// src/main/services/AIManager.ts
import axios, { AxiosError } from 'axios';
import { StoreManager, ApiProvider } from './StoreManager';

// ✅  
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
  icon?: string; // ✅   
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

export interface ProjectGenerationParams {
  model: string;
  description: string;
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'cli' | 'other';
  technologies?: string[];
  features?: string[];
  language?: string;
}

// ✅   
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIManager {
  private storeManager: StoreManager;
  private models: AIModel[];
  private inFlightActions: Set<string> = new Set();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private requestControllers: Map<string, AbortController> = new Map();

  constructor(storeManager: StoreManager) {
    this.storeManager = storeManager;
    this.models = this.initializeModels();
  }

  private createRequestController(requestId?: string): { id: string; controller: AbortController } {
    const id = requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = this.requestControllers.get(id);
    if (existing) {
      existing.abort();
      this.requestControllers.delete(id);
    }
    const controller = new AbortController();
    this.requestControllers.set(id, controller);
    return { id, controller };
  }

  cancelRequest(requestId: string): boolean {
    const controller = this.requestControllers.get(requestId);
    if (!controller) return false;
    controller.abort();
    this.requestControllers.delete(requestId);
    return true;
  }


  // ✅   (2025/2026)
  private initializeModels(): AIModel[] {
    return [
      // OpenAI - GPT-5 Series
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        provider: 'openai',
        description: 'Latest GPT-5.2 for advanced coding tasks',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModelId: 'gpt-5.2',
        icon: 'openai',
      },
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        provider: 'openai',
        description: 'GPT-5.1 for complex code generation',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModelId: 'gpt-5.1',
        icon: 'openai',
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        provider: 'openai',
        description: 'Base GPT-5 model',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModelId: 'gpt-5',
        icon: 'openai',
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        provider: 'openai',
        description: 'GPT-4.1 optimized for code',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModelId: 'gpt-4.1',
        icon: 'openai',
      },
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        provider: 'openai',
        description: 'Fast and efficient GPT-4.1 Mini',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiModelId: 'gpt-4.1-mini-2025-04-14',
        icon: 'openai',
      },
      
      // Anthropic - Claude 3.5 Series
      {
        id: 'claude-opus-4.5',
        name: 'Claude Opus 4.5',
        provider: 'anthropic',
        description: 'Most capable Claude for complex tasks',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        apiModelId: 'claude-3-opus-latest',
        icon: 'anthropic',
      },
      {
        id: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        provider: 'anthropic',
        description: 'Balanced performance and speed',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        apiModelId: 'claude-3-sonnet-latest',
        icon: 'anthropic',
      },
      {
        id: 'claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        description: 'Fast and cost-effective',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'documentation',
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        apiModelId: 'claude-3-haiku-latest',
        icon: 'anthropic',
      },
      
      // Moonshot - Kimi K2.5 Series
      {
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        provider: 'moonshot',
        description: 'Latest Kimi K2.5 with 256K context',
        maxTokens: 256000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        apiModelId: 'kimi-k2-0711-preview',
        icon: 'moonshot',
      },
      {
        id: 'kimi-k2',
        name: 'Kimi K2',
        provider: 'moonshot',
        description: 'Kimi K2 for long context',
        maxTokens: 200000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        apiModelId: 'kimi-k2-thinking-preview',
        icon: 'moonshot',
      },
      {
        id: 'kimi-k1.5',
        name: 'Kimi K1.5',
        provider: 'moonshot',
        description: 'Kimi K1.5 optimized',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
        apiModelId: 'moonshot-v1-128k',
        icon: 'moonshot',
      },
      
      // DeepSeek - V3 Series
      {
        id: 'deepseek-v3',
        name: 'DeepSeek-V3',
        provider: 'deepseek',
        description: 'DeepSeek V3 general purpose',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiModelId: 'deepseek-chat',
        icon: 'deepseek',
      },
      {
        id: 'deepseek-coder-v2',
        name: 'DeepSeek Coder V2',
        provider: 'deepseek',
        description: 'Specialized for coding',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiModelId: 'deepseek-coder',
        icon: 'deepseek',
      },
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        description: 'General chat capabilities',
        maxTokens: 128000,
        supportsStreaming: true,
        category: 'documentation',
        apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
        apiModelId: 'deepseek-chat',
        icon: 'deepseek',
      },
      
      // Google - Gemini 1.5 Series
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        description: 'Gemini 1.5 Pro for complex tasks',
        maxTokens: 2000000,
        supportsStreaming: true,
        category: 'code',
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        apiModelId: 'gemini-1.5-pro-latest',
        icon: 'google',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        description: 'Fast Gemini 1.5 Flash',
        maxTokens: 1000000,
        supportsStreaming: true,
        category: 'documentation',
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        apiModelId: 'gemini-1.5-flash-latest',
        icon: 'google',
      },
    ];
  }

  getAvailableModels(): AIModel[] {
    return this.models;
  }

  getModelById(id: string): AIModel | undefined {
    return this.models.find(m => m.id === id);
  }

  // ✅    API    
  async validateApiKey(modelId: string, apiKey: string): Promise<boolean> {
    const model = this.getModelById(modelId);
    if (!model) {
      throw new AIError(`Model ${modelId} not found`, 'MODEL_NOT_FOUND');
    }

    if (!apiKey || apiKey.length < 10) {
      throw new AIError('Invalid API key format', 'INVALID_KEY_FORMAT');
    }

    try {
      switch (model.provider) {
        case 'openai':
          await axios.get('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000,
          });
          return true;
        
        case 'anthropic':
          await axios.post(
            model.apiEndpoint,
            {
              model: model.apiModelId,
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }],
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );
          return true;

        case 'moonshot':
          await axios.get('https://api.moonshot.cn/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000,
          });
          return true;

        case 'deepseek':
          await axios.get('https://api.deepseek.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000,
          });
          return true;

        case 'google':
          await axios.post(
            `${model.apiEndpoint}?key=${apiKey}`,
            { contents: [{ parts: [{ text: 'Hi' }] }] },
            { timeout: 10000 }
          );
          return true;

        default:
          throw new AIError(`Unsupported provider: ${model.provider}`, 'UNSUPPORTED_PROVIDER');
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        throw new AIError('Invalid API key', 'INVALID_API_KEY', model.provider);
      }
      if (axiosError.code === 'ECONNABORTED') {
        throw new AIError('Connection timeout', 'TIMEOUT', model.provider, true);
      }
      throw new AIError(
        axiosError.message || 'Validation failed',
        'VALIDATION_FAILED',
        model.provider,
        true
      );
    }
  }

  // ✅            
  private async executeWithActionGuard<T>(action: string, operation: () => Promise<T>): Promise<T> {
    if (this.inFlightActions.has(action)) {
      throw new AIError(
        'A request for this action is already running. Please wait for it to finish.',
        'REQUEST_IN_FLIGHT'
      );
    }

    this.inFlightActions.add(action);
    try {
      return await operation();
    } finally {
      this.inFlightActions.delete(action);
    }
  }

  async generateCode(params: AIRequestParams): Promise<AIResponse> {
    return this.executeWithActionGuard('generateCode', () => this.executeWithRetry(() => this._generateCode(params)));
  }

  async modifyCode(params: AIRequestParams): Promise<AIResponse> {
    return this.executeWithActionGuard('modifyCode', () => this.executeWithRetry(() => this._modifyCode(params)));
  }

  async reviewCode(params: AIRequestParams): Promise<AIResponse> {
    return this.executeWithActionGuard('reviewCode', () => this.executeWithRetry(() => this._reviewCode(params)));
  }

  async explainCode(params: AIRequestParams): Promise<AIResponse> {
    return this.executeWithActionGuard('explainCode', () => this.executeWithRetry(() => this._explainCode(params)));
  }

  async generateProject(params: ProjectGenerationParams): Promise<AIResponse> {
    return this.executeWithActionGuard('generateProject', () => this.executeWithRetry(() => this._generateProject(params)));
  }

  async streamExplainCode(params: AIRequestParams, onEvent: (event: AIStreamEvent) => void): Promise<void> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(`API key for ${model.provider} not configured`, 'API_KEY_MISSING');
    }

    const systemPrompt = this.resolveSystemPrompt(
      model,
      params.systemPrompt,
      'You are a helpful coding assistant. Explain code and project architecture clearly using provided project context when available.'
    );
    const userPrompt = this.buildExplainPrompt(params);
    const { id: requestId, controller } = this.createRequestController(params.requestId);
    const signal = controller.signal;

    onEvent({ requestId, type: 'start', model: model.id });

    const parseSSE = async (response: Response, onData: (json: any) => void) => {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Provider returned ${response.status}: ${text.slice(0, 300)}`);
      }
      if (!response.body) throw new Error('Streaming response body is empty');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          for (const line of event.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              onData(JSON.parse(payload));
            } catch {
              // ignore malformed provider keep-alive chunks
            }
          }
        }
      }
    };

    let full = '';
    let usage: AIStreamEvent['usage'];

    try {
      if (['openai', 'moonshot', 'deepseek'].includes(model.provider)) {
        const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
        if (params.conversationHistory && params.conversationHistory.length > 0) {
          for (const msg of params.conversationHistory.slice(-10)) {
            if (msg.role !== 'system') messages.push({ role: msg.role, content: msg.content });
          }
        }
        messages.push({ role: 'user', content: userPrompt });

        const response = await fetch(model.apiEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.apiModelId,
            messages,
            temperature: params.temperature ?? 0.3,
            max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
            stream: true,
          }),
          signal,
        });

        await parseSSE(response, (json) => {
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta;
            onEvent({ requestId, type: 'delta', delta });
          }
          if (json?.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens || 0,
              completionTokens: json.usage.completion_tokens || 0,
              totalTokens: json.usage.total_tokens || 0,
            };
          }
        });
      } else if (model.provider === 'anthropic') {
        const messages = [{ role: 'user', content: userPrompt }];
        const response = await fetch(model.apiEndpoint, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model.apiModelId,
            max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
            system: systemPrompt,
            messages,
            temperature: params.temperature ?? 0.3,
            stream: true,
          }),
          signal,
        });

        await parseSSE(response, (json) => {
          const delta = json?.delta?.text;
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta;
            onEvent({ requestId, type: 'delta', delta });
          }
          if (json?.usage) {
            usage = {
              promptTokens: json.usage.input_tokens || 0,
              completionTokens: json.usage.output_tokens || 0,
              totalTokens: (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0),
            };
          }
        });
      } else if (model.provider === 'google') {
        const response = await fetch(`${model.apiEndpoint}/${model.apiModelId}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              temperature: params.temperature ?? 0.3,
              maxOutputTokens: params.maxTokens ?? Math.min(model.maxTokens, 8192),
            },
          }),
          signal,
        });

        await parseSSE(response, (json) => {
          const delta = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta;
            onEvent({ requestId, type: 'delta', delta });
          }
          if (json?.usageMetadata) {
            usage = {
              promptTokens: json.usageMetadata.promptTokenCount || 0,
              completionTokens: json.usageMetadata.candidatesTokenCount || 0,
              totalTokens: json.usageMetadata.totalTokenCount || 0,
            };
          }
        });
      } else {
        throw new AIError(`Unsupported provider: ${model.provider}`, 'UNSUPPORTED_PROVIDER');
      }

      if (usage) onEvent({ requestId, type: 'usage', usage });
      onEvent({ requestId, type: 'done', content: full, model: model.id });
    } catch (error) {
      const aiError = this.toAIError(error, model);
      onEvent({ requestId, type: 'error', error: aiError.message, model: model.id });
      throw aiError;
    } finally {
      this.requestControllers.delete(requestId);
    }
  }

  // ✅    Retry
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const aiError = error as AIError;
        
        //       
        if (aiError.code === 'INVALID_API_KEY' || aiError.code === 'MODEL_NOT_FOUND') {
          throw error;
        }
        
        if (i < retries - 1 && aiError.retryable) {
          await this.delay(this.RETRY_DELAY * Math.pow(2, i));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  private async _generateCode(params: AIRequestParams): Promise<AIResponse> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(
        `API key for ${model.provider} not configured`,
        'API_KEY_MISSING',
        model.provider
      );
    }

    const systemPrompt = this.resolveSystemPrompt(model, params.systemPrompt, this.getCodeGenerationSystemPrompt());
    const userPrompt = this.buildCodePrompt(params);

    return this.callProvider(model, apiKey, systemPrompt, userPrompt, params);
  }

  private async _modifyCode(params: AIRequestParams): Promise<AIResponse> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(`API key for ${model.provider} not configured`, 'API_KEY_MISSING');
    }

    const systemPrompt = this.resolveSystemPrompt(model, params.systemPrompt, this.getCodeModificationSystemPrompt());
    const userPrompt = this.buildModificationPrompt(params);

    return this.callProvider(model, apiKey, systemPrompt, userPrompt, params);
  }

  private async _reviewCode(params: AIRequestParams): Promise<AIResponse> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(`API key for ${model.provider} not configured`, 'API_KEY_MISSING');
    }

    const systemPrompt = this.resolveSystemPrompt(model, params.systemPrompt, this.getCodeReviewSystemPrompt());
    const userPrompt = this.buildReviewPrompt(params);

    return this.callProvider(model, apiKey, systemPrompt, userPrompt, params);
  }

  private async _explainCode(params: AIRequestParams): Promise<AIResponse> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(`API key for ${model.provider} not configured`, 'API_KEY_MISSING');
    }

    const systemPrompt = this.resolveSystemPrompt(
      model,
      params.systemPrompt,
      'You are a helpful coding assistant. Explain code and project architecture clearly using provided project context when available.'
    );
    const userPrompt = this.buildExplainPrompt(params);

    return this.callProvider(model, apiKey, systemPrompt, userPrompt, params);
  }

  private async _generateProject(params: ProjectGenerationParams): Promise<AIResponse> {
    const model = this.getModelById(params.model);
    if (!model) throw new AIError(`Model ${params.model} not found`, 'MODEL_NOT_FOUND');

    const apiKey = this.storeManager.getApiKey(model.provider);
    if (!apiKey) {
      throw new AIError(`API key for ${model.provider} not configured`, 'API_KEY_MISSING');
    }

    const systemPrompt = this.resolveSystemPrompt(model, undefined, this.getProjectGenerationSystemPrompt());
    const userPrompt = this.buildProjectPrompt(params);

    return this.callProvider(model, apiKey, systemPrompt, userPrompt, {
      model: params.model,
      prompt: userPrompt,
      temperature: 0.7,
      maxTokens: Math.min(model.maxTokens, 128000),
    });
  }

  // ✅  
  private async callProvider(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    const { id: requestId, controller } = this.createRequestController(params.requestId);
    const providerParams = { ...params, requestId, signal: controller.signal } as Partial<AIRequestParams> & { signal: AbortSignal };

    try {
      switch (model.provider) {
        case 'openai':
          return this.callOpenAI(model, apiKey, systemPrompt, userPrompt, providerParams);
        case 'anthropic':
          return this.callAnthropic(model, apiKey, systemPrompt, userPrompt, providerParams);
        case 'moonshot':
          return this.callMoonshot(model, apiKey, systemPrompt, userPrompt, providerParams);
        case 'deepseek':
          return this.callDeepSeek(model, apiKey, systemPrompt, userPrompt, providerParams);
        case 'google':
          return this.callGoogle(model, apiKey, systemPrompt, userPrompt, providerParams);
        default:
          throw new AIError(`Unsupported provider: ${model.provider}`, 'UNSUPPORTED_PROVIDER');
      }
    } catch (error) {
      throw this.toAIError(error, model);
    } finally {
      this.requestControllers.delete(requestId);
    }
  }

  private toAIError(error: unknown, model: AIModel): AIError {
    if (error instanceof AIError) {
      return error;
    }

    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const providerMessage =
      axiosError.response?.data?.error?.message ||
      axiosError.response?.data?.message ||
      axiosError.message;

    if (status === 401 || status === 403) {
      return new AIError(
        `${model.provider} authentication failed. Please check your API key and model access.`,
        'INVALID_API_KEY',
        model.provider
      );
    }

    if (status === 404) {
      return new AIError(
        `Model ${model.apiModelId} is unavailable for ${model.provider}. Verify the configured model ID.`,
        'MODEL_UNAVAILABLE',
        model.provider
      );
    }

    if (status === 429) {
      return new AIError('Provider rate limit reached. Please retry shortly.', 'RATE_LIMIT', model.provider, true);
    }

    if (axiosError.code === 'ECONNABORTED') {
      return new AIError('Provider request timed out. Please retry.', 'TIMEOUT', model.provider, true);
    }

    return new AIError(
      providerMessage || 'AI provider request failed',
      'PROVIDER_ERROR',
      model.provider,
      true
    );
  }

  private async callOpenAI(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // ✅     
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      for (const msg of params.conversationHistory.slice(-10)) { // ✅  10  
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await axios.post(
      model.apiEndpoint,
      {
        model: model.apiModelId,
        messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5 
      }
    );

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: model.id,
      finishReason: response.data.choices[0].finish_reason,
    };
  }

  private async callAnthropic(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    let prompt = userPrompt;
    
    // ✅   
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      const history = params.conversationHistory
        .slice(-5)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');
      prompt = `${history}\n\nuser: ${userPrompt}`;
    }

    const response = await axios.post(
      model.apiEndpoint,
      {
        model: model.apiModelId,
        max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: params.temperature ?? 0.3,
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 300000,
        signal: (params as any).signal,
      }
    );

    return {
      content: response.data.content[0].text,
      usage: {
        promptTokens: response.data.usage.input_tokens,
        completionTokens: response.data.usage.output_tokens,
        totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
      },
      model: model.id,
      finishReason: response.data.stop_reason,
    };
  }

  private async callMoonshot(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (params.conversationHistory) {
      for (const msg of params.conversationHistory.slice(-10)) {
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await axios.post(
      model.apiEndpoint,
      {
        model: model.apiModelId,
        messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
        signal: (params as any).signal,
      }
    );

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: model.id,
      finishReason: response.data.choices[0].finish_reason,
    };
  }

  private async callDeepSeek(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (params.conversationHistory) {
      for (const msg of params.conversationHistory.slice(-10)) {
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const response = await axios.post(
      model.apiEndpoint,
      {
        model: model.apiModelId,
        messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? Math.min(model.maxTokens, 4096),
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
        signal: (params as any).signal,
      }
    );

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: model.id,
      finishReason: response.data.choices[0].finish_reason,
    };
  }

  private async callGoogle(
    model: AIModel,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    params: Partial<AIRequestParams>
  ): Promise<AIResponse> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
    ];

    const response = await axios.post(
      `${model.apiEndpoint}/${model.apiModelId}:generateContent?key=${apiKey}`,
      {
        contents,
        generationConfig: {
          temperature: params.temperature ?? 0.3,
          maxOutputTokens: params.maxTokens ?? Math.min(model.maxTokens, 8192),
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000,
        signal: (params as any).signal,
      }
    );

    return {
      content: response.data.candidates[0].content.parts[0].text,
      usage: {
        promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.data.usageMetadata?.totalTokenCount || 0,
      },
      model: model.id,
    };
  }

  // ✅   Prompts
  private buildCodePrompt(params: AIRequestParams): string {
    let prompt = params.prompt;

    prompt += '\n\nGeneration rules:\n- If the user asks for a new file, create a NEW file path in the response\n- Do not overwrite existing files unless explicitly requested\n- Prefer returning structured multi-file output (JSON files array or fenced blocks with file paths) when creating/editing multiple files';
    
    if (params.currentFile) {
      prompt += `\n\nCurrent file (${params.currentFile.name}):\n\`\`\`\n${params.currentFile.content}\n\`\`\``;
    }

    if (params.files && params.files.length > 0) {
      prompt += '\n\nContext files:';
      for (const file of params.files.slice(0, 5)) { // ✅   5 
        prompt += `\n\n--- ${file.path} ---\n\`\`\`\n${file.content.slice(0, 5000)}\n\`\`\``; // ✅   5000   
      }
      prompt += `

Treat entries prefixed with "attachment/" as user-uploaded files (not inline pasted code).`;
    }

    if (params.projectContext?.fileTree) {
      prompt += `\n\nProject structure:\n${JSON.stringify(params.projectContext.fileTree, null, 2)}`;
    }

    if (params.context) {
      prompt += `\n\nAdditional local analysis context:\n${params.context}`;
    }

    prompt += '\n\nWhen creating or changing files, return either:\n1) JSON: {"files":[{"path":"relative/path","content":"..."}]}\n2) Markdown fenced blocks where fence label is the relative file path.';

    return prompt;
  }

  private buildModificationPrompt(params: AIRequestParams): string {
    if (!params.currentFile) {
      return `You must NOT regenerate full files. Return strict JSON only.

Task: ${params.prompt}

No active file is currently opened in the editor.
Use project context and return one of these actions:
- {"action":"open_file","path":"relative/path.ext","reason":"why this file is needed"}
- {"action":"apply_patch","file":"relative/path.ext","patch":"@@ ..."}
- {"actions":[{"action":"apply_patch","file":"relative/path1.ext","patch":"@@ ..."},{"action":"apply_patch","file":"relative/path2.ext","patch":"@@ ..."}]}
- {"action":"needs_context","reason":"..."}

Rules:
- Prefer open_file when file targets are uncertain but inferable from project context.
- If the user clearly asked to add/remove/update content in existing files, treat it as edit (not chat).
- Multi-file edits are allowed when the task logically spans related files.
- Keep patches minimal and localized per file.
- Do NOT return full-file content.
- Do not add markdown, bullets, prose, or code fences.`;
    }

    return `You must NOT regenerate the full file. Return strict JSON only.

Task: ${params.prompt}

Target file (the ONLY editable file for this request): ${params.currentFile.path}
\`\`\`
${params.currentFile.content}
\`\`\`

Rules:
- ${params.currentFile.path} is the primary context file, but you may edit additional related files when required by the task.
- If the user explicitly asks to create a NEW file, you may return action=create_file with a relative path
- Requests like "add translation", "update locale", or "add key" are usually edits to existing files (use apply_patch), not create_file
- If no file is open or scope is unclear, you may request opening a likely target file with action=open_file
- If the user asked to edit a specific function, prefer action=replace_body for that function
- If the requested edit scope is unclear, return action=needs_context and ask for function/class name or exact lines
- Keep diffs minimal and localized (smallest possible hunk)
- Prefer apply_patch for non-Python files and replace_body only for Python function body updates
- Do NOT return full-file content in any field
- If the request is ambiguous or missing needed code context, return:
{"action":"needs_context","reason":"..."}

Allowed response formats (JSON only):
1) AST mode: {"action":"replace_body","file":"${params.currentFile.path}","target_type":"function","target_name":"...","new_body":"..."}
2) Patch mode: {"action":"apply_patch","file":"${params.currentFile.path}","patch":"@@ ..."}
3) Open mode: {"action":"open_file","path":"relative/path.ext","reason":"why this file is needed"}
4) Create mode: {"action":"create_file","path":"relative/path.ext","content":"..."}
5) Multi-step mode (single or multi-file): {"actions":[<any of the actions above>]}
Do not add markdown, bullets, prose, or code fences.`;
  }


  private buildReviewPrompt(params: AIRequestParams): string {
    let prompt = 'Review this code for:\n- Code quality & best practices\n- Potential bugs\n- Performance issues\n- Security concerns\n- Improvement suggestions\n\n';

    if (params.currentFile) {
      prompt += `File: ${params.currentFile.name}\n\`\`\`\n${params.currentFile.content}\n\`\`\``;
    } else {
      prompt += params.prompt;
    }

    return prompt;
  }

  private buildExplainPrompt(params: AIRequestParams): string {
    let prompt = params.prompt;

    if (params.currentFile) {
      prompt += `

Active file (${params.currentFile.path}):
\`\`\`
${params.currentFile.content.slice(0, 10000)}
\`\`\``;
    }

    if (params.files && params.files.length > 0) {
      prompt += `

Relevant files (project + user attachments):`;
      for (const file of params.files.slice(0, 8)) {
        prompt += `

--- ${file.path} ---
\`\`\`
${file.content.slice(0, 3000)}
\`\`\``;
      }
      prompt += `

Treat entries prefixed with "attachment/" as user-uploaded files (not inline pasted code).`;
    }

    if (params.projectContext?.fileTree) {
      prompt += `

Project tree snapshot:
${JSON.stringify(params.projectContext.fileTree, null, 2).slice(0, 12000)}`;
    }

    if (params.context) {
      prompt += `

Local analyzer context:
${params.context}`;
    }

    prompt += `

If project context is present, base your answer on it directly instead of asking the user to restate project basics.`;

    return prompt;
  }

  private buildProjectPrompt(params: ProjectGenerationParams): string {
    let prompt = `Generate a complete ${params.type} project:\n${params.description}\n\n`;

    if (params.technologies?.length) {
      prompt += `Technologies: ${params.technologies.join(', ')}\n`;
    }

    if (params.features?.length) {
      prompt += `Features:\n${params.features.map(f => `- ${f}`).join('\n')}\n`;
    }

    if (params.language) {
      prompt += `Primary language: ${params.language}\n`;
    }

    prompt += `\nReturn the result as JSON ONLY (no markdown, no prose) using this exact schema:
{
  "projectName": "string",
  "files": [
    {
      "path": "relative/path/from/project/root",
      "content": "full file content"
    }
  ]
}

Rules:
- Include all required runnable files
- Use relative paths only
- Do not include explanations
- The response must be valid JSON`;

    return prompt;
  }

  private resolveSystemPrompt(model: AIModel, userOverride: string | undefined, fallback: string): string {
    const base = (userOverride && userOverride.trim()) || fallback;
    const providerGuidance = this.getProviderPromptGuidance(model);
    return `${base}

${providerGuidance}`;
  }

  private getProviderPromptGuidance(model: AIModel): string {
    const shared = [
      'Output must follow the requested format exactly.',
      'When JSON is requested, return JSON only without markdown fences or narrative text.',
      'Prefer concise, deterministic, machine-parseable responses for edit workflows.',
    ];

    switch (model.provider) {
      case 'anthropic':
        return [...shared, 'Do not use XML wrappers or assistant preambles.'].join('\n');
      case 'google':
        return [...shared, 'Do not prepend safety summaries when strict format is requested.'].join('\n');
      case 'deepseek':
        return [...shared, 'Avoid explanatory prose outside the required schema.'].join('\n');
      case 'moonshot':
        return [...shared, 'Return one final payload only, with no trailing notes.'].join('\n');
      case 'openai':
      default:
        return [...shared, 'Return one valid payload; do not emit intermediate reasoning.'].join('\n');
    }
  }


  // ✅ System Prompts
  private getCodeGenerationSystemPrompt(): string {
    return `You are an expert software developer. Generate high-quality, production-ready code.
Guidelines:
- Clean, well-documented code
- Error handling
- Meaningful names
- Comments for complex logic
- Proper formatting
- Follow best practices`;
  }

  private getCodeModificationSystemPrompt(): string {
    return `You are an expert software developer. Modify code precisely.
Guidelines:
- Preserve structure when possible
- Minimal effective changes
- Maintain consistency
- NEVER rewrite the full file when a localized edit is enough
- Prefer function-level/body-level edits over full-file output
- Return strict machine-readable JSON instructions only (no markdown)`;
  }

  private getCodeReviewSystemPrompt(): string {
    return `You are an expert code reviewer. Provide thorough, constructive feedback.
Focus on: quality, bugs, performance, security, best practices, readability.`;
  }

  private getProjectGenerationSystemPrompt(): string {
    return `You are an expert full-stack developer. Generate complete, runnable projects.
Include: proper structure, all files, clean code, error handling, README, dependencies.
IMPORTANT: For project generation responses, return strict valid JSON only with a top-level \"files\" array.`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
