import { spawn } from 'child_process';
import path from 'path';
import { PythonEnvService } from './PythonEnvService';
import { parseCommand } from '../security/command-policy';

export type TaskEvent =
  | { type: 'task_started'; taskId: string; goal: string; createdAt: string }
  | { type: 'log'; taskId: string; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'plan'; taskId: string; steps: PlanStep[] }
  | { type: 'context_used'; taskId: string; items: ContextItem[] }
  | { type: 'proposed_diff'; taskId: string; diffId: string; patch: string; summary: string; files: string[] }
  | { type: 'needs_approval'; taskId: string; approvalId: string; scope: ApprovalScope; preview?: any }
  | { type: 'patch_applied'; taskId: string; diffId: string; result: ApplyResult }
  | { type: 'command_started'; taskId: string; commandId: string; cmd: string; cwd: string }
  | { type: 'command_finished'; taskId: string; commandId: string; exitCode: number; stdout: string; stderr: string }
  | { type: 'validation'; taskId: string; ok: boolean; summary: string; diagnostics?: Diagnostic[] }
  | { type: 'task_finished'; taskId: string; ok: boolean; finalSummary: string };

export interface PlanStep {
  id: string;
  goal: string;
  tools: string[];
}

export interface ContextItem {
  kind: 'project_map' | 'search' | 'symbol' | 'file';
  ref: string;
  note?: string;
}

export type ApprovalScope =
  | { kind: 'apply_diff'; diffId: string; files: string[] }
  | { kind: 'run_command'; cmd: string; cwd: string; reason: 'validate' | 'install' | 'custom' }
  | { kind: 'outside_workspace_access'; path: string; op: 'read' | 'write' | 'delete' }
  | { kind: 'network_access'; host?: string; reason: string };

export type ApprovalResponse =
  | { decision: 'approve_once' }
  | { decision: 'approve_session' }
  | { decision: 'reject'; note?: string }
  | { decision: 'edit_then_continue'; editedPatch: string };

export interface ApplyResult {
  ok: boolean;
  file?: string;
  patchStrategy?: string;
  error?: string;
}

export interface Diagnostic {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface TaskStartParams {
  goal: string;
  workspaceRoot: string;
  mode?: 'task';
  diff?: {
    file: string;
    patch: string;
    summary: string;
    files?: string[];
  };
  validateCommands?: string[];
}

interface PendingApproval {
  id: string;
  resolve: (value: ApprovalResponse) => void;
}

interface TaskState {
  id: string;
  goal: string;
  workspaceRoot: string;
  cancelled: boolean;
  pendingApproval: PendingApproval | null;
  sessionApprovals: Set<string>;
}

const SAFE_COMMANDS = [
  /^python\s+-m\s+compileall\s+\.\s*$/i,
  /^pytest\s+-q\s*$/i,
  /^ruff\s+check\s+\.\s*$/i,
  /^black\s+\.\s*$/i,
  /^node\s+--version\s*$/i,
];

export class TaskEngineService {
  private readonly pythonEnvService: PythonEnvService;
  private readonly emitEvent: (event: TaskEvent) => void;
  private readonly tasks = new Map<string, TaskState>();

  constructor(pythonEnvService: PythonEnvService, emitEvent: (event: TaskEvent) => void) {
    this.pythonEnvService = pythonEnvService;
    this.emitEvent = emitEvent;
  }

  startTask(params: TaskStartParams): { taskId: string } {
    const taskId = `task-${Date.now()}`;
    const state: TaskState = {
      id: taskId,
      goal: params.goal,
      workspaceRoot: params.workspaceRoot,
      cancelled: false,
      pendingApproval: null,
      sessionApprovals: new Set<string>(),
    };
    this.tasks.set(taskId, state);
    void this.runTask(state, params);
    return { taskId };
  }

  approveTask(taskId: string, approvalId: string, response: ApprovalResponse): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (!task.pendingApproval || task.pendingApproval.id !== approvalId) {
      throw new Error('Approval is not pending for this task');
    }
    const pending = task.pendingApproval;
    task.pendingApproval = null;
    pending.resolve(response);
  }

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.cancelled = true;
    if (task.pendingApproval) {
      task.pendingApproval.resolve({ decision: 'reject', note: 'Cancelled by user' });
      task.pendingApproval = null;
    }
  }

  private async runTask(task: TaskState, params: TaskStartParams): Promise<void> {
    this.emitEvent({ type: 'task_started', taskId: task.id, goal: task.goal, createdAt: new Date().toISOString() });
    this.emitEvent({
      type: 'plan',
      taskId: task.id,
      steps: [
        { id: 's1', goal: 'Build project map and context', tools: ['analyze_project', 'smart_search'] },
        { id: 's2', goal: 'Propose minimal patch and wait for approval', tools: ['proposed_diff', 'needs_approval'] },
        { id: 's3', goal: 'Apply patch, validate with commands', tools: ['apply_patch', 'run_command', 'validate'] },
      ],
    });

    try {
      const projectMap = await this.pythonEnvService.execute(task.workspaceRoot, { action: 'analyze_project' });
      if (projectMap?.ok) {
        const indexed = Array.isArray(projectMap.index) ? projectMap.index.length : 0;
        this.emitEvent({ type: 'log', taskId: task.id, level: 'info', message: `Indexed ${indexed} files for this task.` });
        this.emitEvent({
          type: 'context_used',
          taskId: task.id,
          items: [{ kind: 'project_map', ref: task.workspaceRoot, note: `Indexed ${indexed} files` }],
        });
      }

      if (params.diff) {
        const diffId = `diff-${Date.now()}`;
        const files = params.diff.files?.length ? params.diff.files : [params.diff.file];
        const patchError = this.validatePatchPayload(params.diff.patch);
        if (patchError) {
          this.emitEvent({ type: 'log', taskId: task.id, level: 'error', message: patchError });
          this.emitEvent({ type: 'task_finished', taskId: task.id, ok: false, finalSummary: patchError });
          return;
        }

        this.emitEvent({
          type: 'proposed_diff',
          taskId: task.id,
          diffId,
          patch: params.diff.patch,
          summary: params.diff.summary,
          files,
        });

        const approval = await this.requestApproval(task, {
          kind: 'apply_diff',
          diffId,
          files,
        }, {
          patchPreview: params.diff.patch.slice(0, 4000),
        });

        if (approval.decision === 'reject') {
          this.emitEvent({ type: 'task_finished', taskId: task.id, ok: false, finalSummary: approval.note || 'Diff rejected by user' });
          return;
        }

        const patchToApply = approval.decision === 'edit_then_continue' ? approval.editedPatch : params.diff.patch;
        const applyResult = await this.pythonEnvService.execute(task.workspaceRoot, {
          action: 'apply_patch',
          file: params.diff.file,
          patch: patchToApply,
        });

        this.emitEvent({
          type: 'patch_applied',
          taskId: task.id,
          diffId,
          result: {
            ok: !!applyResult?.ok,
            file: applyResult?.file,
            patchStrategy: applyResult?.patchStrategy,
            error: applyResult?.error,
          },
        });

        if (!applyResult?.ok) {
          this.emitEvent({
            type: 'task_finished',
            taskId: task.id,
            ok: false,
            finalSummary: applyResult?.error || 'Patch failed to apply',
          });
          return;
        }
      }

      const commands = params.validateCommands || ['python -m compileall .'];
      const diagnostics: Diagnostic[] = [];
      for (const cmd of commands) {
        if (task.cancelled) {
          this.emitEvent({ type: 'task_finished', taskId: task.id, ok: false, finalSummary: 'Task cancelled' });
          return;
        }

        const policy = this.classifyCommand(cmd, task.workspaceRoot);
        if (policy.requiresApproval) {
          const approval = await this.requestApproval(task, {
            kind: 'run_command',
            cmd,
            cwd: task.workspaceRoot,
            reason: policy.reason,
          });
          if (approval.decision === 'reject') {
            diagnostics.push({ level: 'warning', message: `Command rejected: ${cmd}` });
            continue;
          }
          if (approval.decision === 'approve_session') {
            task.sessionApprovals.add(`run_command:${cmd}`);
          }
        }

        const commandId = `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.emitEvent({ type: 'command_started', taskId: task.id, commandId, cmd, cwd: task.workspaceRoot });
        const result = await this.runCommand(cmd, task.workspaceRoot);
        this.emitEvent({
          type: 'command_finished',
          taskId: task.id,
          commandId,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });

        if (result.exitCode !== 0) {
          diagnostics.push({ level: 'error', message: `Command failed: ${cmd}` });
        }
      }

      const ok = diagnostics.every((d) => d.level !== 'error');
      this.emitEvent({
        type: 'validation',
        taskId: task.id,
        ok,
        summary: ok ? 'Validation checks passed.' : 'Validation checks completed with errors.',
        diagnostics,
      });
      this.emitEvent({
        type: 'task_finished',
        taskId: task.id,
        ok,
        finalSummary: ok ? 'Task completed successfully' : 'Task completed with validation issues',
      });
    } catch (error: any) {
      this.emitEvent({
        type: 'task_finished',
        taskId: task.id,
        ok: false,
        finalSummary: error?.message || 'Task failed unexpectedly',
      });
    } finally {
      this.tasks.delete(task.id);
    }
  }

  private validatePatchPayload(patch: string): string | null {
    const text = String(patch || '').trim();
    if (!text) return 'Patch is empty.';
    if (text.includes('```')) return 'Patch pre-check failed: fenced markdown is not allowed in patch payload.';
    const headerOk = text.includes('@@') && (text.includes('--- ') || text.includes('+++ '));
    if (!headerOk) {
      return 'Patch pre-check failed: patch must include unified diff markers (---, +++, @@).';
    }
    const lower = text.toLowerCase();
    const disallowed = ['git clone', 'npm i ', 'npm install', 'pnpm add', 'pip install', 'curl ', 'wget '];
    if (disallowed.some((token) => lower.includes(token))) {
      return 'Patch pre-check failed: command-like lines detected in patch body.';
    }
    return null;
  }

  private classifyCommand(cmd: string, workspaceRoot: string): { requiresApproval: boolean; reason: 'validate' | 'install' | 'custom' } {
    if (SAFE_COMMANDS.some((regex) => regex.test(cmd))) {
      return { requiresApproval: false, reason: 'validate' };
    }

    const lower = cmd.toLowerCase();
    const needsInstallApproval = /(pip\s+install|npm\s+i\b|npm\s+install|pnpm\s+add|yarn\s+add)/.test(lower);
    const hasNetworkHints = /(curl\b|wget\b|https?:\/\/)/.test(lower);
    if (needsInstallApproval || hasNetworkHints || !this.isWorkspacePathAllowed(workspaceRoot, workspaceRoot)) {
      return { requiresApproval: true, reason: needsInstallApproval ? 'install' : 'custom' };
    }

    return { requiresApproval: true, reason: 'custom' };
  }

  private isWorkspacePathAllowed(workspaceRoot: string, targetPath: string): boolean {
    const normalizedRoot = path.resolve(workspaceRoot);
    const normalizedTarget = path.resolve(targetPath);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
  }

  private async requestApproval(task: TaskState, scope: ApprovalScope, preview?: any): Promise<ApprovalResponse> {
    if (scope.kind === 'run_command' && task.sessionApprovals.has(`run_command:${scope.cmd}`)) {
      return { decision: 'approve_once' };
    }

    return new Promise<ApprovalResponse>((resolve) => {
      const approvalId = `approval-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      task.pendingApproval = { id: approvalId, resolve };
      this.emitEvent({
        type: 'needs_approval',
        taskId: task.id,
        approvalId,
        scope,
        preview,
      });
    });
  }

  private runCommand(cmd: string, cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let parsed;
      try {
        parsed = parseCommand(cmd);
      } catch (error: any) {
        resolve({ exitCode: 1, stdout: '', stderr: error.message || 'Invalid command' });
        return;
      }

      const child = spawn(parsed.command, parsed.args, {
        cwd,
        shell: false,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 30_000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout: stdout.slice(0, 20000), stderr: stderr.slice(0, 20000) });
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ exitCode: 1, stdout, stderr: `${stderr}
${error.message}`.trim() });
      });
    });
  }
}

