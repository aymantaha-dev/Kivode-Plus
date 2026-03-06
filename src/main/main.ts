// src/main/main.ts

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import axios from 'axios';
import { FileManager } from './services/FileManager';
import { AIManager, AIError } from './services/AIManager';
import { GitHubManager } from './services/GitHubManager';
import { ProjectAnalyzer } from './services/ProjectAnalyzer';
import { StoreManager, VALID_PROVIDERS, ApiProvider } from './services/StoreManager';
import { PythonEnvService } from './services/PythonEnvService';
import { TaskEngineService, ApprovalResponse } from './services/TaskEngineService';
import { SandboxService } from './services/SandboxService';
import { FilesystemPolicy } from './security/filesystem-policy';
import { validateUpdateUrl } from './security/update-policy';

// ==================== GLOBAL VARIABLES ====================
let mainWindow: BrowserWindow | null = null;
let fileManager: FileManager;
let aiManager: AIManager;
let gitHubManager: GitHubManager;
let projectAnalyzer: ProjectAnalyzer;
let storeManager: StoreManager;
let pythonEnvService: PythonEnvService;
let taskEngineService: TaskEngineService;
let sandboxService: SandboxService;
let filesystemPolicy: FilesystemPolicy;

const isDev = process.argv.includes('--dev');

// ==================== SECURITY ====================
if (!isDev) {
  app.commandLine.appendSwitch('js-flags', '--noexpose_wasm,--jitless');
  app.commandLine.appendSwitch('disable-features', 'DevTools');
  app.commandLine.appendSwitch('remote-debugging-port', '0');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

const CSP_POLICY = [
  "default-src 'self'",
  isDev 
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  isDev 
    ? "connect-src 'self' ws://localhost:* http://localhost:* https://api.github.com https://raw.githubusercontent.com https://api.openai.com https://api.anthropic.com https://api.moonshot.cn https://api.deepseek.com https://generativelanguage.googleapis.com"
    : "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://api.openai.com https://api.anthropic.com https://api.moonshot.cn https://api.deepseek.com https://generativelanguage.googleapis.com",
  "media-src 'self'",
  "object-src 'none'",
  "child-src 'none'",
  "frame-src 'self' blob: data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join('; ');

// ==================== WINDOW CREATION ====================
function createWindow(): void {
  if (!isDev && (process.env.NODE_OPTIONS?.includes('--inspect') || process.argv.some(arg => arg.includes('--inspect')))) {
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    title: 'Kivode+',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      spellcheck: false,
      webSecurity: true,
      textAreasAreResizable: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      autoplayPolicy: 'user-gesture-required',
      backgroundThrottling: true,
      offscreen: false,
      safeDialogs: true,
      safeDialogsMessage: 'This action is not allowed',
    },
  });

  Menu.setApplicationMenu(null);

  const winSession = mainWindow.webContents.session;

  winSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
        'Permissions-Policy': [
          'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
        ].join(', '),
      }
    });
  });

  winSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = new URL(details.url);
    const allowedProtocols = ['file:', 'data:', 'blob:'];

    if (!allowedProtocols.includes(url.protocol)) {
      if (details.resourceType === 'mainFrame') {
        shell.openExternal(details.url);
      }
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });

  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
      const devToolsShortcuts = [
        'F12', 'CmdOrCtrl+Shift+I', 'CmdOrCtrl+Shift+J', 'CmdOrCtrl+Shift+C',
        'CmdOrCtrl+Alt+I', 'CmdOrCtrl+Alt+J', 'CmdOrCtrl+Alt+C', 'Shift+F10',
      ];
      const shortcut = `${input.control ? 'Ctrl+' : ''}${input.shift ? 'Shift+' : ''}${input.alt ? 'Alt+' : ''}${input.key}`;
      if (devToolsShortcuts.includes(shortcut) || devToolsShortcuts.includes(input.key)) {
        event.preventDefault();
      }
    });

    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'null' && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== SERVICES ====================
function initializeServices(): void {
  storeManager = new StoreManager();
  filesystemPolicy = new FilesystemPolicy();
  fileManager = new FileManager((targetPath) => filesystemPolicy.assertAllowed(targetPath));
  aiManager = new AIManager(storeManager);
  gitHubManager = new GitHubManager();
  projectAnalyzer = new ProjectAnalyzer();
  pythonEnvService = new PythonEnvService();
  taskEngineService = new TaskEngineService(pythonEnvService, (event) => {
    mainWindow?.webContents.send('task:event', event);
  });
  sandboxService = new SandboxService();
}

// ==================== IPC HANDLERS ====================
function setupIPCHandlers(): void {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // File operations
  ipcMain.handle('file:openDialog', async () => {
    return await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
  });

  ipcMain.handle('file:selectFolder', async () => {
    return await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
  });

  ipcMain.handle('file:extractZip', async (_, zipPath: string, extractPath?: string) => {
    if (!isPathAllowed(zipPath)) throw new Error('Access denied: Path not allowed');
    return fileManager.extractZip(zipPath, extractPath);
  });

  ipcMain.handle('file:readFile', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    return fileManager.readFile(filePath);
  });

  ipcMain.handle('file:writeFile', async (_, filePath: string, content: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    if (content.length > 50 * 1024 * 1024) throw new Error('File too large');
    return fileManager.writeFile(filePath, content);
  });

  ipcMain.handle('file:readDirectory', async (_, dirPath: string) => {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: Path not allowed');
    return fileManager.readDirectory(dirPath);
  });

  ipcMain.handle('file:createDirectory', async (_, dirPath: string) => {
    if (!isPathAllowed(dirPath)) throw new Error('Access denied: Path not allowed');
    return fileManager.createDirectory(dirPath);
  });

  ipcMain.handle('file:deleteFile', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    const criticalPaths = ['System32', 'Windows', 'Program Files', 'ProgramData'];
    if (criticalPaths.some(cp => filePath.toLowerCase().includes(cp.toLowerCase()))) {
      throw new Error('Cannot delete system files');
    }
    return fileManager.deleteFile(filePath);
  });

  ipcMain.handle('file:renameFile', async (_, oldPath: string, newPath: string) => {
    if (!isPathAllowed(oldPath) || !isPathAllowed(newPath)) {
      throw new Error('Access denied: Path not allowed');
    }
    return fileManager.renameFile(oldPath, newPath);
  });

  ipcMain.handle('file:createZip', async (_, sourcePath: string, outputPath: string) => {
    if (!isPathAllowed(sourcePath) || !isPathAllowed(outputPath)) {
      throw new Error('Access denied: Path not allowed');
    }
    return fileManager.createZip(sourcePath, outputPath);
  });

  ipcMain.handle('file:saveDialog', async (_, options: any) => {
    return await dialog.showSaveDialog(mainWindow!, options);
  });

  ipcMain.handle('file:saveAllFiles', async (_, files: Array<{ path: string; content: string }>) => {
    const results = [];
    for (const file of files) {
      try {
        if (!isPathAllowed(file.path)) {
          results.push({ path: file.path, success: false, error: 'Path not allowed' });
          continue;
        }
        await fileManager.writeFile(file.path, file.content);
        results.push({ path: file.path, success: true });
      } catch (error: any) {
        results.push({ path: file.path, success: false, error: error.message });
      }
    }
    return results;
  });

  // GitHub - Basic Operations
  ipcMain.handle('github:clone', async (_, url: string, targetPath: string) => {
    if (!isPathAllowed(targetPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.cloneRepository(url, targetPath);
  });

  ipcMain.handle('github:validateUrl', async (_, url: string) => {
    return gitHubManager.validateUrl(url);
  });

  // GitHub Auth & Repository Management
  ipcMain.handle('github:setAccessToken', async (_, token: string) => {
    if (!token || token.length < 10) throw new Error('Invalid token');
    return gitHubManager.setAccessToken(token);
  });

  ipcMain.handle('github:isAuthenticated', async () => {
    return gitHubManager.isAuthenticated();
  });

  ipcMain.handle('github:getUser', async () => {
    return gitHubManager.getCurrentUser();
  });

  ipcMain.handle('github:getAuthStatus', async () => {
    return gitHubManager.getAuthStatus();
  });

  ipcMain.handle('github:logout', async () => {
    return gitHubManager.logout();
  });

  ipcMain.handle('github:getRepositories', async () => {
    return gitHubManager.getRepositories();
  });

  ipcMain.handle('github:getRepository', async (_, owner: string, repo: string) => {
    return gitHubManager.getRepository(owner, repo);
  });

  ipcMain.handle('github:analyzeRepository', async (_, owner: string, repo: string) => {
    return gitHubManager.analyzeRepository(owner, repo);
  });


  ipcMain.handle('github:getRepositoryReadme', async (_, owner: string, repo: string) => {
    return gitHubManager.getRepositoryReadme(owner, repo);
  });

  // Safe Editing Session
  ipcMain.handle('github:startEditingSession', async (_, owner: string, repo: string) => {
    return gitHubManager.startEditingSession(owner, repo);
  });

  ipcMain.handle('github:getCurrentSession', async () => {
    return gitHubManager.getCurrentSession();
  });

  ipcMain.handle('github:checkSyncStatus', async () => {
    return gitHubManager.checkSyncStatus();
  });

  ipcMain.handle('github:saveChanges', async (_, message?: string) => {
    return gitHubManager.saveChanges(message);
  });

  // Publish to GitHub
  ipcMain.handle('github:publishRepository', async (_, name: string, description: string, isPrivate: boolean, localPath: string, options?: any) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.publishRepository(name, description, isPrivate, localPath, options);
  });

  ipcMain.handle('github:getLocalRepositoryTarget', async (_, localPath: string) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.getLocalRepositoryTarget(localPath);
  });


  ipcMain.handle('github:getWorkspaceStatus', async (_, localPath: string) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.getWorkspaceStatus(localPath);
  });

  ipcMain.handle('github:createBranch', async (_, localPath: string, branchName: string, checkout = true) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.createLocalBranch(localPath, branchName, checkout);
  });

  ipcMain.handle('github:mergeBranches', async (_, localPath: string, sourceBranch: string, targetBranch: string) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.mergeLocalBranches(localPath, sourceBranch, targetBranch);
  });

  ipcMain.handle('github:createPullRequestFromLocal', async (
    _,
    localPath: string,
    base: string,
    head: string,
    title: string,
    body?: string,
  ) => {
    if (!isPathAllowed(localPath)) throw new Error('Access denied: Path not allowed');
    return gitHubManager.createPullRequestFromLocal(localPath, base, head, title, body);
  });

  // AI Operations
  ipcMain.handle('ai:generateCode', async (_, params: any) => {
    try {
      return await aiManager.generateCode(params);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:modifyCode', async (_, params: any) => {
    try {
      return await aiManager.modifyCode(params);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:reviewCode', async (_, params: any) => {
    try {
      return await aiManager.reviewCode(params);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:generateProject', async (_, params: any) => {
    try {
      return await aiManager.generateProject(params);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:explainCode', async (_, params: any) => {
    try {
      return await aiManager.explainCode(params);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:getModels', async () => {
    return aiManager.getAvailableModels();
  });

  ipcMain.handle('ai:validateApiKey', async (_, model: string, apiKey: string) => {
    if (!apiKey || apiKey.length < 10) return false;
    try {
      return await aiManager.validateApiKey(model, apiKey);
    } catch (error) {
      if (error instanceof AIError) {
        throw new Error(`[${error.code}] ${error.message}`);
      }
      throw error;
    }
  });

  ipcMain.handle('ai:getPythonEnvStatus', async () => {
    return pythonEnvService.status();
  });

  ipcMain.handle('ai:inspectWithPythonEnv', async (_, projectPath: string, query: string) => {
    if (!isPathAllowed(projectPath)) throw new Error('Access denied: Path not allowed');
    return pythonEnvService.inspectProject(projectPath, query);
  });


  ipcMain.handle('ai:pythonExecute', async (_, projectPath: string, payload: any) => {
    if (!isPathAllowed(projectPath)) throw new Error('Access denied: Path not allowed');
    return pythonEnvService.execute(projectPath, payload);
  });

  ipcMain.handle('ai:cancelRequest', async (_, requestId: string) => {
    return { ok: aiManager.cancelRequest(requestId) };
  });

  ipcMain.handle('ai:startChatStream', async (event, params: any) => {
    const target = event.sender;
    void aiManager.streamExplainCode(params, (streamEvent) => {
      if (!target.isDestroyed()) {
        target.send('ai:chatStreamEvent', streamEvent);
      }
    }).catch(() => {
      // stream errors are emitted through ai:chatStreamEvent
    });

    return { ok: true, requestId: params?.requestId };
  });

  ipcMain.handle('sandbox:indexStatus', async () => {
    return sandboxService.indexStatus();
  });

  ipcMain.handle('sandbox:ensureEnvironment', async (_, force = false) => {
    return sandboxService.ensureEnvironment(Boolean(force));
  });

  ipcMain.handle('sandbox:queueTask', async (_, workspaceRoot: string, payload: any) => {
    if (!isPathAllowed(workspaceRoot)) throw new Error('Access denied: workspace path not allowed');
    return sandboxService.queueTask(workspaceRoot, payload);
  });

  ipcMain.handle('sandbox:approveTask', async (_, workspaceRoot: string, taskId: string) => {
    if (!isPathAllowed(workspaceRoot)) throw new Error('Access denied: workspace path not allowed');
    return sandboxService.approveTask(workspaceRoot, taskId);
  });

  ipcMain.handle('sandbox:cancelTask', async (_, taskId: string) => {
    return sandboxService.cancelTask(taskId);
  });

  ipcMain.handle('sandbox:getTaskResult', async (_, taskId: string) => {
    return sandboxService.getTaskResult(taskId);
  });

  ipcMain.handle('sandbox:listSessionTasks', async () => {
    return sandboxService.listSessionTasks();
  });

  ipcMain.handle('sandbox:closeTask', async (_, taskId: string) => {
    return sandboxService.closeTask(taskId);
  });


  ipcMain.handle('task:start', async (_, params: any) => {
    if (!params?.workspaceRoot || !isPathAllowed(params.workspaceRoot)) {
      throw new Error('Access denied: workspace path not allowed');
    }
    return taskEngineService.startTask(params);
  });

  ipcMain.handle('task:approve', async (_, payload: { taskId: string; approvalId: string; response: ApprovalResponse }) => {
    taskEngineService.approveTask(payload.taskId, payload.approvalId, payload.response);
    return { ok: true };
  });

  ipcMain.handle('task:cancel', async (_, taskId: string) => {
    taskEngineService.cancelTask(taskId);
    return { ok: true };
  });

  // Project
  ipcMain.handle('project:analyze', async (_, projectPath: string) => {
    if (!isPathAllowed(projectPath)) throw new Error('Access denied: Path not allowed');
    return projectAnalyzer.analyze(projectPath);
  });

  ipcMain.handle('project:getMetrics', async (_, projectPath: string) => {
    if (!isPathAllowed(projectPath)) throw new Error('Access denied: Path not allowed');
    return projectAnalyzer.getMetrics(projectPath);
  });

  ipcMain.handle('project:getDependencies', async (_, projectPath: string) => {
    if (!isPathAllowed(projectPath)) throw new Error('Access denied: Path not allowed');
    return projectAnalyzer.getDependencies(projectPath);
  });

  ipcMain.handle('project:exportProject', async (_, data: {
    sourcePath: string;
    exportPath: string;
    modifiedFiles: Array<{ path: string; content: string; relativePath: string }>;
  }) => {
    try {
      if (!isPathAllowed(data.sourcePath)) throw new Error('Access denied: Source path not allowed');
      if (!isPathAllowed(data.exportPath)) throw new Error('Access denied: Export path not allowed');

      if (!fs.existsSync(data.sourcePath)) throw new Error('Source path does not exist');

      if (!fs.existsSync(data.exportPath)) {
        fs.mkdirSync(data.exportPath, { recursive: true });
      }

      await copyDirectory(data.sourcePath, data.exportPath);

      for (const file of data.modifiedFiles) {
        const targetPath = path.join(data.exportPath, file.relativePath);
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        fs.writeFileSync(targetPath, file.content, 'utf-8');
      }

      return { success: true, exportPath: data.exportPath };
    } catch (error: any) {
      console.error('Export project error:', error);
      throw new Error(`Failed to export project: ${error.message}`);
    }
  });

  // ✅ STORE -   
  const isValidStoreKey = (key: string): boolean => {
    //    
    const allowedKeys = [
      'theme',
      'settings',
      'selectedModel',
      'recentProjects',
      'windowState',
      'chatSessions',
      'promptHistory',
    ];
    
    if (allowedKeys.includes(key)) return true;
    
    // ✅  apiKey.*
    if (key.startsWith('apiKey.')) {
      const provider = key.replace('apiKey.', '') as ApiProvider;
      return VALID_PROVIDERS.includes(provider);
    }
    
    // ✅  settings.*
    if (key.startsWith('settings.')) return true;
    
    return false;
  };

  // ✅  Store 
  ipcMain.handle('store:get', async (_, key: string) => {
    if (!isValidStoreKey(key)) {
      throw new Error(`Invalid store key: ${key}`);
    }
    if (key.startsWith('apiKey.')) {
      return null;
    }
    return storeManager.get(key as any);
  });

  ipcMain.handle('store:set', async (_, key: string, value: any) => {
    if (!isValidStoreKey(key)) {
      throw new Error(`Invalid store key: ${key}`);
    }
    const valueStr = JSON.stringify(value);
    if (valueStr.length > 10 * 1024 * 1024) throw new Error('Value too large');
    return storeManager.set(key as any, value);
  });

  ipcMain.handle('store:delete', async (_, key: string) => {
    if (!isValidStoreKey(key)) {
      throw new Error(`Invalid store key: ${key}`);
    }
    return storeManager.delete(key as any);
  });

  ipcMain.handle('store:getAll', async () => {
    const all = storeManager.getAll();
    for (const provider of VALID_PROVIDERS) {
      (all as any)[`apiKey.${provider}`] = undefined;
    }
    return all;
  });

  // ✅  API Keys  ( )
  ipcMain.handle('store:setApiKey', async (_, provider: ApiProvider, apiKey: string) => {
    try {
      storeManager.setApiKey(provider, apiKey);
      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to set API key: ${error.message}`);
    }
  });

  ipcMain.handle('store:getApiKey', async (_: unknown, _provider: ApiProvider) => {
    return null;
  });

  ipcMain.handle('store:deleteApiKey', async (_, provider: ApiProvider) => {
    try {
      storeManager.deleteApiKey(provider);
      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
  });

  ipcMain.handle('store:hasApiKey', async (_, provider: ApiProvider) => {
    return storeManager.hasApiKey(provider);
  });

  ipcMain.handle('store:getAllApiKeys', async () => {
    return storeManager.getAllApiKeys();
  });

  // Drag & Drop
  ipcMain.handle('drag:handleDrop', async (_, filePaths: string[]) => {
    const results = [];

    for (const filePath of filePaths) {
      try {
        if (!isPathAllowed(filePath)) {
          console.warn('Access denied for path:', filePath);
          continue;
        }

        const stat = fs.statSync(filePath);

        if (filePath.toLowerCase().endsWith('.zip')) {
          console.log('Processing ZIP file:', filePath);

          const tempDir = path.join(app.getPath('temp'), 'kivode-extracted', path.basename(filePath, '.zip') + '-' + Date.now());
          fs.mkdirSync(tempDir, { recursive: true });

          const extractPath = await fileManager.extractZip(filePath, tempDir);

          const tree = fileManager.readDirectory(extractPath);

          results.push({
            type: 'zip',
            path: filePath,
            extractPath: extractPath,
            tree: tree,
            name: path.basename(filePath, '.zip')
          });

        } else if (stat.isDirectory()) {
          const tree = fileManager.readDirectory(filePath);
          results.push({
            type: 'folder',
            path: filePath,
            tree: tree,
            name: path.basename(filePath)
          });
        }

      } catch (error: any) {
        console.error('Error processing dropped file:', filePath, error.message);
        results.push({
          type: 'error',
          path: filePath,
          error: error.message
        });
      }
    }

    return results;
  });

  // App info
  ipcMain.handle('app:getVersion', async () => app.getVersion());

  ipcMain.handle('app:getPath', async (_, name: string) => {
    const allowedPaths = ['home', 'appData', 'userData', 'temp', 'documents', 'downloads'];
    if (!allowedPaths.includes(name)) throw new Error('Invalid path name');
    return app.getPath(name as any);
  });

  // Shell

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs are allowed');
    }

    await shell.openExternal(parsed.toString());
    return true;
  });

  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    return shell.openPath(filePath);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    return shell.showItemInFolder(filePath);
  });

  ipcMain.handle('shell:openInChrome', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) throw new Error('Access denied: Path not allowed');
    const normalized = path.normalize(filePath);

    if (process.platform === 'win32') {
      return new Promise<void>((resolve) => {
        execFile('cmd', ['/c', 'start', 'chrome', normalized], () => resolve());
      });
    }

    const chromeBin = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome';
    return new Promise<void>((resolve, reject) => {
      execFile(chromeBin, [normalized], (error) => {
        if (error) {
          reject(new Error('Google Chrome is not available on this system'));
          return;
        }
        resolve();
      });
    });
  });

  // Clipboard
  ipcMain.handle('clipboard:writeText', (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('clipboard:readText', () => {
    return clipboard.readText();
  });

  // Updates
  ipcMain.handle('updates:check', async (_, url: string) => {
    try {
      const safeUrl = validateUpdateUrl(url);
      const response = await axios.get(safeUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': `Kivode-Plus/${app.getVersion()}`
        },
        timeout: 10000,
      });

      if (response.status >= 200 && response.status < 300) {
        return { success: true, data: response.data };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Update check error:', error);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timeout. Please check your internet connection.');
      } else if (error.response) {
        throw new Error(`Server error: ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw new Error(error.message || 'Failed to check for updates');
      }
    }
  });
}

// ==================== HELPERS ====================
async function copyDirectory(src: string, dest: string): Promise<void> {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.gitignore') continue;
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function isPathAllowed(filePath: string): boolean {
  return filesystemPolicy.isAllowed(filePath);
}

// ==================== APP EVENTS ====================
app.whenReady().then(() => {
  if (!isDev) {
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-software-rasterizer');
  }

  initializeServices();
  createWindow();
  setupIPCHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && !parsedUrl.protocol.startsWith('file')) {
      event.preventDefault();
    }
  });
  contents.on('devtools-opened', () => {
    if (!isDev) contents.closeDevTools();
  });
});

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.webContents.session.clearCache();
    mainWindow.webContents.session.clearStorageData({
      storages: ['cookies', 'localstorage', 'websql', 'indexdb'],
    });
  }
});
