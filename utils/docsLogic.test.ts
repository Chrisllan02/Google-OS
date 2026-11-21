import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDocumentStats,
  extractDocumentOutline,
  countMatchesInHtml,
  findAndReplaceInHtml,
  convertHtmlToMarkdown,
  filterComments,
  toggleResolveComment,
  deleteComment,
  buildExportHtmlDocument,
  DocCommentItem,
} from './docsLogic';

test('computeDocumentStats calculates words, characters, paragraphs, and pages accurately', () => {
  const html = '<h1>Plano Estrategico</h1><p>Meta trimestral de engenharia e produto.</p><p>Segunda linha.</p>';
  const stats = computeDocumentStats(html);
  assert.equal(stats.words, 10);
  assert.equal(stats.paragraphs, 3);
  assert.equal(stats.pages, 1);
  assert.ok(stats.characters > stats.charactersNoSpaces);
});

test('extractDocumentOutline parses h1, h2, and h3 headings in order', () => {
  const html = '<h1>Visão Geral</h1><p>Texto</p><h2>Objetivos Q2</h2><h3>Métrica 1</h3>';
  const outline = extractDocumentOutline(html);
  assert.equal(outline.length, 3);
  assert.equal(outline[0].level, 1);
  assert.equal(outline[0].text, 'Visão Geral');
  assert.equal(outline[1].level, 2);
  assert.equal(outline[1].text, 'Objetivos Q2');
  assert.equal(outline[2].level, 3);
  assert.equal(outline[2].text, 'Métrica 1');
});

test('findAndReplaceInHtml replaces text inside nodes without corrupting HTML tags', () => {
  const html = '<h1 class="title">Projeto Alpha</h1><p>O Projeto Alpha está ativo no cluster alpha.</p>';
  assert.equal(countMatchesInHtml(html, 'alpha', false), 3);
  assert.equal(countMatchesInHtml(html, 'Alpha', true), 2);

  const single = findAndReplaceInHtml(html, 'Alpha', 'Beta', { matchCase: true, replaceAll: false });
  assert.equal(single.replacements, 1);
  assert.ok(single.updatedHtml.includes('<h1 class="title">Projeto Beta</h1>'));
  assert.ok(single.updatedHtml.includes('O Projeto Alpha'));

  const all = findAndReplaceInHtml(html, 'alpha', 'Omega', { matchCase: false, replaceAll: true });
  assert.equal(all.replacements, 3);
  assert.ok(all.updatedHtml.includes('<h1 class="title">Projeto Omega</h1>'));
});

test('convertHtmlToMarkdown converts headings, bold, lists, and paragraphs cleanly', () => {
  const html = '<h1>Título Principal</h1><p>Texto em <strong>negrito</strong> e <em>itálico</em>.</p><ul><li>Item A</li><li>Item B</li></ul>';
  const md = convertHtmlToMarkdown(html);
  assert.ok(md.includes('# Título Principal'));
  assert.ok(md.includes('**negrito**'));
  assert.ok(md.includes('*itálico*'));
  assert.ok(md.includes('- Item A'));
});

test('filterComments, toggleResolveComment, and deleteComment manage comment lifecycle', () => {
  const sample: DocCommentItem[] = [
    {
      id: 'c1',
      author: 'Gabriel',
      authorEmail: 'g@example.com',
      createdAt: 'Agora',
      quotedText: 'Meta Q2',
      text: 'Revisar meta',
      resolved: false,
      replies: [],
    },
    {
      id: 'c2',
      author: 'Ana',
      authorEmail: 'a@example.com',
      createdAt: 'Ontem',
      quotedText: 'Contraste',
      text: 'Aprovado',
      resolved: true,
      replies: [],
    },
  ];

  assert.equal(filterComments(sample, 'open').length, 1);
  assert.equal(filterComments(sample, 'resolved').length, 1);
  assert.equal(filterComments(sample, 'all').length, 2);

  const resolvedAll = toggleResolveComment(sample, 'c1');
  assert.equal(filterComments(resolvedAll, 'open').length, 0);
  assert.equal(filterComments(resolvedAll, 'resolved').length, 2);

  const reopened = toggleResolveComment(resolvedAll, 'c2');
  assert.equal(reopened.find((c) => c.id === 'c2')?.resolved, false);

  const afterDelete = deleteComment(reopened, 'c1');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'c2');
});

test('buildExportHtmlDocument escapes dangerous characters in document title', () => {
  const exported = buildExportHtmlDocument('<script>alert(1)</script> Relatório "Q2"', '<p>Ok</p>');
  assert.ok(exported.includes('&lt;script&gt;alert(1)&lt;/script&gt; Relatório &quot;Q2&quot;'));
  assert.ok(!exported.includes('<title><script>'));
  assert.ok(exported.includes('<p>Ok</p>'));
});

