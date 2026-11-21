export interface DocumentStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  pages: number;
  readingTimeMinutes: number;
}

export interface OutlineHeading {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

export interface DocCommentItem {
  id: string;
  author: string;
  authorEmail: string;
  createdAt: string;
  quotedText: string;
  text: string;
  resolved: boolean;
  isSuggestion?: boolean;
  suggestedReplacement?: string;
  replies: Array<{
    id: string;
    author: string;
    createdAt: string;
    text: string;
  }>;
}

export interface DocVersionSnapshot {
  id: string;
  name: string;
  createdAt: string;
  author: string;
  html: string;
}

export interface DocTabSection {
  id: string;
  title: string;
  icon: string;
  html: string;
}

export interface PageSetupConfig {
  pageless: boolean;
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
  margins: 'narrow' | 'normal' | 'wide';
  pageColor: string;
  showHeaderFooter: boolean;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  columns: 1 | 2;
}

export interface DocsTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  html: string;
}

export const DEFAULT_PAGE_SETUP: PageSetupConfig = {
  pageless: false,
  orientation: 'portrait',
  paperSize: 'a4',
  margins: 'normal',
  pageColor: '#FFFFFF',
  showHeaderFooter: true,
  headerText: 'Google Workspace · Documento Confidencial',
  footerText: 'Sincronizado via Google Drive',
  showPageNumbers: true,
  columns: 1,
};

export const DOCS_TEMPLATES: DocsTemplate[] = [
  {
    id: 'blank',
    name: 'Documento em branco',
    category: 'Básico',
    description: 'Comece um documento limpo do zero',
    html: '<h1>Título do Documento</h1><p>Comece a digitar seu conteúdo ou pressione <strong>@</strong> para inserir Smart Chips, datas, pessoas e blocos de reunião.</p>',
  },
  {
    id: 'executive-plan',
    name: 'Plano Trimestral & OKRs',
    category: 'Executivo',
    description: 'Estrutura executiva com objetivos, métricas-chave e cronograma',
    html: `<h1>Plano Trimestral Q2 2026 — Produto & Engenharia</h1>
<p><strong>Responsável:</strong> <span data-smart-chip="person" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">@Chrisllan Franco</span> · <strong>Status:</strong> <span data-smart-chip="status" style="background:#E6F4EA;color:#137333;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">● Em andamento</span> · <strong>Atualizado em:</strong> <span data-smart-chip="date" style="background:#F1F3F4;color:#3C4043;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">📅 Hoje</span></p>
<h2>1. Resumo Executivo</h2>
<p>Este documento consolida as prioridades estratégicas do segundo trimestre de 2026 para a plataforma Workspace OS, focando em performance full-stack, governança Zero-Trust e produtividade integrada entre Gmail, Agenda, Keep, Tarefas, Drive e Docs.</p>
<h2>2. Objetivos e Resultados-Chave (OKRs)</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <thead>
    <tr style="background:#F1F5F9;">
      <th style="border:1px solid #CBD5E1;padding:8px 12px;text-align:left;">Objetivo</th>
      <th style="border:1px solid #CBD5E1;padding:8px 12px;text-align:left;">Métrica Principal (KR)</th>
      <th style="border:1px solid #CBD5E1;padding:8px 12px;text-align:left;">Meta Q2</th>
      <th style="border:1px solid #CBD5E1;padding:8px 12px;text-align:left;">Owner</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Adoção Corporativa</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Usuários ativos semanais (WAU)</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">+38%</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Gabriel Silva</td>
    </tr>
    <tr>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Confiabilidade & Latência</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">P95 Tempo de Resposta</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">&lt; 120ms</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Pedro Moreira</td>
    </tr>
    <tr>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Design System Apple Glass</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Cobertura de componentes</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">100%</td>
      <td style="border:1px solid #CBD5E1;padding:8px 12px;">Ana Lima</td>
    </tr>
  </tbody>
</table>
<h2>3. Próximos Passos & Ações</h2>
<ul>
  <li>Finalizar revisão de segurança Zero-Trust com Carlos Eduardo até sexta-feira.</li>
  <li>Validar métricas de retenção e funil de conversão na reunião executiva.</li>
  <li>Publicar changelog técnico da release 2.4 para todos os squads.</li>
</ul>`,
  },
  {
    id: 'meeting-notes',
    name: 'Ata de Reunião Executiva',
    category: 'Reuniões',
    description: 'Notas estruturadas com participantes, pauta, decisões e itens de ação',
    html: `<h1>Ata de Reunião — Alinhamento Semanal de Produto</h1>
<p><strong>Data:</strong> <span data-smart-chip="date" style="background:#F1F3F4;color:#3C4043;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">📅 12 de nov. de 2026</span> · <strong>Participantes:</strong> <span data-smart-chip="person" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">@Chrisllan Franco</span> <span data-smart-chip="person" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">@Gabriel Silva</span> <span data-smart-chip="person" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">@Ana Lima</span></p>
<h2>1. Pauta da Reunião</h2>
<ol>
  <li>Análise dos indicadores da Sprint 12 e velocidade de entrega.</li>
  <li>Demonstração dos fluxos integrados entre Google Drive e Google Docs.</li>
  <li>Alocação de capacidade de engenharia para a próxima semana.</li>
</ol>
<h2>2. Decisões Tomadas</h2>
<p>Ficou aprovado por unanimidade o cronograma de lançamento gradual com foco em estabilidade e testes automatizados de ponta a ponta.</p>
<h2>3. Itens de Ação (Action Items)</h2>
<ul>
  <li>[ ] <strong>Gabriel Silva:</strong> Consolidar feedback dos stakeholders no painel de métricas.</li>
  <li>[ ] <strong>Ana Lima:</strong> Entregar guia atualizado de tipografia e contraste.</li>
  <li>[ ] <strong>Chrisllan Franco:</strong> Aprovar deploy de produção após validação final.</li>
</ul>`,
  },
  {
    id: 'rfc-architecture',
    name: 'RFC — Especificação Técnica',
    category: 'Engenharia',
    description: 'Documento de arquitetura de software, contratos de API e segurança',
    html: `<h1>RFC-042: Arquitetura de Sincronização Offline-First</h1>
<p><strong>Autor:</strong> <span data-smart-chip="person" style="background:#E8F0FE;color:#1967D2;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">@Chrisllan Franco</span> · <strong>Status:</strong> <span data-smart-chip="status" style="background:#FEF7E0;color:#B06000;padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.9em;">● Em revisão</span></p>
<h2>1. Contexto e Motivação</h2>
<p>Garantir que todas as edições em documentos, planilhas, apresentações, notas e tarefas ocorram com latência zero para o usuário final e persistência resiliente.</p>
<h2>2. Desenho da Solução</h2>
<pre style="background:#0F172A;color:#E2E8F0;padding:14px;border-radius:8px;font-family:monospace;font-size:13px;">interface SyncOperation {
  docId: string;
  revision: number;
  checksum: string;
  updatedAt: string;
}</pre>
<h2>3. Segurança e Governança</h2>
<p>Todas as permissões respeitam o modelo RBAC com papéis de Proprietário, Editor e Leitor auditados em tempo real.</p>`,
  },
];

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function computeDocumentStats(html: string): DocumentStats {
  const rawText = stripHtmlToText(html);
  const trimmed = rawText.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = trimmed.length;
  const charactersNoSpaces = trimmed.replace(/\s+/g, '').length;
  const paragraphs = trimmed
    ? trimmed.split(/\n+/).filter((line) => line.trim().length > 0).length
    : 0;
  const pages = Math.max(1, Math.ceil(words / 350));
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs,
    pages,
    readingTimeMinutes,
  };
}

export function extractDocumentOutline(html: string): OutlineHeading[] {
  if (!html) return [];
  const regex = /<h([1-3])(?:\s+[^>]*)?>(.*?)<\/h\1>/gi;
  const headings: OutlineHeading[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(html)) !== null) {
    const level = Number(match[1]) as 1 | 2 | 3;
    const rawInner = match[2] || '';
    const cleanText = stripHtmlToText(rawInner).trim();
    if (cleanText) {
      headings.push({
        id: `heading-${index}-${cleanText.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
        level,
        text: cleanText,
      });
      index += 1;
    }
  }

  return headings;
}

export function countMatchesInHtml(html: string, query: string, matchCase = false): number {
  if (!query) return 0;
  const plain = stripHtmlToText(html);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = matchCase ? 'g' : 'gi';
  const matches = plain.match(new RegExp(escaped, flags));
  return matches ? matches.length : 0;
}

export function findAndReplaceInHtml(
  html: string,
  findText: string,
  replaceText: string,
  options: { matchCase?: boolean; replaceAll?: boolean } = {}
): { updatedHtml: string; replacements: number } {
  if (!findText) return { updatedHtml: html, replacements: 0 };

  const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = `${options.replaceAll !== false ? 'g' : ''}${options.matchCase ? '' : 'i'}`;
  const pattern = new RegExp(escaped, flags);

  let replacements = 0;
  // Split HTML by tags so we only replace inside text nodes and never corrupt HTML attributes/tags
  const parts = html.split(/(<[^>]+>)/g);
  let replacedOnce = false;

  const updatedParts = parts.map((part) => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part;
    }
    if (options.replaceAll === false && replacedOnce) {
      return part;
    }
    return part.replace(pattern, () => {
      replacements += 1;
      replacedOnce = true;
      return replaceText;
    });
  });

  return {
    updatedHtml: updatedParts.join(''),
    replacements,
  };
}

export function convertHtmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<\/(p|div|table|ul|ol|blockquote|pre)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  return md.replace(/\n{3,}/g, '\n\n').trim();
}

export type CommentFilterMode = 'open' | 'resolved' | 'all';

export function filterComments(
  comments: DocCommentItem[],
  mode: CommentFilterMode
): DocCommentItem[] {
  if (mode === 'open') return comments.filter((c) => !c.resolved);
  if (mode === 'resolved') return comments.filter((c) => c.resolved);
  return comments;
}

export function toggleResolveComment(
  comments: DocCommentItem[],
  commentId: string
): DocCommentItem[] {
  return comments.map((c) =>
    c.id === commentId ? { ...c, resolved: !c.resolved } : c
  );
}

export function deleteComment(
  comments: DocCommentItem[],
  commentId: string
): DocCommentItem[] {
  return comments.filter((c) => c.id !== commentId);
}

function escapeDocHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildExportHtmlDocument(title: string, safeBodyHtml: string): string {
  const safeTitle = escapeDocHtmlText(title || 'Documento sem título');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;">${safeBodyHtml}</body></html>`;
}

