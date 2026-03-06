// src/main/preload.ts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

// ✅  
export type ApiProvider = 'openai' | 'anthropic' | 'moonshot' | 'deepseek' | 'google' | 'pollinations';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface DialogOptions {
  filters?: FileFilter[];
  properties?: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface FileOperationResult {
  path: string;
  success: boolean;
  error?: string;
}

export interface ExportProjectData {
  sourcePath: string;
  exportPath: string;
  modifiedFiles: Array<{
    path: string;
    content: string;
    relativePath: string;
  }>;
}

export interface GitHubUser {
  login: string;
  avatar: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: ApiProvider;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  category: 'code' | 'documentation' | 'review' | 'general';
  apiEndpoint: string;
  apiModelId: string;
  icon?: string;
}

export interface AIRequestParams {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  files?: Array<{ path: string; content: string }>;
  context?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
    files?: string[];
  }>;
  currentFile?: {
    path: string;
    content: string;
    name: string;
  } | null;
  projectContext?: {
    path: string | null;
    openFiles: Array<{ name: string; path: string }>;
    fileTree: any[];
  };
  operation?: 'generate' | 'modify' | 'review' | 'explain' | 'project';
  requestId?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface AIStreamEvent {
  requestId: string;
  type: 'start' | 'delta' | 'usage' | 'done' | 'error';
  delta?: string;
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
  model?: string;
}


export interface PythonEnvInspection {
  ok: boolean;
  project?: string;
  tree?: string[];
  contextFiles?: Array<{
    path: string;
    excerpt: string;
  }>;
  matches?: Array<{
    path: string;
    score: number;
    snippets: Array<{ line: number; snippet: string }>;
  }>;
  error?: string;
}

export interface ProjectGenerationParams {
  model: string;
  description: string;
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'cli' | 'other';
  technologies?: string[];
  features?: string[];
  language?: string;
}

export interface DropResult {
  type: 'zip' | 'folder' | 'error';
  path: string;
  extractPath?: string;
  tree?: any;
  name?: string;
  error?: string;
}

export interface UpdateCheckResult {
  success: boolean;
  data?: any;
  error?: string;
}


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


// ✅   
export interface ElectronAPI {
  // Window
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };

  // File
  file: {
    openDialog: (options?: DialogOptions) => Promise<any>;
    selectFolder: () => Promise<any>;
    extractZip: (zipPath: string, extractPath?: string) => Promise<string>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    readDirectory: (dirPath: string) => Promise<any[]>;
    createDirectory: (dirPath: string) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string) => Promise<void>;
    createZip: (sourcePath: string, outputPath: string) => Promise<string>;
    saveDialog: (options: SaveDialogOptions) => Promise<any>;
    saveAllFiles: (files: Array<{ path: string; content: string }>) => Promise<FileOperationResult[]>;
  };

  // GitHub
  github: {
    clone: (url: string, targetPath: string) => Promise<any>;
    validateUrl: (url: string) => Promise<boolean>;
    setAccessToken: (token: string) => Promise<void>;
    isAuthenticated: () => Promise<boolean>;
    getUser: () => Promise<GitHubUser | null>;
    getAuthStatus: () => Promise<any>;
    logout: () => Promise<void>;
    getRepositories: () => Promise<any[]>;
    getRepository: (owner: string, repo: string) => Promise<any>;
    analyzeRepository: (owner: string, repo: string) => Promise<any>;
    getRepositoryReadme: (owner: string, repo: string) => Promise<any>;
    startEditingSession: (owner: string, repo: string) => Promise<boolean>;
    getCurrentSession: () => Promise<any>;
    checkSyncStatus: () => Promise<any>;
    saveChanges: (message?: string) => Promise<any>;
    publishRepository: (name: string, description: string, isPrivate: boolean, localPath: string, options?: PublishRepositoryOptions) => Promise<any>;
    getLocalRepositoryTarget: (localPath: string) => Promise<any>;
    getWorkspaceStatus: (localPath: string) => Promise<any>;
    createBranch: (localPath: string, branchName: string, checkout?: boolean) => Promise<any>;
    mergeBranches: (localPath: string, sourceBranch: string, targetBranch: string) => Promise<any>;
    createPullRequestFromLocal: (localPath: string, base: string, head: string, title: string, body?: string) => Promise<any>;
  };

  // AI
  ai: {
    generateCode: (params: AIRequestParams) => Promise<AIResponse>;
    modifyCode: (params: AIRequestParams) => Promise<AIResponse>;
    reviewCode: (params: AIRequestParams) => Promise<AIResponse>;
    generateProject: (params: ProjectGenerationParams) => Promise<AIResponse>;
    explainCode: (params: AIRequestParams) => Promise<AIResponse>;
    getModels: () => Promise<AIModel[]>;
    validateApiKey: (model: string, apiKey: string) => Promise<boolean>;
    getPythonEnvStatus: () => Promise<{ available: boolean; version?: string; runtime?: 'bundled' | 'system'; pythonPath?: string; scriptPath?: string; error?: string }>;
    inspectWithPythonEnv: (projectPath: string, query: string) => Promise<PythonEnvInspection>;
    pythonExecute: (projectPath: string, payload: Record<string, any>) => Promise<any>;
    cancelRequest: (requestId: string) => Promise<{ ok: boolean }>;
    startChatStream: (params: AIRequestParams) => Promise<{ ok: boolean; requestId?: string }>;
    onChatStreamEvent: (listener: (payload: AIStreamEvent) => void) => () => void;
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

  // Project
  project: {
    analyze: (projectPath: string) => Promise<any>;
    getMetrics: (projectPath: string) => Promise<any>;
    getDependencies: (projectPath: string) => Promise<any>;
    exportProject: (data: ExportProjectData) => Promise<{ success: boolean; exportPath: string }>;
  };

  // ✅ Store 
  store: {
    // 
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    getAll: () => Promise<Record<string, any>>;
    
    // ✅ API Keys 
    setApiKey: (provider: ApiProvider, apiKey: string) => Promise<{ success: boolean }>;
    getApiKey: (provider: ApiProvider) => Promise<string | null>;
    deleteApiKey: (provider: ApiProvider) => Promise<{ success: boolean }>;
    hasApiKey: (provider: ApiProvider) => Promise<boolean>;
    getAllApiKeys: () => Promise<Record<ApiProvider, boolean>>;
  };

  // Drag & Drop
  drag: {
    handleDrop: (filePaths: string[]) => Promise<DropResult[]>;
    getFilePath: (file: File) => string;
  };

  // App
  app: {
    getVersion: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };

  // Shell
  shell: {
    openPath: (filePath: string) => Promise<string>;
    showItemInFolder: (filePath: string) => Promise<void>;
    openInChrome: (filePath: string) => Promise<void>;
    openExternal: (url: string) => Promise<boolean>;
  };

  // Clipboard
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };

  // Updates
  updates: {
    check: (url: string) => Promise<UpdateCheckResult>;
  };

  // Task Engine
  task: {
    start: (params: { goal: string; workspaceRoot: string; mode?: 'task'; diff?: { file: string; patch: string; summary: string; files?: string[] }; validateCommands?: string[] }) => Promise<{ taskId: string }>;
    approve: (payload: { taskId: string; approvalId: string; response: TaskApprovalResponse }) => Promise<{ ok: boolean }>;
    cancel: (taskId: string) => Promise<{ ok: boolean }>;
    onEvent: (listener: (event: TaskEvent) => void) => () => void;
  };
}

// ✅ 
const api: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  file: {
    openDialog: (options?: DialogOptions) => ipcRenderer.invoke('file:openDialog', options),
    selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
    extractZip: (zipPath: string, extractPath?: string) => 
      ipcRenderer.invoke('file:extractZip', zipPath, extractPath),
    readFile: (filePath: string) => ipcRenderer.invoke('file:readFile', filePath),
    writeFile: (filePath: string, content: string) => 
      ipcRenderer.invoke('file:writeFile', filePath, content),
    readDirectory: (dirPath: string) => ipcRenderer.invoke('file:readDirectory', dirPath),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('file:createDirectory', dirPath),
    deleteFile: (filePath: string) => ipcRenderer.invoke('file:deleteFile', filePath),
    renameFile: (oldPath: string, newPath: string) => 
      ipcRenderer.invoke('file:renameFile', oldPath, newPath),
    createZip: (sourcePath: string, outputPath: string) => 
      ipcRenderer.invoke('file:createZip', sourcePath, outputPath),
    saveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('file:saveDialog', options),
    saveAllFiles: (files) => ipcRenderer.invoke('file:saveAllFiles', files),
  },

  github: {
    clone: (url: string, targetPath: string) => 
      ipcRenderer.invoke('github:clone', url, targetPath),
    validateUrl: (url: string) => ipcRenderer.invoke('github:validateUrl', url),
    setAccessToken: (token: string) => ipcRenderer.invoke('github:setAccessToken', token),
    isAuthenticated: () => ipcRenderer.invoke('github:isAuthenticated'),
    getUser: () => ipcRenderer.invoke('github:getUser'),
    getAuthStatus: () => ipcRenderer.invoke('github:getAuthStatus'),
    logout: () => ipcRenderer.invoke('github:logout'),
    getRepositories: () => ipcRenderer.invoke('github:getRepositories'),
    getRepository: (owner: string, repo: string) => 
      ipcRenderer.invoke('github:getRepository', owner, repo),
    analyzeRepository: (owner: string, repo: string) => 
      ipcRenderer.invoke('github:analyzeRepository', owner, repo),
    getRepositoryReadme: (owner: string, repo: string) => ipcRenderer.invoke('github:getRepositoryReadme', owner, repo),
    startEditingSession: (owner: string, repo: string) => 
      ipcRenderer.invoke('github:startEditingSession', owner, repo),
    getCurrentSession: () => ipcRenderer.invoke('github:getCurrentSession'),
    checkSyncStatus: () => ipcRenderer.invoke('github:checkSyncStatus'),
    saveChanges: (message?: string) => ipcRenderer.invoke('github:saveChanges', message),
    publishRepository: (name: string, description: string, isPrivate: boolean, localPath: string, options?: PublishRepositoryOptions) => 
      ipcRenderer.invoke('github:publishRepository', name, description, isPrivate, localPath, options),
    getLocalRepositoryTarget: (localPath: string) => ipcRenderer.invoke('github:getLocalRepositoryTarget', localPath),
    getWorkspaceStatus: (localPath: string) => ipcRenderer.invoke('github:getWorkspaceStatus', localPath),
    createBranch: (localPath: string, branchName: string, checkout = true) => ipcRenderer.invoke('github:createBranch', localPath, branchName, checkout),
    mergeBranches: (localPath: string, sourceBranch: string, targetBranch: string) => ipcRenderer.invoke('github:mergeBranches', localPath, sourceBranch, targetBranch),
    createPullRequestFromLocal: (localPath: string, base: string, head: string, title: string, body?: string) =>
      ipcRenderer.invoke('github:createPullRequestFromLocal', localPath, base, head, title, body),
  },

  ai: {
    generateCode: (params: AIRequestParams) => ipcRenderer.invoke('ai:generateCode', params),
    modifyCode: (params: AIRequestParams) => ipcRenderer.invoke('ai:modifyCode', params),
    reviewCode: (params: AIRequestParams) => ipcRenderer.invoke('ai:reviewCode', params),
    generateProject: (params: ProjectGenerationParams) => ipcRenderer.invoke('ai:generateProject', params),
    explainCode: (params: AIRequestParams) => ipcRenderer.invoke('ai:explainCode', params),
    getModels: () => ipcRenderer.invoke('ai:getModels'),
    validateApiKey: (model: string, apiKey: string) => 
      ipcRenderer.invoke('ai:validateApiKey', model, apiKey),
    getPythonEnvStatus: () => ipcRenderer.invoke('ai:getPythonEnvStatus'),
    inspectWithPythonEnv: (projectPath: string, query: string) =>
      ipcRenderer.invoke('ai:inspectWithPythonEnv', projectPath, query),
    pythonExecute: (projectPath: string, payload: Record<string, any>) =>
      ipcRenderer.invoke('ai:pythonExecute', projectPath, payload),
    cancelRequest: (requestId: string) => ipcRenderer.invoke('ai:cancelRequest', requestId),
    startChatStream: (params: AIRequestParams) => ipcRenderer.invoke('ai:startChatStream', params),
    onChatStreamEvent: (listener: (payload: AIStreamEvent) => void) => {
      const wrapped = (_event: any, payload: AIStreamEvent) => listener(payload);
      ipcRenderer.on('ai:chatStreamEvent', wrapped);
      return () => ipcRenderer.removeListener('ai:chatStreamEvent', wrapped);
    },
  },

  sandbox: {
    indexStatus: () => ipcRenderer.invoke('sandbox:indexStatus'),
    ensureEnvironment: (force = false) => ipcRenderer.invoke('sandbox:ensureEnvironment', force),
    queueTask: (workspaceRoot: string, payload: Record<string, any>) => ipcRenderer.invoke('sandbox:queueTask', workspaceRoot, payload),
    approveTask: (workspaceRoot: string, taskId: string) => ipcRenderer.invoke('sandbox:approveTask', workspaceRoot, taskId),
    cancelTask: (taskId: string) => ipcRenderer.invoke('sandbox:cancelTask', taskId),
    getTaskResult: (taskId: string) => ipcRenderer.invoke('sandbox:getTaskResult', taskId),
    listSessionTasks: () => ipcRenderer.invoke('sandbox:listSessionTasks'),
    closeTask: (taskId: string) => ipcRenderer.invoke('sandbox:closeTask', taskId),
  },

  project: {
    analyze: (projectPath: string) => ipcRenderer.invoke('project:analyze', projectPath),
    getMetrics: (projectPath: string) => ipcRenderer.invoke('project:getMetrics', projectPath),
    getDependencies: (projectPath: string) => ipcRenderer.invoke('project:getDependencies', projectPath),
    exportProject: (data: ExportProjectData) => ipcRenderer.invoke('project:exportProject', data),
  },

  // ✅ Store 
  store: {
    // 
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getAll: () => ipcRenderer.invoke('store:getAll'),
    
    // API Keys 
    setApiKey: (provider: ApiProvider, apiKey: string) => 
      ipcRenderer.invoke('store:setApiKey', provider, apiKey),
    getApiKey: (provider: ApiProvider) => 
      ipcRenderer.invoke('store:getApiKey', provider),
    deleteApiKey: (provider: ApiProvider) => 
      ipcRenderer.invoke('store:deleteApiKey', provider),
    hasApiKey: (provider: ApiProvider) => 
      ipcRenderer.invoke('store:hasApiKey', provider),
    getAllApiKeys: () => 
      ipcRenderer.invoke('store:getAllApiKeys'),
  },

  drag: {
    handleDrop: (filePaths: string[]) => ipcRenderer.invoke('drag:handleDrop', filePaths),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },

  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openInChrome: (filePath: string) => ipcRenderer.invoke('shell:openInChrome', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
    readText: () => ipcRenderer.invoke('clipboard:readText'),
  },

  updates: {
    check: (url: string) => ipcRenderer.invoke('updates:check', url),
  },

  task: {
    start: (params) => ipcRenderer.invoke('task:start', params),
    approve: (payload) => ipcRenderer.invoke('task:approve', payload),
    cancel: (taskId: string) => ipcRenderer.invoke('task:cancel', taskId),
    onEvent: (listener) => {
      const wrapped = (_event: any, payload: TaskEvent) => listener(payload);
      ipcRenderer.on('task:event', wrapped);
      return () => ipcRenderer.removeListener('task:event', wrapped);
    },
  },
};

// ✅ 
contextBridge.exposeInMainWorld('electronAPI', api);

// ✅  
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
