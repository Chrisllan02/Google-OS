import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizeHtml, encodeBase64Utf8, decodeBase64Utf8 } from './sanitize';

test('escapeHtml neutralizes HTML special characters', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)"> & \'test\''),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;'
  );
});

test('sanitizeHtml strips scripts, iframes, event handlers, and javascript URIs while keeping safe formatting', () => {
  const payload =
    '<p>Olá <strong>Chrisllan</strong></p><script>alert(1)</script><img src="x" onerror="alert(2)" /><a href="javascript:alert(3)">Link</a><iframe src="https://evil.test"></iframe>';
  const clean = sanitizeHtml(payload);

  assert.ok(clean.includes('<p>Olá <strong>Chrisllan</strong></p>'));
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('onerror'));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(!clean.includes('<iframe'));
});

test('sanitizeHtml defends against nested script tags and data:text/html links', () => {
  const nested = '<scr<script>ipt>alert(1)</scr</script>ipt><a href="data:text/html,<script>alert(1)</script>">click</a>';
  const clean = sanitizeHtml(nested);
  assert.ok(!/javascript:|data:text\/html|<script/i.test(clean));
});

test('encodeBase64Utf8 and decodeBase64Utf8 round-trip Portuguese accents and emojis cleanly', () => {
  const original = 'Relatório Q2 — Revisão rápida ✓ 🚀';
  const encoded = encodeBase64Utf8(original);
  assert.equal(decodeBase64Utf8(encoded), original);
});
