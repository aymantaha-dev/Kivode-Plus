export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified: Date;
  language?: string;
  children?: FileNode[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isModified: boolean;
  isActive: boolean;
  originalContent: string; 
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens: number;
  supportsStreaming: boolean;
  category: 'code' | 'documentation' | 'review' | 'general';
  apiEndpoint: string;
}

export interface AIRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  files?: { path: string; content: string }[];
  context?: string;
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

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  languages: { [key: string]: number };
  fileTypes: { [key: string]: number };
  complexity: {
    averageComplexity: number;
    maxComplexity: number;
    functions: number;
    classes: number;
  };
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'optional';
}

export interface DiffChange {
  type: 'add' | 'remove' | 'unchanged';
  lineNumber: number;
  content: string;
}

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  changes: DiffChange[];
}

export interface ProjectSettings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  defaultModel: string;
  autoSave: boolean;
  tabSize: number;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
}

export interface APIKeys {
  openai?: string;
  anthropic?: string;
  moonshot?: string;
  deepseek?: string;
  google?: string;
}

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: Date;
  model: string;
  type: 'generate' | 'modify' | 'review' | 'explain';
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'cli' | 'other';
  technologies: string[];
  icon: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export type ViewType = 'editor' | 'diff' | 'preview' | 'metrics' | 'settings';

export type AIOperationType = 'generate' | 'modify' | 'review' | 'explain' | 'project';
