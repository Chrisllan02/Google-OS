import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EmailItem,
  filterEmails,
  applyBatchEmailAction,
  parseGmailSearchTokens,
  getSmartRepliesForEmail,
} from './mailLogic';

const SAMPLE_EMAILS: EmailItem[] = [
  {
    id: '1',
    sender: 'Gabriel Silva',
    senderInit: 'G',
    senderEmail: 'gabriel@example.com',
    subject: 'Dashboard de métricas — revisão urgente',
    preview: 'Precisamos revisitar os KPIs antes da reunião...',
    time: '10:32',
    folder: 'inbox',
    category: 'primary',
    read: false,
    isStarred: true,
    isImportant: true,
    hasAttachment: true,
    labels: ['label_project'],
  },
  {
    id: '2',
    sender: 'Ana Lima',
    senderInit: 'A',
    senderEmail: 'ana@example.com',
    subject: 'Convite para revisão de design',
    preview: 'Compartilhei o novo protótipo do Figma...',
    time: '09:15',
    folder: 'inbox',
    category: 'social',
    read: true,
    isStarred: false,
    isImportant: true,
    hasAttachment: false,
    labels: [],
  },
  {
    id: '3',
    sender: 'Ofertas Cloud',
    senderInit: 'O',
    senderEmail: 'promo@cloud.io',
    subject: 'Desconto de 40% no plano anual',
    preview: 'Aproveite créditos extras para sua equipe...',
    time: 'Ontem',
    folder: 'inbox',
    category: 'promotions',
    read: false,
    isStarred: false,
    isImportant: false,
    hasAttachment: false,
    labels: ['label_finance'],
  },
  {
    id: '4',
    sender: 'Rascunho',
    senderInit: 'R',
    subject: 'Proposta Q3',
    preview: 'Resumo executivo...',
    time: 'Rascunho',
    folder: 'drafts',
    read: true,
  },
];

test('filterEmails filters by folder, category, and custom labels accurately', () => {
  const primaryOnly = filterEmails(SAMPLE_EMAILS, { folder: 'inbox', category: 'primary' });
  assert.equal(primaryOnly.length, 1);
  assert.equal(primaryOnly[0].id, '1');

  const socialOnly = filterEmails(SAMPLE_EMAILS, { folder: 'inbox', category: 'social' });
  assert.equal(socialOnly.length, 1);
  assert.equal(socialOnly[0].id, '2');

  const starred = filterEmails(SAMPLE_EMAILS, { folder: 'starred' });
  assert.equal(starred.length, 1);
  assert.equal(starred[0].id, '1');

  const drafts = filterEmails(SAMPLE_EMAILS, { folder: 'drafts' });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, '4');

  const projectLabel = filterEmails(SAMPLE_EMAILS, { folder: 'label_project' });
  assert.equal(projectLabel.length, 1);
  assert.equal(projectLabel[0].id, '1');
});

test('parseGmailSearchTokens and filterEmails support Gmail search operators', () => {
  const parsed = parseGmailSearchTokens('from:gabriel has:attachment is:unread kpis');
  assert.equal(parsed.from, 'gabriel');
  assert.equal(parsed.hasAttachment, true);
  assert.equal(parsed.isUnread, true);
  assert.deepEqual(parsed.freeText, ['kpis']);

  const matched = filterEmails(SAMPLE_EMAILS, {
    folder: 'inbox',
    searchQuery: 'from:gabriel has:attachment is:unread kpis',
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, '1');
});

test('applyBatchEmailAction handles archive, snooze, labels, star, and trash', () => {
  const snoozed = applyBatchEmailAction(SAMPLE_EMAILS, ['1'], 'snooze', {
    snoozedUntil: 'Amanhã, 08:00',
  });
  const item1 = snoozed.find((e) => e.id === '1')!;
  assert.equal(item1.folder, 'snoozed');
  assert.equal(item1.snoozedUntil, 'Amanhã, 08:00');

  const labeled = applyBatchEmailAction(snoozed, ['2'], 'add_label', {
    labelId: 'label_project',
  });
  assert.ok(labeled.find((e) => e.id === '2')!.labels?.includes('label_project'));

  const trashed = applyBatchEmailAction(labeled, ['3'], 'trash');
  assert.equal(trashed.find((e) => e.id === '3')!.folder, 'trash');

  const deleted = applyBatchEmailAction(trashed, ['3'], 'delete_forever');
  assert.equal(deleted.find((e) => e.id === '3'), undefined);
});

test('getSmartRepliesForEmail returns context-aware replies', () => {
  const replies = getSmartRepliesForEmail(SAMPLE_EMAILS[0]);
  assert.equal(replies.length, 3);
  assert.ok(replies[0].includes('KPIs'));
});

test('pinning sorts emails to top and muting hides from default inbox unless searched', () => {
  const pinned = applyBatchEmailAction(SAMPLE_EMAILS, ['3'], 'pin');
  const inboxList = filterEmails(pinned, { folder: 'inbox', category: 'all' });
  assert.equal(inboxList[0].id, '3');

  const muted = applyBatchEmailAction(pinned, ['1'], 'mute');
  const afterMute = filterEmails(muted, { folder: 'inbox', category: 'all' });
  assert.equal(afterMute.some((e) => e.id === '1'), false);

  const searchedMuted = filterEmails(muted, { folder: 'inbox', searchQuery: 'is:muted' });
  assert.equal(searchedMuted.length, 1);
  assert.equal(searchedMuted[0].id, '1');
});

test('in:folder and in:anywhere operators override active folder cleanly', () => {
  const inDrafts = filterEmails(SAMPLE_EMAILS, { folder: 'inbox', searchQuery: 'in:drafts proposta' });
  assert.equal(inDrafts.length, 1);
  assert.equal(inDrafts[0].id, '4');

  const trashedList = applyBatchEmailAction(SAMPLE_EMAILS, ['3'], 'trash');
  const inAnywhere = filterEmails(trashedList, { folder: 'inbox', searchQuery: 'in:anywhere desconto' });
  assert.equal(inAnywhere.length, 1);
  assert.equal(inAnywhere[0].id, '3');
});
