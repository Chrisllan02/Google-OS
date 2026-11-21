import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMeetingCode,
  generateDeterministicMeetCode,
  formatLocalDateInput,
  normalizeMeetingCode,
  formatCallDuration,
  computeGridColumns,
  filterUpcomingMeetMeetings,
  voteInPoll,
  togglePollClosed,
  deletePoll,
  toggleQuestionUpvote,
  markQuestionAnswered,
  resolveSpotlightParticipant,
  formatMeetingSummaryHtml,
  type MeetPoll,
  type MeetQuestion,
} from './meetLogic';

test('generateMeetingCode, generateDeterministicMeetCode, and normalizeMeetingCode format and extract room codes cleanly', () => {
  const code = generateMeetingCode(() => 0.1);
  assert.match(code, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);

  const detA = generateDeterministicMeetCode('evt_daily_standup');
  const detB = generateDeterministicMeetCode('evt_daily_standup');
  const detC = generateDeterministicMeetCode('evt_other');
  assert.match(detA, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  assert.equal(detA, detB);
  assert.notEqual(detA, detC);

  assert.equal(normalizeMeetingCode('https://meet.google.com/abc-defg-hij?authuser=0'), 'abc-defg-hij');
  assert.equal(normalizeMeetingCode('  spr-plan-13  '), 'spr-plan-13');
  assert.equal(normalizeMeetingCode(''), '');

  assert.equal(formatLocalDateInput(new Date(2026, 10, 5, 23, 55, 0)), '2026-11-05');
});

test('formatCallDuration and computeGridColumns handle call timers and responsive grids', () => {
  assert.equal(formatCallDuration(0), '00:00');
  assert.equal(formatCallDuration(75), '01:15');
  assert.equal(formatCallDuration(3665), '01:01:05');

  assert.equal(computeGridColumns(2, 'auto', false).mode, 'grid');
  assert.equal(computeGridColumns(2, 'auto', false).colsClass, 'grid-cols-1 md:grid-cols-2');
  assert.equal(computeGridColumns(4, 'auto', true).mode, 'spotlight');
  assert.equal(computeGridColumns(5, 'grid', true).mode, 'grid');
  assert.equal(computeGridColumns(5, 'grid', false).colsClass, 'grid-cols-2 md:grid-cols-3');
});

test('filterUpcomingMeetMeetings extracts chronological Agenda meetings with stable deterministic fallback codes', () => {
  const now = new Date('2026-11-18T09:00:00.000Z');
  const events = [
    {
      id: 'past',
      title: 'Ontem',
      start: '2026-11-17T10:00:00.000Z',
      end: '2026-11-17T11:00:00.000Z',
      calendarId: 'primary',
      meetLink: 'https://meet.google.com/old-meet-123',
    },
    {
      id: 'later',
      title: 'Design Review',
      start: '2026-11-18T14:00:00.000Z',
      end: '2026-11-18T15:00:00.000Z',
      calendarId: 'primary',
      meetLink: 'https://meet.google.com/dsg-revw-s12',
    },
    {
      id: 'sooner',
      title: 'Daily Standup',
      start: '2026-11-18T09:30:00.000Z',
      end: '2026-11-18T10:00:00.000Z',
      calendarId: 'primary',
      location: 'Google Meet',
    },
  ];

  const result1 = filterUpcomingMeetMeetings(events, now);
  const result2 = filterUpcomingMeetMeetings(events, now);
  assert.equal(result1.length, 2);
  assert.equal(result1[0].id, 'sooner');
  assert.equal(result1[0].meetCode, result2[0].meetCode);
  assert.match(result1[0].meetCode, /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  assert.equal(result1[1].id, 'later');
  assert.equal(result1[1].meetCode, 'dsg-revw-s12');
});

test('voteInPoll, togglePollClosed, deletePoll, toggleQuestionUpvote, markQuestionAnswered, and resolveSpotlightParticipant update state immutably', () => {
  const initialPolls: MeetPoll[] = [
    {
      id: 'p1',
      question: 'Prioridade da Sprint 13?',
      launched: true,
      createdAt: '10:00',
      votedOptionId: null,
      options: [
        { id: 'o1', text: 'Performance', votes: 2 },
        { id: 'o2', text: 'Testes E2E', votes: 1 },
      ],
    },
  ];

  const afterVote1 = voteInPoll(initialPolls, 'p1', 'o1');
  assert.equal(afterVote1[0].options[0].votes, 3);
  assert.equal(afterVote1[0].votedOptionId, 'o1');

  const afterSwitch = voteInPoll(afterVote1, 'p1', 'o2');
  assert.equal(afterSwitch[0].options[0].votes, 2);
  assert.equal(afterSwitch[0].options[1].votes, 2);
  assert.equal(afterSwitch[0].votedOptionId, 'o2');

  const closedPolls = togglePollClosed(afterSwitch, 'p1');
  assert.equal(closedPolls[0].closed, true);
  const voteWhileClosed = voteInPoll(closedPolls, 'p1', 'o1');
  assert.equal(voteWhileClosed[0].votedOptionId, 'o2');
  assert.equal(voteWhileClosed[0].options[0].votes, 2);

  const deleted = deletePoll(closedPolls, 'p1');
  assert.equal(deleted.length, 0);

  const questions: MeetQuestion[] = [
    { id: 'q1', author: 'Ana', text: 'Qual a meta de NRR?', upvotes: 3, answered: false, time: '10:05' },
  ];
  const upvoted = toggleQuestionUpvote(questions, 'q1');
  assert.equal(upvoted[0].upvotes, 4);
  assert.equal(upvoted[0].upvotedByMe, true);

  const answered = markQuestionAnswered(upvoted, 'q1');
  assert.equal(answered[0].answered, true);

  const participants = [
    { id: 'local', isScreenSharing: false },
    { id: 'p2', isScreenSharing: true },
    { id: 'p3', isScreenSharing: false },
  ];
  const screenSpotlight = resolveSpotlightParticipant(participants, null);
  assert.equal(screenSpotlight.spotlight?.id, 'p2');
  assert.equal(screenSpotlight.others.length, 2);

  const pinnedSpotlight = resolveSpotlightParticipant(participants, 'p3');
  assert.equal(pinnedSpotlight.spotlight?.id, 'p3');
});

test('formatMeetingSummaryHtml builds structured HTML and escapes untrusted content', () => {
  const html = formatMeetingSummaryHtml({
    title: 'Sprint <script>alert(1)</script>',
    meetingId: 'abc-defg-hij',
    durationSeconds: 185,
    participants: [{ name: 'Chrisllan', role: 'host' }],
    messages: [{ sender: 'Ana', text: '<b>Oi</b>', time: '10:00' }],
    captions: [{ id: 'c1', speaker: 'Chrisllan', text: 'Começando a daily.', time: '10:01' }],
    polls: [
      {
        id: 'p1',
        question: 'Aprovar release?',
        launched: true,
        closed: true,
        createdAt: '10:02',
        options: [{ id: 'o1', text: 'Sim', votes: 4 }],
      },
    ],
    questions: [{ id: 'q1', author: 'Lucas', text: 'Deploy hoje?', upvotes: 2, answered: true, time: '10:03' }],
  });

  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('03:05'));
  assert.ok(html.includes('Começando a daily.'));
  assert.ok(html.includes('&lt;b&gt;Oi&lt;/b&gt;'));
  assert.ok(html.includes('Aprovar release?'));
  assert.ok(html.includes('Deploy hoje?'));
});
