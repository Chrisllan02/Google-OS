import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGeminiRequest } from './gemini';

test('handleGeminiRequest rejects non-POST methods with 405', async () => {
  const res = await handleGeminiRequest({ method: 'GET', body: {}, ip: '127.0.0.1' }, 'fake-key');
  assert.equal(res.status, 405);
});

test('handleGeminiRequest validates payload task, prompt, and history bounds', async () => {
  const invalidTask = await handleGeminiRequest(
    { method: 'POST', body: { task: 'invalid', prompt: 'oi' }, ip: '127.0.0.1' },
    'fake-key',
  );
  assert.equal(invalidTask.status, 400);

  const emptyPrompt = await handleGeminiRequest(
    { method: 'POST', body: { task: 'chat', prompt: '   ' }, ip: '127.0.0.1' },
    'fake-key',
  );
  assert.equal(emptyPrompt.status, 400);
});

test('handleGeminiRequest returns 503 when GEMINI_API_KEY is missing', async () => {
  const res = await handleGeminiRequest(
    { method: 'POST', body: { task: 'chat', prompt: 'Olá' }, ip: '127.0.0.2' },
    undefined,
  );
  assert.equal(res.status, 503);
});
