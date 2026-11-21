import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterKeepNotes,
  convertTextToChecklist,
  convertChecklistToText,
  duplicateKeepNote,
  applyKeepNoteAction,
  removeLabelFromNotes,
} from './keepLogic';
import { NoteItem } from './GASBridge';

const SAMPLE_NOTES: NoteItem[] = [
  {
    id: 1,
    title: 'Arquitetura Workspace',
    content: 'Definir tokens\nValidar contraste\nPublicar release',
    color: 'yellow',
    pinned: true,
    date: '2026-11-11',
    labels: ['Arquitetura', 'Core'],
    reminder: 'Hoje, 18:00',
  },
  {
    id: 2,
    title: 'Nota Arquivada',
    content: 'Histórico Q1',
    color: 'green',
    pinned: false,
    archived: true,
    date: '2026-11-10',
    labels: ['Financeiro'],
  },
  {
    id: 3,
    title: 'Nota na Lixeira',
    content: 'Rascunho antigo',
    color: 'red',
    pinned: false,
    trashed: true,
    date: '2026-11-09',
  },
];

test('filterKeepNotes filters active notes, reminders, archive, trash, and custom labels accurately', () => {
  const active = filterKeepNotes(SAMPLE_NOTES, { folder: 'notes' });
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 1);

  const reminders = filterKeepNotes(SAMPLE_NOTES, { folder: 'reminders' });
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].id, 1);

  const archived = filterKeepNotes(SAMPLE_NOTES, { folder: 'archive' });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, 2);

  const trashed = filterKeepNotes(SAMPLE_NOTES, { folder: 'trash' });
  assert.equal(trashed.length, 1);
  assert.equal(trashed[0].id, 3);

  const byLabel = filterKeepNotes(SAMPLE_NOTES, { folder: 'label:Arquitetura' });
  assert.equal(byLabel.length, 1);
  assert.equal(byLabel[0].id, 1);
});

test('convertTextToChecklist and convertChecklistToText convert bi-directionally', () => {
  const checklist = convertTextToChecklist('Item 1\n[x] Item 2 concluído\n- Item 3');
  assert.equal(checklist.length, 3);
  assert.equal(checklist[0].text, 'Item 1');
  assert.equal(checklist[0].checked, false);
  assert.equal(checklist[1].checked, true);

  const plain = convertChecklistToText(checklist);
  assert.ok(plain.includes('Item 1'));
  assert.ok(plain.includes('Item 3'));
});

test('applyKeepNoteAction and duplicateKeepNote handle archive, trash, checklist toggle, and cloning', () => {
  const withChecklist = convertTextToChecklist('Passo A\nPasso B');
  let notes: NoteItem[] = [{ ...SAMPLE_NOTES[0], checklist: withChecklist }];

  notes = applyKeepNoteAction(notes, 1, 'toggle_checklist_item', {
    checklistItemId: withChecklist[0].id,
  });
  assert.equal(notes[0].checklist?.[0].checked, true);

  notes = applyKeepNoteAction(notes, 1, 'archive');
  assert.equal(notes[0].archived, true);
  assert.equal(notes[0].pinned, false);

  const copy = duplicateKeepNote(notes[0]);
  assert.notEqual(copy.id, notes[0].id);
  assert.ok(copy.title.includes('(Cópia)'));
  assert.equal(copy.archived, false);
});

test('applyKeepNoteAction edits, unchecks all, deletes checked items, and removeLabelFromNotes cleans orphaned labels', () => {
  const list = convertTextToChecklist('Item A\n[x] Item B\n[x] Item C');
  let notes: NoteItem[] = [{ ...SAMPLE_NOTES[0], checklist: list }];

  notes = applyKeepNoteAction(notes, 1, 'edit_checklist_item', {
    checklistItemId: list[0].id,
    checklistText: 'Item A revisado',
  });
  assert.equal(notes[0].checklist?.[0].text, 'Item A revisado');

  const deletedChecked = applyKeepNoteAction(notes, 1, 'delete_checked_checklist');
  assert.equal(deletedChecked[0].checklist?.length, 1);
  assert.equal(deletedChecked[0].checklist?.[0].text, 'Item A revisado');

  const uncheckedAll = applyKeepNoteAction(notes, 1, 'uncheck_all_checklist');
  assert.equal(uncheckedAll[0].checklist?.every((i) => !i.checked), true);

  const cleaned = removeLabelFromNotes(SAMPLE_NOTES, 'Arquitetura');
  assert.deepEqual(cleaned[0].labels, ['Core']);
});
