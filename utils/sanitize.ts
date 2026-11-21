/**
 * Security utilities for HTML sanitization, escaping, and UTF-8 Base64 encoding.
 * Designed to prevent XSS in rich-text surfaces (Mail, Docs, Drive exports)
 * while remaining pure and testable in both browser and Node environments.
 */

const BLOCKED_TAG_BLOCKS = /<(script|style|iframe|object|embed|applet|meta|link|base|form|input|button|textarea|select|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BLOCKED_STANDALONE_TAGS = /<\/?(script|style|iframe|object|embed|applet|meta|link|base|form|input|button|textarea|select|svg|math)\b[^>]*\/?>/gi;
const EVENT_HANDLER_ATTR = /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URI_ATTR = /\s+(href|src|xlink:href|formaction|action)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*'|(?:javascript|vbscript):[^\s>]+)/gi;
const DANGEROUS_STYLE_ATTR = /\s+style\s*=\s*(?:"[^"]*(?:expression\s*\(|url\s*\(\s*['"]?\s*javascript:)[^"]*"|'[^']*(?:expression\s*\(|url\s*\(\s*['"]?\s*javascript:)[^']*')/gi;
const SRCDOC_ATTR = /\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

export function escapeHtml(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';

  let cleaned = dirty
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(BLOCKED_TAG_BLOCKS, '')
    .replace(BLOCKED_STANDALONE_TAGS, '')
    .replace(EVENT_HANDLER_ATTR, '')
    .replace(DANGEROUS_URI_ATTR, '')
    .replace(DANGEROUS_STYLE_ATTR, '')
    .replace(SRCDOC_ATTR, '');

  // Second pass ensures nested or obfuscated payloads like <scr<script>ipt> cannot reassemble
  if (/<script|\bon[a-z]+\s*=|javascript:/i.test(cleaned)) {
    cleaned = cleaned
      .replace(BLOCKED_TAG_BLOCKS, '')
      .replace(BLOCKED_STANDALONE_TAGS, '')
      .replace(EVENT_HANDLER_ATTR, '')
      .replace(DANGEROUS_URI_ATTR, '');
  }

  return cleaned;
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function decodeBase64Utf8(base64: string): string {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}
