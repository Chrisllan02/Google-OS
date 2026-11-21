import { GoogleGenAI } from '@google/genai';
import {
  createSlidingWindowRateLimiter,
  RequestTimeoutError,
  withTimeout,
} from '../../utils/perfUtils';

type Task = 'chat' | 'search' | 'generate';
type Tool = 'search' | 'maps';
type HistoryItem = { role: 'user' | 'assistant'; text: string };
type GeminiInput = { task: Task; prompt: string; history: HistoryItem[]; tool: Tool };
type GeminiResult = { status: number; body: object };

const MODEL = 'gemini-4-hydrogen';
const MAX_TEXT = 4000;
const MAX_HISTORY = 20;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 1000;
const UPSTREAM_TIMEOUT_MS = 25_000;
const MAX_CACHED_CLIENTS = 4;
const SYSTEM_INSTRUCTION =
  'Você é um assistente inteligente do Google Workspace OS. Você ajuda o usuário a gerenciar seus e-mails, arquivos do Drive, agenda e tarefas. Seja conciso, útil e amigável. Use formatação Markdown simples quando necessário.';

const RETRY_DELAY_MS = 500;

const rateLimiter = createSlidingWindowRateLimiter(RATE_LIMIT, RATE_WINDOW_MS, MAX_TRACKED_IPS);
const clientCache = new Map<string, GoogleGenAI>();

function getGeminiClient(apiKey: string): GoogleGenAI {
  const existing = clientCache.get(apiKey);
  if (existing) return existing;
  if (clientCache.size >= MAX_CACHED_CLIENTS) {
    const oldest = clientCache.keys().next().value;
    if (oldest !== undefined) clientCache.delete(oldest);
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  clientCache.set(apiKey, client);
  return client;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isAuthError(err: unknown): boolean {
  const errorObj = err as { message?: string; status?: number } | null;
  const msg = errorObj?.message ?? '';
  return (
    msg.includes('API key not valid') ||
    msg.includes('API_KEY_INVALID') ||
    errorObj?.status === 401 ||
    errorObj?.status === 403
  );
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= MAX_TEXT ? text : null;
}

function parseInput(body: unknown): GeminiInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { task, prompt, history = [], tool = 'search' } = body as Record<string, unknown>;
  if (task !== 'chat' && task !== 'search' && task !== 'generate') return null;
  if (tool !== 'search' && tool !== 'maps') return null;
  const cleanPrompt = cleanText(prompt);
  if (!cleanPrompt || !Array.isArray(history) || history.length > MAX_HISTORY) return null;
  const cleanHistory: HistoryItem[] = [];
  for (const item of history) {
    if (typeof item !== 'object' || item === null) return null;
    const { role, text } = item as Record<string, unknown>;
    const cleanItem = cleanText(text);
    if ((role !== 'user' && role !== 'assistant') || !cleanItem) return null;
    cleanHistory.push({ role, text: cleanItem });
  }
  return { task, prompt: cleanPrompt, history: cleanHistory, tool };
}

export async function handleGeminiRequest(
  input: { method: string; body: unknown; ip: string },
  apiKey: string | undefined,
): Promise<GeminiResult> {
  if (input.method !== 'POST') return { status: 405, body: { error: 'Método não permitido.' } };
  const parsed = parseInput(input.body);
  if (!parsed) return { status: 400, body: { error: 'Requisição inválida.' } };
  if (!apiKey) return { status: 503, body: { error: 'IA não configurada.' } };
  if (rateLimiter.isLimited(input.ip)) {
    return { status: 429, body: { error: 'Muitas requisições. Tente em instantes.' } };
  }

  const { task, prompt, history, tool } = parsed;
  const contents =
    task === 'chat'
      ? [
          ...history.map((item) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.text }],
          })),
          { role: 'user', parts: [{ text: prompt }] },
        ]
      : prompt;
  const systemInstruction = task === 'chat' ? SYSTEM_INSTRUCTION : undefined;
  const tools =
    task === 'generate' ? undefined : tool === 'maps' && task === 'search' ? [{ googleMaps: {} }] : [{ googleSearch: {} }];

  try {
    const ai = getGeminiClient(apiKey);
    const generate = (withTools: boolean) =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents,
          config: { systemInstruction, tools: withTools ? tools : undefined },
        }),
        UPSTREAM_TIMEOUT_MS,
        'Tempo limite da resposta de IA excedido.',
      );
    const useTools = Boolean(tools);
    const response = await generate(useTools).catch(async (firstErr) => {
      if (!useTools || isAuthError(firstErr) || firstErr instanceof RequestTimeoutError) throw firstErr;
      await delay(RETRY_DELAY_MS);
      return generate(false);
    });
    return {
      status: 200,
      body: {
        text: (response.text ?? '').trim(),
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [],
      },
    };
  } catch (err: unknown) {
    if (err instanceof RequestTimeoutError) {
      return { status: 504, body: { error: 'A IA demorou demais para responder. Tente novamente.' } };
    }
    const errorObj = err as { message?: string; status?: number } | null;
    if (isAuthError(errorObj) || errorObj?.status === 400) {
      return { status: 503, body: { error: 'Para interagir com o Gemini, configure a variável GEMINI_API_KEY no ambiente.' } };
    }
    return { status: 502, body: { error: 'Não foi possível responder agora.' } };
  }
}

