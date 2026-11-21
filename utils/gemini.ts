import {
  buildLocalAIRequest,
  extractLocalAIResponseText,
  loadAIConfig,
  validateLocalEndpoint,
  type LocalAIConfig,
} from './aiConfig';
import { fetchWithTimeout, RequestTimeoutError } from './perfUtils';

export type GeminiPayload = {
  task: 'chat' | 'search' | 'generate';
  prompt: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  tool?: 'search' | 'maps';
};

export class GeminiUnavailableError extends Error {}

const LOCAL_PROBE_TIMEOUT_MS = 5_000;
const LOCAL_AI_TIMEOUT_MS = 45_000;
const CLOUD_AI_TIMEOUT_MS = 30_000;

const LOCAL_SYSTEM_INSTRUCTION =
  'Você é o assistente local do Google OS rodando na máquina do usuário. Seja direto, claro e responda em português do Brasil.';

async function askLocalAI(config: LocalAIConfig, payload: GeminiPayload): Promise<{ text: string; sources: unknown[] }> {
  const { url, body } = buildLocalAIRequest(
    config,
    payload.prompt,
    payload.history ?? [],
    payload.task === 'chat' ? LOCAL_SYSTEM_INSTRUCTION : undefined,
  );
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      LOCAL_AI_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof RequestTimeoutError) {
      throw new Error(`A IA local em ${config.endpoint} excedeu o tempo limite (45s).`);
    }
    throw new GeminiUnavailableError(
      `Não foi possível conectar à IA local em ${config.endpoint}. Verifique se o ${config.engine === 'ollama' ? 'Ollama' : 'servidor local'} está em execução e com CORS liberado.`,
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`IA local respondeu com erro (${res.status}). Verifique o modelo "${config.model}".`);
  }
  const text = extractLocalAIResponseText(config.engine, json);
  if (!text) {
    throw new Error('A IA local retornou uma resposta vazia.');
  }
  return { text, sources: [] };
}

export async function testLocalAIConnection(
  config: LocalAIConfig,
): Promise<{ ok: boolean; message: string }> {
  const check = validateLocalEndpoint(config.endpoint);
  if (!check.valid) {
    return { ok: false, message: check.error || 'Endereço inválido.' };
  }
  const probeUrl = config.engine === 'ollama' ? `${check.normalized}/api/tags` : `${check.normalized}/v1/models`;
  try {
    const res = await fetchWithTimeout(probeUrl, { method: 'GET' }, LOCAL_PROBE_TIMEOUT_MS);
    if (!res.ok) {
      return { ok: false, message: `Servidor respondeu HTTP ${res.status}.` };
    }
    return { ok: true, message: `Conectado com sucesso em ${check.normalized}.` };
  } catch (err) {
    if (err instanceof RequestTimeoutError) {
      return { ok: false, message: `Tempo limite excedido (5s) ao testar ${check.normalized}.` };
    }
    return {
      ok: false,
      message: `Sem resposta em ${check.normalized}. Inicie o ${config.engine === 'ollama' ? 'Ollama' : 'LM Studio'} na sua máquina.`,
    };
  }
}

export async function askGemini(payload: GeminiPayload): Promise<{ text: string; sources: unknown[] }> {
  const aiConfig = loadAIConfig();
  if (aiConfig.mode === 'local') {
    return askLocalAI(aiConfig, payload);
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      '/api/gemini',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      CLOUD_AI_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof RequestTimeoutError) {
      throw new Error('Tempo limite excedido ao aguardar resposta da IA.');
    }
    throw new Error('Falha de rede ao consultar o servidor de IA.');
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 503) throw new GeminiUnavailableError(json.error ?? 'IA não configurada.');
  if (!res.ok) throw new Error(json.error ?? 'Não foi possível responder agora.');
  return json;
}
