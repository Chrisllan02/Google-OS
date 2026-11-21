import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EnrichedCalendarEvent,
  expandEventsForDay,
  arrangeEventsForDay,
  filterCalendarEvents,
  findConflictingEvents,
  suggestAvailableSlots,
  exportEventsToICS,
  parseICSContent,
} from './calendarLogic';

const SAMPLE_EVENTS: EnrichedCalendarEvent[] = [
  {
    id: 'ev1',
    title: 'Daily Stand-up',
    start: new Date(2026, 10, 11, 9, 0).toISOString(),
    end: new Date(2026, 10, 11, 9, 45).toISOString(),
    calendarId: 'primary',
    recurrenceRule: 'daily',
    guests: [{ name: 'Gabriel Silva', email: 'gabriel@example.com', responseStatus: 'accepted' }],
  },
  {
    id: 'ev2',
    title: 'Arquitetura Conflitante',
    start: new Date(2026, 10, 11, 9, 15).toISOString(),
    end: new Date(2026, 10, 11, 10, 0).toISOString(),
    calendarId: 'work',
  },
  {
    id: 'ev3',
    title: 'Alinhamento Tarde (Solo)',
    start: new Date(2026, 10, 11, 15, 0).toISOString(),
    end: new Date(2026, 10, 11, 16, 0).toISOString(),
    calendarId: 'primary',
  },
  {
    id: 'ev_free',
    title: 'Lembrete Livre',
    start: new Date(2026, 10, 11, 11, 0).toISOString(),
    end: new Date(2026, 10, 11, 12, 0).toISOString(),
    calendarId: 'primary',
    busyStatus: 'free',
  },
  {
    id: 'ev_multi',
    title: 'Offsite Produto',
    start: new Date(2026, 10, 13, 0, 0).toISOString(),
    end: new Date(2026, 10, 15, 23, 59).toISOString(),
    isAllDay: true,
    calendarId: 'work',
  },
];

test('expandEventsForDay expands recurring daily events, multi-day spans, and tasks', () => {
  const nextDay = new Date(2026, 10, 12, 12, 0);
  const expanded = expandEventsForDay(
    SAMPLE_EVENTS,
    nextDay,
    [
      {
        id: 'tk1',
        title: 'Entregar Relatório',
        completed: false,
        date: nextDay.toISOString(),
        time: '14:00',
      },
    ],
    true
  );

  assert.equal(expanded.length, 2);
  assert.ok(expanded.some((e) => e.title === 'Daily Stand-up'));
  assert.ok(expanded.some((e) => e.entryType === 'task'));

  // Multi-day span must appear on Day 2 (Nov 14)
  const midOffsite = expandEventsForDay(SAMPLE_EVENTS, new Date(2026, 10, 14, 12, 0), [], false);
  assert.ok(midOffsite.some((e) => e.title === 'Offsite Produto' && e.isAllDay));
});

test('arrangeEventsForDay computes totalCols per overlap cluster so solo events get full width', () => {
  const dayDate = new Date(2026, 10, 11, 12, 0);
  const dayEvents = expandEventsForDay(SAMPLE_EVENTS, dayDate, [], false);
  const positioned = arrangeEventsForDay(dayEvents);

  const morning1 = positioned.find((e) => e.id === 'ev1');
  const morning2 = positioned.find((e) => e.id === 'ev2');
  const afternoonSolo = positioned.find((e) => e.id === 'ev3');

  assert.equal(morning1?.totalCols, 2);
  assert.equal(morning2?.totalCols, 2);
  assert.notEqual(morning1?.colIndex, morning2?.colIndex);
  assert.equal(afternoonSolo?.totalCols, 1);
  assert.equal(afternoonSolo?.colIndex, 0);
});

test('findConflictingEvents ignores free events and detects busy overlaps and all-day OOO', () => {
  const conflictBusy = findConflictingEvents(
    SAMPLE_EVENTS,
    new Date(2026, 10, 11, 9, 30),
    new Date(2026, 10, 11, 10, 15)
  );
  assert.equal(conflictBusy.length, 2);

  // Free event at 11:00 should NOT conflict
  const conflictFree = findConflictingEvents(
    SAMPLE_EVENTS,
    new Date(2026, 10, 11, 11, 0),
    new Date(2026, 10, 11, 11, 45)
  );
  assert.equal(conflictFree.length, 0);

  // Exclude self when editing
  const selfExcluded = findConflictingEvents(
    SAMPLE_EVENTS,
    new Date(2026, 10, 11, 15, 0),
    new Date(2026, 10, 11, 16, 0),
    'ev3'
  );
  assert.equal(selfExcluded.length, 0);
});

test('suggestAvailableSlots, exportEventsToICS, and parseICSContent handle OOO, RRULE, and all-day', () => {
  const dayDate = new Date(2026, 10, 11, 12, 0);
  const slots = suggestAvailableSlots(SAMPLE_EVENTS, dayDate, 45);
  assert.ok(slots.length > 0);
  // 09:00 is busy, 08:00 is free, 11:00 is marked free so available too
  assert.ok(slots[0].label.startsWith('08:00'));
  assert.ok(slots.some((s) => s.label.startsWith('11:00')));

  // All-day Out-of-Office blocks all slots
  const oooDay = new Date(2026, 10, 16, 12, 0);
  const oooEvents: EnrichedCalendarEvent[] = [
    {
      id: 'ooo1',
      title: 'Férias',
      start: new Date(2026, 10, 16, 0, 0).toISOString(),
      end: new Date(2026, 10, 16, 23, 59).toISOString(),
      isAllDay: true,
      entryType: 'outOfOffice',
      calendarId: 'primary',
    },
  ];
  assert.equal(suggestAvailableSlots(oooEvents, oooDay, 45).length, 0);

  const filtered = filterCalendarEvents(SAMPLE_EVENTS, {
    visibleCalendarIds: new Set(['primary']),
    searchQuery: 'gabriel',
  });
  assert.equal(filtered.length, 1);

  const ics = exportEventsToICS([...filtered, SAMPLE_EVENTS[4]]);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:'));

  const imported = parseICSContent(ics);
  assert.equal(imported.length, 2);
  assert.equal(imported[0].title, 'Daily Stand-up');
  assert.equal(imported[0].recurrenceRule, 'daily');
  assert.equal(imported[1].isAllDay, true);
});

