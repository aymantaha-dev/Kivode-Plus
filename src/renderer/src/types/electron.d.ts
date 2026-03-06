// src/renderer/src/types/electron.d.ts


export type TaskEvent =
  | { type: 'task_started'; taskId: string; goal: string; createdAt: string }
  | { type: 'log'; taskId: string; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'plan'; taskId: string; steps: Array<{ id: string; goal: string; tools: string[] }> }
  | { type: 'context_used'; taskId: string; items: Array<{ kind: string; ref: string; note?: string }> }
  | { type: 'proposed_diff'; taskId: string; diffId: string; patch: string; summary: string; files: string[] }
  | { type: 'needs_approval'; taskId: string; approvalId: string; scope: any; preview?: any }
  | { type: 'patch_applied'; taskId: string; diffId: string; result: { ok: boolean; file?: string; patchStrategy?: string; error?: string } }
  | { type: 'command_started'; taskId: string; commandId: string; cmd: string; cwd: string }
  | { type: 'command_finished'; taskId: string; commandId: string; exitCode: number; stdout: string; stderr: string }
  | { type: 'validation'; taskId: string; ok: boolean; summary: string; diagnostics?: Array<{ level: string; message: string }> }
  | { type: 'task_finished'; taskId: string; ok: boolean; finalSummary: string };

export type TaskApprovalResponse =
  | { decision: 'approve_once' }
  | { decision: 'approve_session' }
  | { decision: 'reject'; note?: string }
  | { decision: 'edit_then_continue'; editedPatch: string };

export interface PublishRepositoryOptions {
  verifyUser?: boolean;
  addReadme?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  targetMode?: 'create' | 'existing' | 'auto';
  existingRepoFullName?: string;
  branchName?: string;
  forcePush?: boolean;
  gitUserName?: string;
  gitUserEmail?: string;
  createPullRequest?: boolean;
  pullRequestBase?: string;
}

export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  file: {
    openDialog: (options?: { filters?: any[] }) => Promise<any>;
    selectFolder: () => Promise<any>;
    extractZip: (zipPath: string, extractPath?: string) => Promise<any>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    readDirectory: (dirPath: string) => Promise<any[]>;
    createDirectory: (dirPath: string) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string) => Promise<void>;
    createZip: (sourcePath: string, outputPath: string) => Promise<string>;
    saveDialog: (options: any) => Promise<any>;
    saveAllFiles: (files: Array<{ path: string; content: string }>) => Promise<Array<{ path: string; success: boolean; error?: string }>>;
  };
  // ✅ Extended GitHub Integration
  github: {
    // Basic operations
    clone: (url: string, targetPath: string) => Promise<any>;
    validateUrl: (url: string) => Promise<boolean>;
    
    // Authentication
    setAccessToken: (token: string) => Promise<void>;
    isAuthenticated: () => Promise<boolean>;
    getUser: () => Promise<{ login: string; avatar: string } | null>;
    getAuthStatus: () => Promise<any>;
    logout: () => Promise<void>;
    
    // Repository operations
    getRepositories: () => Promise<any[]>;
    getRepository: (owner: string, repo: string) => Promise<any>;
    analyzeRepository: (owner: string, repo: string) => Promise<any>;
    getRepositoryReadme: (owner: string, repo: string) => Promise<any>;
    
    // Editing session (Safe editing)
    startEditingSession: (owner: string, repo: string) => Promise<boolean>;
    getCurrentSession: () => Promise<any>;
    checkSyncStatus: () => Promise<any>;
    saveChanges: (message?: string) => Promise<any>;
    
    // Publishing
    publishRepository: (name: string, description: string, isPrivate: boolean, localPath: string, options?: PublishRepositoryOptions) => Promise<any>;
    getLocalRepositoryTarget: (localPath: string) => Promise<any>;
    getWorkspaceStatus: (localPath: string) => Promise<any>;
    createBranch: (localPath: string, branchName: string, checkout?: boolean) => Promise<any>;
    mergeBranches: (localPath: string, sourceBranch: string, targetBranch: string) => Promise<any>;
    createPullRequestFromLocal: (localPath: string, base: string, head: string, title: string, body?: string) => Promise<any>;
  };
  ai: {
    generateCode: (params: any) => Promise<any>;
    modifyCode: (params: any) => Promise<any>;
    reviewCode: (params: any) => Promise<any>;
    generateProject: (params: any) => Promise<any>;
    explainCode: (params: any) => Promise<any>;
    getModels: () => Promise<any[]>;
    validateApiKey: (model: string, apiKey: string) => Promise<boolean>;
    getPythonEnvStatus: () => Promise<{ available: boolean; version?: string; runtime?: 'bundled' | 'system'; pythonPath?: string; scriptPath?: string; error?: string }>;
    inspectWithPythonEnv: (projectPath: string, query: string) => Promise<any>;
    pythonExecute: (projectPath: string, payload: Record<string, any>) => Promise<any>;
    cancelRequest: (requestId: string) => Promise<{ ok: boolean }>;
  };

  sandbox: {
    indexStatus: () => Promise<{ available: boolean; version?: string; mode: string; pythonPath?: string; runtimePath?: string; error?: string }>;
    ensureEnvironment: (force?: boolean) => Promise<{ ready: boolean; pythonPath: string; runtimePath: string; venvRoot: string; details: string }>;
    queueTask: (workspaceRoot: string, payload: Record<string, any>) => Promise<any>;
    approveTask: (workspaceRoot: string, taskId: string) => Promise<any>;
    cancelTask: (taskId: string) => Promise<any>;
    getTaskResult: (taskId: string) => Promise<any>;
    listSessionTasks: () => Promise<any[]>;
    closeTask: (taskId: string) => Promise<{ ok: boolean }>;
  };
  project: {
    analyze: (projectPath: string) => Promise<any>;
    getMetrics: (projectPath: string) => Promise<any>;
    getDependencies: (projectPath: string) => Promise<any>;
    exportProject: (data: {
      sourcePath: string;
      exportPath: string;
      modifiedFiles: Array<{ path: string; content: string; relativePath: string }>;
    }) => Promise<{ success: boolean; exportPath: string }>;
  };
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    getAll: () => Promise<any>;
  };
  drag: {
    handleDrop: (filePaths: string[]) => Promise<any[]>;
    getFilePath: (file: File) => string;
  };
  app: {
    getVersion: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  shell: {
    openPath: (filePath: string) => Promise<string>;
    showItemInFolder: (filePath: string) => Promise<void>;
    openInChrome: (filePath: string) => Promise<void>;
    openExternal: (url: string) => Promise<boolean>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };
  task: {
    start: (params: { goal: string; workspaceRoot: string; mode?: 'task'; diff?: { file: string; patch: string; summary: string; files?: string[] }; validateCommands?: string[] }) => Promise<{ taskId: string }>;
    approve: (payload: { taskId: string; approvalId: string; response: TaskApprovalResponse }) => Promise<{ ok: boolean }>;
    cancel: (taskId: string) => Promise<{ ok: boolean }>;
    onEvent: (listener: (event: TaskEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}