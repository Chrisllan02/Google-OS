import { NoteItem } from './GASBridge';

export type KeepFolderId = 'notes' | 'reminders' | 'archive' | 'trash' | string;

export interface KeepChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export type KeepNoteAction =
  | 'pin'
  | 'unpin'
  | 'archive'
  | 'unarchive'
  | 'trash'
  | 'restore'
  | 'delete_forever'
  | 'set_color'
  | 'set_reminder'
  | 'clear_reminder'
  | 'add_label'
  | 'remove_label'
  | 'toggle_checklist_item'
  | 'add_checklist_item'
  | 'delete_checklist_item'
  | 'edit_checklist_item'
  | 'uncheck_all_checklist'
  | 'delete_checked_checklist'
  | 'add_collaborator'
  | 'remove_collaborator';

export const KEEP_COLORS: Array<{
  id: string;
  label: string;
  lightBg: string;
  darkBg: string;
  border: string;
}> = [
  { id: 'default', label: 'Padrão', lightBg: 'bg-white', darkBg: 'bg-[#181B22]', border: 'border-zinc-200 dark:border-white/10' },
  { id: 'red', label: 'Coral', lightBg: 'bg-[#FAAFA8]', darkBg: 'bg-[#77172E]', border: 'border-[#F28B82]/50' },
  { id: 'orange', label: 'Pêssego', lightBg: 'bg-[#F39F76]', darkBg: 'bg-[#692B17]', border: 'border-[#FBBC04]/50' },
  { id: 'yellow', label: 'Areia / Âmbar', lightBg: 'bg-[#FFF8B8]', darkBg: 'bg-[#7C4A03]', border: 'border-[#FDE047]/50' },
  { id: 'green', label: 'Hortelã', lightBg: 'bg-[#E2F6D3]', darkBg: 'bg-[#264D3B]', border: 'border-[#86EFAC]/50' },
  { id: 'teal', label: 'Sálvia', lightBg: 'bg-[#B4DDD3]', darkBg: 'bg-[#0C625D]', border: 'border-[#5EEAD4]/50' },
  { id: 'blue', label: 'Névoa', lightBg: 'bg-[#D4E4ED]', darkBg: 'bg-[#256377]', border: 'border-[#93C5FD]/50' },
  { id: 'darkblue', label: 'Tempestade', lightBg: 'bg-[#AECCDC]', darkBg: 'bg-[#284255]', border: 'border-[#818CF8]/50' },
  { id: 'purple', label: 'Lavanda', lightBg: 'bg-[#D3BFDB]', darkBg: 'bg-[#472E5B]', border: 'border-[#C084FC]/50' },
  { id: 'pink', label: 'Flor', lightBg: 'bg-[#F6E2DD]', darkBg: 'bg-[#6C394F]', border: 'border-[#F472B6]/50' },
  { id: 'brown', label: 'Argila', lightBg: 'bg-[#E9E3D4]', darkBg: 'bg-[#4B443A]', border: 'border-[#D6D3D1]/40' },
  { id: 'gray', label: 'Giz', lightBg: 'bg-[#EFEFF1]', darkBg: 'bg-[#232427]', border: 'border-zinc-300/50' },
];

export function filterKeepNotes(
  notes: NoteItem[],
  options: {
    folder: KeepFolderId;
    searchQuery?: string;
    colorFilter?: string | null;
  }
): NoteItem[] {
  const { folder, searchQuery = '', colorFilter = null } = options;
  const q = searchQuery.trim().toLowerCase();

  const filtered = notes.filter((note) => {
    const isTrashed = Boolean(note.trashed);
    const isArchived = Boolean(note.archived);

    if (folder === 'trash') {
      if (!isTrashed) return false;
    } else if (folder === 'archive') {
      if (isTrashed || !isArchived) return false;
    } else if (folder === 'reminders') {
      if (isTrashed || !note.reminder) return false;
    } else if (folder === 'notes') {
      if (isTrashed || isArchived) return false;
    } else if (folder.startsWith('label:')) {
      const targetLabel = folder.slice(6).toLowerCase();
      if (isTrashed) return false;
      const hasLabel = (note.labels || []).some((l) => l.toLowerCase() === targetLabel);
      if (!hasLabel) return false;
    }

    if (colorFilter && (note.color || 'default') !== colorFilter) {
      return false;
    }

    if (q) {
      const haystack = [
        note.title || '',
        note.content || '',
        ...(note.labels || []),
        ...(note.checklist || []).map((c) => c.text),
        ...(note.participants || []).map((p) => p.name),
        note.reminder || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  // Sort pinned first when not in trash
  return [...filtered].sort((a, b) => {
    if (folder !== 'trash') {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
    }
    return 0;
  });
}

export function convertTextToChecklist(text: string): KeepChecklistItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [{ id: `chk_${Date.now()}_0`, text: 'Novo item da lista', checked: false }];
  }
  return lines.map((line, idx) => ({
    id: `chk_${Date.now()}_${idx}`,
    text: line.replace(/^[-*•[\]xX\s]+/, '').trim() || line,
    checked: /^\[[xX]\]/.test(line),
  }));
}

export function convertChecklistToText(checklist: KeepChecklistItem[]): string {
  return checklist.map((item) => item.text).join('\n');
}

export function duplicateKeepNote(note: NoteItem): NoteItem {
  const newId = Date.now() + Math.floor(Math.random() * 1000);
  return {
    ...JSON.parse(JSON.stringify(note)),
    id: newId,
    title: note.title ? `${note.title} (Cópia)` : 'Nota (Cópia)',
    date: new Date().toISOString(),
    trashed: false,
    archived: false,
  };
}

export function applyKeepNoteAction(
  notes: NoteItem[],
  noteId: number | string,
  action: KeepNoteAction,
  payload?: {
    color?: string;
    reminder?: string;
    label?: string;
    checklistItemId?: string;
    checklistText?: string;
    collaborator?: { name: string; avatar: string; email?: string };
  }
): NoteItem[] {
  if (action === 'delete_forever') {
    return notes.filter((n) => String(n.id) !== String(noteId));
  }

  return notes.map((note) => {
    if (String(note.id) !== String(noteId)) return note;

    switch (action) {
      case 'pin':
        return { ...note, pinned: true, archived: false, trashed: false };
      case 'unpin':
        return { ...note, pinned: false };
      case 'archive':
        return { ...note, archived: true, pinned: false, trashed: false };
      case 'unarchive':
        return { ...note, archived: false };
      case 'trash':
        return { ...note, trashed: true, pinned: false };
      case 'restore':
        return { ...note, trashed: false };
      case 'set_color':
        return { ...note, color: payload?.color || 'default' };
      case 'set_reminder':
        return { ...note, reminder: payload?.reminder };
      case 'clear_reminder':
        return { ...note, reminder: undefined };
      case 'add_label': {
        if (!payload?.label) return note;
        const labels = Array.from(new Set([...(note.labels || []), payload.label.trim()]));
        return { ...note, labels };
      }
      case 'remove_label': {
        if (!payload?.label) return note;
        return {
          ...note,
          labels: (note.labels || []).filter((l) => l !== payload.label),
        };
      }
      case 'toggle_checklist_item': {
        if (!payload?.checklistItemId) return note;
        const nextList = (note.checklist || []).map((item) =>
          item.id === payload.checklistItemId ? { ...item, checked: !item.checked } : item
        );
        const allDone = nextList.length > 0 && nextList.every((i) => i.checked);
        return {
          ...note,
          checklist: nextList,
          status: allDone ? 'completed' : note.status === 'completed' ? 'in_progress' : note.status,
        };
      }
      case 'add_checklist_item': {
        const text = (payload?.checklistText || '').trim();
        if (!text) return note;
        const newItem: KeepChecklistItem = {
          id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text,
          checked: false,
        };
        return {
          ...note,
          checklist: [...(note.checklist || []), newItem],
        };
      }
      case 'delete_checklist_item': {
        if (!payload?.checklistItemId) return note;
        return {
          ...note,
          checklist: (note.checklist || []).filter((i) => i.id !== payload.checklistItemId),
        };
      }
      case 'edit_checklist_item': {
        const text = (payload?.checklistText || '').trim();
        if (!payload?.checklistItemId || !text) return note;
        return {
          ...note,
          checklist: (note.checklist || []).map((i) =>
            i.id === payload.checklistItemId ? { ...i, text } : i
          ),
        };
      }
      case 'uncheck_all_checklist': {
        if (!note.checklist || note.checklist.length === 0) return note;
        return {
          ...note,
          checklist: note.checklist.map((i) => ({ ...i, checked: false })),
          status: note.status === 'completed' ? 'in_progress' : note.status,
        };
      }
      case 'delete_checked_checklist': {
        if (!note.checklist || note.checklist.length === 0) return note;
        return {
          ...note,
          checklist: note.checklist.filter((i) => !i.checked),
        };
      }
      case 'add_collaborator': {
        if (!payload?.collaborator) return note;
        const exists = (note.participants || []).some((p) => p.name === payload.collaborator!.name);
        if (exists) return note;
        return {
          ...note,
          participants: [...(note.participants || []), payload.collaborator],
        };
      }
      case 'remove_collaborator': {
        if (!payload?.collaborator) return note;
        return {
          ...note,
          participants: (note.participants || []).filter((p) => p.name !== payload.collaborator!.name),
        };
      }
      default:
        return note;
    }
  });
}

export function removeLabelFromNotes(notes: NoteItem[], labelToRemove: string): NoteItem[] {
  const target = labelToRemove.trim().toLowerCase();
  if (!target) return notes;
  return notes.map((note) => {
    if (!note.labels || note.labels.length === 0) return note;
    const filtered = note.labels.filter((l) => l.toLowerCase() !== target);
    return filtered.length === note.labels.length ? note : { ...note, labels: filtered };
  });
}
