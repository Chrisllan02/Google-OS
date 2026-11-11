import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Pin, Trash2, Layers, LayoutGrid, ChevronRight, GripHorizontal
} from 'lucide-react';
import { NoteItem } from '../utils/GASBridge';

interface PostItStyle {
  card: string;
  tape: string;
  accent: string;
}

interface PostItLayoutItem {
  x: number;
  y: number;
  z: number;
  rotation: number;
  stackId: string;
  stackOrder: number;
}

type LayoutMap = Record<string, PostItLayoutItem>;

interface PostItBoardProps {
  notes: NoteItem[];
  darkMode: boolean;
  textColor: string;
  subTextColor: string;
  postItPalette: Record<string, PostItStyle>;
  onAddNote: (title: string, content: string, color: string) => Promise<void>;
  onUpdateNote: (id: number | string, updates: { title?: string; content?: string; color?: string }) => void;
  onDeleteNote: (id: number | string, e: React.MouseEvent) => void;
  onTogglePin: (id: number | string, e: React.MouseEvent) => void;
  onOpenKeep: () => void;
  playSound: (kind: 'tick' | 'select' | 'action') => void;
  moduleDragHandle?: React.ReactNode;
}

const STORAGE_KEY = 'workspace_postit_board_v4';
const CARD_WIDTH = 256;
const CARD_HEIGHT = 206;

const DEFAULT_ROTATIONS = [-1.4, 1.1, -0.8, 1.5, -1.1, 0.9];

// Guaranteed 100% opaque solid background hexes per theme & color
const SOLID_BG_DARK: Record<string, string> = {
  default: '#3A3214',
  yellow: '#423813',
  green: '#1B3B26',
  teal: '#15393D',
  blue: '#19334D',
  darkblue: '#1D2849',
  purple: '#331F47',
  pink: '#451E35',
  red: '#452120',
  orange: '#442D18',
  brown: '#38291D',
  gray: '#2C2F36',
};

const SOLID_BG_LIGHT: Record<string, string> = {
  default: '#FFF59D',
  yellow: '#FFEE58',
  green: '#C5E1A5',
  teal: '#80CBC4',
  blue: '#90CAF9',
  darkblue: '#9FA8DA',
  purple: '#CE93D8',
  pink: '#F48FB1',
  red: '#EF9A9A',
  orange: '#FFCC80',
  brown: '#BCAAA4',
  gray: '#E5E7EB',
};

export default function PostItBoard({
  notes,
  darkMode,
  textColor,
  subTextColor,
  postItPalette,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  playSound,
}: PostItBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [layouts, setLayouts] = useState<LayoutMap>(() => {
    const targetStackId = 'stack_master';
    const initialMap: LayoutMap = {};
    notes.forEach((n, idx) => {
      const id = String(n.id);
      initialMap[id] = {
        x: 24,
        y: 16,
        z: (notes.length - idx) * 2 + 10,
        rotation: DEFAULT_ROTATIONS[idx % DEFAULT_ROTATIONS.length],
        stackId: targetStackId,
        stackOrder: idx,
      };
    });
    return initialMap;
  });

  const [maxZ, setMaxZ] = useState<number>(40);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetStackId, setDropTargetStackId] = useState<string | null>(null);
  const [controlsExpanded, setControlsExpanded] = useState<boolean>(false);
  const [quickLineInputs, setQuickLineInputs] = useState<Record<string, string>>({});

  const dragInfoRef = useRef<{
    noteId: string;
    initialStackId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  } | null>(null);

  const layoutsRef = useRef<LayoutMap>(layouts);
  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  // New Post-it inline composer state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('yellow');

  const getSolidBg = (colorKey?: string) => {
    const key = colorKey || 'yellow';
    return darkMode
      ? SOLID_BG_DARK[key] || SOLID_BG_DARK.yellow
      : SOLID_BG_LIGHT[key] || SOLID_BG_LIGHT.yellow;
  };

  const computeStackedPositions = useCallback((items: NoteItem[], anchorX = 24, anchorY = 16): LayoutMap => {
    const targetStackId = 'stack_master';
    const nextMap: LayoutMap = {};
    items.forEach((n, idx) => {
      const id = String(n.id);
      nextMap[id] = {
        x: anchorX,
        y: anchorY,
        z: (items.length - idx) * 2 + 10,
        rotation: DEFAULT_ROTATIONS[idx % DEFAULT_ROTATIONS.length],
        stackId: targetStackId,
        stackOrder: idx,
      };
    });
    return nextMap;
  }, []);

  const computeGridPositions = useCallback((items: NoteItem[], boardWidth: number): LayoutMap => {
    const usableW = Math.max(boardWidth - 24, 300);
    const cols = Math.max(1, Math.min(3, Math.floor(usableW / (CARD_WIDTH + 16))));
    const gapX = cols > 1 ? Math.min(22, Math.floor((usableW - cols * CARD_WIDTH) / (cols - 1))) : 16;
    const startX = 16;
    const startY = 14;

    const nextMap: LayoutMap = {};
    items.forEach((n, idx) => {
      const id = String(n.id);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      nextMap[id] = {
        x: startX + col * (CARD_WIDTH + Math.max(14, gapX)),
        y: startY + row * (CARD_HEIGHT + 18),
        z: idx * 2 + 10,
        rotation: DEFAULT_ROTATIONS[idx % DEFAULT_ROTATIONS.length],
        stackId: `stack_${id}`,
        stackOrder: 0,
      };
    });
    return nextMap;
  }, []);

  // Ensure every note has a valid layout entry
  useEffect(() => {
    setLayouts((prev) => {
      let changed = false;
      const next = { ...prev };
      const existingKeys = Object.keys(next);

      if (existingKeys.length === 0 && notes.length > 0) {
        const initialStacked = computeStackedPositions(notes, 20, 14);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStacked));
        } catch {
          // Ignore storage quota errors
        }
        return initialStacked;
      }

      const firstExisting = existingKeys.length > 0 ? next[existingKeys[0]] : null;
      const anchorX = firstExisting ? firstExisting.x : 20;
      const anchorY = firstExisting ? firstExisting.y : 14;
      const anchorStackId = firstExisting ? firstExisting.stackId : 'stack_master';

      notes.forEach((n, idx) => {
        const id = String(n.id);
        if (!next[id]) {
          changed = true;
          Object.keys(next).forEach((k) => {
            if (next[k].stackId === anchorStackId) {
              next[k] = { ...next[k], stackOrder: (next[k].stackOrder || 0) + 1 };
            }
          });
          next[id] = {
            x: anchorX,
            y: anchorY,
            z: existingKeys.length * 2 + idx + 40,
            rotation: DEFAULT_ROTATIONS[idx % DEFAULT_ROTATIONS.length],
            stackId: anchorStackId,
            stackOrder: 0,
          };
        }
      });

      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      }
      return prev;
    });
  }, [notes, computeStackedPositions]);

  const saveLayouts = useCallback((updater: (prev: LayoutMap) => LayoutMap) => {
    setLayouts((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const getHighestZ = (map: LayoutMap, fallback = 30): number =>
    Object.keys(map).reduce((m, k) => Math.max(m, map[k]?.z || 0), fallback);

  // Bring a specific note to the front of its stack (and global top z-index)
  const bringNoteToFront = useCallback((stackId: string, targetNoteId: string) => {
    saveLayouts((prev) => {
      const next = { ...prev };
      const currentHighestZ = getHighestZ(next, 30);
      const stackMemberIds = notes
        .map((n) => String(n.id))
        .filter((id) => next[id]?.stackId === stackId)
        .sort((a, b) => (next[a]?.stackOrder ?? 0) - (next[b]?.stackOrder ?? 0));

      const reordered = [
        targetNoteId,
        ...stackMemberIds.filter((id) => id !== targetNoteId),
      ];

      reordered.forEach((id, idx) => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            stackOrder: idx,
            z: currentHighestZ + (reordered.length - idx) * 2 + 2,
          };
        }
      });

      return next;
    });
    setMaxZ((z) => z + notes.length * 2 + 6);
  }, [notes, saveLayouts]);

  // Global window pointermove / pointerup listeners for 100% reliable dragging
  useEffect(() => {
    if (!draggingId) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const info = dragInfoRef.current;
      if (!info) return;

      const zoomFactor = 0.9;
      const dx = (e.clientX - info.startX) / zoomFactor;
      const dy = (e.clientY - info.startY) / zoomFactor;

      if (!info.hasMoved && Math.hypot(dx, dy) > 4) {
        info.hasMoved = true;
        playSound('tick');
      }
      if (!info.hasMoved) return;

      const boardRect = boardRef.current?.getBoundingClientRect();
      const viewportW = typeof window !== 'undefined' ? window.innerWidth / zoomFactor : 1600;
      const viewportH = typeof window !== 'undefined' ? window.innerHeight / zoomFactor : 900;
      const minX = boardRect ? -boardRect.left / zoomFactor + 8 : -200;
      const maxW = boardRect ? viewportW - boardRect.left / zoomFactor - CARD_WIDTH - 12 : 1200;
      const minY = boardRect ? -boardRect.top / zoomFactor + 48 : -300;
      const maxH = boardRect
        ? Math.max(boardRect.height / zoomFactor - CARD_HEIGHT + 120, viewportH - boardRect.top / zoomFactor - CARD_HEIGHT - 24)
        : 600;

      const newX = Math.round(Math.min(Math.max(minX, info.origX + dx), maxW));
      const newY = Math.round(Math.min(Math.max(minY, info.origY + dy), maxH));

      // Detect magnetic stack target (another card within 75px distance once moved away from origin)
      let foundTargetStack: string | null = null;
      const currentMap = layoutsRef.current;
      if (Math.hypot(dx, dy) > 35) {
        for (const n of notes) {
          const otherId = String(n.id);
          if (otherId === info.noteId) continue;
          const otherLayout = currentMap[otherId];
          if (!otherLayout) continue;
          const dist = Math.hypot(otherLayout.x - newX, otherLayout.y - newY);
          if (dist < 75) {
            foundTargetStack = otherLayout.stackId;
            break;
          }
        }
      }
      setDropTargetStackId(foundTargetStack);

      const soloStackId = `stack_${info.noteId}`;
      setLayouts((prev) => {
        const next = { ...prev };
        const currentHighestZ = getHighestZ(next, 40);
        if (next[info.noteId]) {
          next[info.noteId] = {
            ...next[info.noteId],
            x: newX,
            y: newY,
            stackId: soloStackId,
            stackOrder: 0,
            z: currentHighestZ + 2,
          };
        }
        // Re-index remaining cards in the old stack so the next card becomes stackOrder 0 seamlessly
        const remainingInOldStack = Object.keys(next)
          .filter((k) => k !== info.noteId && next[k].stackId === info.initialStackId)
          .sort((a, b) => (next[a].stackOrder ?? 0) - (next[b].stackOrder ?? 0));
        remainingInOldStack.forEach((k, idx) => {
          next[k] = { ...next[k], stackOrder: idx };
        });
        return next;
      });
    };

    const handleWindowPointerUp = () => {
      const info = dragInfoRef.current;
      if (!info) {
        setDraggingId(null);
        return;
      }

      setDropTargetStackId((currentDropTarget) => {
        if (currentDropTarget && info.hasMoved) {
          playSound('action');
          saveLayouts((prev) => {
            const next = { ...prev };
            const currentHighestZ = getHighestZ(next, 40);
            const targetMembers = Object.keys(next)
              .filter((k) => next[k].stackId === currentDropTarget && k !== info.noteId)
              .sort((a, b) => (next[a].stackOrder ?? 0) - (next[b].stackOrder ?? 0));
            const anchor = targetMembers.length > 0 ? next[targetMembers[0]] : next[info.noteId];

            targetMembers.forEach((k, idx) => {
              next[k] = {
                ...next[k],
                stackOrder: idx + 1,
                z: currentHighestZ + (targetMembers.length - idx) * 2,
              };
            });

            if (next[info.noteId] && anchor) {
              next[info.noteId] = {
                ...next[info.noteId],
                x: anchor.x,
                y: anchor.y,
                stackId: currentDropTarget,
                stackOrder: 0,
                z: currentHighestZ + targetMembers.length * 2 + 6,
              };
            }
            return next;
          });
        } else if (info.hasMoved) {
          saveLayouts((prev) => ({ ...prev }));
        }
        return null;
      });

      setDraggingId(null);
      dragInfoRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [draggingId, notes, playSound, saveLayouts]);

  // Align all Post-its neatly in a grid (unstacking all)
  const handleAlignGrid = () => {
    playSound('select');
    const boardWidth = boardRef.current?.clientWidth || 1080;
    const sorted = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    const fresh = computeGridPositions(sorted, boardWidth);
    saveLayouts(() => fresh);
  };

  // Stack all Post-its into a tactile deck at the current primary anchor position
  const handleStackAll = () => {
    playSound('action');
    const targetStackId = 'stack_master';
    saveLayouts((prev) => {
      const firstId = notes[0] ? String(notes[0].id) : '';
      const anchorX = prev[firstId]?.x ?? 20;
      const anchorY = prev[firstId]?.y ?? 14;
      const next: LayoutMap = {};
      notes.forEach((n, idx) => {
        const id = String(n.id);
        const existing = prev[id];
        next[id] = {
          x: anchorX,
          y: anchorY,
          z: (notes.length - idx) * 2 + 20,
          rotation: existing?.rotation ?? DEFAULT_ROTATIONS[idx % DEFAULT_ROTATIONS.length],
          stackId: targetStackId,
          stackOrder: idx,
        };
      });
      return next;
    });
  };

  // Cycle top note of a stack to the bottom of that stack
  const handleCycleStack = (stackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('select');
    saveLayouts((prev) => {
      const next = { ...prev };
      const currentHighestZ = getHighestZ(next, maxZ);
      const stackIds = notes
        .map((n) => String(n.id))
        .filter((id) => next[id]?.stackId === stackId)
        .sort((a, b) => (next[a]?.stackOrder ?? 0) - (next[b]?.stackOrder ?? 0));

      if (stackIds.length <= 1) return prev;
      stackIds.forEach((id, idx) => {
        const newOrder = idx === 0 ? stackIds.length - 1 : idx - 1;
        next[id] = {
          ...next[id],
          stackOrder: newOrder,
          z: currentHighestZ + (stackIds.length - newOrder) * 2 + 2,
        };
      });
      return next;
    });
    setMaxZ((z) => z + notes.length * 2 + 4);
  };

  // Unstack a specific stack onto adjacent spots
  const handleUnstackGroup = (stackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('action');
    const boardWidth = boardRef.current?.clientWidth || 1080;
    saveLayouts((prev) => {
      const next = { ...prev };
      const currentHighestZ = getHighestZ(next, maxZ);
      const stackMemberIds = notes
        .map((n) => String(n.id))
        .filter((id) => next[id]?.stackId === stackId)
        .sort((a, b) => (next[a]?.stackOrder ?? 0) - (next[b]?.stackOrder ?? 0));

      if (stackMemberIds.length <= 1) return prev;
      const base = next[stackMemberIds[0]];
      const usableW = Math.max(boardWidth - 24, 300);
      const cols = Math.max(1, Math.min(3, Math.floor(usableW / (CARD_WIDTH + 16))));

      stackMemberIds.forEach((id, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const clampedX = Math.min(
          Math.max(16, base.x + col * (CARD_WIDTH + 18)),
          Math.max(20, boardWidth - CARD_WIDTH - 16)
        );
        next[id] = {
          ...next[id],
          x: clampedX,
          y: base.y + row * (CARD_HEIGHT + 18),
          stackId: `stack_${id}`,
          stackOrder: 0,
          z: currentHighestZ + idx * 2 + 2,
        };
      });
      return next;
    });
    setMaxZ((z) => z + notes.length * 2 + 4);
  };

  const handleCardPointerDown = (noteId: string, stackId: string, visualX: number, visualY: number, e: React.PointerEvent) => {
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, input, textarea')) {
      bringNoteToFront(stackId, noteId);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    bringNoteToFront(stackId, noteId);
    setDraggingId(noteId);

    dragInfoRef.current = {
      noteId,
      initialStackId: stackId,
      startX: e.clientX,
      startY: e.clientY,
      origX: visualX,
      origY: visualY,
      hasMoved: false,
    };
  };

  const handleCreatePostIt = async () => {
    if (!newTitle.trim() && !newContent.trim()) return;
    await onAddNote(newTitle, newContent, newColor);
    setNewTitle('');
    setNewContent('');
    setIsAdding(false);
    playSound('action');
  };

  const handleAddQuickLineToNote = (note: NoteItem) => {
    const idStr = String(note.id);
    const lineText = (quickLineInputs[idStr] || '').trim();
    if (!lineText) return;
    const prefix = note.content && note.content.trim().length > 0 ? `${note.content.trim()}\n• ` : '• ';
    onUpdateNote(note.id, { content: `${prefix}${lineText}` });
    setQuickLineInputs((prev) => ({ ...prev, [idStr]: '' }));
    playSound('tick');
  };

  // Compute stack membership and order for every note
  const stackGroups = new Map<string, string[]>();
  notes.forEach((n) => {
    const id = String(n.id);
    const sId = layouts[id]?.stackId || 'stack_master';
    const list = stackGroups.get(sId) || [];
    list.push(id);
    stackGroups.set(sId, list);
  });

  stackGroups.forEach((idList) => {
    idList.sort((a, b) => (layouts[a]?.stackOrder ?? 0) - (layouts[b]?.stackOrder ?? 0));
  });

  // Find primary/active Post-it group anchor so the companion + controls follow it
  let companionAnchor = { x: 20, y: 14 };
  if (draggingId && layouts[draggingId]) {
    companionAnchor = { x: layouts[draggingId].x, y: layouts[draggingId].y };
  } else {
    let highestZ = -1;
    notes.forEach((n) => {
      const l = layouts[String(n.id)];
      if (l && l.z > highestZ) {
        highestZ = l.z;
        companionAnchor = { x: l.x, y: l.y };
      }
    });
  }

  const boardWidth = boardRef.current?.clientWidth || 1080;
  const placeOnLeft = companionAnchor.x + CARD_WIDTH + 280 > boardWidth;
  const companionX = placeOnLeft
    ? Math.max(8, companionAnchor.x - 46)
    : companionAnchor.x + CARD_WIDTH + 34;
  const companionY = Math.max(6, companionAnchor.y + 4);

  const maxBottomY = notes.reduce((acc, n) => {
    const l = layouts[String(n.id)];
    return Math.max(acc, (l?.y ?? 14) + CARD_HEIGHT + 32);
  }, 240);

  return (
    <div className="w-full h-full flex-1 flex flex-col justify-between transition-all duration-300">
      <div
        ref={boardRef}
        className="relative w-full h-full flex-1 overflow-visible transition-all duration-300 select-none"
        style={{ minHeight: `${Math.max(240, Math.min(540, maxBottomY))}px` }}
      >
        {/* Companion "+" Control Dock */}
        <div
          style={{
            transform: `translate3d(${companionX}px, ${companionY}px, 0)`,
            zIndex: maxZ + 120,
          }}
          className={`absolute top-0 left-0 flex items-center gap-1.5 ${
            draggingId ? '' : 'transition-transform duration-200 ease-out'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              playSound('tick');
              setControlsExpanded((prev) => !prev);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all glass-control shadow-md ${textColor} hover:scale-105 active:scale-95`}
            title={controlsExpanded ? 'Recolher ações dos Post-its' : 'Ações dos Post-its'}
          >
            <Plus
              size={15}
              className={`text-[#FBBC04] transition-transform duration-300 ${
                controlsExpanded ? 'rotate-45' : 'rotate-0'
              }`}
            />
          </button>

          {controlsExpanded && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
              <button
                type="button"
                onClick={() => {
                  playSound('tick');
                  setIsAdding((prev) => !prev);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all glass-control shadow-sm whitespace-nowrap ${textColor} hover:scale-105 active:scale-95`}
              >
                <Plus size={12} className="text-[#FBBC04]" />
                <span>Novo Post-it</span>
              </button>
              <button
                type="button"
                onClick={handleAlignGrid}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all glass-control shadow-sm whitespace-nowrap ${textColor} hover:scale-105 active:scale-95`}
                title="Espalhar e alinhar Post-its"
              >
                <LayoutGrid size={12} className="text-[#34A853]" />
                <span>Alinhar</span>
              </button>
              <button
                type="button"
                onClick={handleStackAll}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all glass-control shadow-sm whitespace-nowrap ${textColor} hover:scale-105 active:scale-95`}
                title="Agrupar / empilhar Post-its"
              >
                <Layers size={12} className="text-[#3B82F6]" />
                <span>Empilhar</span>
              </button>
            </div>
          )}
        </div>

        {/* Inline New Post-it Composer */}
        {isAdding && (
          <div
            style={{
              transform: `translate3d(${Math.min(companionX, Math.max(16, boardWidth - 275))}px, ${companionY + 42}px, 0)`,
              zIndex: maxZ + 160,
              backgroundColor: getSolidBg(newColor),
            }}
            className={`absolute top-0 left-0 w-[264px] p-4 rounded-2xl border flex flex-col justify-between min-h-[190px] animate-in zoom-in-95 duration-200 ${
              postItPalette[newColor]?.card || postItPalette.yellow.card
            }`}
          >
            <div className={`w-12 h-2.5 rounded-sm mx-auto -mt-5 mb-2 ${postItPalette[newColor]?.tape || postItPalette.yellow.tape}`} />
            <div className="flex-1 flex flex-col gap-1.5">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título do Post-it..."
                className={`bg-transparent border-none outline-none text-xs font-bold ${textColor} placeholder:${subTextColor}`}
                autoFocus
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Escreva sua anotação..."
                rows={3}
                className={`bg-transparent border-none outline-none text-xs resize-none flex-1 ${textColor} placeholder:${subTextColor}`}
              />
            </div>
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/10 dark:border-white/15">
              <div className="flex items-center gap-1.5">
                {(['yellow', 'green', 'teal', 'pink', 'blue'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-4 h-4 rounded-full border border-black/20 ${
                      c === 'yellow'
                        ? 'bg-[#FBC02D]'
                        : c === 'green'
                        ? 'bg-[#7CB342]'
                        : c === 'teal'
                        ? 'bg-[#26A69A]'
                        : c === 'pink'
                        ? 'bg-[#EC407A]'
                        : 'bg-[#42A5F5]'
                    } ${newColor === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : 'opacity-75 hover:opacity-100'}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className={`px-2 py-1 rounded-lg text-[11px] ${subTextColor} hover:bg-black/10`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreatePostIt}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                >
                  Colar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render each Post-it by stable note.id so DOM nodes never unmount during drag */}
        {notes.map((note) => {
          const noteId = String(note.id);
          const layout = layouts[noteId] || {
            x: 24,
            y: 16,
            z: 10,
            rotation: -1,
            stackId: 'stack_master',
            stackOrder: 0,
          };
          const stackId = layout.stackId || 'stack_master';
          const stackMemberIds = stackGroups.get(stackId) || [noteId];
          const stackCount = stackMemberIds.length;
          const stackPos = Math.max(0, stackMemberIds.indexOf(noteId));
          const isTopOfStack = stackPos === 0;
          const isBeingDragged = draggingId === noteId;
          const isDropTarget = dropTargetStackId === stackId && isTopOfStack && !isBeingDragged;

          // If in a stack behind the top card, offset its visual position so it peeks out and can be clicked/dragged
          const topMemberId = stackMemberIds[0] || noteId;
          const anchorLayout = layouts[topMemberId] || layout;
          const offsetX = !isTopOfStack && !isBeingDragged ? stackPos * 12 : 0;
          const offsetY = !isTopOfStack && !isBeingDragged ? stackPos * 9 : 0;
          const visualX = (isBeingDragged ? layout.x : anchorLayout.x) + offsetX;
          const visualY = (isBeingDragged ? layout.y : anchorLayout.y) + offsetY;
          const visualRotation = isBeingDragged
            ? 0
            : isTopOfStack
            ? layout.rotation
            : stackPos % 2 === 1
            ? stackPos * 3.2
            : -stackPos * 2.8;

          const effectiveZ = isBeingDragged
            ? maxZ + 100
            : (anchorLayout.z || 20) + (20 - stackPos);

          const styleObj = postItPalette[note.color || 'yellow'] || postItPalette.yellow;

          return (
            <div
              key={noteId}
              onPointerDown={(e) => handleCardPointerDown(noteId, stackId, visualX, visualY, e)}
              style={{
                transform: `translate3d(${visualX}px, ${visualY}px, 0) rotate(${visualRotation}deg)`,
                zIndex: effectiveZ,
                width: `${CARD_WIDTH}px`,
                minHeight: `${CARD_HEIGHT}px`,
                touchAction: 'none',
              }}
              className={`absolute top-0 left-0 select-none ${
                isBeingDragged
                  ? 'cursor-grabbing scale-[1.03] z-50'
                  : 'cursor-grab transition-transform duration-200 ease-out'
              }`}
            >
              {/* Drop-to-Stack Magnetic Highlight Ring */}
              {isDropTarget && (
                <div className="absolute -inset-2 rounded-3xl border-2 border-dashed border-[#3B82F6] bg-[#3B82F6]/15 animate-pulse pointer-events-none flex items-end justify-center pb-2 z-30">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#3B82F6] text-white shadow">
                    Solte para empilhar
                  </span>
                </div>
              )}

              {/* Solid Opaque Post-it Card */}
              <div
                style={{
                  backgroundColor: getSolidBg(note.color),
                }}
                className={`group relative p-4 rounded-2xl rounded-br-[26px] border flex flex-col justify-between min-h-[206px] transition-shadow duration-200 ${
                  styleObj.card
                } ${
                  isBeingDragged
                    ? 'shadow-[0_24px_48px_rgba(0,0,0,0.65)] ring-2 ring-[#3B82F6]/70'
                    : !isTopOfStack
                    ? 'hover:brightness-105 cursor-pointer'
                    : ''
                }`}
                title={!isTopOfStack ? `Clique para trazer "${note.title || 'Nota rápida'}" para frente ou arraste` : undefined}
              >
                {/* Top adhesive tape + drag handle */}
                <div
                  className={`w-16 h-3.5 rounded-sm mx-auto -mt-5 mb-2 flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform group-hover:scale-105 ${styleObj.tape}`}
                  title="Arraste para mover este Post-it"
                >
                  <GripHorizontal size={12} className="opacity-65" />
                </div>

                <div className="flex-1 flex flex-col">
                  {/* Editable Title + Pin/Delete Controls */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    {isTopOfStack ? (
                      <input
                        type="text"
                        value={note.title || ''}
                        onChange={(e) => onUpdateNote(note.id, { title: e.target.value })}
                        placeholder="Título da nota..."
                        className={`flex-1 min-w-0 bg-transparent border-none outline-none text-xs font-bold ${textColor} placeholder:${subTextColor} focus:ring-1 focus:ring-black/15 dark:focus:ring-white/20 rounded px-1 -ml-1 py-0.5 select-text`}
                      />
                    ) : (
                      <span className={`flex-1 min-w-0 text-xs font-bold ${textColor} truncate`}>
                        {note.title || 'Nota rápida'}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => onTogglePin(note.id, e)}
                        className={`p-1 rounded-md transition-opacity ${
                          note.pinned
                            ? `${styleObj.accent} opacity-100`
                            : `${subTextColor} opacity-60 hover:opacity-100`
                        }`}
                        title={note.pinned ? 'Desafixar Post-it' : 'Fixar Post-it'}
                      >
                        <Pin size={12} className={note.pinned ? 'fill-current' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onDeleteNote(note.id, e)}
                        className={`p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity ${subTextColor} hover:text-red-500`}
                        title="Remover Post-it"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Editable Content Textarea inside the active Post-it */}
                  {isTopOfStack ? (
                    <>
                      <textarea
                        value={note.content || ''}
                        onChange={(e) => onUpdateNote(note.id, { content: e.target.value })}
                        placeholder="Clique para escrever ou editar..."
                        rows={3}
                        className={`w-full flex-1 bg-transparent border-none outline-none text-xs resize-none leading-relaxed ${
                          darkMode ? 'text-white/95' : 'text-[#202124]'
                        } placeholder:${subTextColor} focus:ring-1 focus:ring-black/15 dark:focus:ring-white/20 rounded px-1 -mx-1 py-0.5 select-text custom-scrollbar`}
                      />

                      {/* Quick Add Item/Line inside existing Post-it */}
                      <div className="mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={quickLineInputs[noteId] || ''}
                          onChange={(e) =>
                            setQuickLineInputs((prev) => ({ ...prev, [noteId]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddQuickLineToNote(note);
                            }
                          }}
                          placeholder="+ Adicionar item na nota..."
                          className={`flex-1 min-w-0 bg-black/[0.06] dark:bg-white/[0.08] rounded-lg px-2 py-1 text-[11px] outline-none ${textColor} placeholder:${subTextColor} select-text`}
                        />
                        {(quickLineInputs[noteId] || '').trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAddQuickLineToNote(note)}
                            className="w-6 h-6 rounded-lg bg-black/15 dark:bg-white/20 flex items-center justify-center hover:scale-105 transition-transform shrink-0"
                            title="Adicionar item"
                          >
                            <Plus size={12} className={textColor} />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p
                      className={`text-xs ${
                        darkMode ? 'text-white/85' : 'text-[#202124]/85'
                      } line-clamp-3 leading-relaxed`}
                    >
                      {note.content}
                    </p>
                  )}
                </div>

                {/* Footer: Color dots + Stack Controls */}
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-1">
                    {(['yellow', 'green', 'teal', 'pink', 'blue'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSound('tick');
                          onUpdateNote(note.id, { color: c });
                        }}
                        title={`Mudar cor para ${c}`}
                        className={`w-3 h-3 rounded-full border border-black/25 transition-transform ${
                          c === 'yellow'
                            ? 'bg-[#FBC02D]'
                            : c === 'green'
                            ? 'bg-[#7CB342]'
                            : c === 'teal'
                            ? 'bg-[#26A69A]'
                            : c === 'pink'
                            ? 'bg-[#EC407A]'
                            : 'bg-[#42A5F5]'
                        } ${(note.color || 'yellow') === c ? 'scale-125 ring-1 ring-white' : 'opacity-70 hover:opacity-100 hover:scale-110'}`}
                      />
                    ))}
                  </div>

                  {stackCount > 1 && isTopOfStack ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleCycleStack(stackId, e)}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/15 dark:bg-white/15 ${textColor} hover:bg-black/25 dark:hover:bg-white/25 transition-colors`}
                        title="Passar para o próximo Post-it da pilha"
                      >
                        <Layers size={10} className={styleObj.accent} />
                        <span>Pilha ({stackCount})</span>
                        <ChevronRight size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleUnstackGroup(stackId, e)}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${subTextColor} hover:${textColor} hover:bg-black/10 dark:hover:bg-white/10 transition-colors`}
                        title="Espalhar esta pilha no mural"
                      >
                        Espalhar
                      </button>
                    </div>
                  ) : (
                    <span className={`text-[10px] ${subTextColor}`}>
                      {note.date
                        ? new Date(note.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                        : 'Hoje'}
                    </span>
                  )}
                </div>

                {/* Subtle folded corner crease */}
                <div
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-tl-lg pointer-events-none ${
                    darkMode ? 'bg-white/15' : 'bg-black/10'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
