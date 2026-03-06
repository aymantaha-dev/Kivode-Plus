import { app } from 'electron';
import { ChildProcess, execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type SandboxTaskStatus = 'pending_approval' | 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface SandboxTaskRequest {
  title: string;
  type: string;
  input: Record<string, any>;
  requiresApproval?: boolean;
  limits?: { timeoutMs?: number; memoryMb?: number };
}

export interface SandboxTaskRecord {
  id: string;
  title: string;
  type: string;
  input: Record<string, any>;
  requiresApproval: boolean;
  limits: { timeoutMs: number; memoryMb: number };
  createdAt: string;
  status: SandboxTaskStatus;
  result?: { stdout: string; stderr: string; summary: string; exitCode: number; artifacts: string[]; data?: any; durationMs?: number };
  logs: string[];
}

interface SandboxEnvironmentStatus {
  ready: boolean;
  pythonPath: string;
  runtimePath: string;
  venvRoot: string;
  details: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const DEFAULT_MEMORY_MB = 256;
const MAX_MEMORY_MB = 512;
const SANDBOX_PACKAGES = ['PyYAML==6.0.3', 'beautifulsoup4==4.12.*', 'toml==0.10.*', 'jedi==0.19.*', 'radon==6.*', 'pygments==2.19.*'];

export class SandboxService {
  private readonly tasks = new Map<string, SandboxTaskRecord>();
  private readonly runningProcesses = new Map<string, ChildProcess>();
  private environmentPromise: Promise<SandboxEnvironmentStatus> | null = null;

  private getPlatformKey() {
    const arch = process.arch;
    if (process.platform === 'win32') return arch === 'arm64' ? 'win32-arm64' : 'win32-x64';
    if (process.platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    if (process.platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    return `${process.platform}-${arch}`;
  }

  private getResourcesPythonRoot() {
    const devRoot = path.join(app.getAppPath(), 'resources', 'python');
    const packagedRoot = path.join(process.resourcesPath, 'python');
    return fs.existsSync(packagedRoot) ? packagedRoot : devRoot;
  }

  private getRuntimePythonPath() {
    const root = this.getResourcesPythonRoot();
    const platformKey = this.getPlatformKey();
    const runtimeBase = path.join(root, 'runtime', platformKey);

    if (process.platform === 'win32') return path.join(runtimeBase, 'python.exe');
    return path.join(runtimeBase, 'bin', 'python3');
  }

  private getVenvRoot() {
    return path.join(app.getPath('userData'), 'python-sandbox', this.getPlatformKey(), 'venv');
  }

  private getVenvPythonPath() {
    const venv = this.getVenvRoot();
    if (process.platform === 'win32') return path.join(venv, 'Scripts', 'python.exe');
    return path.join(venv, 'bin', 'python3');
  }

  private getEnsureScriptPath() {
    return path.join(this.getResourcesPythonRoot(), 'bootstrap', 'ensure_env.py');
  }

  private getRequirementsPath() {
    return path.join(this.getResourcesPythonRoot(), 'requirements.txt');
  }

  private getWheelsDir() {
    return path.join(this.getResourcesPythonRoot(), 'wheels', this.getPlatformKey());
  }

  private resolveRunnerPath() {
    const devPath = path.join(app.getAppPath(), 'src', 'main', 'python', 'sandbox_runner.py');
    const unpackedPath = path.join(process.resourcesPath, 'python', 'sandbox_runner.py');
    return fs.existsSync(unpackedPath) ? unpackedPath : devPath;
  }

  private normalizeLimits(request?: SandboxTaskRequest['limits']) {
    const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(500, request?.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    const memoryMb = Math.min(MAX_MEMORY_MB, Math.max(64, request?.memoryMb ?? DEFAULT_MEMORY_MB));
    return { timeoutMs, memoryMb };
  }

  private getSandboxRoot(workspaceRoot: string) {
    return path.join(workspaceRoot, '.kivode', 'sandbox');
  }

  private appendLog(task: SandboxTaskRecord, message: string) {
    task.logs = [...task.logs.slice(-199), `[${new Date().toISOString()}] ${message}`];
  }

  private ensureBundledRuntimeExists() {
    const runtimePython = this.getRuntimePythonPath();
    if (!fs.existsSync(runtimePython)) {
      throw new Error(`Bundled Python runtime missing at ${runtimePython}. System Python fallback is forbidden.`);
    }
    return runtimePython;
  }

  private execute(pythonPath: string, args: string[], options: { timeout?: number; maxBuffer?: number } = {}) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        pythonPath,
        args,
        {
          timeout: options.timeout ?? 30000,
          maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve({ stdout, stderr });
        }
      );
    });
  }

  async ensureEnvironment(force = false): Promise<SandboxEnvironmentStatus> {
    if (!force && this.environmentPromise) return this.environmentPromise;

    this.environmentPromise = (async () => {
      const runtimePython = this.ensureBundledRuntimeExists();
      const venvPython = this.getVenvPythonPath();

      if (fs.existsSync(venvPython)) {
        return {
          ready: true,
          pythonPath: venvPython,
          runtimePath: runtimePython,
          venvRoot: this.getVenvRoot(),
          details: 'Sandbox environment already initialized',
        };
      }

      const ensureScript = this.getEnsureScriptPath();
      const requirements = this.getRequirementsPath();
      const wheelsDir = this.getWheelsDir();
      if (!fs.existsSync(ensureScript)) throw new Error(`ensure_env.py missing at ${ensureScript}`);
      if (!fs.existsSync(requirements)) throw new Error(`requirements.txt missing at ${requirements}`);
      if (!fs.existsSync(wheelsDir)) throw new Error(`Offline wheels directory missing at ${wheelsDir}`);

      await this.execute(runtimePython, [
        ensureScript,
        '--runtime-python',
        runtimePython,
        '--venv-root',
        this.getVenvRoot(),
        '--requirements',
        requirements,
        '--wheels-dir',
        wheelsDir,
      ], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 });

      if (!fs.existsSync(venvPython)) {
        throw new Error(`Sandbox venv bootstrap did not produce python executable at ${venvPython}`);
      }

      return {
        ready: true,
        pythonPath: venvPython,
        runtimePath: runtimePython,
        venvRoot: this.getVenvRoot(),
        details: 'Sandbox environment bootstrapped from bundled runtime and offline wheels',
      };
    })();

    return this.environmentPromise;
  }

  async queueTask(workspaceRoot: string, payload: SandboxTaskRequest) {
    const task: SandboxTaskRecord = {
      id: randomUUID(),
      title: payload.title,
      type: payload.type,
      input: payload.input || {},
      requiresApproval: payload.requiresApproval !== false,
      limits: this.normalizeLimits(payload.limits),
      createdAt: new Date().toISOString(),
      status: payload.requiresApproval === false ? 'queued' : 'pending_approval',
      logs: [],
    };

    this.appendLog(task, `Task queued with type=${task.type}`);
    this.tasks.set(task.id, task);

    if (!task.requiresApproval) {
      await this.runTask(workspaceRoot, task.id);
    }

    return task;
  }

  async approveTask(workspaceRoot: string, taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'pending_approval') return task;
    task.status = 'queued';
    this.appendLog(task, 'Task approved by user');
    await this.runTask(workspaceRoot, taskId);
    return task;
  }

  cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (['completed', 'failed', 'canceled'].includes(task.status)) return task;
    const runningProcess = this.runningProcesses.get(taskId);
    if (runningProcess && !runningProcess.killed) {
      runningProcess.kill('SIGKILL');
      this.runningProcesses.delete(taskId);
      this.appendLog(task, 'Running process killed by user cancel request');
    }
    task.status = 'canceled';
    this.appendLog(task, 'Task canceled by user');
    return task;
  }

  closeTask(taskId: string) {
    this.tasks.delete(taskId);
    return { ok: true };
  }

  listSessionTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getTaskResult(taskId: string) {
    return this.tasks.get(taskId) || null;
  }

  async indexStatus() {
    const runner = this.resolveRunnerPath();
    try {
      const env = await this.ensureEnvironment();
      const version = await this.execute(env.pythonPath, ['--version'], { timeout: 4000 });
      return {
        available: fs.existsSync(runner),
        version: (version.stdout || version.stderr).trim(),
        runner,
        mode: 'sandboxed',
        packages: SANDBOX_PACKAGES,
        pythonPath: env.pythonPath,
        runtimePath: env.runtimePath,
      };
    } catch (error: any) {
      return {
        available: false,
        runner,
        mode: 'sandboxed',
        packages: SANDBOX_PACKAGES,
        error: error?.message || 'Sandbox environment unavailable',
        pythonPath: this.getVenvPythonPath(),
        runtimePath: this.getRuntimePythonPath(),
      };
    }
  }


  private createTaskInputFile(sandboxRoot: string, task: SandboxTaskRecord) {
    const taskDir = path.join(sandboxRoot, 'tasks', task.id);
    fs.mkdirSync(taskDir, { recursive: true });
    const inputFile = path.join(taskDir, 'input.json');
    fs.writeFileSync(inputFile, JSON.stringify(task.input), { encoding: 'utf-8' });
    return inputFile;
  }

  private isSystemPythonPath(pythonPath: string, env: SandboxEnvironmentStatus) {
    const normalized = path.resolve(pythonPath);
    const allowed = new Set([path.resolve(env.pythonPath), path.resolve(env.runtimePath)]);
    if (allowed.has(normalized)) return false;

    if (process.platform === 'win32') {
      return /\\Python\d{2,3}\\python\.exe$/i.test(normalized) || normalized.includes('WindowsApps');
    }

    return normalized.startsWith('/usr/bin/') || normalized.startsWith('/usr/local/bin/');
  }

  private extractRunnerJson(stdout: string) {
    const trimmed = stdout.trim();
    if (!trimmed) return {};

    try {
      return JSON.parse(trimmed);
    } catch {
      const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (!(line.startsWith('{') || line.startsWith('['))) continue;
        try {
          return JSON.parse(line);
        } catch {
          continue;
        }
      }
      throw new Error('Sandbox runner returned non-JSON output');
    }
  }

  private runRunnerProcess(pythonPath: string, args: string[], timeoutMs: number, taskId: string) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(pythonPath, args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.runningProcesses.set(taskId, child);

      let stdout = '';
      let stderr = '';
      const maxBytes = 220 * 1024;

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
        if (Buffer.byteLength(stdout, 'utf-8') > maxBytes) {
          stdout = stdout.slice(-maxBytes);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
        if (Buffer.byteLength(stderr, 'utf-8') > maxBytes) {
          stderr = stderr.slice(-maxBytes);
        }
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(taskId);
        reject(error);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(taskId);
        if (signal) {
          reject(new Error(`Sandbox runner terminated by signal ${signal}`));
          return;
        }
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(stderr || `Sandbox runner exited with code ${code}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  private async runTask(workspaceRoot: string, taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'canceled') return;

    const runner = this.resolveRunnerPath();
    if (!fs.existsSync(runner)) {
      task.status = 'failed';
      task.result = { stdout: '', stderr: 'sandbox_runner.py not found', summary: 'Sandbox runner missing', exitCode: 1, artifacts: [] };
      return;
    }

    const sandboxRoot = this.getSandboxRoot(workspaceRoot);
    fs.mkdirSync(sandboxRoot, { recursive: true });

    task.status = 'running';
    this.appendLog(task, `Running with timeout=${task.limits.timeoutMs}ms memory=${task.limits.memoryMb}MB`);
    const startedAt = Date.now();

    let inputFilePath = '';
    try {
      const env = await this.ensureEnvironment();
      this.appendLog(task, `Using bundled python: ${env.pythonPath}`);

      if (this.isSystemPythonPath(env.pythonPath, env)) {
        throw new Error('Detected system python path. Fallback is forbidden by sandbox policy.');
      }

      inputFilePath = this.createTaskInputFile(sandboxRoot, task);
      this.appendLog(task, `Payload transport: --input-file ${inputFilePath}`);
      // TODO: move payload transport to --input-stdin after stream hardening.

      const output = await this.runRunnerProcess(
        env.pythonPath,
        [runner, '--task', task.type, '--workspace', workspaceRoot, '--sandbox-root', sandboxRoot, '--input-file', inputFilePath, '--memory-mb', String(task.limits.memoryMb)],
        task.limits.timeoutMs,
        task.id
      );

      if (this.tasks.get(task.id)?.status === 'canceled') {
        this.appendLog(task, 'Task result ignored because it was canceled');
        return;
      }

      const parsed = this.extractRunnerJson(output.stdout);
      const durationMs = Date.now() - startedAt;
      task.result = {
        stdout: parsed.stdout || '',
        stderr: parsed.stderr || output.stderr || '',
        summary: parsed.summary || (parsed.ok ? 'Task completed' : 'Task failed'),
        exitCode: parsed.ok ? 0 : 1,
        artifacts: parsed.artifacts || [],
        data: {
          ...(parsed.data || {}),
          security: parsed.security,
        },
        durationMs,
      };
      task.status = parsed.ok ? 'completed' : 'failed';
      this.appendLog(task, `Task finished with status=${task.status} duration=${durationMs}ms`);
    } catch (error: any) {
      if (this.tasks.get(task.id)?.status === 'canceled') return;
      const stderr = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
      task.result = { stdout: '', stderr, summary: 'Sandbox execution failed', exitCode: 1, artifacts: [] };
      task.status = 'failed';
      this.appendLog(task, `Task failed: ${stderr}`);
    } finally {
      this.runningProcesses.delete(task.id);
      if (inputFilePath) {
        try {
          fs.unlinkSync(inputFilePath);
        } catch (cleanupError: any) {
          this.appendLog(task, `Input cleanup warning: ${cleanupError?.message || 'unknown error'}`);
        }
      }
    }
  }
}
