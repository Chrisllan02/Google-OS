import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Undo2,
  Redo2,
  Play,
  Star,
  Share2,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Type,
  Square,
  Circle,
  Minus,
  Image as ImageIcon,
  LayoutTemplate,
  Palette,
  Sparkles,
  Grid,
  Copy,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  Search,
  Download,
  Printer,
  FolderOpen,
  Check,
  StickyNote,
  BarChart2,
  CheckSquare,
  Maximize2,
  ArrowUp,
  ArrowDown,
  Wand2,
  EyeOff,
  Eye,
  Strikethrough,
  Globe,
  Lock,
  Send,
  RotateCcw,
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { decodeBase64Utf8, encodeBase64Utf8 } from '../../utils/sanitize';
import { bridge, Permission } from '../../utils/GASBridge';
import {
  SlideDeckBundle,
  SlidePage,
  SlideElement,
  SlideLayoutId,
  SlideTransitionType,
  SlideComment,
  SLIDE_CANVAS_WIDTH,
  SLIDE_CANVAS_HEIGHT,
  SLIDE_THEMES,
  SLIDE_LAYOUT_META,
  getThemeById,
  createBlankDeck,
  createSlideFromLayout,
  insertSlideAfter,
  duplicateSlideAt,
  deleteSlideAt,
  reorderSlides,
  applyThemeToSlides,
  applyLayoutToSlide,
  createElementForSlide,
  alignElementInBounds,
  bringElementLayer,
  findAndReplaceInDeck,
  computeDeckStats,
  exportDeckToHtml,
  exportDeckToMarkdown,
  isSafeSlideImageUrl,
  toggleSkipSlide,
  getPresentableSlideIndices,
  filterSlideComments,
  toggleResolveSlideComment,
  addSlideCommentReply,
  deleteSlideComment,
} from '../../utils/slidesLogic';
import type { AppOpenPayload, DashboardData, TaskItem } from '../../utils/GASBridge';
import type { EnrichedDriveItem } from '../../utils/driveLogic';

interface SlidesAppProps {
  onClose: () => void;
  data: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const QUICK_COLORS = [
  'transparent',
  '#FFFFFF',
  '#0F172A',
  '#1A73E8',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#F1F5F9',
  '#FEF08A',
];

const FONT_FAMILIES = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Manrope', value: "'Manrope', sans-serif" },
  { label: 'Georgia', value: "'Georgia', serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

const SLIDE_BG_PRESETS = [
  '#FFFFFF',
  '#F8FAFC',
  '#0F172A',
  '#18181B',
  'linear-gradient(135deg, #0F294A 0%, #1A73E8 100%)',
  'linear-gradient(135deg, #064E3B 0%, #059669 100%)',
  'linear-gradient(135deg, #312E81 0%, #4338CA 100%)',
  'linear-gradient(135deg, #7C2D12 0%, #D97706 100%)',
];

const SlideThumbnailView: React.FC<{ slide: SlidePage }> = ({ slide }) => (
  <svg
    viewBox={`0 0 ${SLIDE_CANVAS_WIDTH} ${SLIDE_CANVAS_HEIGHT}`}
    className="w-full h-full block select-none pointer-events-none"
    preserveAspectRatio="xMidYMid meet"
  >
    <foreignObject x="0" y="0" width={SLIDE_CANVAS_WIDTH} height={SLIDE_CANVAS_HEIGHT}>
      <div
        className="relative overflow-hidden select-none pointer-events-none"
        style={{
          width: SLIDE_CANVAS_WIDTH,
          height: SLIDE_CANVAS_HEIGHT,
          background: slide.background,
        }}
      >
        {[...slide.elements]
          .sort((a, b) => (a.style.zIndex || 1) - (b.style.zIndex || 1))
          .map((el) => (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.w,
                height: el.h,
                background: el.style.backgroundColor || 'transparent',
                color: el.style.color || '#0F172A',
                fontSize: el.style.fontSize || 18,
                fontFamily: el.style.fontFamily || 'sans-serif',
                fontWeight: el.style.fontWeight || 'normal',
                fontStyle: el.style.fontStyle || 'normal',
                textDecoration: el.style.textDecoration || 'none',
                textAlign: el.style.textAlign || 'left',
                borderRadius: el.style.borderRadius || 0,
                border: el.style.borderWidth
                  ? `${el.style.borderWidth}px solid ${el.style.borderColor || '#1A73E8'}`
                  : undefined,
                padding: el.style.padding || 0,
                opacity: el.style.opacity ?? 1,
                zIndex: el.style.zIndex || 1,
                whiteSpace: 'pre-wrap',
                overflow: 'hidden',
                display: el.type === 'shape' ? 'flex' : 'block',
                alignItems: el.type === 'shape' ? 'center' : undefined,
                justifyContent:
                  el.type === 'shape' && el.style.textAlign === 'center' ? 'center' : 'flex-start',
              }}
            >
              {el.type === 'image' && el.imageUrl ? (
                <img
                  src={el.imageUrl}
                  alt={el.content || 'Imagem do slide'}
                  className="w-full h-full object-cover"
                  style={{ borderRadius: el.style.borderRadius || 0 }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                el.content
              )}
            </div>
          ))}
      </div>
    </foreignObject>
  </svg>
);

export default function SlidesApp({
  onClose,
  data,
  onOpenApp,
  onUpdateTasks,
  showToast,
  isDarkMode = false,
}: SlidesAppProps) {
  const initialId = data?.id || 'slide_local_new';
  const initialTitle = data?.name || 'Apresentação sem título';

  const [driveDecks, setDriveDecks] = useState<EnrichedDriveItem[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string>(initialId);
  const [title, setTitle] = useState<string>(initialTitle);
  const [isStarred, setIsStarred] = useState<boolean>(() => Boolean((data?.activeFile as { isStarred?: boolean } | undefined)?.isStarred ?? false));
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  const [bundle, setBundle] = useState<SlideDeckBundle>(() => createBlankDeck(initialTitle));
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<SlidePage[][]>([]);
  const [redoStack, setRedoStack] = useState<SlidePage[][]>([]);

  // View & Panels
  const [viewMode, setViewMode] = useState<'normal' | 'grid'>('normal');
  const [showNotes, setShowNotes] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [showSnapGuides, setShowSnapGuides] = useState<boolean>(true);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fitScale, setFitScale] = useState<number>(0.85);
  const [rightPanel, setRightPanel] = useState<
    'none' | 'themes' | 'layouts' | 'background' | 'transition' | 'comments' | 'versions'
  >('none');

  // Dropdowns & Modals
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState<boolean>(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState<boolean>(false);
  const [showPresentMenu, setShowPresentMenu] = useState<boolean>(false);

  const [showOpenDriveModal, setShowOpenDriveModal] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [showFindReplaceModal, setShowFindReplaceModal] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [matchCase, setMatchCase] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  // Share State
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [shareEmail, setShareEmail] = useState<string>('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor');
  const [generalAccess, setGeneralAccess] = useState<'restricted' | 'anyone_with_link'>('restricted');
  const [generalRole, setGeneralRole] = useState<'viewer' | 'commenter' | 'editor'>('viewer');

  // Comments & Versions State
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentFilter, setCommentFilter] = useState<'open' | 'resolved'>('open');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [newVersionName, setNewVersionName] = useState<string>('');

  // Presentation Mode State
  const [isPresenting, setIsPresenting] = useState<boolean>(false);
  const [presentStepIdx, setPresentStepIdx] = useState<number>(0);
  const [presentShowNotes, setPresentShowNotes] = useState<boolean>(false);
  const [laserActive, setLaserActive] = useState<boolean>(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [presentElapsedSec, setPresentElapsedSec] = useState<number>(0);

  // Drag / Resize Interaction State
  const [dragSlideIdx, setDragSlideIdx] = useState<number | null>(null);
  const [interactionState, setInteractionState] = useState<{
    mode: 'move' | 'resize';
    elementId: string;
    handle?: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    initialSlides: SlidePage[];
    changed: boolean;
  } | null>(null);
  const [centerGuides, setCenterGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  const stageAreaRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSnapshotRef = useRef<SlidePage[] | null>(null);
  const bundleRef = useRef<SlideDeckBundle>(bundle);
  bundleRef.current = bundle;
  const toast = (msg: string) => (showToast ? showToast(msg) : undefined);

  const slides = bundle.slides;
  const activeSlide = slides[activeSlideIdx] || slides[0];
  const selectedElement = useMemo(
    () => activeSlide?.elements.find((e) => e.id === selectedElementId) || null,
    [activeSlide, selectedElementId]
  );

  const presentableIndices = useMemo(() => getPresentableSlideIndices(slides), [slides]);

  const scaleFactor = zoomMode === 'fit' ? fitScale : zoomMode / 100;

  // Responsive Auto-Fit Stage Measurement
  useEffect(() => {
    const el = stageAreaRef.current;
    if (!el) return;
    const updateFit = () => {
      const pad = el.clientWidth < 520 ? 20 : 40;
      const availW = Math.max(240, el.clientWidth - pad);
      const availH = Math.max(160, el.clientHeight - pad);
      const nextScale = Math.min(availW / SLIDE_CANVAS_WIDTH, availH / SLIDE_CANVAS_HEIGHT, 1.15);
      setFitScale(Math.max(0.28, Number(nextScale.toFixed(3))));
    };
    updateFit();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateFit);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [viewMode, rightPanel, showNotes]);

  // Sync incoming Drive payload if another deck is opened while Slides is mounted
  useEffect(() => {
    if (data?.id && data.id !== activeDeckId) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setActiveDeckId(data.id);
      setTitle(data.name || 'Apresentação sem título');
      setUndoStack([]);
      setRedoStack([]);
      setSelectedElementId(null);
      setEditingElementId(null);
    }
  }, [data?.id, data?.name]);

  // Load Drive slide decks, metadata & permissions
  useEffect(() => {
    let mounted = true;
    bridge.getAllDriveItems().then((items) => {
      if (!mounted) return;
      setDriveDecks(items.filter((i) => i.type === 'slide' && !i.trashed));
      const meta = items.find((i) => i.id === activeDeckId);
      if (meta) {
        setIsStarred(Boolean(meta.isStarred));
        setGeneralAccess(meta.generalAccess === 'anyone_with_link' ? 'anyone_with_link' : 'restricted');
        setGeneralRole(meta.generalRole || 'viewer');
      }
    });
    bridge.getFilePermissions(activeDeckId).then((perms) => {
      if (mounted) setPermissions(perms);
    });
    return () => {
      mounted = false;
    };
  }, [activeDeckId]);

  useEffect(() => {
    let mounted = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    bridge.getFileContent(activeDeckId).then((res) => {
      if (!mounted) return;
      if (res.success && res.data) {
        try {
          const decoded = decodeBase64Utf8(res.data);
          const parsed = JSON.parse(decoded);
          if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            setBundle(parsed);
            setActiveSlideIdx(0);
            setSelectedElementId(null);
            setEditingElementId(null);
            setUndoStack([]);
            setRedoStack([]);
            return;
          }
        } catch {
          // Ignore legacy payload format and initialize fresh deck
        }
      }
      setBundle(createBlankDeck(title));
      setActiveSlideIdx(0);
      setSelectedElementId(null);
      setEditingElementId(null);
      setUndoStack([]);
      setRedoStack([]);
    });
    return () => {
      mounted = false;
    };
  }, [activeDeckId]);

  // Persist deck changes automatically to GASBridge
  const scheduleSave = useCallback(
    (nextBundle: SlideDeckBundle) => {
      setSaveState('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const encoded = encodeBase64Utf8(JSON.stringify(nextBundle));
          await bridge.saveFileContent(activeDeckId, encoded);
          setSaveState('saved');
        } catch {
          setSaveState('saved');
        }
      }, 650);
    },
    [activeDeckId]
  );

  const commitSlides = useCallback(
    (nextSlides: SlidePage[], recordHistory = true) => {
      setBundle((prev) => {
        if (recordHistory) {
          setUndoStack((u) => [...u.slice(-24), prev.slides]);
          setRedoStack([]);
        }
        const updated = { ...prev, slides: nextSlides };
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, slides]);
    setBundle((prev) => {
      const updated = { ...prev, slides: previous };
      scheduleSave(updated);
      return updated;
    });
    setActiveSlideIdx((i) => Math.min(i, previous.length - 1));
    setSelectedElementId(null);
    toast('Ação desfeita');
  }, [undoStack, slides, scheduleSave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, slides]);
    setBundle((prev) => {
      const updated = { ...prev, slides: next };
      scheduleSave(updated);
      return updated;
    });
    setActiveSlideIdx((i) => Math.min(i, next.length - 1));
    setSelectedElementId(null);
    toast('Ação refeita');
  }, [redoStack, slides, scheduleSave]);

  // Element Drag & Resize Pointer Listeners
  useEffect(() => {
    if (!interactionState) return;
    let moved = false;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = (e.clientX - interactionState.startClientX) / scaleFactor;
      const dy = (e.clientY - interactionState.startClientY) / scaleFactor;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;

      setBundle((prev) => {
        const nextSlides = prev.slides.map((s, idx) => {
          if (idx !== activeSlideIdx) return s;
          return {
            ...s,
            elements: s.elements.map((el) => {
              if (el.id !== interactionState.elementId) return el;

              if (interactionState.mode === 'move') {
                let nextX = Math.round(interactionState.startX + dx);
                let nextY = Math.round(interactionState.startY + dy);
                const snapCenterX = Math.round((SLIDE_CANVAS_WIDTH - el.w) / 2);
                const snapCenterY = Math.round((SLIDE_CANVAS_HEIGHT - el.h) / 2);

                const isNearX = showSnapGuides && Math.abs(nextX - snapCenterX) <= 10;
                const isNearY = showSnapGuides && Math.abs(nextY - snapCenterY) <= 10;
                if (isNearX) nextX = snapCenterX;
                if (isNearY) nextY = snapCenterY;
                setCenterGuides({ x: isNearX, y: isNearY });

                return { ...el, x: nextX, y: nextY };
              }

              // Resize handles
              const h = interactionState.handle || 'se';
              let { startX: nx, startY: ny, startW: nw, startH: nh } = interactionState;
              const minW = 36;
              const minH = el.type === 'line' ? 4 : 24;

              if (h.includes('e')) nw = Math.max(minW, Math.round(interactionState.startW + dx));
              if (h.includes('s')) nh = Math.max(minH, Math.round(interactionState.startH + dy));
              if (h.includes('w')) {
                const candidateW = Math.max(minW, Math.round(interactionState.startW - dx));
                nx = Math.round(interactionState.startX + (interactionState.startW - candidateW));
                nw = candidateW;
              }
              if (h.includes('n')) {
                const candidateH = Math.max(minH, Math.round(interactionState.startH - dy));
                ny = Math.round(interactionState.startY + (interactionState.startH - candidateH));
                nh = candidateH;
              }

              return { ...el, x: nx, y: ny, w: nw, h: nh };
            }),
          };
        });
        return { ...prev, slides: nextSlides };
      });
    };

    const handlePointerUp = () => {
      setCenterGuides({ x: false, y: false });
      if (moved) {
        setUndoStack((u) => [...u.slice(-24), interactionState.initialSlides]);
        setRedoStack([]);
        scheduleSave(bundleRef.current);
      }
      setInteractionState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interactionState, activeSlideIdx, scaleFactor, showSnapGuides, scheduleSave]);

  const startPresentation = useCallback(
    (startSlideIndex: number, withNotes = false) => {
      const pos = presentableIndices.indexOf(startSlideIndex);
      setPresentStepIdx(pos >= 0 ? pos : 0);
      setPresentShowNotes(withNotes);
      setLaserActive(false);
      setShowPresentMenu(false);
      setIsPresenting(true);
    },
    [presentableIndices]
  );

  // Keyboard shortcuts (Editor & Presentation mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPresenting) {
        if (e.key === 'Escape') {
          setIsPresenting(false);
          setLaserActive(false);
        } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
          e.preventDefault();
          setPresentStepIdx((i) => Math.min(presentableIndices.length - 1, i + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          setPresentStepIdx((i) => Math.max(0, i - 1));
        }
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFindReplaceModal(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedElement && !isInput) {
        e.preventDefault();
        handleDuplicateSelectedElement();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && !editingElementId && !isInput) {
        e.preventDefault();
        handleDeleteSelectedElement();
      } else if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        selectedElement &&
        !editingElementId &&
        !isInput
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 16 : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        updateSelectedElement({ x: selectedElement.x + dx, y: selectedElement.y + dy }, false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresenting, presentableIndices.length, selectedElement, editingElementId, handleUndo, handleRedo]);

  // Presentation Timer
  useEffect(() => {
    if (!isPresenting) {
      setPresentElapsedSec(0);
      return;
    }
    const timer = setInterval(() => setPresentElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isPresenting]);

  const handleRenameTitle = async (nextTitle: string) => {
    setTitle(nextTitle);
    const trimmed = nextTitle.trim();
    if (trimmed && activeDeckId) {
      await bridge.renameDriveItem(activeDeckId, trimmed);
    }
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    await bridge.setStarredDriveItem(activeDeckId, next);
    toast(next ? 'Adicionado aos itens com estrela' : 'Removido dos itens com estrela');
  };

  // Slide Operations
  const handleAddSlide = (layout: SlideLayoutId = 'title_body') => {
    const newSlide = createSlideFromLayout(layout, bundle.themeId);
    const { slides: nextSlides, insertedIndex } = insertSlideAfter(slides, activeSlideIdx, newSlide);
    commitSlides(nextSlides);
    setActiveSlideIdx(insertedIndex);
    setSelectedElementId(null);
    setEditingElementId(null);
    setShowLayoutDropdown(false);
    toast('Novo slide adicionado');
  };

  const handleDuplicateSlide = (idx = activeSlideIdx) => {
    const { slides: nextSlides, duplicatedIndex } = duplicateSlideAt(slides, idx);
    commitSlides(nextSlides);
    setActiveSlideIdx(duplicatedIndex);
    setSelectedElementId(null);
    toast('Slide duplicado');
  };

  const handleDeleteSlide = (idx = activeSlideIdx) => {
    const { slides: nextSlides, nextIndex } = deleteSlideAt(slides, idx, bundle.themeId);
    commitSlides(nextSlides);
    setActiveSlideIdx(nextIndex);
    setSelectedElementId(null);
    toast('Slide excluído');
  };

  const handleMoveSlide = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= slides.length || fromIdx === toIdx) return;
    const nextSlides = reorderSlides(slides, fromIdx, toIdx);
    commitSlides(nextSlides);
    setActiveSlideIdx(toIdx);
  };

  const handleToggleSkipSlide = (idx = activeSlideIdx) => {
    const target = slides[idx];
    if (!target) return;
    const nextSlides = toggleSkipSlide(slides, idx);
    commitSlides(nextSlides);
    toast(target.skipped ? `Slide ${idx + 1} incluído na apresentação` : `Slide ${idx + 1} marcado para pular`);
  };

  const handleMakeDeckCopy = async () => {
    const copyName = `Cópia de ${title}`;
    const newItem = await bridge.createDriveDocument('slide', copyName);
    const clonedBundle: SlideDeckBundle = JSON.parse(JSON.stringify(bundle));
    await bridge.saveFileContent(newItem.id, encodeBase64Utf8(JSON.stringify(clonedBundle)));
    setDriveDecks((prev) => [newItem, ...prev]);
    setActiveDeckId(newItem.id);
    setTitle(newItem.name);
    setBundle(clonedBundle);
    setActiveSlideIdx(0);
    setUndoStack([]);
    setRedoStack([]);
    toast(`Cópia "${copyName}" criada no Drive`);
  };

  const handleApplyLayout = (layout: SlideLayoutId) => {
    const nextSlides = slides.map((s, i) =>
      i === activeSlideIdx ? applyLayoutToSlide(s, layout, bundle.themeId) : s
    );
    commitSlides(nextSlides);
    setSelectedElementId(null);
    toast('Layout aplicado ao slide');
  };

  const handleApplyTheme = (themeId: string) => {
    const themedSlides = applyThemeToSlides(slides, themeId);
    setBundle((prev) => {
      setUndoStack((u) => [...u.slice(-24), prev.slides]);
      const updated = { ...prev, themeId, slides: themedSlides };
      scheduleSave(updated);
      return updated;
    });
    toast(`Tema "${getThemeById(themeId).name}" aplicado`);
  };

  const handleUpdateSlideBackground = (bg: string, applyAll = false) => {
    const nextSlides = slides.map((s, i) =>
      applyAll || i === activeSlideIdx ? { ...s, background: bg } : s
    );
    commitSlides(nextSlides);
    toast(applyAll ? 'Plano de fundo aplicado a todos os slides' : 'Plano de fundo atualizado');
  };

  const handleUpdateSlideTransition = (transition: SlideTransitionType, applyAll = false) => {
    const nextSlides = slides.map((s, i) =>
      applyAll || i === activeSlideIdx ? { ...s, transition } : s
    );
    commitSlides(nextSlides);
    toast(applyAll ? 'Transição aplicada a todos os slides' : 'Transição atualizada');
  };

  const handleUpdateSpeakerNotes = (notes: string) => {
    setBundle((prev) => {
      const nextSlides = prev.slides.map((s, i) => (i === activeSlideIdx ? { ...s, notes } : s));
      const updated = { ...prev, slides: nextSlides };
      scheduleSave(updated);
      return updated;
    });
  };

  // Element Operations
  const handleInsertElement = (
    kind: 'text' | 'rectangle' | 'rounded' | 'circle' | 'pill' | 'callout' | 'line' | 'image',
    extra?: { imageUrl?: string; content?: string }
  ) => {
    const maxZ = activeSlide.elements.reduce((m, e) => Math.max(m, e.style.zIndex || 1), 1);
    const el = createElementForSlide(kind, bundle.themeId, { ...extra, zIndex: maxZ + 1 });
    const nextSlides = slides.map((s, i) =>
      i === activeSlideIdx ? { ...s, elements: [...s.elements, el] } : s
    );
    commitSlides(nextSlides);
    setSelectedElementId(el.id);
    if (kind === 'text') setEditingElementId(el.id);
    setShowShapesDropdown(false);
  };

  const updateSelectedElement = (
    patch: Partial<SlideElement> & { style?: Partial<SlideElement['style']> },
    recordHistory = true
  ) => {
    if (!selectedElement) return;
    const nextSlides = slides.map((s, i) => {
      if (i !== activeSlideIdx) return s;
      return {
        ...s,
        elements: s.elements.map((el) =>
          el.id === selectedElement.id
            ? {
                ...el,
                ...patch,
                style: patch.style ? { ...el.style, ...patch.style } : el.style,
              }
            : el
        ),
      };
    });
    commitSlides(nextSlides, recordHistory);
  };

  const handleDuplicateSelectedElement = () => {
    if (!selectedElement) return;
    const maxZ = activeSlide.elements.reduce((m, e) => Math.max(m, e.style.zIndex || 1), 1);
    const clone: SlideElement = {
      ...selectedElement,
      id: `el_${Date.now().toString(36)}`,
      x: Math.min(SLIDE_CANVAS_WIDTH - selectedElement.w, selectedElement.x + 24),
      y: Math.min(SLIDE_CANVAS_HEIGHT - selectedElement.h, selectedElement.y + 24),
      style: { ...selectedElement.style, zIndex: maxZ + 1 },
    };
    const nextSlides = slides.map((s, i) =>
      i === activeSlideIdx ? { ...s, elements: [...s.elements, clone] } : s
    );
    commitSlides(nextSlides);
    setSelectedElementId(clone.id);
    toast('Elemento duplicado');
  };

  const handleDeleteSelectedElement = () => {
    if (!selectedElement) return;
    const nextSlides = slides.map((s, i) =>
      i === activeSlideIdx
        ? { ...s, elements: s.elements.filter((el) => el.id !== selectedElement.id) }
        : s
    );
    commitSlides(nextSlides);
    setSelectedElementId(null);
    setEditingElementId(null);
  };

  const handleAlignSelected = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElement) return;
    const aligned = alignElementInBounds(selectedElement, alignment);
    updateSelectedElement({ x: aligned.x, y: aligned.y });
  };

  const handleLayerSelected = (dir: 'front' | 'back') => {
    if (!selectedElement) return;
    const reordered = bringElementLayer(activeSlide.elements, selectedElement.id, dir);
    const nextSlides = slides.map((s, i) => (i === activeSlideIdx ? { ...s, elements: reordered } : s));
    commitSlides(nextSlides);
  };

  // Image Upload / URL
  const handleInsertImageFromUrl = () => {
    const cleanUrl = imageUrlInput.trim();
    if (!cleanUrl) return;
    if (!isSafeSlideImageUrl(cleanUrl)) {
      toast('URL inválida. Utilize um endereço https:// ou imagem válida.');
      return;
    }
    handleInsertElement('image', { imageUrl: cleanUrl, content: 'Imagem inserida' });
    setImageUrlInput('');
    setShowImageModal(false);
    toast('Imagem adicionada ao slide');
  };

  const handleUploadImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && isSafeSlideImageUrl(reader.result)) {
        handleInsertElement('image', { imageUrl: reader.result, content: file.name });
        setShowImageModal(false);
        toast(`Imagem "${file.name}" inserida`);
      } else {
        toast('Formato de imagem não suportado.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Find & Replace
  const handleRunFindReplace = () => {
    if (!findQuery) return;
    const result = findAndReplaceInDeck(slides, findQuery, replaceQuery, matchCase);
    if (result.replacements === 0) {
      toast(`Nenhuma ocorrência para "${findQuery}"`);
      return;
    }
    commitSlides(result.slides);
    toast(`${result.replacements} ocorrência(s) substituída(s)`);
    setShowFindReplaceModal(false);
  };

  // Comments & Versions
  const handleAddComment = () => {
    const txt = newCommentText.trim();
    if (!txt) return;
    const comment: SlideComment = {
      id: `sc_${Date.now()}`,
      slideId: activeSlide.id,
      author: data?.user?.name || 'Você',
      createdAt: 'Agora',
      text: txt,
      resolved: false,
      replies: [],
    };
    setBundle((prev) => {
      const updated = { ...prev, comments: [comment, ...prev.comments] };
      scheduleSave(updated);
      return updated;
    });
    setNewCommentText('');
    setCommentFilter('open');
    toast('Comentário adicionado');
  };

  const handleSaveVersion = () => {
    const customName = newVersionName.trim();
    const ver = {
      id: `sv_${Date.now()}`,
      name:
        customName ||
        `Snapshot ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: 'Agora',
      author: data?.user?.name || 'Você',
      slides: JSON.parse(JSON.stringify(slides)) as SlidePage[],
    };
    setBundle((prev) => {
      const updated = { ...prev, versions: [ver, ...prev.versions] };
      scheduleSave(updated);
      return updated;
    });
    setNewVersionName('');
    toast(`Versão "${ver.name}" salva no histórico`);
  };

  const handleRestoreVersion = (verId: string) => {
    const found = bundle.versions.find((v) => v.id === verId);
    if (!found || !Array.isArray(found.slides) || found.slides.length === 0) return;
    const clonedSlides = JSON.parse(JSON.stringify(found.slides)) as SlidePage[];
    commitSlides(clonedSlides);
    setActiveSlideIdx(0);
    setSelectedElementId(null);
    setEditingElementId(null);
    toast(`Versão "${found.name}" restaurada`);
  };

  // Exports
  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exportado como ${filename}`);
  };

  // Tasks integration
  const handleExportNotesToTasks = async () => {
    const notesText = activeSlide.notes.trim() || `Revisar Slide ${activeSlideIdx + 1}: ${title}`;
    const result = await bridge.createTask(notesText, `Origem: ${title} · Slide ${activeSlideIdx + 1}`);
    if (onUpdateTasks && data?.tasks && result.task) {
      onUpdateTasks([result.task, ...data.tasks]);
    }
    toast('Ação enviada para o Google Tarefas');
  };

  const handleCreateBlankDeck = async () => {
    const deckTitle = 'Apresentação sem título';
    const newItem = await bridge.createDriveDocument('slide', deckTitle);
    const createdBundle = createBlankDeck(deckTitle);
    const encoded = encodeBase64Utf8(JSON.stringify(createdBundle));
    await bridge.saveFileContent(newItem.id, encoded);
    setDriveDecks((prev) => [newItem, ...prev]);
    setActiveDeckId(newItem.id);
    setTitle(newItem.name);
    setBundle(createdBundle);
    setActiveSlideIdx(0);
    setUndoStack([]);
    setRedoStack([]);
    toast(`Apresentação "${newItem.name}" criada`);
  };

  const handleOpenShareModal = async () => {
    const [perms, allItems] = await Promise.all([
      bridge.getFilePermissions(activeDeckId),
      bridge.getAllDriveItems(),
    ]);
    setPermissions(perms);
    const meta = allItems.find((i) => i.id === activeDeckId);
    setGeneralAccess(meta?.generalAccess === 'anyone_with_link' ? 'anyone_with_link' : 'restricted');
    setGeneralRole(meta?.generalRole || 'viewer');
    setShowShareModal(true);
  };

  const handleAddSharePermission = async () => {
    if (!shareEmail.trim() || !shareEmail.includes('@')) return;
    await bridge.addDrivePermission(activeDeckId, shareEmail.trim(), shareRole);
    const updated = await bridge.getFilePermissions(activeDeckId);
    setPermissions(updated);
    setShareEmail('');
    toast('Permissão adicionada');
  };

  const handleRemoveSharePermission = async (email: string) => {
    await bridge.removeDrivePermission(activeDeckId, email);
    const updated = await bridge.getFilePermissions(activeDeckId);
    setPermissions(updated);
    toast(`Acesso removido para ${email}`);
  };

  const deckStats = useMemo(() => computeDeckStats(slides), [slides]);

  const bgMain = isDarkMode ? 'bg-[#18191B] text-[#E8EAED]' : 'bg-[#F8F9FA] text-[#202124]';
  const surfaceBg = isDarkMode ? 'bg-[#202124] border-white/10' : 'bg-white border-gray-200';
  const subtleHover = isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';
  const menuBtnCls = `px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${subtleHover}`;

  const renderElementOnCanvas = (el: SlideElement) => {
    const isSelected = selectedElementId === el.id;
    const isEditing = editingElementId === el.id;

    return (
      <div
        key={el.id}
        data-slide-element-id={el.id}
        onPointerDown={(e) => {
          e.stopPropagation();
          setSelectedElementId(el.id);
          if (editingElementId !== el.id) {
            setEditingElementId(null);
            setInteractionState({
              mode: 'move',
              elementId: el.id,
              startClientX: e.clientX,
              startClientY: e.clientY,
              startX: el.x,
              startY: el.y,
              startW: el.w,
              startH: el.h,
              initialSlides: JSON.parse(JSON.stringify(slides)) as SlidePage[],
              changed: false,
            });
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (el.type === 'text' || el.type === 'shape') {
            editSnapshotRef.current = JSON.parse(JSON.stringify(slides)) as SlidePage[];
            setSelectedElementId(el.id);
            setEditingElementId(el.id);
          }
        }}
        className={`absolute group cursor-move transition-shadow ${
          isSelected ? 'ring-2 ring-[#1A73E8] shadow-sm' : 'hover:ring-1 hover:ring-[#1A73E8]/50'
        }`}
        style={{
          left: el.x,
          top: el.y,
          width: el.w,
          height: el.h,
          background: el.style.backgroundColor || 'transparent',
          color: el.style.color || '#0F172A',
          fontSize: el.style.fontSize || 18,
          fontFamily: el.style.fontFamily || 'sans-serif',
          fontWeight: el.style.fontWeight || 'normal',
          fontStyle: el.style.fontStyle || 'normal',
          textDecoration: el.style.textDecoration || 'none',
          textAlign: el.style.textAlign || 'left',
          borderRadius: el.style.borderRadius || 0,
          border: el.style.borderWidth
            ? `${el.style.borderWidth}px solid ${el.style.borderColor || '#1A73E8'}`
            : undefined,
          padding: el.style.padding || (el.type === 'text' ? 6 : 0),
          opacity: el.style.opacity ?? 1,
          zIndex: el.style.zIndex || 1,
          display: el.type === 'shape' ? 'flex' : 'block',
          alignItems: el.type === 'shape' ? 'center' : undefined,
          justifyContent:
            el.type === 'shape' && el.style.textAlign === 'center' ? 'center' : 'flex-start',
        }}
      >
        {el.type === 'image' ? (
          el.imageUrl ? (
            <img
              src={el.imageUrl}
              alt={el.content || 'Imagem do slide'}
              className="w-full h-full object-cover pointer-events-none select-none"
              style={{ borderRadius: el.style.borderRadius || 0 }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200/70 text-slate-600 text-xs rounded-lg">
              <ImageIcon size={24} className="mb-1 opacity-70" />
              <span>{el.content || 'Imagem'}</span>
            </div>
          )
        ) : isEditing ? (
          <textarea
            autoFocus
            value={el.content}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => updateSelectedElement({ content: e.target.value }, false)}
            onBlur={() => {
              if (editSnapshotRef.current) {
                const beforeJson = JSON.stringify(editSnapshotRef.current);
                const afterJson = JSON.stringify(bundleRef.current.slides);
                if (beforeJson !== afterJson) {
                  setUndoStack((u) => [...u.slice(-24), editSnapshotRef.current!]);
                  setRedoStack([]);
                }
                editSnapshotRef.current = null;
              }
              setEditingElementId(null);
              scheduleSave(bundleRef.current);
            }}
            className="w-full h-full bg-transparent border-none outline-none resize-none cursor-text"
            style={{
              color: el.style.color || '#0F172A',
              fontSize: el.style.fontSize || 18,
              fontFamily: el.style.fontFamily || 'sans-serif',
              fontWeight: el.style.fontWeight || 'normal',
              fontStyle: el.style.fontStyle || 'normal',
              textAlign: el.style.textAlign || 'left',
              lineHeight: 1.3,
            }}
          />
        ) : (
          <div className="w-full whitespace-pre-wrap break-words leading-snug select-none">
            {el.content}
          </div>
        )}

        {/* 8 Resize Handles */}
        {isSelected &&
          !isEditing &&
          ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
            const posCls: Record<string, string> = {
              nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
              n: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
              ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
              e: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize',
              se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
              s: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
              sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
              w: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize',
            };
            return (
              <div
                key={handle}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setInteractionState({
                    mode: 'resize',
                    elementId: el.id,
                    handle,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startX: el.x,
                    startY: el.y,
                    startW: el.w,
                    startH: el.h,
                    initialSlides: JSON.parse(JSON.stringify(slides)) as SlidePage[],
                    changed: false,
                  });
                }}
                className={`absolute w-3 h-3 bg-white border-2 border-[#1A73E8] rounded-xs shadow-xs z-50 ${posCls[handle]}`}
              />
            );
          })}
      </div>
    );
  };

  // FULL-SCREEN PRESENTATION MODE
  if (isPresenting) {
    const safeStep = Math.min(presentStepIdx, Math.max(0, presentableIndices.length - 1));
    const currentSlideNumber = presentableIndices[safeStep] ?? 0;
    const pSlide = slides[currentSlideNumber] || slides[0];
    const animClass =
      pSlide.transition === 'fade'
        ? 'animate-in fade-in duration-300'
        : pSlide.transition === 'slide'
          ? 'animate-in slide-in-from-right-8 duration-300'
          : pSlide.transition === 'zoom'
            ? 'animate-in zoom-in-95 duration-300'
            : '';
    const mins = String(Math.floor(presentElapsedSec / 60)).padStart(2, '0');
    const secs = String(presentElapsedSec % 60).padStart(2, '0');

    return (
      <div
        className="w-full h-full bg-[#0B0D10] text-white flex flex-col items-center justify-between p-3 sm:p-4 gap-3 select-none relative"
        onMouseMove={(e) => {
          if (!laserActive) return;
          setLaserPos({ x: e.clientX, y: e.clientY });
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, select')) return;
          if (safeStep < presentableIndices.length - 1) setPresentStepIdx(safeStep + 1);
        }}
      >
        {/* Main 16:9 Stage */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div
            key={pSlide.id}
            className={`relative rounded-xl overflow-hidden shadow-2xl border border-white/10 max-h-full max-w-full ${animClass}`}
            style={{
              width: presentShowNotes ? 'min(92vw, calc(58vh * 16 / 9))' : 'min(94vw, calc(72vh * 16 / 9))',
              aspectRatio: '16 / 9',
            }}
          >
            <SlideThumbnailView slide={pSlide} />
          </div>
        </div>

        {/* Optional Presenter Speaker Notes Overlay */}
        {presentShowNotes && (
          <div className="w-full max-w-4xl bg-black/75 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 shrink-0 max-h-28 overflow-y-auto">
            <div className="text-[11px] font-semibold text-amber-300 mb-0.5">
              Notas do apresentador · Slide {currentSlideNumber + 1}
            </div>
            <p className="leading-snug text-xs md:text-sm">
              {pSlide.notes || 'Nenhuma nota cadastrada para este slide.'}
            </p>
          </div>
        )}

        {/* Laser Pointer Dot */}
        {laserActive && laserPos && (
          <div
            className="fixed w-4 h-4 rounded-full bg-red-500 shadow-[0_0_16px_4px_rgba(239,68,68,0.85)] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[140]"
            style={{ left: laserPos.x, top: laserPos.y }}
          />
        )}

        {/* Bottom Presenter Control Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 bg-[#1F242D]/95 border border-white/15 rounded-2xl sm:rounded-full px-3 sm:px-4 py-1.5 shadow-2xl backdrop-blur-md shrink-0 max-w-[calc(100%-8px)]">
          <button
            type="button"
            onClick={() => setPresentStepIdx((i) => Math.max(0, i - 1))}
            disabled={safeStep === 0}
            aria-label="Slide anterior"
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            aria-label="Selecionar slide na apresentação"
            value={safeStep}
            onChange={(e) => setPresentStepIdx(Number(e.target.value))}
            className="bg-transparent text-xs font-mono tabular-nums px-2 py-1 rounded outline-none cursor-pointer"
          >
            {presentableIndices.map((slideIdx, stepIdx) => (
              <option key={slideIdx} value={stepIdx} className="bg-[#1F242D] text-white">
                Slide {slideIdx + 1} ({stepIdx + 1}/{presentableIndices.length})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setPresentStepIdx((i) => Math.min(presentableIndices.length - 1, i + 1))}
            disabled={safeStep === presentableIndices.length - 1}
            aria-label="Próximo slide"
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          <div className="hidden sm:block w-px h-5 bg-white/15 mx-1" />

          <span className="hidden sm:inline text-xs font-mono tabular-nums text-white/70 px-1.5">
            {mins}:{secs}
          </span>

          <button
            type="button"
            onClick={() => setLaserActive((v) => !v)}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              laserActive ? 'bg-red-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            Laser
          </button>

          <button
            type="button"
            onClick={() => setPresentShowNotes((v) => !v)}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              presentShowNotes ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            Notas
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPresenting(false);
              setLaserActive(false);
            }}
            className="px-3 sm:px-3.5 py-1 rounded-full bg-white text-black text-xs font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            Sair (Esc)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col h-full font-sans overflow-hidden ${bgMain}`}
      onClick={() => {
        setOpenMenu(null);
        setShowLayoutDropdown(false);
        setShowShapesDropdown(false);
        setShowPresentMenu(false);
      }}
    >
      {/* TOP HEADER BAR (2 Responsive Rows) */}
      <div className={`px-3 sm:px-4 pt-2 pb-1.5 border-b shrink-0 ${surfaceBg}`}>
        {/* Row 1: Brand + Title + Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <GoogleIcons.Slides className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <input
              type="text"
              aria-label="Título da apresentação"
              value={title}
              onChange={(e) => handleRenameTitle(e.target.value)}
              className={`text-sm sm:text-base font-medium bg-transparent border border-transparent focus:border-[#1A73E8] rounded px-1.5 py-0.5 outline-none truncate min-w-0 flex-1 max-w-[260px] ${
                isDarkMode ? 'text-white hover:border-white/15' : 'text-gray-900 hover:border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={handleToggleStar}
              aria-label={isStarred ? 'Remover estrela' : 'Adicionar estrela'}
              className={`p-1.5 rounded-full shrink-0 ${subtleHover}`}
            >
              <Star
                size={15}
                className={isStarred ? 'fill-amber-400 text-amber-400' : 'opacity-50'}
              />
            </button>
            <span className="text-xs opacity-60 whitespace-nowrap shrink-0 hidden xl:inline">
              {saveState === 'saving' ? 'Salvando...' : 'Salvo no Drive'}
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setRightPanel(rightPanel === 'versions' ? 'none' : 'versions')}
              aria-label="Histórico de versões"
              title="Histórico de versões"
              className={`p-2 rounded-full ${
                rightPanel === 'versions' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
              }`}
            >
              <Clock size={17} />
            </button>

            <button
              type="button"
              onClick={() => setRightPanel(rightPanel === 'comments' ? 'none' : 'comments')}
              aria-label="Comentários"
              title="Comentários"
              className={`p-2 rounded-full relative ${
                rightPanel === 'comments' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
              }`}
            >
              <MessageSquare size={17} />
              {bundle.comments.filter((c) => !c.resolved).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => startPresentation(activeSlideIdx, false)}
                aria-label="Apresentar slides"
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-l-full bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <Play size={14} fill="currentColor" />
                <span className="hidden sm:inline">Apresentar</span>
              </button>
              <button
                type="button"
                aria-label="Opções de apresentação"
                onClick={() => setShowPresentMenu((v) => !v)}
                className="px-1.5 sm:px-2 py-1.5 rounded-r-full bg-[#F59E0B] hover:bg-[#D97706] border-l border-black/15 text-slate-950 transition-colors"
              >
                <ChevronDown size={14} />
              </button>
              {showPresentMenu && (
                <div
                  className={`absolute right-0 top-10 w-56 max-w-[calc(100vw-24px)] rounded-lg border shadow-xl py-1.5 z-50 ${
                    isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => startPresentation(0, false)}
                    className={`w-full text-left px-3.5 py-2 text-xs ${subtleHover}`}
                  >
                    Apresentar do início
                  </button>
                  <button
                    type="button"
                    onClick={() => startPresentation(activeSlideIdx, true)}
                    className={`w-full text-left px-3.5 py-2 text-xs ${subtleHover}`}
                  >
                    Visão do apresentador (com notas)
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenShareModal}
              aria-label="Compartilhar apresentação"
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              <Share2 size={14} />
              <span className="hidden md:inline">Compartilhar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Apresentações"
              className={`p-1.5 sm:p-2 rounded-full ${subtleHover}`}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Row 2: Full-width Classic Menu Bar */}
        <div
          className="flex items-center flex-wrap gap-0.5 mt-1 -ml-1 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            {
              id: 'file',
              label: 'Arquivo',
              items: [
                { label: 'Nova apresentação em branco', action: () => { void handleCreateBlankDeck(); } },
                { label: 'Abrir do Drive', action: () => setShowOpenDriveModal(true) },
                { label: 'Fazer uma cópia', action: handleMakeDeckCopy },
                { label: 'Histórico de versões', action: () => setRightPanel('versions') },
                { label: 'Baixar como HTML', action: () => triggerDownload(`${title}.html`, exportDeckToHtml(title, slides), 'text/html') },
                { label: 'Baixar como Markdown', action: () => triggerDownload(`${title}.md`, exportDeckToMarkdown(title, slides), 'text/markdown') },
                { label: 'Imprimir', action: () => window.print() },
              ],
            },
            {
              id: 'edit',
              label: 'Editar',
              items: [
                { label: 'Desfazer (Ctrl+Z)', action: handleUndo },
                { label: 'Refazer (Ctrl+Y)', action: handleRedo },
                { label: 'Duplicar elemento (Ctrl+D)', action: handleDuplicateSelectedElement },
                { label: 'Excluir elemento', action: handleDeleteSelectedElement },
                { label: 'Localizar e substituir (Ctrl+H)', action: () => setShowFindReplaceModal(true) },
              ],
            },
            {
              id: 'view',
              label: 'Ver',
              items: [
                { label: 'Modo Normal', action: () => setViewMode('normal') },
                { label: 'Grade de slides (Organizador)', action: () => setViewMode((v) => (v === 'grid' ? 'normal' : 'grid')) },
                { label: showNotes ? 'Ocultar notas do apresentador' : 'Mostrar notas do apresentador', action: () => setShowNotes((v) => !v) },
                { label: showSnapGuides ? 'Desativar guias de alinhamento' : 'Ativar guias de alinhamento', action: () => setShowSnapGuides((v) => !v) },
                { label: 'Apresentar tela cheia', action: () => startPresentation(activeSlideIdx, false) },
              ],
            },
            {
              id: 'insert',
              label: 'Inserir',
              items: [
                { label: 'Caixa de texto', action: () => handleInsertElement('text') },
                { label: 'Imagem...', action: () => setShowImageModal(true) },
                { label: 'Forma retangular', action: () => handleInsertElement('rounded') },
                { label: 'Círculo', action: () => handleInsertElement('circle') },
                { label: 'Linha divisória', action: () => handleInsertElement('line') },
                { label: 'Novo slide', action: () => handleAddSlide('title_body') },
              ],
            },
            {
              id: 'slide',
              label: 'Slide',
              items: [
                { label: 'Novo slide', action: () => handleAddSlide('title_body') },
                { label: 'Duplicar slide', action: () => handleDuplicateSlide() },
                { label: activeSlide?.skipped ? 'Desfazer pular slide' : 'Pular slide', action: () => handleToggleSkipSlide() },
                { label: 'Excluir slide', action: () => handleDeleteSlide() },
                { label: 'Alterar plano de fundo', action: () => setRightPanel('background') },
                { label: 'Aplicar layout', action: () => setRightPanel('layouts') },
                { label: 'Transição', action: () => setRightPanel('transition') },
                { label: 'Alterar tema', action: () => setRightPanel('themes') },
              ],
            },
            {
              id: 'arrange',
              label: 'Organizar',
              items: [
                { label: 'Trazer para frente', action: () => handleLayerSelected('front') },
                { label: 'Enviar para trás', action: () => handleLayerSelected('back') },
                { label: 'Centralizar horizontalmente', action: () => handleAlignSelected('center') },
                { label: 'Centralizar verticalmente', action: () => handleAlignSelected('middle') },
                { label: 'Alinhar à esquerda', action: () => handleAlignSelected('left') },
                { label: 'Alinhar à direita', action: () => handleAlignSelected('right') },
              ],
            },
            {
              id: 'tools',
              label: 'Ferramentas',
              items: [
                { label: 'Estatísticas da apresentação', action: () => setShowStatsModal(true) },
                { label: 'Enviar nota para Google Tarefas', action: handleExportNotesToTasks },
                { label: 'Comentários', action: () => setRightPanel('comments') },
              ],
            },
          ].map((menu) => (
            <div key={menu.id} className="sm:relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                className={`${menuBtnCls} ${openMenu === menu.id ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : ''}`}
              >
                {menu.label}
              </button>
              {openMenu === menu.id && (
                <div
                  className={`absolute top-full left-1 mt-0.5 sm:top-7 sm:left-0 sm:mt-0 w-64 max-w-[calc(100vw-24px)] rounded-lg border shadow-xl py-1.5 z-50 ${
                    isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-200'
                  }`}
                >
                  {menu.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        item.action();
                        setOpenMenu(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${subtleHover}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FORMATTING & INSERTION TOOLBAR (Wrapper is relative so popovers sit OUTSIDE overflow-x-auto!) */}
      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <div
          className={`h-11 px-3 flex items-center gap-1 border-b overflow-x-auto whitespace-nowrap ${
            isDarkMode ? 'bg-[#232528] border-white/10' : 'bg-[#EDF2FA] border-gray-200'
          }`}
        >
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => handleAddSlide('title_body')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 ${subtleHover}`}
              title="Novo slide"
            >
              <Plus size={15} />
              Novo slide
            </button>
            <button
              type="button"
              aria-label="Escolher layout do novo slide"
              onClick={() => {
                setShowShapesDropdown(false);
                setShowLayoutDropdown((v) => !v);
              }}
              className={`p-1.5 rounded ${showLayoutDropdown ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover}`}
            >
              <ChevronDown size={13} />
            </button>
          </div>

          <div className="w-px h-5 bg-current opacity-15 mx-1 shrink-0" />

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Desfazer"
            className={`p-1.5 rounded disabled:opacity-30 shrink-0 ${subtleHover}`}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Refazer"
            className={`p-1.5 rounded disabled:opacity-30 shrink-0 ${subtleHover}`}
          >
            <Redo2 size={15} />
          </button>

          <select
            aria-label="Zoom do palco"
            value={String(zoomMode)}
            onChange={(e) => {
              const v = e.target.value;
              setZoomMode(v === 'fit' ? 'fit' : Number(v));
            }}
            className="bg-transparent text-xs font-mono tabular-nums px-1.5 py-1 rounded outline-none cursor-pointer shrink-0"
          >
            <option value="fit" className={isDarkMode ? 'bg-[#282A2D]' : 'bg-white'}>
              Ajustar ({Math.round(fitScale * 100)}%)
            </option>
            {[50, 75, 100, 125].map((z) => (
              <option key={z} value={String(z)} className={isDarkMode ? 'bg-[#282A2D]' : 'bg-white'}>
                {z}%
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-current opacity-15 mx-1 shrink-0" />

          <button
            type="button"
            onClick={() => handleInsertElement('text')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${subtleHover}`}
            title="Inserir caixa de texto"
          >
            <Type size={15} />
            Texto
          </button>
          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${subtleHover}`}
            title="Inserir imagem"
          >
            <ImageIcon size={15} />
            Imagem
          </button>

          <button
            type="button"
            onClick={() => {
              setShowLayoutDropdown(false);
              setShowShapesDropdown((v) => !v);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${
              showShapesDropdown ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
            }`}
            title="Inserir forma"
          >
            <Square size={15} />
            Forma
          </button>

          <button
            type="button"
            onClick={() => handleInsertElement('line')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${subtleHover}`}
            title="Inserir linha"
          >
            <Minus size={15} />
            Linha
          </button>

          <div className="w-px h-5 bg-current opacity-15 mx-1 shrink-0" />

          {selectedElement ? (
            <>
              <select
                aria-label="Família da fonte"
                value={selectedElement.style.fontFamily || FONT_FAMILIES[0].value}
                onChange={(e) => updateSelectedElement({ style: { fontFamily: e.target.value } })}
                className="bg-transparent text-xs px-1.5 py-1 rounded outline-none max-w-[130px] shrink-0"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value} className={isDarkMode ? 'bg-[#282A2D]' : 'bg-white'}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Tamanho da fonte"
                value={selectedElement.style.fontSize || 18}
                onChange={(e) => updateSelectedElement({ style: { fontSize: Number(e.target.value) } })}
                className="bg-transparent text-xs font-mono tabular-nums px-1 py-1 rounded outline-none shrink-0"
              >
                {[12, 14, 16, 18, 22, 28, 36, 44, 60, 84].map((sz) => (
                  <option key={sz} value={sz} className={isDarkMode ? 'bg-[#282A2D]' : 'bg-white'}>
                    {sz}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  updateSelectedElement({
                    style: { fontWeight: selectedElement.style.fontWeight === 'bold' ? 'normal' : 'bold' },
                  })
                }
                aria-label="Negrito"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.fontWeight === 'bold' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : subtleHover
                }`}
              >
                <Bold size={14} />
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedElement({
                    style: { fontStyle: selectedElement.style.fontStyle === 'italic' ? 'normal' : 'italic' },
                  })
                }
                aria-label="Itálico"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.fontStyle === 'italic' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : subtleHover
                }`}
              >
                <Italic size={14} />
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedElement({
                    style: {
                      textDecoration: selectedElement.style.textDecoration === 'underline' ? 'none' : 'underline',
                    },
                  })
                }
                aria-label="Sublinhado"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.textDecoration === 'underline'
                    ? 'bg-[#1A73E8]/20 text-[#1A73E8]'
                    : subtleHover
                }`}
              >
                <Underline size={14} />
              </button>

              <button
                type="button"
                onClick={() =>
                  updateSelectedElement({
                    style: {
                      textDecoration:
                        selectedElement.style.textDecoration === 'line-through' ? 'none' : 'line-through',
                    },
                  })
                }
                aria-label="Tachado"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.textDecoration === 'line-through'
                    ? 'bg-[#1A73E8]/20 text-[#1A73E8]'
                    : subtleHover
                }`}
              >
                <Strikethrough size={14} />
              </button>

              <label
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs cursor-pointer shrink-0 ${subtleHover}`}
                title="Cor do texto"
              >
                <span
                  className="font-bold text-xs px-0.5 border-b-2 leading-none"
                  style={{ borderColor: selectedElement.style.color || '#0F172A' }}
                >
                  A
                </span>
                <input
                  type="color"
                  aria-label="Cor do texto"
                  value={
                    selectedElement.style.color && /^#[0-9a-f]{6}$/i.test(selectedElement.style.color)
                      ? selectedElement.style.color
                      : '#0F172A'
                  }
                  onChange={(e) => updateSelectedElement({ style: { color: e.target.value } })}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                onClick={() => updateSelectedElement({ style: { textAlign: 'left' } })}
                aria-label="Alinhar à esquerda"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.textAlign === 'left' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : subtleHover
                }`}
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => updateSelectedElement({ style: { textAlign: 'center' } })}
                aria-label="Centralizar texto"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.textAlign === 'center' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : subtleHover
                }`}
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                onClick={() => updateSelectedElement({ style: { textAlign: 'right' } })}
                aria-label="Alinhar à direita"
                className={`p-1.5 rounded shrink-0 ${
                  selectedElement.style.textAlign === 'right' ? 'bg-[#1A73E8]/20 text-[#1A73E8]' : subtleHover
                }`}
              >
                <AlignRight size={14} />
              </button>

              <div className="flex items-center gap-1 px-1 shrink-0" title="Cor do preenchimento">
                {QUICK_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Preenchimento ${c}`}
                    onClick={() => updateSelectedElement({ style: { backgroundColor: c } })}
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{
                      background:
                        c === 'transparent'
                          ? 'repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 4px)'
                          : c,
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleLayerSelected('front')}
                className={`px-2 py-1 rounded text-xs shrink-0 ${subtleHover}`}
                title="Trazer para frente"
              >
                Frente
              </button>
              <button
                type="button"
                onClick={() => handleLayerSelected('back')}
                className={`px-2 py-1 rounded text-xs shrink-0 ${subtleHover}`}
                title="Enviar para trás"
              >
                Trás
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelectedElement}
                aria-label="Duplicar elemento"
                className={`p-1.5 rounded shrink-0 ${subtleHover}`}
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedElement}
                aria-label="Remover elemento"
                className="p-1.5 rounded text-red-500 hover:bg-red-500/10 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRightPanel(rightPanel === 'background' ? 'none' : 'background')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                  rightPanel === 'background' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
                }`}
              >
                <Palette size={14} /> Plano de fundo
              </button>
              <button
                type="button"
                onClick={() => setRightPanel(rightPanel === 'layouts' ? 'none' : 'layouts')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                  rightPanel === 'layouts' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
                }`}
              >
                <LayoutTemplate size={14} /> Layout
              </button>
              <button
                type="button"
                onClick={() => setRightPanel(rightPanel === 'themes' ? 'none' : 'themes')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                  rightPanel === 'themes' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
                }`}
              >
                <Wand2 size={14} /> Tema
              </button>
              <button
                type="button"
                onClick={() => setRightPanel(rightPanel === 'transition' ? 'none' : 'transition')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                  rightPanel === 'transition' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
                }`}
              >
                <Sparkles size={14} /> Transição
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setViewMode((v) => (v === 'grid' ? 'normal' : 'grid'))}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
              viewMode === 'grid' ? 'bg-[#1A73E8]/15 text-[#1A73E8]' : subtleHover
            }`}
          >
            <Grid size={14} /> Grade de slides
          </button>
        </div>

        {/* Floating Unclipped Popover: New Slide Layout Picker */}
        {showLayoutDropdown && (
          <div
            className={`absolute left-3 top-11 w-64 max-w-[calc(100vw-24px)] rounded-xl border shadow-2xl py-1.5 z-50 ${
              isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-200'
            }`}
          >
            {SLIDE_LAYOUT_META.map((lay) => (
              <button
                key={lay.id}
                type="button"
                onClick={() => handleAddSlide(lay.id)}
                className={`w-full text-left px-3 py-2 text-xs ${subtleHover}`}
              >
                <div className="font-medium">{lay.label}</div>
                <div className="text-[11px] opacity-60">{lay.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Floating Unclipped Popover: Shapes Picker */}
        {showShapesDropdown && (
          <div
            className={`absolute left-4 sm:left-72 top-11 w-48 max-w-[calc(100vw-24px)] rounded-xl border shadow-2xl py-1.5 z-50 ${
              isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-200'
            }`}
          >
            <button
              type="button"
              onClick={() => handleInsertElement('rectangle')}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${subtleHover}`}
            >
              <Square size={14} /> Retângulo
            </button>
            <button
              type="button"
              onClick={() => handleInsertElement('rounded')}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${subtleHover}`}
            >
              <Square size={14} className="rounded" /> Retângulo arredondado
            </button>
            <button
              type="button"
              onClick={() => handleInsertElement('circle')}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${subtleHover}`}
            >
              <Circle size={14} /> Círculo / Elipse
            </button>
            <button
              type="button"
              onClick={() => handleInsertElement('callout')}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${subtleHover}`}
            >
              <MessageSquare size={14} /> Destaque
            </button>
          </div>
        )}
      </div>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden relative">
        {viewMode === 'grid' ? (
          /* SLIDE SORTER / GRID VIEW */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold">Organizador de Slides ({slides.length})</h2>
                  <p className="text-xs opacity-60">Clique para editar, reordene, pule ou duplique slides em lote</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('normal')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
                >
                  Voltar ao Editor
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {slides.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-2.5 transition-all ${
                      s.skipped ? 'opacity-65' : ''
                    } ${
                      idx === activeSlideIdx
                        ? 'border-[#1A73E8] ring-2 ring-[#1A73E8]/30'
                        : isDarkMode
                          ? 'border-white/10 bg-white/[0.03]'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`Abrir Slide ${idx + 1} no editor`}
                      className="w-full aspect-video rounded-lg overflow-hidden relative cursor-pointer border border-black/10 block text-left"
                      onClick={() => {
                        setActiveSlideIdx(idx);
                        setViewMode('normal');
                      }}
                    >
                      <SlideThumbnailView slide={s} />
                      {s.skipped && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium flex items-center gap-1">
                          <EyeOff size={10} /> Pulado
                        </span>
                      )}
                    </button>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-mono tabular-nums font-medium opacity-70">Slide {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSkipSlide(idx)}
                          aria-label={
                            s.skipped
                              ? `Incluir slide ${idx + 1} na apresentação`
                              : `Pular slide ${idx + 1}`
                          }
                          title={s.skipped ? 'Incluir na apresentação' : 'Pular slide'}
                          className={`p-1 rounded hover:bg-black/10 ${s.skipped ? 'text-amber-500' : ''}`}
                        >
                          {s.skipped ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, idx - 1)}
                          disabled={idx === 0}
                          aria-label={`Mover slide ${idx + 1} antes`}
                          className="p-1 rounded hover:bg-black/10 disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, idx + 1)}
                          disabled={idx === slides.length - 1}
                          aria-label={`Mover slide ${idx + 1} depois`}
                          className="p-1 rounded hover:bg-black/10 disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSlide(idx)}
                          aria-label={`Duplicar slide ${idx + 1}`}
                          className="p-1 rounded hover:bg-black/10"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(idx)}
                          aria-label={`Excluir slide ${idx + 1}`}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* FILMSTRIP (Horizontal bar on Mobile, Vertical left strip on Tablet/Desktop) */}
            <aside
              aria-label="Miniaturas dos slides"
              className={`w-full h-24 border-t flex flex-row items-center overflow-x-auto overflow-y-hidden px-2.5 py-1.5 gap-2.5 md:w-44 lg:w-52 md:h-auto md:border-t-0 md:border-r md:flex-col md:items-stretch md:overflow-y-auto md:overflow-x-hidden md:p-3 md:gap-3 shrink-0 ${
                isDarkMode ? 'bg-[#1D1E20] border-white/10' : 'bg-[#F1F3F4] border-gray-200'
              }`}
            >
              {slides.map((s, idx) => {
                const isActive = idx === activeSlideIdx;
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDragSlideIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragSlideIdx !== null) handleMoveSlide(dragSlideIdx, idx);
                      setDragSlideIdx(null);
                    }}
                    className={`group flex items-start gap-1.5 shrink-0 w-32 md:w-auto ${
                      s.skipped ? 'opacity-60' : ''
                    }`}
                  >
                    <span
                      className={`text-[11px] font-mono tabular-nums w-4 pt-1 text-right shrink-0 ${
                        isActive ? 'text-[#1A73E8] font-bold' : 'opacity-50'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        aria-label={`Selecionar Slide ${idx + 1}`}
                        onClick={() => {
                          setActiveSlideIdx(idx);
                          setSelectedElementId(null);
                          setEditingElementId(null);
                        }}
                        className={`w-full aspect-video rounded-lg overflow-hidden relative border-2 transition-all block text-left ${
                          isActive
                            ? 'border-[#1A73E8] shadow-md'
                            : isDarkMode
                              ? 'border-white/10 hover:border-white/30'
                              : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <SlideThumbnailView slide={s} />
                        {s.skipped && (
                          <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-black/75 text-white text-[9px] font-medium flex items-center gap-0.5">
                            <EyeOff size={9} /> Pulado
                          </span>
                        )}
                      </button>

                      <div
                        className={`hidden md:flex items-center justify-end gap-0.5 mt-1 transition-opacity ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSkipSlide(idx)}
                          aria-label={
                            s.skipped
                              ? `Incluir slide ${idx + 1} na apresentação`
                              : `Pular slide ${idx + 1}`
                          }
                          title={s.skipped ? 'Incluir slide na apresentação' : 'Pular slide'}
                          className={`p-1 rounded hover:bg-black/10 ${s.skipped ? 'text-amber-500' : ''}`}
                        >
                          {s.skipped ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, idx - 1)}
                          disabled={idx === 0}
                          aria-label={`Mover slide ${idx + 1} para cima`}
                          className="p-1 rounded hover:bg-black/10 disabled:opacity-20"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, idx + 1)}
                          disabled={idx === slides.length - 1}
                          aria-label={`Mover slide ${idx + 1} para baixo`}
                          className="p-1 rounded hover:bg-black/10 disabled:opacity-20"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSlide(idx)}
                          aria-label={`Duplicar slide ${idx + 1}`}
                          className="p-1 rounded hover:bg-black/10"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(idx)}
                          aria-label={`Excluir slide ${idx + 1}`}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => handleAddSlide('title_body')}
                className={`shrink-0 h-16 px-3 md:h-auto md:w-full md:py-2.5 rounded-lg border-2 border-dashed text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  isDarkMode
                    ? 'border-white/15 text-white/70 hover:border-[#1A73E8] hover:text-white'
                    : 'border-gray-300 text-gray-600 hover:border-[#1A73E8] hover:text-[#1A73E8]'
                }`}
              >
                <Plus size={14} /> Novo slide
              </button>
            </aside>

            {/* CENTER STAGE + SPEAKER NOTES */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              <div
                ref={stageAreaRef}
                onClick={() => {
                  setSelectedElementId(null);
                  setEditingElementId(null);
                }}
                className={`flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6 ${
                  isDarkMode ? 'bg-[#121315]' : 'bg-[#E8EAED]'
                }`}
              >
                <div
                  style={{
                    width: SLIDE_CANVAS_WIDTH * scaleFactor,
                    height: SLIDE_CANVAS_HEIGHT * scaleFactor,
                  }}
                  className="relative shrink-0"
                >
                  <div
                    data-testid="slides-canvas"
                    className="relative rounded-md shadow-2xl overflow-hidden origin-top-left"
                    style={{
                      width: SLIDE_CANVAS_WIDTH,
                      height: SLIDE_CANVAS_HEIGHT,
                      transform: `scale(${scaleFactor})`,
                      background: activeSlide.background,
                    }}
                  >
                    {/* Center Alignment Snap Guides */}
                    {centerGuides.x && (
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-rose-500/80 z-40 pointer-events-none" />
                    )}
                    {centerGuides.y && (
                      <div className="absolute left-0 right-0 top-1/2 h-px bg-rose-500/80 z-40 pointer-events-none" />
                    )}

                    {activeSlide.elements.map(renderElementOnCanvas)}
                  </div>
                </div>
              </div>

              {/* BOTTOM SPEAKER NOTES */}
              {showNotes && (
                <div
                  className={`h-24 sm:h-28 border-t px-3 sm:px-4 py-2 flex flex-col shrink-0 ${
                    isDarkMode ? 'bg-[#1E2023] border-white/10' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold opacity-60 flex items-center gap-1.5 truncate">
                      <StickyNote size={12} className="shrink-0" /> Notas do apresentador · Slide {activeSlideIdx + 1} de {slides.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleExportNotesToTasks}
                      className="text-[11px] font-medium text-[#1A73E8] hover:underline flex items-center gap-1 shrink-0"
                    >
                      <CheckSquare size={12} /> <span className="hidden sm:inline">Enviar nota para Tarefas</span><span className="sm:hidden">Tarefas</span>
                    </button>
                  </div>
                  <textarea
                    aria-label="Notas do apresentador"
                    placeholder="Clique para adicionar anotações do apresentador..."
                    value={activeSlide.notes}
                    onChange={(e) => handleUpdateSpeakerNotes(e.target.value)}
                    className="flex-1 w-full bg-transparent text-xs outline-none resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* RIGHT CONTEXTUAL SIDEBAR (Overlay drawer on < lg, docked on lg+) */}
        {rightPanel !== 'none' && (
          <aside
            className={`absolute inset-y-0 right-0 z-40 w-[min(300px,calc(100vw-24px))] shadow-2xl lg:static lg:w-72 lg:shadow-none border-l flex flex-col shrink-0 ${surfaceBg}`}
          >
            <div className="h-12 px-4 flex items-center justify-between border-b border-inherit shrink-0">
              <span className="text-sm font-semibold">
                {rightPanel === 'themes'
                  ? 'Temas'
                  : rightPanel === 'layouts'
                    ? 'Layouts de slide'
                    : rightPanel === 'background'
                      ? 'Plano de fundo'
                      : rightPanel === 'transition'
                        ? 'Movimento e transição'
                        : rightPanel === 'comments'
                          ? 'Comentários'
                          : 'Histórico de versões'}
              </span>
              <button
                type="button"
                aria-label="Fechar painel lateral"
                onClick={() => setRightPanel('none')}
                className={`p-1.5 rounded-full ${subtleHover}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {rightPanel === 'themes' &&
                SLIDE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleApplyTheme(theme.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                      bundle.themeId === theme.id
                        ? 'border-[#1A73E8] ring-2 ring-[#1A73E8]/20'
                        : isDarkMode
                          ? 'border-white/10 hover:border-white/25'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="h-16 rounded-lg mb-2 flex items-center justify-center text-sm font-bold border border-black/10"
                      style={{ background: theme.background, color: theme.titleColor, fontFamily: theme.fontFamily }}
                    >
                      Aa Título
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>{theme.name}</span>
                      {bundle.themeId === theme.id && <Check size={14} className="text-[#1A73E8]" />}
                    </div>
                  </button>
                ))}

              {rightPanel === 'layouts' &&
                SLIDE_LAYOUT_META.map((lay) => (
                  <button
                    key={lay.id}
                    type="button"
                    onClick={() => handleApplyLayout(lay.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      activeSlide.layout === lay.id
                        ? 'border-[#1A73E8] bg-[#1A73E8]/5'
                        : isDarkMode
                          ? 'border-white/10 hover:bg-white/5'
                          : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs font-semibold">{lay.label}</div>
                    <div className="text-[11px] opacity-60 mt-0.5">{lay.desc}</div>
                  </button>
                ))}

              {rightPanel === 'background' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    {SLIDE_BG_PRESETS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => handleUpdateSlideBackground(bg, false)}
                        className={`h-14 rounded-lg border-2 transition-all ${
                          activeSlide.background === bg ? 'border-[#1A73E8]' : 'border-black/15'
                        }`}
                        style={{ background: bg }}
                        aria-label={`Aplicar plano de fundo ${bg}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdateSlideBackground(activeSlide.background, true)}
                    className="w-full py-2 rounded-lg border border-[#1A73E8] text-[#1A73E8] text-xs font-medium hover:bg-[#1A73E8]/10"
                  >
                    Aplicar a todos os slides
                  </button>
                </div>
              )}

              {rightPanel === 'transition' && (
                <div className="space-y-4">
                  <label className="block text-xs font-medium opacity-75">Transição do slide atual</label>
                  <select
                    aria-label="Transição do slide atual"
                    value={activeSlide.transition}
                    onChange={(e) => handleUpdateSlideTransition(e.target.value as SlideTransitionType, false)}
                    className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${
                      isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="none">Sem transição</option>
                    <option value="fade">Dissolver (Fade)</option>
                    <option value="slide">Deslizar da direita</option>
                    <option value="zoom">Zoom suave</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleUpdateSlideTransition(activeSlide.transition, true)}
                    className="w-full py-2 rounded-lg border border-[#1A73E8] text-[#1A73E8] text-xs font-medium hover:bg-[#1A73E8]/10"
                  >
                    Aplicar a todos os slides
                  </button>
                </div>
              )}

              {rightPanel === 'comments' && (() => {
                const openCount = filterSlideComments(bundle.comments, 'open').length;
                const resolvedCount = filterSlideComments(bundle.comments, 'resolved').length;
                const visibleComments = filterSlideComments(bundle.comments, commentFilter);
                const currentUserName = data?.user?.name || 'Você';

                return (
                  <div className="space-y-3">
                    <div className="flex rounded-lg border border-inherit p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setCommentFilter('open')}
                        className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                          commentFilter === 'open'
                            ? 'bg-[#1A73E8] text-white'
                            : subtleHover
                        }`}
                      >
                        Abertos ({openCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentFilter('resolved')}
                        className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                          commentFilter === 'resolved'
                            ? 'bg-[#1A73E8] text-white'
                            : subtleHover
                        }`}
                      >
                        Resolvidos ({resolvedCount})
                      </button>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        aria-label="Novo comentário"
                        placeholder={`Adicionar comentário no Slide ${activeSlideIdx + 1}...`}
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        rows={3}
                        className={`w-full rounded-lg border p-2.5 text-xs outline-none resize-none ${
                          isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-200'
                        }`}
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddComment}
                          className="px-4 py-1.5 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
                        >
                          Comentar
                        </button>
                      </div>
                    </div>

                    {visibleComments.length === 0 ? (
                      <div className="text-center py-6 text-xs opacity-60">
                        {commentFilter === 'open'
                          ? 'Nenhum comentário aberto.'
                          : 'Nenhum comentário resolvido.'}
                      </div>
                    ) : (
                      visibleComments.map((c) => {
                        const slideNumber = slides.findIndex((sl) => sl.id === c.slideId) + 1;
                        const replyDraft = replyDrafts[c.id] || '';
                        return (
                          <div
                            key={c.id}
                            className={`rounded-xl border p-3 text-xs space-y-2 ${
                              isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{c.author}</div>
                                <div className="text-[10px] opacity-60">{c.createdAt}</div>
                              </div>
                              {slideNumber > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSlideIdx(slideNumber - 1);
                                    setViewMode('normal');
                                  }}
                                  className="px-2 py-0.5 rounded bg-[#1A73E8]/10 text-[#1A73E8] text-[10px] font-medium shrink-0 hover:bg-[#1A73E8]/20"
                                >
                                  Slide {slideNumber}
                                </button>
                              )}
                            </div>

                            <p className="leading-relaxed">{c.text}</p>

                            {c.replies && c.replies.length > 0 && (
                              <div className="pl-2.5 border-l-2 border-[#1A73E8]/30 space-y-1.5">
                                {c.replies.map((rep) => (
                                  <div key={rep.id} className="text-[11px]">
                                    <span className="font-semibold">{rep.author}</span>{' '}
                                    <span className="opacity-50 text-[10px]">{rep.createdAt}</span>
                                    <p className="opacity-90 mt-0.5">{rep.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                aria-label={`Responder comentário de ${c.author}`}
                                placeholder="Responder..."
                                value={replyDraft}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && replyDraft.trim()) {
                                    e.preventDefault();
                                    setBundle((prev) => {
                                      const updated = {
                                        ...prev,
                                        comments: addSlideCommentReply(
                                          prev.comments,
                                          c.id,
                                          currentUserName,
                                          replyDraft,
                                          'Agora'
                                        ),
                                      };
                                      scheduleSave(updated);
                                      return updated;
                                    });
                                    setReplyDrafts((prev) => ({ ...prev, [c.id]: '' }));
                                  }
                                }}
                                className={`flex-1 min-w-0 rounded-md border px-2 py-1 text-[11px] outline-none ${
                                  isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-white border-gray-200'
                                }`}
                              />
                              <button
                                type="button"
                                aria-label="Enviar resposta"
                                disabled={!replyDraft.trim()}
                                onClick={() => {
                                  if (!replyDraft.trim()) return;
                                  setBundle((prev) => {
                                    const updated = {
                                      ...prev,
                                      comments: addSlideCommentReply(
                                        prev.comments,
                                        c.id,
                                        currentUserName,
                                        replyDraft,
                                        'Agora'
                                      ),
                                    };
                                    scheduleSave(updated);
                                    return updated;
                                  });
                                  setReplyDrafts((prev) => ({ ...prev, [c.id]: '' }));
                                }}
                                className="p-1.5 rounded-md bg-[#1A73E8] text-white disabled:opacity-40"
                              >
                                <Send size={11} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-inherit">
                              <button
                                type="button"
                                onClick={() =>
                                  setBundle((prev) => {
                                    const updated = {
                                      ...prev,
                                      comments: toggleResolveSlideComment(prev.comments, c.id),
                                    };
                                    scheduleSave(updated);
                                    return updated;
                                  })
                                }
                                className="text-[11px] font-medium text-[#1A73E8] hover:underline flex items-center gap-1"
                              >
                                {c.resolved ? (
                                  <>
                                    <RotateCcw size={11} /> Reabrir
                                  </>
                                ) : (
                                  <>
                                    <Check size={11} /> Resolver
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                aria-label={`Excluir comentário de ${c.author}`}
                                onClick={() =>
                                  setBundle((prev) => {
                                    const updated = {
                                      ...prev,
                                      comments: deleteSlideComment(prev.comments, c.id),
                                    };
                                    scheduleSave(updated);
                                    return updated;
                                  })
                                }
                                className="text-[11px] text-red-500 hover:underline"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}

              {rightPanel === 'versions' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <input
                      type="text"
                      aria-label="Nome da versão"
                      placeholder="Nome da versão (opcional)..."
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveVersion();
                      }}
                      className={`w-full rounded-lg border px-2.5 py-2 text-xs outline-none ${
                        isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleSaveVersion}
                      className="w-full py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
                    >
                      Salvar versão atual
                    </button>
                  </div>
                  {bundle.versions.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                        isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-[11px] opacity-60">
                        {v.author} · {v.createdAt} · {v.slides.length} slides
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(v.id)}
                        className="text-[11px] font-medium text-[#1A73E8] hover:underline"
                      >
                        Restaurar esta versão
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* MODALS */}
      {showOpenDriveModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-lg max-h-[90%] overflow-y-auto rounded-2xl border p-5 sm:p-6 shadow-2xl ${surfaceBg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FolderOpen size={18} className="text-amber-500" /> Abrir apresentação do Drive
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowOpenDriveModal(false)}
                className={`p-1.5 rounded-full ${subtleHover}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {driveDecks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setActiveDeckId(d.id);
                    setTitle(d.name);
                    setShowOpenDriveModal(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    d.id === activeDeckId ? 'border-[#1A73E8] bg-[#1A73E8]/10' : 'border-inherit'
                  } ${subtleHover}`}
                >
                  <span className="font-medium truncate">{d.name}</span>
                  <span className="opacity-60 shrink-0 ml-2">{d.date}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 ${surfaceBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Inserir imagem no slide</h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowImageModal(false)}
                className={`p-1.5 rounded-full ${subtleHover}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium opacity-75">URL da imagem</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-xs outline-none ${
                    isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleInsertImageFromUrl}
                  className="px-3.5 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium shrink-0"
                >
                  Inserir
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium opacity-75 block mb-1.5">Enviar do dispositivo</label>
              <input type="file" accept="image/*" onChange={handleUploadImageFile} className="text-xs w-full" />
            </div>
          </div>
        </div>
      )}

      {showFindReplaceModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-3 ${surfaceBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Search size={16} /> Localizar e substituir em todos os slides
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowFindReplaceModal(false)}
                className={`p-1.5 rounded-full ${subtleHover}`}
              >
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Localizar texto..."
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${
                isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
              }`}
            />
            <input
              type="text"
              placeholder="Substituir por..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${
                isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
              }`}
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
              Diferenciar maiúsculas e minúsculas
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFindReplaceModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs ${subtleHover}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRunFindReplace}
                className="px-4 py-1.5 rounded-lg bg-[#1A73E8] text-white text-xs font-medium"
              >
                Substituir tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-sm max-h-[90%] overflow-y-auto rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 ${surfaceBg}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <BarChart2 size={16} /> Estatísticas da Apresentação
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowStatsModal(false)}
                className={`p-1.5 rounded-full ${subtleHover}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between py-1.5 border-b border-inherit">
                <span className="font-sans opacity-70">Total de slides</span>
                <span className="font-bold">{deckStats.slideCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-inherit">
                <span className="font-sans opacity-70">Elementos visuais & blocos</span>
                <span className="font-bold">{deckStats.elementCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-inherit">
                <span className="font-sans opacity-70">Palavras (slides + notas)</span>
                <span className="font-bold">{deckStats.wordCount}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-sans opacity-70">Tempo estimado de fala</span>
                <span className="font-bold">{deckStats.estimatedMinutes} min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl border p-5 sm:p-6 shadow-2xl space-y-4 ${surfaceBg}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold truncate">Compartilhar "{title}"</h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setShowShareModal(false)}
                className={`p-1.5 rounded-full shrink-0 ${subtleHover}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="email"
                aria-label="E-mail da pessoa para compartilhar"
                placeholder="Adicionar pessoa por e-mail..."
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSharePermission();
                }}
                className={`flex-1 min-w-[160px] rounded-lg border px-3 py-2 text-xs outline-none ${
                  isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
                }`}
              />
              <select
                aria-label="Função do convidado"
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'editor' | 'viewer')}
                className={`rounded-lg border px-2 py-2 text-xs outline-none ${
                  isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
                }`}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Leitor</option>
              </select>
              <button
                type="button"
                onClick={handleAddSharePermission}
                className="px-3.5 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium shrink-0"
              >
                Enviar
              </button>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto">
              <div className="text-xs font-semibold opacity-70">Pessoas com acesso</div>
              {permissions.length === 0 ? (
                <div className="flex items-center justify-between gap-2 text-xs py-1">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {data?.user?.name || 'Você'} (você)
                    </div>
                    <div className="text-[11px] opacity-60 truncate">
                      {data?.user?.email || 'Conta local'}
                    </div>
                  </div>
                  <span className="text-[11px] opacity-70 shrink-0">Proprietário</span>
                </div>
              ) : (
                permissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs py-1">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[11px] opacity-60 truncate">{p.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] opacity-70 capitalize">
                        {p.role === 'owner' ? 'Proprietário' : p.role === 'editor' ? 'Editor' : 'Leitor'}
                      </span>
                      {p.role !== 'owner' && (
                        <button
                          type="button"
                          aria-label={`Remover acesso de ${p.email}`}
                          onClick={() => handleRemoveSharePermission(p.email)}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-inherit space-y-2.5">
              <div className="text-xs font-semibold opacity-70">Acesso geral</div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    generalAccess === 'anyone_with_link'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : isDarkMode
                        ? 'bg-white/10 text-white/70'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {generalAccess === 'anyone_with_link' ? <Globe size={16} /> : <Lock size={16} />}
                </div>
                <select
                  aria-label="Acesso geral"
                  value={generalAccess}
                  onChange={async (e) => {
                    const nextVal = e.target.value as 'restricted' | 'anyone_with_link';
                    setGeneralAccess(nextVal);
                    await bridge.updateDriveItemMeta(activeDeckId, {
                      generalAccess: nextVal,
                      generalRole,
                    });
                    toast(
                      nextVal === 'anyone_with_link'
                        ? 'Qualquer pessoa com o link pode acessar'
                        : 'Acesso restrito a convidados'
                    );
                  }}
                  className={`flex-1 min-w-[160px] rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                    isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <option value="restricted">Restrito</option>
                  <option value="anyone_with_link">Qualquer pessoa com o link</option>
                </select>
                {generalAccess === 'anyone_with_link' && (
                  <select
                    aria-label="Permissão do link"
                    value={generalRole}
                    onChange={async (e) => {
                      const nextRole = e.target.value as 'viewer' | 'commenter' | 'editor';
                      setGeneralRole(nextRole);
                      await bridge.updateDriveItemMeta(activeDeckId, {
                        generalAccess: 'anyone_with_link',
                        generalRole: nextRole,
                      });
                      toast('Permissão do link atualizada');
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                      isDarkMode ? 'bg-[#282A2D] border-white/15' : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <option value="viewer">Leitor</option>
                    <option value="commenter">Comentador</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-inherit">
              <button
                type="button"
                onClick={async () => {
                  const link = await bridge.getDriveShareLink(activeDeckId);
                  navigator.clipboard?.writeText(link).catch(() => {});
                  toast('Link da apresentação copiado');
                }}
                className="px-3.5 py-1.5 rounded-full border border-[#1A73E8] text-[#1A73E8] text-xs font-medium hover:bg-[#1A73E8]/10"
              >
                Copiar link
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-5 py-1.5 rounded-full bg-[#1A73E8] text-white text-xs font-medium hover:bg-[#1557B0]"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
