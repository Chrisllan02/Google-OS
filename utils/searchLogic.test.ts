import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSearchOperators,
  filterWorkspaceSearchResults,
  addSearchHistoryEntry,
  removeSearchHistoryEntry,
} from './searchLogic';

test('parseSearchOperators extracts from:, type:, and is:starred operators cleanly', () => {
  const parsed = parseSearchOperators('dashboard from:gabriel type:sheet is:starred');
  assert.equal(parsed.cleanQuery, 'dashboard');
  assert.equal(parsed.fromToken, 'gabriel');
  assert.equal(parsed.typeToken, 'sheet');
  assert.equal(parsed.starredOnly, true);
});

test('filterWorkspaceSearchResults filters by type, sender, date, and file subtype across all Workspace modules', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const dataset = {
    emails: [
      { id: 'e1', subject: 'Métricas Q2', sender: 'Gabriel Silva', senderInit: 'G', senderEmail: 'gabriel@example.com', preview: 'CAC e retenção', time: 'Hoje', folder: 'inbox' as const, read: false, isStarred: true },
      { id: 'e2', subject: 'Convite Figma', sender: 'Ana Lima', senderInit: 'A', senderEmail: 'ana@example.com', preview: 'Protótipo', time: '05 abr', folder: 'inbox' as const, read: true, isStarred: false },
    ],
    files: [
      { id: 'f1', name: 'Métricas de Marketing.xlsx', type: 'sheet', owner: 'eu', date: 'Editado hoje', isStarred: true },
      { id: 'f2', name: 'Plano Trimestral Q2', type: 'doc', owner: 'eu', date: 'Editado hoje', isStarred: false },
    ],
    events: [
      { id: 'ev1', title: 'Check-in de Métricas Q2', start: '2026-11-18T16:30:00.000Z', end: '2026-11-18T17:15:00.000Z', calendarId: 'primary', guests: [{ email: 'gabriel@example.com', name: 'Gabriel Silva' }] },
    ],
    tasks: [
      { id: 't1', title: 'Validar métricas com Gabriel', completed: false, starred: true, date: '2026-11-18T18:00:00.000Z' },
    ],
    notes: [
      { id: 1, title: 'Dashboard & Métricas Q2', content: 'KPIs semanais', color: 'green', pinned: true, date: '2026-11-18T09:00:00.000Z' },
    ],
  };

  const allMatches = filterWorkspaceSearchResults(dataset, {
    query: 'Métricas',
    typeFilter: 'all',
    dateFilter: 'today',
    senderFilter: '',
    now,
  });
  assert.equal(allMatches.emails.length, 1);
  assert.equal(allMatches.files.length, 1);
  assert.equal(allMatches.events.length, 1);
  assert.equal(allMatches.tasks.length, 1);
  assert.equal(allMatches.notes.length, 1);

  const onlyGabrielEvents = filterWorkspaceSearchResults(dataset, {
    query: 'Métricas',
    typeFilter: 'events',
    dateFilter: 'any',
    senderFilter: 'gabriel',
    now,
  });
  assert.equal(onlyGabrielEvents.events.length, 1);
  assert.equal(onlyGabrielEvents.emails.length, 0);

  const sheetOnly = filterWorkspaceSearchResults(dataset, {
    query: 'type:sheet',
    typeFilter: 'files',
    dateFilter: 'any',
    senderFilter: '',
    now,
  });
  assert.equal(sheetOnly.files.length, 1);
  assert.equal(sheetOnly.files[0].id, 'f1');
});

test('addSearchHistoryEntry and removeSearchHistoryEntry deduplicate and limit history cleanly', () => {
  let history: string[] = [];
  history = addSearchHistoryEntry(history, 'Q2');
  history = addSearchHistoryEntry(history, 'Sprint');
  history = addSearchHistoryEntry(history, 'q2');
  assert.deepEqual(history, ['q2', 'Sprint']);

  history = removeSearchHistoryEntry(history, 'Sprint');
  assert.deepEqual(history, ['q2']);
});

test('type:sheet, is:unread, has:attachment, and from: strictly scope results across modules', () => {
  const now = new Date('2026-11-18T12:00:00.000Z');
  const dataset = {
    emails: [
      { id: 'e1', subject: 'Métricas Q2', sender: 'Gabriel Silva', senderInit: 'G', senderEmail: 'gabriel@example.com', preview: 'Anexo pronto', time: 'Hoje', folder: 'inbox' as const, read: false, isStarred: true, attachments: [{ name: 'q2.pdf', size: '1MB', type: 'pdf' }] },
      { id: 'e2', subject: 'Lido sem anexo', sender: 'Ana Lima', senderInit: 'A', senderEmail: 'ana@example.com', preview: 'Ok', time: 'Hoje', folder: 'inbox' as const, read: true, isStarred: false },
    ],
    files: [
      { id: 'f1', name: 'Métricas.xlsx', type: 'sheet', owner: 'eu', date: 'Hoje', isStarred: true },
      { id: 'f2', name: 'Plano.docx', type: 'doc', owner: 'eu', date: 'Hoje', isStarred: false },
    ],
    events: [
      { id: 'ev1', title: 'Daily', start: '2026-11-18T10:00:00.000Z', end: '2026-11-18T10:30:00.000Z', calendarId: 'primary' },
    ],
    tasks: [
      { id: 't1', title: 'Alinhar com Gabriel', completed: false, date: '2026-11-18T18:00:00.000Z' },
      { id: 't2', title: 'Outra tarefa', completed: false, date: '2026-11-18T18:00:00.000Z' },
    ],
    notes: [
      { id: 1, title: 'Nota Keep', content: 'Texto', color: 'yellow', pinned: true, date: '2026-11-18T09:00:00.000Z' },
    ],
  };

  const sheetsOnly = filterWorkspaceSearchResults(dataset, {
    query: 'type:sheet',
    typeFilter: 'all',
    dateFilter: 'any',
    senderFilter: '',
    now,
  });
  assert.equal(sheetsOnly.files.length, 1);
  assert.equal(sheetsOnly.emails.length, 0);
  assert.equal(sheetsOnly.events.length, 0);
  assert.equal(sheetsOnly.tasks.length, 0);
  assert.equal(sheetsOnly.notes.length, 0);

  const unreadWithAttach = filterWorkspaceSearchResults(dataset, {
    query: 'is:unread has:attachment',
    typeFilter: 'all',
    dateFilter: 'any',
    senderFilter: '',
    now,
  });
  assert.equal(unreadWithAttach.emails.length, 1);
  assert.equal(unreadWithAttach.emails[0].id, 'e1');
  assert.equal(unreadWithAttach.files.length, 0);

  const fromGabriel = filterWorkspaceSearchResults(dataset, {
    query: 'from:gabriel',
    typeFilter: 'all',
    dateFilter: 'any',
    senderFilter: '',
    now,
  });
  assert.equal(fromGabriel.emails.length, 1);
  assert.equal(fromGabriel.tasks.length, 1);
  assert.equal(fromGabriel.tasks[0].id, 't1');
  assert.equal(fromGabriel.notes.length, 0);
});
