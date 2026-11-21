import type { CalendarEvent } from './GASBridge';
import { escapeHtml } from './sanitize';

export type MeetLayoutMode = 'auto' | 'grid' | 'spotlight';

export interface MeetParticipant {
  id: string;
  name: string;
  email?: string;
  role: 'host' | 'guest';
  mic: boolean;
  cam: boolean;
  handRaised: boolean;
  isScreenSharing?: boolean;
  isLocal?: boolean;
  avatarColor?: string;
}

export interface WaitingGuest {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
}

export interface MeetPollOption {
  id: string;
  text: string;
  votes: number;
}

export interface MeetPoll {
  id: string;
  question: string;
  options: MeetPollOption[];
  votedOptionId?: string | null;
  launched: boolean;
  closed?: boolean;
  createdAt: string;
}

export interface MeetQuestion {
  id: string;
  author: string;
  text: string;
  upvotes: number;
  upvotedByMe?: boolean;
  answered: boolean;
  time: string;
}

export interface MeetCaption {
  id: string;
  speaker: string;
  text: string;
  time: string;
}

export interface MeetSummaryMessage {
  sender: string;
  text: string;
  time: string;
}

export interface MeetSummaryInput {
  title: string;
  meetingId: string;
  durationSeconds: number;
  participants: Array<{ name: string; role: 'host' | 'guest' }>;
  messages: MeetSummaryMessage[];
  captions: MeetCaption[];
  polls: MeetPoll[];
  questions: MeetQuestion[];
}

const CODE_LETTERS = 'abcdefghijkmnpqrstuvwxyz';

export function generateMeetingCode(seedRandom: () => number = Math.random): string {
  const chunk = (len: number) => {
    let out = '';
    for (let i = 0; i < len; i += 1) {
      const idx = Math.floor(seedRandom() * CODE_LETTERS.length) % CODE_LETTERS.length;
      out += CODE_LETTERS[idx];
    }
    return out;
  };
  return `${chunk(3)}-${chunk(4)}-${chunk(3)}`;
}

export function generateDeterministicMeetCode(seed: string): string {
  let hash = 2166136261;
  const normalized = seed || 'meet-room';
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextRand = () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    return hash / 0x100000000;
  };
  return generateMeetingCode(nextRand);
}

export function formatLocalDateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeMeetingCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('meet.google.com/')) {
      const after = trimmed.split('meet.google.com/')[1] || '';
      return after.split(/[?#/\s]/)[0].trim();
    }
  } catch {
    // ignore URL parse errors
  }
  return trimmed.replace(/^https?:\/\//i, '').trim();
}

export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function computeGridColumns(
  participantCount: number,
  layoutMode: MeetLayoutMode,
  hasSpotlightTarget: boolean
): { mode: 'grid' | 'spotlight'; colsClass: string } {
  const count = Math.max(1, participantCount);
  if (layoutMode === 'spotlight' || (layoutMode === 'auto' && hasSpotlightTarget)) {
    return { mode: 'spotlight', colsClass: 'grid-cols-1' };
  }
  if (count === 1) return { mode: 'grid', colsClass: 'grid-cols-1 max-w-4xl mx-auto' };
  if (count === 2) return { mode: 'grid', colsClass: 'grid-cols-1 md:grid-cols-2' };
  if (count <= 4) return { mode: 'grid', colsClass: 'grid-cols-2' };
  if (count <= 6) return { mode: 'grid', colsClass: 'grid-cols-2 md:grid-cols-3' };
  return { mode: 'grid', colsClass: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' };
}

export function filterUpcomingMeetMeetings(
  events: CalendarEvent[],
  now: Date = new Date()
): Array<CalendarEvent & { meetCode: string }> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  return (events || [])
    .filter((ev) => {
      const endMs = new Date(ev.end).getTime();
      const hasMeet = Boolean(ev.meetLink) || /meet/i.test(ev.location || '') || /meet/i.test(ev.description || '');
      return hasMeet && endMs >= startOfToday.getTime();
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((ev) => ({
      ...ev,
      meetCode: ev.meetLink ? normalizeMeetingCode(ev.meetLink) : generateDeterministicMeetCode(ev.id || ev.title),
    }));
}

export function voteInPoll(polls: MeetPoll[], pollId: string, optionId: string): MeetPoll[] {
  return polls.map((poll) => {
    if (poll.id !== pollId || poll.closed) return poll;
    const prevVote = poll.votedOptionId || null;
    if (prevVote === optionId) return poll;

    const options = poll.options.map((opt) => {
      if (opt.id === prevVote) return { ...opt, votes: Math.max(0, opt.votes - 1) };
      if (opt.id === optionId) return { ...opt, votes: opt.votes + 1 };
      return opt;
    });

    return {
      ...poll,
      votedOptionId: optionId,
      options,
    };
  });
}

export function togglePollClosed(polls: MeetPoll[], pollId: string): MeetPoll[] {
  return polls.map((poll) => (poll.id === pollId ? { ...poll, closed: !poll.closed } : poll));
}

export function deletePoll(polls: MeetPoll[], pollId: string): MeetPoll[] {
  return polls.filter((poll) => poll.id !== pollId);
}

export function toggleQuestionUpvote(questions: MeetQuestion[], questionId: string): MeetQuestion[] {
  return questions.map((q) => {
    if (q.id !== questionId) return q;
    const nextUpvoted = !q.upvotedByMe;
    return {
      ...q,
      upvotedByMe: nextUpvoted,
      upvotes: Math.max(0, q.upvotes + (nextUpvoted ? 1 : -1)),
    };
  });
}

export function markQuestionAnswered(questions: MeetQuestion[], questionId: string): MeetQuestion[] {
  return questions.map((q) => (q.id === questionId ? { ...q, answered: !q.answered } : q));
}

export function resolveSpotlightParticipant<T extends { id: string; isScreenSharing?: boolean }>(
  participants: T[],
  pinnedId: string | null
): { spotlight: T | null; others: T[] } {
  if (participants.length === 0) return { spotlight: null, others: [] };
  const target =
    (pinnedId && participants.find((p) => p.id === pinnedId)) ||
    participants.find((p) => p.isScreenSharing) ||
    null;

  if (!target) {
    return { spotlight: null, others: participants };
  }
  return {
    spotlight: target,
    others: participants.filter((p) => p.id !== target.id),
  };
}

export function formatMeetingSummaryHtml(input: MeetSummaryInput): string {
  const safeTitle = escapeHtml(input.title || 'Reunião Google Meet');
  const safeCode = escapeHtml(input.meetingId || '');
  const durationLabel = formatCallDuration(input.durationSeconds);

  const participantItems = input.participants
    .map((p) => `<li>${escapeHtml(p.name)} (${p.role === 'host' ? 'Organizador' : 'Convidado'})</li>`)
    .join('');

  const chatSection =
    input.messages.length > 0
      ? `<h2>Mensagens do chat</h2><ul>${input.messages
          .map((m) => `<li><strong>${escapeHtml(m.sender)}</strong> (${escapeHtml(m.time)}): ${escapeHtml(m.text)}</li>`)
          .join('')}</ul>`
      : '';

  const captionsSection =
    input.captions.length > 0
      ? `<h2>Transcrição (Legendas)</h2><ul>${input.captions
          .map((c) => `<li><strong>${escapeHtml(c.speaker)}</strong> (${escapeHtml(c.time)}): ${escapeHtml(c.text)}</li>`)
          .join('')}</ul>`
      : '';

  const pollsSection =
    input.polls.length > 0
      ? `<h2>Enquetes</h2>${input.polls
          .map((poll) => {
            const opts = poll.options
              .map((o) => `<li>${escapeHtml(o.text)} — ${o.votes} voto${o.votes === 1 ? '' : 's'}</li>`)
              .join('');
            return `<p><strong>${escapeHtml(poll.question)}</strong>${poll.closed ? ' (Encerrada)' : ''}</p><ul>${opts}</ul>`;
          })
          .join('')}`
      : '';

  const qaSection =
    input.questions.length > 0
      ? `<h2>Perguntas e Respostas (P&amp;R)</h2><ul>${input.questions
          .map(
            (q) =>
              `<li><strong>${escapeHtml(q.author)}</strong> (${q.answered ? 'Respondida' : 'Pendente'}, ${q.upvotes} votos): ${escapeHtml(q.text)}</li>`
          )
          .join('')}</ul>`
      : '';

  return [
    `<h1>Ata da reunião: ${safeTitle}</h1>`,
    `<p><strong>Código da sala:</strong> ${safeCode} · <strong>Duração:</strong> ${durationLabel}</p>`,
    `<h2>Participantes (${input.participants.length})</h2><ul>${participantItems}</ul>`,
    captionsSection,
    chatSection,
    pollsSection,
    qaSection,
  ]
    .filter(Boolean)
    .join('');
}
