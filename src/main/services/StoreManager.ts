// src/main/services/StoreManager.ts
import Store from 'electron-store';

// ✅  
export type ApiProvider = 'openai' | 'anthropic' | 'moonshot' | 'deepseek' | 'google' | 'pollinations';
export type ApiKeyPath = `apiKey.${ApiProvider}`;
export type Theme = 'dark' | 'light' | 'system';

export interface StoreSchema {
  // API Keys
  'apiKey.openai': string;
  'apiKey.anthropic': string;
  'apiKey.moonshot': string;
  'apiKey.deepseek': string;
  'apiKey.google': string;
  'apiKey.pollinations': string;
  
  // Settings
  'settings.theme': Theme;
  'settings.language': string;
  'settings.defaultModel': string;
  'settings.autoSave': boolean;
  'settings.tabSize': number;
  'settings.fontSize': number;
  'settings.wordWrap': boolean;
  'settings.minimap': boolean;
  
  // Data
  'recentProjects': string[];
  'promptHistory': string[];
  'chatSessions': any[];
}

// ✅   
export const VALID_PROVIDERS: ApiProvider[] = [
  'openai', 'anthropic', 'moonshot', 'deepseek', 'google', 'pollinations'
];

// ✅  
const DEFAULTS: StoreSchema = {
  'apiKey.openai': '',
  'apiKey.anthropic': '',
  'apiKey.moonshot': '',
  'apiKey.deepseek': '',
  'apiKey.google': '',
  'apiKey.pollinations': '',
  'settings.theme': 'dark',
  'settings.language': 'en',
  'settings.defaultModel': 'deepseek-coder',
  'settings.autoSave': true,
  'settings.tabSize': 2,
  'settings.fontSize': 14,
  'settings.wordWrap': true,
  'settings.minimap': true,
  'recentProjects': [],
  'promptHistory': [],
  'chatSessions': [],
};

export class StoreManager {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'kivode-plus-config',
      defaults: DEFAULTS,
      clearInvalidConfig: true, // ✅    
    });
  }

  // ✅  
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.store.get(key);
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.store.set(key, value);
  }

  delete(key: keyof StoreSchema): void {
    this.store.delete(key);
  }

  getAll(): Partial<StoreSchema> {
    const result: Partial<StoreSchema> = {};
    const keys = Object.keys(DEFAULTS) as Array<keyof StoreSchema>;
    for (const key of keys) {
      result[key] = this.store.get(key) as any; // ✅  
    }
    return result;
  }

  clear(): void {
    this.store.clear();
  }

  // ✅  API Keys 
  setApiKey(provider: ApiProvider, apiKey: string): void {
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new Error(`Invalid provider: ${provider}. Valid: ${VALID_PROVIDERS.join(', ')}`);
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }
    const key: ApiKeyPath = `apiKey.${provider}`;
    this.store.set(key, apiKey);
  }

  getApiKey(provider: ApiProvider): string | undefined {
    if (!VALID_PROVIDERS.includes(provider)) return undefined;
    const key: ApiKeyPath = `apiKey.${provider}`;
    const value = this.store.get(key);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  deleteApiKey(provider: ApiProvider): void {
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`);
    }
    const key: ApiKeyPath = `apiKey.${provider}`;
    this.store.delete(key);
  }

  hasApiKey(provider: ApiProvider): boolean {
    const key = this.getApiKey(provider);
    return !!key && key.length > 10; // ✅    
  }

  getAllApiKeys(): Record<ApiProvider, boolean> {
    const result = {} as Record<ApiProvider, boolean>;
    for (const provider of VALID_PROVIDERS) {
      result[provider] = this.hasApiKey(provider);
    }
    return result;
  }

  // ✅  
  getSettings(): Pick<StoreSchema, 
    'settings.theme' | 'settings.language' | 'settings.defaultModel' | 
    'settings.autoSave' | 'settings.tabSize' | 'settings.fontSize' | 
    'settings.wordWrap' | 'settings.minimap'> {
    return {
      'settings.theme': this.get('settings.theme'),
      'settings.language': this.get('settings.language'),
      'settings.defaultModel': this.get('settings.defaultModel'),
      'settings.autoSave': this.get('settings.autoSave'),
      'settings.tabSize': this.get('settings.tabSize'),
      'settings.fontSize': this.get('settings.fontSize'),
      'settings.wordWrap': this.get('settings.wordWrap'),
      'settings.minimap': this.get('settings.minimap'),
    };
  }

  updateSettings(settings: Partial<ReturnType<typeof this.getSettings>>): void {
    if (settings['settings.theme']) this.set('settings.theme', settings['settings.theme']);
    if (settings['settings.language']) this.set('settings.language', settings['settings.language']);
    if (settings['settings.defaultModel']) this.set('settings.defaultModel', settings['settings.defaultModel']);
    if (settings['settings.autoSave'] !== undefined) this.set('settings.autoSave', settings['settings.autoSave']);
    if (settings['settings.tabSize']) this.set('settings.tabSize', settings['settings.tabSize']);
    if (settings['settings.fontSize']) this.set('settings.fontSize', settings['settings.fontSize']);
    if (settings['settings.wordWrap'] !== undefined) this.set('settings.wordWrap', settings['settings.wordWrap']);
    if (settings['settings.minimap'] !== undefined) this.set('settings.minimap', settings['settings.minimap']);
  }

  // ✅  
  addRecentProject(projectPath: string): void {
    const recent = this.get('recentProjects') || [];
    const filtered = recent.filter((p: string) => p !== projectPath);
    filtered.unshift(projectPath);
    this.set('recentProjects', filtered.slice(0, 10));
  }

  removeRecentProject(projectPath: string): void {
    const recent = this.get('recentProjects') || [];
    this.set('recentProjects', recent.filter((p: string) => p !== projectPath));
  }

  // ✅  
  addPromptToHistory(prompt: string): void {
    const history = this.get('promptHistory') || [];
    const filtered = history.filter((p: string) => p !== prompt);
    filtered.unshift(prompt);
    this.set('promptHistory', filtered.slice(0, 50));
  }

  clearPromptHistory(): void {
    this.set('promptHistory', []);
  }

  // ✅   
  getChatSessions(): any[] {
    return this.get('chatSessions') || [];
  }

  setChatSessions(sessions: any[]): void {
    this.set('chatSessions', sessions.slice(0, 50)); // ✅   50 
  }

  clearChatSessions(): void {
    this.set('chatSessions', []);
  }
}