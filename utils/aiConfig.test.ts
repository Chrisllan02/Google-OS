import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_CONFIG,
  validateLocalEndpoint,
  parseAIConfig,
  buildLocalAIRequest,
  extractLocalAIResponseText,
} from './aiConfig';

test('validateLocalEndpoint allows only loopback localhost / 127.0.0.1 URLs', () => {
  assert.deepEqual(validateLocalEndpoint('http://localhost:11434/'), {
    valid: true,
    normalized: 'http://localhost:11434',
  });
  assert.deepEqual(validateLocalEndpoint('http://127.0.0.1:1234'), {
    valid: true,
    normalized: 'http://127.0.0.1:1234',
  });
  assert.equal(validateLocalEndpoint('https://evil.example.com').valid, false);
  assert.equal(validateLocalEndpoint('http://169.254.169.254/latest').valid, false);
  assert.equal(validateLocalEndpoint('javascript:alert(1)').valid, false);
});

test('parseAIConfig falls back safely on malformed JSON or non-loopback endpoints', () => {
  assert.deepEqual(parseAIConfig(null), DEFAULT_AI_CONFIG);
  assert.deepEqual(parseAIConfig('{bad json'), DEFAULT_AI_CONFIG);

  const parsed = parseAIConfig(
    JSON.stringify({
      mode: 'local',
      engine: 'openai-compatible',
      endpoint: 'https://remote-host.test',
      model: 'gemma3:4b',
    }),
  );
  assert.equal(parsed.mode, 'local');
  assert.equal(parsed.engine, 'openai-compatible');
  assert.equal(parsed.endpoint, DEFAULT_AI_CONFIG.endpoint);
  assert.equal(parsed.model, 'gemma3:4b');
});

test('buildLocalAIRequest builds Ollama and OpenAI-compatible payloads and extracts replies', () => {
  const ollamaReq = buildLocalAIRequest(
    { mode: 'local', engine: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2' },
    'Resuma minha agenda',
    [{ role: 'user', text: 'Oi' }],
    'Você é um assistente local.',
  );
  assert.equal(ollamaReq.url, 'http://localhost:11434/api/chat');
  assert.equal(ollamaReq.body.model, 'llama3.2');
  assert.equal(extractLocalAIResponseText('ollama', { message: { content: '  Resumo pronto  ' } }), 'Resumo pronto');

  const lmReq = buildLocalAIRequest(
    { mode: 'local', engine: 'openai-compatible', endpoint: 'http://127.0.0.1:1234', model: 'qwen2.5' },
    'Olá',
  );
  assert.equal(lmReq.url, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(
    extractLocalAIResponseText('openai-compatible', { choices: [{ message: { content: 'Tudo certo!' } }] }),
    'Tudo certo!',
  );
});
