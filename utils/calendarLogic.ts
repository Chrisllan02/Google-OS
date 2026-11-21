import type { CalendarEvent, TaskItem } from './GASBridge';

export type CalendarViewMode = 'day' | 'fourDays' | 'week' | 'month' | 'year' | 'schedule';

export type CalendarEntryType = 'event' | 'focusTime' | 'outOfOffice' | 'task';

export type CalendarRecurrenceRule = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface EnrichedCalendarEvent extends CalendarEvent {
  entryType?: CalendarEntryType;
  recurrenceRule?: CalendarRecurrenceRule;
  autoDeclineMeetings?: boolean;
  notificationMinutes?: number;
  visibility?: 'default' | 'public' | 'private';
  busyStatus?: 'busy' | 'free';
  linkedTaskId?: string;
  attachments?: Array<{ id: string; name: string; type: string }>;
}

export interface PositionedCalendarEvent extends EnrichedCalendarEvent {
  startDate: Date;
  endDate: Date;
  colIndex: number;
  totalCols: number;
}

export const CALENDAR_EVENT_COLORS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'peacock', name: 'Pavão (Padrão)', hex: '#039BE5' },
  { id: 'blueberry', name: 'Mirtilo', hex: '#2563EB' },
  { id: 'sage', name: 'Sálvia', hex: '#33B679' },
  { id: 'basil', name: 'Manjericão', hex: '#0B8043' },
  { id: 'banana', name: 'Banana', hex: '#F6BF26' },
  { id: 'tangerine', name: 'Tangerina', hex: '#F4511E' },
  { id: 'tomato', name: 'Tomate', hex: '#D50000' },
  { id: 'flamingo', name: 'Flamingo', hex: '#E67C73' },
  { id: 'lavender', name: 'Lavanda', hex: '#7986CB' },
  { id: 'grape', name: 'Uva', hex: '#8E24AA' },
  { id: 'graphite', name: 'Grafite', hex: '#616161' },
];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatLocalGmtOffset(date = new Date()): string {
  const offsetMins = -date.getTimezoneOffset();
  const sign = offsetMins >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMins);
  const hh = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mm = absMins % 60;
  return mm > 0 ? `GMT${sign}${hh}:${String(mm).padStart(2, '0')}` : `GMT${sign}${hh}`;
}

export function expandEventsForDay(
  events: EnrichedCalendarEvent[],
  targetDay: Date,
  tasks: TaskItem[] = [],
  includeTasks = true
): EnrichedCalendarEvent[] {
  const result: EnrichedCalendarEvent[] = [];
  const targetStart = new Date(targetDay);
  targetStart.setHours(0, 0, 0, 0);
  const targetEnd = new Date(targetDay);
  targetEnd.setHours(23, 59, 59, 999);

  for (const ev of events) {
    const evStart = new Date(ev.start);
    const evEnd = new Date(ev.end);
    const evDayStart = new Date(evStart);
    evDayStart.setHours(0, 0, 0, 0);

    if (isSameDay(evStart, targetDay)) {
      result.push(ev);
      continue;
    }

    // Multi-day span: event starts before targetDay and ends on/after targetDay
    if (evStart.getTime() < targetStart.getTime() && evEnd.getTime() > targetStart.getTime()) {
      const clampedStart = new Date(targetStart);
      const clampedEnd = evEnd.getTime() > targetEnd.getTime() ? new Date(targetEnd) : evEnd;
      const spansWholeDay = ev.isAllDay || evEnd.getTime() >= targetEnd.getTime();
      result.push({
        ...ev,
        id: `${ev.id}_span_${targetStart.toISOString().slice(0, 10)}`,
        start: clampedStart.toISOString(),
        end: clampedEnd.toISOString(),
        isAllDay: spansWholeDay,
      });
      continue;
    }

    // Check recurrence rules for dates after initial event start
    const rule = ev.recurrenceRule || 'none';
    if (rule !== 'none' && targetStart.getTime() > evDayStart.getTime()) {
      const diffDays = Math.round((targetStart.getTime() - evDayStart.getTime()) / 86400000);
      let matches = false;

      if (rule === 'daily') {
        matches = true;
      } else if (rule === 'weekdays') {
        const dow = targetDay.getDay();
        matches = dow >= 1 && dow <= 5;
      } else if (rule === 'weekly') {
        matches = diffDays % 7 === 0;
      } else if (rule === 'monthly') {
        matches = targetDay.getDate() === evStart.getDate();
      } else if (rule === 'yearly') {
        matches =
          targetDay.getDate() === evStart.getDate() &&
          targetDay.getMonth() === evStart.getMonth();
      }

      if (matches) {
        const durationMs = Math.max(30 * 60000, evEnd.getTime() - evStart.getTime());
        const occStart = new Date(targetDay);
        occStart.setHours(evStart.getHours(), evStart.getMinutes(), 0, 0);
        const occEnd = new Date(occStart.getTime() + durationMs);
        result.push({
          ...ev,
          id: `${ev.id}_occ_${targetDay.toISOString().slice(0, 10)}`,
          start: occStart.toISOString(),
          end: occEnd.toISOString(),
        });
      }
    }
  }

  if (includeTasks && tasks.length > 0) {
    for (const t of tasks) {
      if (!t.date) continue;
      const tDate = new Date(t.date);
      if (!isSameDay(tDate, targetDay)) continue;

      const start = new Date(targetDay);
      if (t.time) {
        const [hh, mm] = t.time.split(':').map(Number);
        start.setHours(hh || 9, mm || 0, 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
      const end = new Date(start.getTime() + 30 * 60000);

      result.push({
        id: `cal_task_${t.id}`,
        title: `${t.completed ? '✓ ' : '☐ '}${t.title}`,
        start: start.toISOString(),
        end: end.toISOString(),
        isAllDay: !t.time,
        calendarId: 'tasks',
        color: t.completed ? '#616161' : '#1A73E8',
        description: t.details || 'Tarefa sincronizada do Google Tasks',
        entryType: 'task',
        linkedTaskId: t.id,
      });
    }
  }

  return result;
}

export function arrangeEventsForDay(events: EnrichedCalendarEvent[]): PositionedCalendarEvent[] {
  if (!events || events.length === 0) return [];
  const timed = events
    .filter((e) => !e.isAllDay)
    .map((e) => ({
      ...e,
      startDate: new Date(e.start),
      endDate: new Date(e.end),
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || b.endDate.getTime() - a.endDate.getTime());

  if (timed.length === 0) return [];

  // Partition into connected overlap clusters so non-overlapping events use 100% width
  const clusters: Array<typeof timed> = [];
  let currentCluster: typeof timed = [];
  let clusterEndMs = -Infinity;

  for (const ev of timed) {
    const startMs = ev.startDate.getTime();
    const endMs = Math.max(ev.endDate.getTime(), startMs + 30 * 60000);
    if (currentCluster.length === 0 || startMs < clusterEndMs) {
      currentCluster.push(ev);
      clusterEndMs = Math.max(clusterEndMs, endMs);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEndMs = endMs;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedCalendarEvent[] = [];

  for (const cluster of clusters) {
    const columns: Array<Array<typeof timed[0]>> = [];
    for (const ev of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.endDate.getTime() <= ev.startDate.getTime()) {
          columns[i].push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([ev]);
    }
    const totalCols = columns.length;
    for (let i = 0; i < totalCols; i++) {
      for (const ev of columns[i]) {
        positioned.push({
          ...ev,
          colIndex: i,
          totalCols,
        });
      }
    }
  }

  return positioned;
}

export function filterCalendarEvents(
  events: EnrichedCalendarEvent[],
  options: {
    visibleCalendarIds: Set<string>;
    searchQuery?: string;
  }
): EnrichedCalendarEvent[] {
  const { visibleCalendarIds, searchQuery = '' } = options;
  const q = searchQuery.trim().toLowerCase();

  return events.filter((ev) => {
    const calId = ev.calendarId || 'primary';
    if (!visibleCalendarIds.has(calId)) return false;

    if (q) {
      const haystack = [
        ev.title || '',
        ev.description || '',
        ev.location || '',
        ...(ev.guests || []).map((g) => `${g.name || ''} ${g.email || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function findConflictingEvents(
  events: EnrichedCalendarEvent[],
  candidateStart: Date,
  candidateEnd: Date,
  excludeEventId?: string | null
): EnrichedCalendarEvent[] {
  const dayEvents = expandEventsForDay(events, candidateStart, [], false);
  const startMs = candidateStart.getTime();
  const endMs = candidateEnd.getTime();

  return dayEvents.filter((ev) => {
    const baseId = ev.id.includes('_occ_')
      ? ev.id.split('_occ_')[0]
      : ev.id.includes('_span_')
      ? ev.id.split('_span_')[0]
      : ev.id;
    if (excludeEventId && (ev.id === excludeEventId || baseId === excludeEventId)) return false;
    if (ev.busyStatus === 'free') return false;
    if (ev.isAllDay) {
      return ev.entryType === 'outOfOffice';
    }
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    return startMs < e && endMs > s;
  });
}

export function suggestAvailableSlots(
  events: EnrichedCalendarEvent[],
  targetDay: Date,
  durationMinutes = 45
): Array<{ start: string; end: string; label: string }> {
  const dayEvents = expandEventsForDay(events, targetDay, [], false);
  const hasAllDayOoo = dayEvents.some(
    (ev) => ev.isAllDay && ev.entryType === 'outOfOffice' && ev.busyStatus !== 'free'
  );
  if (hasAllDayOoo) return [];

  const busyTimed = dayEvents.filter((e) => !e.isAllDay && e.busyStatus !== 'free');
  const candidateHours = [8, 9, 10, 11, 13, 14, 15, 16, 17];
  const suggestions: Array<{ start: string; end: string; label: string }> = [];

  for (const hour of candidateHours) {
    const slotStart = new Date(targetDay);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + Math.max(15, durationMinutes) * 60000);

    const hasConflict = busyTimed.some((ev) => {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      return slotStart.getTime() < e && slotEnd.getTime() > s;
    });

    if (!hasConflict) {
      const startStr = `${String(hour).padStart(2, '0')}:00`;
      const endH = slotEnd.getHours();
      const endM = slotEnd.getMinutes();
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      suggestions.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        label: `${startStr} – ${endStr} (Livre para todos)`,
      });
    }
    if (suggestions.length >= 4) break;
  }

  return suggestions;
}

const RECURRENCE_TO_RRULE: Record<Exclude<CalendarRecurrenceRule, 'none'>, string> = {
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

export function exportEventsToICS(events: EnrichedCalendarEvent[]): string {
  const formatICSDate = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const formatICSDateOnly = (iso: string) => {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Workspace OS//Calendar 100%//PT',
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@workspace.os`, `DTSTAMP:${formatICSDate(new Date().toISOString())}`);
    if (ev.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatICSDateOnly(ev.start)}`, `DTEND;VALUE=DATE:${formatICSDateOnly(ev.end)}`);
    } else {
      lines.push(`DTSTART:${formatICSDate(ev.start)}`, `DTEND:${formatICSDate(ev.end)}`);
    }
    if (ev.recurrenceRule && ev.recurrenceRule !== 'none') {
      lines.push(`RRULE:${RECURRENCE_TO_RRULE[ev.recurrenceRule]}`);
    }
    lines.push(
      `SUMMARY:${(ev.title || 'Evento').replace(/\r?\n/g, ' ')}`,
      `DESCRIPTION:${(ev.description || '').replace(/\r?\n/g, ' ')}`,
      `LOCATION:${(ev.location || 'Google Meet').replace(/\r?\n/g, ' ')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function parseICSContent(icsText: string): EnrichedCalendarEvent[] {
  if (!icsText || !icsText.includes('BEGIN:VEVENT')) return [];
  const blocks = icsText.split('BEGIN:VEVENT').slice(1);
  const parsed: EnrichedCalendarEvent[] = [];

  const parseICSDate = (raw: string): { iso: string; isDateOnly: boolean } => {
    const isDateOnly = raw.includes('VALUE=DATE') && !raw.includes('VALUE=DATE-TIME');
    const clean = raw.trim().replace(/^.*:/, '');
    const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
    if (!m) return { iso: new Date().toISOString(), isDateOnly: false };
    const [, y, mo, d, hh, mm, ss] = m;
    const dateOnlyFlag = isDateOnly || !hh;
    if (dateOnlyFlag) {
      return { iso: new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0).toISOString(), isDateOnly: true };
    }
    if (clean.endsWith('Z')) {
      return { iso: new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}.000Z`).toISOString(), isDateOnly: false };
    }
    return {
      iso: new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss)).toISOString(),
      isDateOnly: false,
    };
  };

  blocks.forEach((blk, idx) => {
    const endIdx = blk.indexOf('END:VEVENT');
    const body = endIdx >= 0 ? blk.slice(0, endIdx) : blk;
    const lines = body.split(/\r?\n/);
    let summary = 'Evento Importado';
    let description = '';
    let location = '';
    let dtStart = new Date().toISOString();
    let dtEnd = new Date(Date.now() + 3600000).toISOString();
    let isAllDay = false;
    let recurrenceRule: CalendarRecurrenceRule = 'none';

    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) summary = line.slice('SUMMARY:'.length).trim();
      else if (line.startsWith('DESCRIPTION:')) description = line.slice('DESCRIPTION:'.length).trim();
      else if (line.startsWith('LOCATION:')) location = line.slice('LOCATION:'.length).trim();
      else if (line.startsWith('DTSTART')) {
        const res = parseICSDate(line);
        dtStart = res.iso;
        if (res.isDateOnly) isAllDay = true;
      } else if (line.startsWith('DTEND')) {
        const res = parseICSDate(line);
        dtEnd = res.iso;
      } else if (line.startsWith('RRULE:')) {
        const ruleVal = line.slice('RRULE:'.length).toUpperCase();
        if (ruleVal.includes('BYDAY=MO,TU,WE,TH,FR')) recurrenceRule = 'weekdays';
        else if (ruleVal.includes('FREQ=DAILY')) recurrenceRule = 'daily';
        else if (ruleVal.includes('FREQ=WEEKLY')) recurrenceRule = 'weekly';
        else if (ruleVal.includes('FREQ=MONTHLY')) recurrenceRule = 'monthly';
        else if (ruleVal.includes('FREQ=YEARLY')) recurrenceRule = 'yearly';
      }
    }

    parsed.push({
      id: `ev_ics_${Date.now()}_${idx}`,
      title: summary,
      description,
      location,
      start: dtStart,
      end: dtEnd,
      isAllDay,
      recurrenceRule,
      calendarId: 'primary',
      color: '#039BE5',
      entryType: 'event',
    });
  });

  return parsed;
}

