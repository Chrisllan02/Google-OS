import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGeminiRequest } from './_lib/gemini';

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const { status, body } = await handleGeminiRequest(
    { method: req.method ?? '', body: parseBody(req.body), ip },
    process.env.GEMINI_API_KEY,
  );
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
