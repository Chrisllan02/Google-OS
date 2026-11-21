export type AIProviderMode = 'cloud' | 'local';
export type LocalAIEngine = 'ollama' | 'openai-compatible';

export interface LocalAIConfig {
  mode: AIProviderMode;
  engine: LocalAIEngine;
  endpoint: string;
  model: string;
}

export const AI_CONFIG_STORAGE_KEY = 'workspace_ai_provider_config_v1';

export const DEFAULT_AI_CONFIG: LocalAIConfig = {
  mode: 'cloud',
  engine: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3.2',
};

export const LOCAL_AI_PRESETS: Array<{
  id: string;
  label: string;
  engine: LocalAIEngine;
  endpoint: string;
  model: string;
}> = [
  {
    id: 'ollama',
    label: 'Ollama (Padrão)',
    engine: 'ollama',
    endpoint: 'http://localhost:11434',
    model: 'llama3.2',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    engine: 'openai-compatible',
    endpoint: 'http://localhost:1234',
    model: 'local-model',
  },
];

const ALLOWED_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Validates that a local AI endpoint strictly targets the user's own machine
 * (loopback only) to prevent unintended external requests.
 */
export function validateLocalEndpoint(rawUrl: string): { valid: boolean; normalized: string; error?: string } {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Informe o endereço local (ex: http://localhost:11434).' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, normalized: '', error: 'Use protocolo http:// ou https://.' };
    }
    if (!ALLOWED_LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
      return {
        valid: false,
        normalized: '',
        error: 'Por segurança, a IA local aceita apenas endereços da própria máquina (localhost ou 127.0.0.1).',
      };
    }
    return { valid: true, normalized: `${parsed.protocol}//${parsed.host}` };
  } catch {
    return { valid: false, normalized: '', error: 'Endereço inválido. Exemplo: http://localhost:11434' };
  }
}

export function parseAIConfig(raw: string | null): LocalAIConfig {
  if (!raw) return { ...DEFAULT_AI_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalAIConfig>;
    const mode: AIProviderMode = parsed.mode === 'local' ? 'local' : 'cloud';
    const engine: LocalAIEngine = parsed.engine === 'openai-compatible' ? 'openai-compatible' : 'ollama';
    const endpointCheck = validateLocalEndpoint(parsed.endpoint || DEFAULT_AI_CONFIG.endpoint);
    const model =
      typeof parsed.model === 'string' && parsed.model.trim().length > 0
        ? parsed.model.trim().slice(0, 80)
        : DEFAULT_AI_CONFIG.model;
    return {
      mode,
      engine,
      endpoint: endpointCheck.valid ? endpointCheck.normalized : DEFAULT_AI_CONFIG.endpoint,
      model,
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function loadAIConfig(): LocalAIConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_AI_CONFIG };
  try {
    return parseAIConfig(window.localStorage.getItem(AI_CONFIG_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function saveAIConfig(config: LocalAIConfig): LocalAIConfig {
  const endpointCheck = validateLocalEndpoint(config.endpoint);
  const sanitized: LocalAIConfig = {
    mode: config.mode === 'local' ? 'local' : 'cloud',
    engine: config.engine === 'openai-compatible' ? 'openai-compatible' : 'ollama',
    endpoint: endpointCheck.valid ? endpointCheck.normalized : DEFAULT_AI_CONFIG.endpoint,
    model: (config.model || DEFAULT_AI_CONFIG.model).trim().slice(0, 80) || DEFAULT_AI_CONFIG.model,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      /* ignore quota errors */
    }
  }
  return sanitized;
}

export function buildLocalAIRequest(
  config: LocalAIConfig,
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
  systemInstruction?: string,
): { url: string; body: Record<string, unknown> } {
  const check = validateLocalEndpoint(config.endpoint);
  if (!check.valid) {
    throw new Error(check.error || 'Endereço de IA local inválido.');
  }
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  for (const item of history.slice(-20)) {
    messages.push({ role: item.role, content: item.text });
  }
  messages.push({ role: 'user', content: prompt });

  if (config.engine === 'ollama') {
    return {
      url: `${check.normalized}/api/chat`,
      body: {
        model: config.model,
        messages,
        stream: false,
      },
    };
  }

  return {
    url: `${check.normalized}/v1/chat/completions`,
    body: {
      model: config.model,
      messages,
      stream: false,
    },
  };
}

export function extractLocalAIResponseText(engine: LocalAIEngine, payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as Record<string, unknown>;
  if (engine === 'ollama') {
    const msg = data.message as { content?: unknown } | undefined;
    if (typeof msg?.content === 'string') return msg.content.trim();
    if (typeof data.response === 'string') return data.response.trim();
    return '';
  }
  const choices = data.choices as Array<{ message?: { content?: unknown } }> | undefined;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}
