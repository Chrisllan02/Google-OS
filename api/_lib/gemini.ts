import { GoogleGenAI } from '@google/genai';

type Task = 'chat' | 'search' | 'generate';
type Tool = 'search' | 'maps';
type HistoryItem = { role: 'user' | 'assistant'; text: string };
type GeminiInput = { task: Task; prompt: string; history: HistoryItem[]; tool: Tool };
type GeminiResult = { status: number; body: object };

const MODEL = 'gemini-3.8-flash';
const MAX_TEXT = 4000;
const MAX_HISTORY = 20;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const SYSTEM_INSTRUCTION =
  'Você é um assistente inteligente do Google Workspace OS. Você ajuda o usuário a gerenciar seus e-mails, arquivos do Drive, agenda e tarefas. Seja conciso, útil e amigável. Use formatação Markdown simples quando necessário.';

const GROUNDING_BLOCK_MS = 10 * 60_000;
const RETRY_DELAY_MS = 800;

const hits = new Map<string, number[]>();
let groundingBlockedUntil = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length) hits.set(key, recent);
    else hits.delete(key);
  }
  const recent = hits.get(ip) ?? [];
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
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
  if (isRateLimited(input.ip)) {
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
    const ai = new GoogleGenAI({ apiKey });
    const generate = (withTools: boolean) =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: { systemInstruction, tools: withTools ? tools : undefined },
      });
    const useTools = Boolean(tools) && Date.now() > groundingBlockedUntil;
    const response = await generate(useTools).catch(async () => {
      if (useTools) groundingBlockedUntil = Date.now() + GROUNDING_BLOCK_MS;
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
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || err?.status === 400 || err?.status === 403) {
      return { status: 503, body: { error: 'Para interagir com o Gemini, configure a variável GEMINI_API_KEY no ambiente.' } };
    }
    return { status: 502, body: { error: 'Não foi possível responder agora.' } };
  }
}

