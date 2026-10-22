export type GeminiPayload = {
  task: 'chat' | 'search' | 'generate';
  prompt: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  tool?: 'search' | 'maps';
};

export class GeminiUnavailableError extends Error {}

export async function askGemini(payload: GeminiPayload): Promise<{ text: string; sources: unknown[] }> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 503) throw new GeminiUnavailableError(json.error ?? 'IA não configurada.');
  if (!res.ok) throw new Error(json.error ?? 'Não foi possível responder agora.');
  return json;
}
