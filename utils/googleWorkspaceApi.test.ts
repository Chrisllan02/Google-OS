import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSPACE_SCOPES,
  encodeBase64UrlUtf8,
  decodeBase64UrlUtf8,
  buildRfc2822Base64UrlEmail,
  parseGmailMessageToEmailItem,
  parseDriveFileToItem,
  parseCalendarEventFromGoogle,
  parseGoogleTaskToItem,
  extractHtmlFromGoogleDoc,
  extractGridFromGoogleSheet,
  extractSlidesFromGooglePresentation,
} from './googleWorkspaceApi';

test('WORKSPACE_SCOPES includes all 8 approved Google Workspace scopes', () => {
  assert.equal(WORKSPACE_SCOPES.length, 8);
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/gmail.modify'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/drive'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/calendar.events'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/tasks'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/documents'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/presentations'));
  assert.ok(WORKSPACE_SCOPES.includes('https://www.googleapis.com/auth/meetings.space.created'));
});

test('buildRfc2822Base64UrlEmail encodes UTF-8 headers safely without CRLF injection', () => {
  const encoded = buildRfc2822Base64UrlEmail({
    to: 'ana@empresa.com\r\nBcc: evil@attacker.test',
    subject: 'Relatório Q2',
    body: '<p>Olá mundo!</p>',
  });
  const decoded = decodeBase64UrlUtf8(encoded);
  assert.ok(decoded.includes('To: ana@empresa.com Bcc: evil@attacker.test'));
  assert.ok(!decoded.includes('\r\nBcc: evil@attacker.test'));
  assert.ok(decoded.includes('<p>Olá mundo!</p>'));
});

test('parseGmailMessageToEmailItem maps Gmail REST v1 payload accurately', () => {
  const item = parseGmailMessageToEmailItem({
    id: 'msg-1',
    threadId: 'thr-1',
    snippet: 'Resumo do sprint',
    labelIds: ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT'],
    internalDate: String(Date.UTC(2026, 10, 21, 14, 30)),
    payload: {
      headers: [
        { name: 'From', value: '"Gabriel Silva" <gabriel@empresa.com>' },
        { name: 'To', value: 'eu@gmail.com' },
        { name: 'Subject', value: 'Sprint Review' },
      ],
      parts: [
        { mimeType: 'text/html', body: { data: encodeBase64UrlUtf8('<p>Tudo pronto!</p>') } },
      ],
    },
  });
  assert.equal(item.sender, 'Gabriel Silva');
  assert.equal(item.senderInit, 'GS');
  assert.equal(item.senderEmail, 'gabriel@empresa.com');
  assert.equal(item.subject, 'Sprint Review');
  assert.equal(item.preview, 'Resumo do sprint');
  assert.equal(item.read, false);
  assert.equal(item.isStarred, true);
  assert.equal(item.isImportant, true);
  assert.equal(item.folder, 'inbox');
  assert.equal(item.body, '<p>Tudo pronto!</p>');
});

test('parseDriveFileToItem, parseCalendarEventFromGoogle, and parseGoogleTaskToItem map API payloads', () => {
  const driveItem = parseDriveFileToItem({
    id: 'file-1',
    name: 'Orçamento 2026',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    size: '4096',
    starred: true,
    owners: [{ displayName: 'Chrisllan' }],
  });
  assert.equal(driveItem.type, 'sheet');
  assert.equal(driveItem.size, '4.0 KB');
  assert.equal(driveItem.isStarred, true);

  const calEv = parseCalendarEventFromGoogle({
    id: 'ev-1',
    summary: 'Daily Standup',
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    start: { dateTime: '2026-11-21T12:00:00.000Z' },
    end: { dateTime: '2026-11-21T12:30:00.000Z' },
  });
  assert.equal(calEv.title, 'Daily Standup');
  assert.equal(calEv.meetLink, 'https://meet.google.com/abc-defg-hij');

  const task = parseGoogleTaskToItem(
    { id: 't-1', title: 'Revisar PR', status: 'completed', due: '2026-11-22T00:00:00.000Z' },
    'list-1',
  );
  assert.equal(task.completed, true);
  assert.equal(task.date, '2026-11-22');
  assert.equal(task.listId, 'list-1');
});

test('extractHtmlFromGoogleDoc, extractGridFromGoogleSheet, and extractSlidesFromGooglePresentation parse content', () => {
  const html = extractHtmlFromGoogleDoc({
    title: 'Plano',
    body: {
      content: [
        {
          paragraph: {
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            elements: [{ textRun: { content: 'Meta Q4\n' } }],
          },
        },
        {
          paragraph: {
            elements: [{ textRun: { content: 'Entregar <seguro>\n', textStyle: { bold: true } } }],
          },
        },
      ],
    },
  });
  assert.ok(html.includes('<h1>Meta Q4</h1>'));
  assert.ok(html.includes('<p><strong>Entregar &lt;seguro&gt;</strong></p>'));

  const sheet = extractGridFromGoogleSheet('Vendas Q4', [
    ['Produto', 'Valor'],
    ['Plano Pro', '199'],
  ]);
  assert.equal(sheet.sheetName, 'Vendas Q4');
  assert.equal(sheet.grid.A1, 'Produto');
  assert.equal(sheet.grid.B2, '199');

  const slides = extractSlidesFromGooglePresentation({
    slides: [
      {
        objectId: 's1',
        pageElements: [
          { objectId: 'e1', shape: { text: { textElements: [{ textRun: { content: 'Capa' } }] } } },
        ],
      },
    ],
  });
  assert.equal(slides.length, 1);
  assert.equal(slides[0].elements[0].content, 'Capa');
});
