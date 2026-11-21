import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X, Star, CloudCheck, History, MessageSquare, Share2, Download,
  Undo2, Redo2, Printer, PaintBucket, Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, Plus, Trash2, Filter,
  BarChart3, LineChart, PieChart, Table2, Sparkles, CheckSquare, ChevronDown,
  Copy, FileSpreadsheet, ArrowUpDown, Layers, Lock, Unlock,
  Check, Calendar, FileText, Sigma, Columns, Combine, SplitSquareVertical,
  User, Link2, ExternalLink, WrapText, Grid, EyeOff, Eye, ArrowLeftRight, Globe, Send, RotateCcw
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, DriveItem, Permission } from '../../utils/GASBridge';
import { encodeBase64Utf8, escapeHtml } from '../../utils/sanitize';
import {
  NumberFormatType,
  CellStyle,
  CellSmartChip,
  SheetCell,
  ConditionalFormatRule,
  SheetChartConfig,
  NamedRange,
  SheetTab,
  SheetComment,
  SpreadsheetDocument,
  colIndexToLetter,
  coordToCellId,
  cellIdToCoord,
  expandRange,
  evaluateCell,
  computeSelectionStats,
  sortSheetRows,
  removeDuplicateRows,
  evaluateConditionalFormatting,
  exportCellsToDelimited,
  parseCsvToCells,
  computePivotTable,
  parseNumericValue,
  insertRowInCells,
  deleteRowInCells,
  insertColInCells,
  deleteColInCells,
  mergeCellsInSelection,
  unmergeCellsInSelection,
  autoFillRange,
  splitTextToColumns,
  transposeRangeInCells,
  extractChartDataPoints,
  filterSheetComments,
  toggleResolveSheetComment,
  addSheetCommentReply,
  deleteSheetComment,
} from '../../utils/sheetsLogic';
import type { AppOpenPayload, CalendarEvent, DashboardData, TaskItem } from '../../utils/GASBridge';

interface SheetsAppProps {
  onClose: () => void;
  data?: DashboardData;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  showToast?: (msg: string) => void;
  isDarkMode?: boolean;
}

const TOTAL_ROWS = 40;
const TOTAL_COLS = 14; // A..N

const FORMULA_CATALOG = [
  { name: 'SOMA', syntax: 'SOMA(A1:A10)', desc: 'Soma todos os valores numéricos de um intervalo.' },
  { name: 'MÉDIA', syntax: 'MÉDIA(B2:B12)', desc: 'Calcula a média aritmética do intervalo.' },
  { name: 'MED', syntax: 'MED(B2:B12)', desc: 'Retorna a mediana estatística do intervalo.' },
  { name: 'DESVPAD', syntax: 'DESVPAD(B2:B12)', desc: 'Calcula o desvio padrão amostral de um conjunto.' },
  { name: 'SE', syntax: 'SE(B2>1000; "Meta Batida"; "Atenção")', desc: 'Retorna um valor se verdadeiro e outro se falso.' },
  { name: 'SEERRO', syntax: 'SEERRO(A2/B2; 0)', desc: 'Retorna um valor alternativo caso a fórmula gere erro.' },
  { name: 'PROCV', syntax: 'PROCV("Orgânico"; A2:D10; 3)', desc: 'Pesquisa verticalmente na primeira coluna do intervalo.' },
  { name: 'PROCX', syntax: 'PROCX("Busca"; A2:A6; E2:E6)', desc: 'Pesquisa moderna em qualquer direção e retorna valor correspondente.' },
  { name: 'ÍNDICE', syntax: 'ÍNDICE(A2:E6; 2; 5)', desc: 'Retorna o conteúdo de uma célula por linha e coluna.' },
  { name: 'CORRESP', syntax: 'CORRESP("Google Ads Search"; A2:A6)', desc: 'Retorna a posição relativa de um item no intervalo.' },
  { name: 'SOMASE', syntax: 'SOMASE(B2:B10; ">500"; C2:C10)', desc: 'Soma células que atendem a um critério específico.' },
  { name: 'SOMASES', syntax: 'SOMASES(E2:E6; B2:B6; ">15000"; D2:D6; ">=90")', desc: 'Soma células com múltiplos critérios simultâneos.' },
  { name: 'CONT.SE', syntax: 'CONT.SE(D2:D10; "Concluído")', desc: 'Conta células que correspondem ao critério.' },
  { name: 'CONT.SES', syntax: 'CONT.SES(B2:B6; ">10000"; G2:G6; "Acima da Meta")', desc: 'Conta linhas que satisfazem múltiplos critérios.' },
  { name: 'PGTO', syntax: 'PGTO(0.01; 12; 50000)', desc: 'Calcula o pagamento periódico de um financiamento/investimento.' },
  { name: 'VPL', syntax: 'VPL(0.08; B2:B6)', desc: 'Calcula o Valor Presente Líquido de um fluxo de caixa.' },
  { name: 'MÁXIMO', syntax: 'MÁXIMO(C2:C20)', desc: 'Retorna o maior valor numérico do intervalo.' },
  { name: 'MÍNIMO', syntax: 'MÍNIMO(C2:C20)', desc: 'Retorna o menor valor numérico do intervalo.' },
  { name: 'CONT.NÚM', syntax: 'CONT.NÚM(B2:B20)', desc: 'Conta quantas células contêm números.' },
  { name: 'SPARKLINE', syntax: 'SPARKLINE(B2:E2)', desc: 'Desenha um minigráfico de tendência dentro da célula.' },
  { name: 'ARRED', syntax: 'ARRED(A2; 2)', desc: 'Arredonda um número para casas decimais definidas.' },
  { name: 'CONCATENAR', syntax: 'CONCATENAR(A2; " - "; B2)', desc: 'Une textos de diferentes células.' },
  { name: 'E', syntax: 'E(B2>1000; E2>50000)', desc: 'Retorna VERDADEIRO se todas as condições forem verdadeiras.' },
  { name: 'OU', syntax: 'OU(B2>1000; E2>50000)', desc: 'Retorna VERDADEIRO se qualquer condição for verdadeira.' },
];

const TAB_COLORS = [
  { label: 'Padrão', hex: '' },
  { label: 'Verde Sheets', hex: '#0F9D58' },
  { label: 'Azul Google', hex: '#1A73E8' },
  { label: 'Roxo', hex: '#8E24AA' },
  { label: 'Amarelo', hex: '#F9AB00' },
  { label: 'Vermelho', hex: '#D93025' },
  { label: 'Turquesa', hex: '#00897B' },
];

function createBlankSpreadsheet(id: string, title = 'Planilha sem título'): SpreadsheetDocument {
  return {
    id,
    title,
    starred: false,
    updatedAt: new Date().toISOString(),
    sheets: [
      {
        id: `tab_${Date.now()}`,
        name: 'Página1',
        color: '#0F9D58',
        frozenRows: 0,
        frozenCols: 0,
        showGridlines: true,
        colWidths: {},
        cells: {},
        conditionalRules: [],
        charts: [],
      },
    ],
  };
}

export default function SheetsApp({
  onClose,
  data,
  onOpenApp,
  onUpdateTasks,
  onUpdateEvents,
  showToast,
  isDarkMode = false,
}: SheetsAppProps) {
  const notify = useCallback(
    (msg: string) => {
      if (showToast) showToast(msg);
    },
    [showToast]
  );

  const selfName = data?.user?.name || 'Você';
  const selfEmail = data?.user?.email || '';
  const initialFileId = data?.id || 'sheet_local_new';
  const initialFileName = data?.name || 'Planilha sem título';

  const [doc, setDoc] = useState<SpreadsheetDocument>(() => {
    try {
      const saved = localStorage.getItem(`workspace_sheet_doc_v2_${initialFileId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return createBlankSpreadsheet(initialFileId, initialFileName);
  });

  const [activeSheetId, setActiveSheetId] = useState<string>(() => doc.sheets[0]?.id || 'tab_1');
  const [driveSheets, setDriveSheets] = useState<DriveItem[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  // Selection & Editing States
  const [selectedCoord, setSelectedCoord] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [selectionEnd, setSelectionEnd] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [isSelectingCells, setIsSelectingCells] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [formulaInput, setFormulaInput] = useState<string>('');
  const [nameBoxInput, setNameBoxInput] = useState<string>('A1');
  const [showFormulaAutocomplete, setShowFormulaAutocomplete] = useState(false);

  // Right-click Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);

  // Internal 2D Clipboard for Copy/Cut/Paste
  const clipboardRef = useRef<{
    rSpan: number;
    cSpan: number;
    cells: Record<string, SheetCell>;
    cut?: boolean;
    sourceIds?: string[];
  } | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<SheetTab[][]>([]);
  const [redoStack, setRedoStack] = useState<SheetTab[][]>([]);
  const [copiedCellStyle, setCopiedCellStyle] = useState<CellStyle | null>(null);

  // UI Menus & Modals
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [showFormulaBar, setShowFormulaBar] = useState<boolean>(true);
  const [showChartPanel, setShowChartPanel] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [showPivotModal, setShowPivotModal] = useState<boolean>(false);
  const [pivotCategoryCol, setPivotCategoryCol] = useState<number>(0);
  const [pivotValueCol, setPivotValueCol] = useState<number>(4);

  const [showConditionalModal, setShowConditionalModal] = useState<boolean>(false);
  const [newRuleRange, setNewRuleRange] = useState<string>('E2:E6');
  const [newRuleOperator, setNewRuleOperator] = useState<ConditionalFormatRule['operator']>('greater_than');
  const [newRuleValue, setNewRuleValue] = useState<string>('90000');
  const [newRuleColor, setNewRuleColor] = useState<{ fill: string; text: string }>({
    fill: '#DCFCE7',
    text: '#166534',
  });

  const [showFindReplaceModal, setShowFindReplaceModal] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');

  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState<boolean>(false);
  const [newVersionName, setNewVersionName] = useState<string>('');

  const [showCommentsDrawer, setShowCommentsDrawer] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentFilter, setCommentFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [sharePermissions, setSharePermissions] = useState<Permission[]>([]);
  const [shareEmail, setShareEmail] = useState<string>('');
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor');
  const [generalAccess, setGeneralAccess] = useState<'restricted' | 'anyone_with_link'>('restricted');
  const [generalAccessRole, setGeneralAccessRole] = useState<'viewer' | 'commenter' | 'editor'>('viewer');

  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);
  const [validationType, setValidationType] = useState<'checkbox' | 'dropdown'>('dropdown');
  const [validationOptionsInput, setValidationOptionsInput] = useState<string>(
    'Acima da Meta, Em andamento, Em risco'
  );

  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);
  const [cellNoteText, setCellNoteText] = useState<string>('');

  const [showNamedRangesModal, setShowNamedRangesModal] = useState<boolean>(false);
  const [newNamedRangeName, setNewNamedRangeName] = useState<string>('');
  const [newNamedRangeRef, setNewNamedRangeRef] = useState<string>('B2:E6');

  const [showSplitColumnsModal, setShowSplitColumnsModal] = useState<boolean>(false);
  const [splitDelimiter, setSplitDelimiter] = useState<string>(',');

  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [linkTextInput, setLinkTextInput] = useState<string>('');
  const [linkUrlInput, setLinkUrlInput] = useState<string>('https://');

  const [tabMenuId, setTabMenuId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTabValue, setRenamingTabValue] = useState<string>('');

  // Column Resize & Timer Refs
  const resizingColRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const activeSheet = useMemo(
    () => doc.sheets.find((s) => s.id === activeSheetId) || doc.sheets[0],
    [doc.sheets, activeSheetId]
  );

  const loadDriveSheets = useCallback(async () => {
    const items = await bridge.getAllDriveItems();
    setDriveSheets(items.filter((i) => i.type === 'sheet' && !i.trashed));
  }, []);

  useEffect(() => {
    void loadDriveSheets();
  }, [loadDriveSheets]);

  useEffect(() => {
    if (!data?.id || data.id === doc.id) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      const saved = localStorage.getItem(`workspace_sheet_doc_v2_${data.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          setDoc(parsed);
          setActiveSheetId(parsed.sheets[0].id);
          setUndoStack([]);
          setRedoStack([]);
          setEditingCellId(null);
          return;
        }
      }
    } catch {
      // ignore
    }
    const nextDoc = createBlankSpreadsheet(data.id, data.name || 'Planilha sem título');
    setDoc(nextDoc);
    setActiveSheetId(nextDoc.sheets[0].id);
    setUndoStack([]);
    setRedoStack([]);
    setEditingCellId(null);
  }, [data?.id, data?.name, doc.id]);

  useEffect(() => {
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const currentDoc = doc;
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`workspace_sheet_doc_v2_${currentDoc.id}`, JSON.stringify(currentDoc));
        void bridge.updateDriveItemMeta(currentDoc.id, {
          name: currentDoc.title,
          isStarred: Boolean(currentDoc.starred),
          date: 'Editado agora',
          modifiedIso: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
      setSaveState('saved');
    }, 320);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [doc]);

  const activeCellId = useMemo(
    () => coordToCellId(selectedCoord.r, selectedCoord.c),
    [selectedCoord]
  );

  const selectedRangeIds = useMemo(() => {
    const rMin = Math.min(selectedCoord.r, selectionEnd.r);
    const rMax = Math.max(selectedCoord.r, selectionEnd.r);
    const cMin = Math.min(selectedCoord.c, selectionEnd.c);
    const cMax = Math.max(selectedCoord.c, selectionEnd.c);
    const ids: string[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        ids.push(coordToCellId(r, c));
      }
    }
    return ids;
  }, [selectedCoord, selectionEnd]);

  const selectedRangeString = useMemo(() => {
    const startId = coordToCellId(
      Math.min(selectedCoord.r, selectionEnd.r),
      Math.min(selectedCoord.c, selectionEnd.c)
    );
    const endId = coordToCellId(
      Math.max(selectedCoord.r, selectionEnd.r),
      Math.max(selectedCoord.c, selectionEnd.c)
    );
    return startId === endId ? startId : `${startId}:${endId}`;
  }, [selectedCoord, selectionEnd]);

  useEffect(() => {
    const raw = activeSheet?.cells[activeCellId]?.raw ?? '';
    setFormulaInput(raw);
    setNameBoxInput(selectedRangeString);
  }, [activeCellId, selectedRangeString, activeSheet?.id]);

  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-24), JSON.parse(JSON.stringify(doc.sheets))]);
    setRedoStack([]);
  }, [doc.sheets]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(doc.sheets))]);
    setUndoStack((u) => u.slice(0, -1));
    setDoc((prev) => ({ ...prev, sheets: previous }));
    notify('Ação desfeita.');
  }, [undoStack, doc.sheets, notify]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, JSON.parse(JSON.stringify(doc.sheets))]);
    setRedoStack((r) => r.slice(0, -1));
    setDoc((prev) => ({ ...prev, sheets: next }));
    notify('Ação refeita.');
  }, [redoStack, doc.sheets, notify]);

  const updateActiveSheet = useCallback(
    (updater: (sheet: SheetTab) => SheetTab, recordUndo = true) => {
      if (activeSheet.protected) {
        notify('Esta guia está protegida. Desbloqueie a proteção em Dados > Proteger página.');
        return;
      }
      if (recordUndo) pushHistory();
      setDoc((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        sheets: prev.sheets.map((s) => (s.id === activeSheet.id ? updater(s) : s)),
      }));
    },
    [activeSheet.id, activeSheet.protected, pushHistory, notify]
  );

  const commitCellValue = useCallback(
    (cellId: string, rawVal: string) => {
      updateActiveSheet((sheet) => {
        const existing = sheet.cells[cellId] || { raw: '' };
        return {
          ...sheet,
          cells: {
            ...sheet.cells,
            [cellId]: {
              ...existing,
              raw: rawVal,
            },
          },
        };
      });
    },
    [updateActiveSheet]
  );

  // Copy / Cut / Paste handlers
  const handleCopySelection = useCallback(
    (cut = false) => {
      const rMin = Math.min(selectedCoord.r, selectionEnd.r);
      const rMax = Math.max(selectedCoord.r, selectionEnd.r);
      const cMin = Math.min(selectedCoord.c, selectionEnd.c);
      const cMax = Math.max(selectedCoord.c, selectionEnd.c);
      const copied: Record<string, SheetCell> = {};
      const lines: string[] = [];

      for (let r = rMin; r <= rMax; r++) {
        const rowText: string[] = [];
        for (let c = cMin; c <= cMax; c++) {
          const id = coordToCellId(r, c);
          const relKey = `${r - rMin}_${c - cMin}`;
          if (activeSheet.cells[id]) {
            copied[relKey] = JSON.parse(JSON.stringify(activeSheet.cells[id]));
          }
          rowText.push(evaluateCell(id, activeSheet.cells, doc.namedRanges, new Set(), doc.sheets).display);
        }
        lines.push(rowText.join('\t'));
      }

      clipboardRef.current = {
        rSpan: rMax - rMin + 1,
        cSpan: cMax - cMin + 1,
        cells: copied,
        cut,
        sourceIds: cut ? [...selectedRangeIds] : undefined,
      };
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(lines.join('\n'));
      }
      notify(cut ? `Intervalo ${selectedRangeString} recortado.` : `Intervalo ${selectedRangeString} copiado.`);
    },
    [selectedCoord, selectionEnd, activeSheet.cells, doc.namedRanges, doc.sheets, selectedRangeIds, selectedRangeString, notify]
  );

  const handlePasteSelection = useCallback(
    (valuesOnly = false) => {
      const clip = clipboardRef.current;
      if (!clip) return;
      updateActiveSheet((sheet) => {
        const nextCells = { ...sheet.cells };
        if (clip.cut && clip.sourceIds) {
          for (const id of clip.sourceIds) {
            if (nextCells[id]) nextCells[id] = { ...nextCells[id], raw: '' };
          }
        }
        for (let dr = 0; dr < clip.rSpan; dr++) {
          for (let dc = 0; dc < clip.cSpan; dc++) {
            const targetR = selectedCoord.r + dr;
            const targetC = selectedCoord.c + dc;
            if (targetR < TOTAL_ROWS && targetC < TOTAL_COLS) {
              const relKey = `${dr}_${dc}`;
              const srcCell = clip.cells[relKey];
              if (srcCell) {
                const targetId = coordToCellId(targetR, targetC);
                if (valuesOnly) {
                  const tempMap = { ...sheet.cells, [targetId]: srcCell };
                  const evaluatedVal = evaluateCell(targetId, tempMap, doc.namedRanges, new Set(), doc.sheets).display;
                  nextCells[targetId] = {
                    ...(nextCells[targetId] || {}),
                    raw: evaluatedVal,
                  };
                } else {
                  nextCells[targetId] = JSON.parse(JSON.stringify(srcCell));
                }
              }
            }
          }
        }
        return { ...sheet, cells: nextCells };
      });
      notify(valuesOnly ? 'Valores colados (sem fórmulas).' : 'Conteúdo colado.');
    },
    [selectedCoord, updateActiveSheet, doc.namedRanges, doc.sheets, notify]
  );

  const handleTransposeSelection = () => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: transposeRangeInCells(sheet.cells, selectedCoord, selectionEnd),
    }));
    const rSpan = Math.abs(selectionEnd.r - selectedCoord.r);
    const cSpan = Math.abs(selectionEnd.c - selectedCoord.c);
    const rMin = Math.min(selectedCoord.r, selectionEnd.r);
    const cMin = Math.min(selectedCoord.c, selectionEnd.c);
    setSelectedCoord({ r: rMin, c: cMin });
    setSelectionEnd({ r: rMin + cSpan, c: cMin + rSpan });
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Intervalo ${selectedRangeString} transposto (linhas ⇄ colunas).`);
  };

  const handleHideSelectedRow = () => {
    const r = selectedCoord.r;
    updateActiveSheet((sheet) => ({
      ...sheet,
      hiddenRows: Array.from(new Set([...(sheet.hiddenRows || []), r])),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Linha ${r + 1} ocultada.`);
  };

  const handleHideSelectedCol = () => {
    const c = selectedCoord.c;
    updateActiveSheet((sheet) => ({
      ...sheet,
      hiddenCols: Array.from(new Set([...(sheet.hiddenCols || []), c])),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Coluna ${colIndexToLetter(c)} ocultada.`);
  };

  const handleUnhideAll = () => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      hiddenRows: [],
      hiddenCols: [],
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify('Todas as linhas e colunas ocultas foram reexibidas.');
  };

  // Structural Row / Column Operations
  const handleInsertRow = (position: 'above' | 'below') => {
    const targetRow = position === 'above' ? selectedCoord.r : selectedCoord.r + 1;
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: insertRowInCells(sheet.cells, targetRow),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Linha inserida ${position === 'above' ? 'acima' : 'abaixo'} da linha ${selectedCoord.r + 1}.`);
  };

  const handleDeleteRow = () => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: deleteRowInCells(sheet.cells, selectedCoord.r),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Linha ${selectedCoord.r + 1} excluída.`);
  };

  const handleInsertColumn = (position: 'left' | 'right') => {
    const targetCol = position === 'left' ? selectedCoord.c : selectedCoord.c + 1;
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: insertColInCells(sheet.cells, targetCol),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(
      `Coluna inserida à ${position === 'left' ? 'esquerda' : 'direita'} de ${colIndexToLetter(selectedCoord.c)}.`
    );
  };

  const handleDeleteColumn = () => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: deleteColInCells(sheet.cells, selectedCoord.c),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Coluna ${colIndexToLetter(selectedCoord.c)} excluída.`);
  };

  // Merge / Unmerge Cells
  const handleToggleMergeSelection = () => {
    const anchorId = coordToCellId(
      Math.min(selectedCoord.r, selectionEnd.r),
      Math.min(selectedCoord.c, selectionEnd.c)
    );
    const isAlreadyMerged = Boolean(
      activeSheet.cells[anchorId]?.style?.colSpan || activeSheet.cells[anchorId]?.style?.rowSpan
    );

    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: isAlreadyMerged
        ? unmergeCellsInSelection(sheet.cells, selectedCoord, selectionEnd)
        : mergeCellsInSelection(sheet.cells, selectedCoord, selectionEnd),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(isAlreadyMerged ? 'Mesclagem desfeita.' : `Células mescladas (${selectedRangeString}).`);
  };

  // Insert Smart Chip in Active Cell
  const handleInsertSmartChip = (chip: CellSmartChip) => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: {
        ...sheet.cells,
        [activeCellId]: {
          ...(sheet.cells[activeCellId] || {}),
          raw: chip.label,
          smartChip: chip,
        },
      },
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Smart Chip "${chip.label}" inserido em ${activeCellId}.`);
  };

  // Close menus on outside click & handle global keyboard shortcuts
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (topBarRef.current && !topBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setContextMenu(null);
        setEditingCellId(null);
        setShowFormulaAutocomplete(false);
        setShowPivotModal(false);
        setShowConditionalModal(false);
        setShowFindReplaceModal(false);
        setShowTemplatesModal(false);
        setShowVersionHistoryModal(false);
        setShowShareModal(false);
        setShowValidationModal(false);
        setShowNoteModal(false);
        setShowNamedRangesModal(false);
        setShowSplitColumnsModal(false);
        setShowLinkModal(false);
        setTabMenuId(null);
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFindReplaceModal(true);
        return;
      }

      if (isInputFocused || editingCellId) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopySelection(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCopySelection(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteSelection(e.shiftKey);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCoord((p) => {
          const next = { r: Math.min(TOTAL_ROWS - 1, p.r + 1), c: p.c };
          if (!e.shiftKey) setSelectionEnd(next);
          else setSelectionEnd((s) => ({ r: Math.min(TOTAL_ROWS - 1, s.r + 1), c: s.c }));
          return e.shiftKey ? p : next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCoord((p) => {
          const next = { r: Math.max(0, p.r - 1), c: p.c };
          if (!e.shiftKey) setSelectionEnd(next);
          else setSelectionEnd((s) => ({ r: Math.max(0, s.r - 1), c: s.c }));
          return e.shiftKey ? p : next;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        setSelectedCoord((p) => {
          const next = { r: p.r, c: Math.min(TOTAL_COLS - 1, p.c + 1) };
          if (!e.shiftKey) setSelectionEnd(next);
          else setSelectionEnd((s) => ({ r: s.r, c: Math.min(TOTAL_COLS - 1, s.c + 1) }));
          return e.shiftKey ? p : next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCoord((p) => {
          const next = { r: p.r, c: Math.max(0, p.c - 1) };
          if (!e.shiftKey) setSelectionEnd(next);
          else setSelectionEnd((s) => ({ r: s.r, c: Math.max(0, s.c - 1) }));
          return e.shiftKey ? p : next;
        });
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setEditingCellId(activeCellId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        updateActiveSheet((sheet) => {
          const nextCells = { ...sheet.cells };
          for (const id of selectedRangeIds) {
            if (nextCells[id]) nextCells[id] = { ...nextCells[id], raw: '', smartChip: undefined };
          }
          return { ...sheet, cells: nextCells };
        });
        setFormulaInput('');
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    editingCellId,
    activeCellId,
    selectedRangeIds,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handlePasteSelection,
    updateActiveSheet,
  ]);

  // Column resize & AutoFill pointerup
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!resizingColRef.current) return;
      const { col, startX, startWidth } = resizingColRef.current;
      const nextWidth = Math.max(68, Math.min(420, startWidth + (e.clientX - startX)));
      setDoc((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) =>
          s.id === activeSheet.id
            ? { ...s, colWidths: { ...(s.colWidths || {}), [col]: nextWidth } }
            : s
        ),
      }));
    };
    const handlePointerUp = () => {
      resizingColRef.current = null;
      if (isSelectingCells) setIsSelectingCells(false);
      if (isAutoFilling) {
        setIsAutoFilling(false);
      }
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeSheet.id, isSelectingCells, isAutoFilling]);

  const applyStyleToSelection = (stylePatch: Partial<CellStyle>) => {
    updateActiveSheet((sheet) => {
      const nextCells = { ...sheet.cells };
      for (const id of selectedRangeIds) {
        const current = nextCells[id] || { raw: '' };
        nextCells[id] = {
          ...current,
          style: {
            ...(current.style || {}),
            ...stylePatch,
          },
        };
      }
      return { ...sheet, cells: nextCells };
    });
  };

  const handleToggleStyleFlag = (flag: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
    const currentStyle = activeSheet.cells[activeCellId]?.style || {};
    applyStyleToSelection({ [flag]: !currentStyle[flag] });
  };

  const handleAdjustDecimals = (delta: number) => {
    const currentStyle = activeSheet.cells[activeCellId]?.style || {};
    const currDec = currentStyle.decimals ?? 2;
    const nextDec = Math.max(0, Math.min(6, currDec + delta));
    applyStyleToSelection({ decimals: nextDec });
  };

  const handleInsertFunction = (fnName: string) => {
    const rangeRef = selectedRangeIds.length > 1 ? selectedRangeString : 'B2:B6';
    const formulaTemplate =
      fnName === 'SE'
        ? `=SE(${activeCellId}>1000; "Meta Batida"; "Abaixo")`
        : fnName === 'PROCV'
        ? `=PROCV("Google Ads Search"; A2:E6; 5)`
        : fnName === 'PROCX'
        ? `=PROCX("Google Ads Search"; A2:A6; E2:E6)`
        : fnName === 'ÍNDICE'
        ? `=ÍNDICE(A2:E6; 2; 5)`
        : fnName === 'CORRESP'
        ? `=CORRESP("Google Ads Search"; A2:A6)`
        : `=${fnName}(${rangeRef})`;
    setFormulaInput(formulaTemplate);
    commitCellValue(activeCellId, formulaTemplate);
    setOpenMenu(null);
    notify(`Fórmula ${fnName} inserida em ${activeCellId}.`);
  };

  const handleClearSelectionValues = () => {
    updateActiveSheet((sheet) => {
      const nextCells = { ...sheet.cells };
      for (const id of selectedRangeIds) {
        if (nextCells[id]) {
          nextCells[id] = { ...nextCells[id], raw: '', smartChip: undefined };
        }
      }
      return { ...sheet, cells: nextCells };
    });
    setFormulaInput('');
  };

  const handleClearFormatting = () => {
    updateActiveSheet((sheet) => {
      const nextCells = { ...sheet.cells };
      for (const id of selectedRangeIds) {
        if (nextCells[id]) {
          nextCells[id] = { ...nextCells[id], style: undefined };
        }
      }
      return { ...sheet, cells: nextCells };
    });
    notify('Formatação limpa na seleção.');
  };

  const handleSortBySelectedColumn = (direction: 'asc' | 'desc') => {
    const colIdx = selectedCoord.c;
    const headerRows = activeSheet.frozenRows ?? 1;
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: sortSheetRows(sheet.cells, colIdx, direction, headerRows, TOTAL_ROWS, TOTAL_COLS, doc.namedRanges, doc.sheets),
    }));
    setOpenMenu(null);
    setContextMenu(null);
    notify(
      `Planilha classificada pela Coluna ${colIndexToLetter(colIdx)} (${
        direction === 'asc' ? 'A → Z' : 'Z → A'
      }).`
    );
  };

  const handleRemoveDuplicates = () => {
    const headerRows = activeSheet.frozenRows ?? 1;
    const result = removeDuplicateRows(activeSheet.cells, headerRows, TOTAL_ROWS, TOTAL_COLS);
    updateActiveSheet((sheet) => ({
      ...sheet,
      cells: result.cells,
    }));
    setOpenMenu(null);
    notify(
      result.removedCount > 0
        ? `${result.removedCount} linha(s) duplicada(s) removida(s).`
        : 'Nenhuma linha duplicada encontrada.'
    );
  };

  const handleTrimWhitespace = () => {
    updateActiveSheet((sheet) => {
      const nextCells: Record<string, SheetCell> = {};
      (Object.entries(sheet.cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
        nextCells[id] = {
          ...cell,
          raw: cell.raw.startsWith('=') ? cell.raw : cell.raw.trim().replace(/\s+/g, ' '),
        };
      });
      return { ...sheet, cells: nextCells };
    });
    setOpenMenu(null);
    notify('Espaços em branco extras removidos.');
  };

  const handleApplyValidation = () => {
    const opts = validationOptionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateActiveSheet((sheet) => {
      const nextCells = { ...sheet.cells };
      for (const id of selectedRangeIds) {
        const curr = nextCells[id] || { raw: validationType === 'checkbox' ? 'FALSE' : opts[0] || '' };
        nextCells[id] = {
          ...curr,
          raw:
            validationType === 'checkbox' && curr.raw !== 'TRUE' && curr.raw !== 'FALSE'
              ? 'FALSE'
              : curr.raw,
          validation: {
            type: validationType,
            options: validationType === 'dropdown' ? opts : undefined,
          },
        };
      }
      return { ...sheet, cells: nextCells };
    });
    setShowValidationModal(false);
    notify(
      validationType === 'checkbox'
        ? 'Caixas de seleção inseridas.'
        : 'Menu suspenso (Dropdown) aplicado.'
    );
  };

  const handleAddConditionalRule = () => {
    const newRule: ConditionalFormatRule = {
      id: `cf_${Date.now()}`,
      range: newRuleRange.trim().toUpperCase() || selectedRangeString,
      operator: newRuleOperator,
      value: newRuleValue,
      fillColor: newRuleColor.fill,
      textColor: newRuleColor.text,
      bold: true,
    };
    updateActiveSheet((sheet) => ({
      ...sheet,
      conditionalRules: [...(sheet.conditionalRules || []), newRule],
    }));
    notify('Regra de formatação condicional adicionada.');
  };

  const handleFindAndReplaceAll = () => {
    if (!findQuery.trim()) return;
    let count = 0;
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    updateActiveSheet((sheet) => {
      const nextCells: Record<string, SheetCell> = {};
      (Object.entries(sheet.cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
        if (cell.raw && regex.test(cell.raw)) {
          count++;
          nextCells[id] = { ...cell, raw: cell.raw.replace(regex, replaceQuery) };
        } else {
          nextCells[id] = cell;
        }
      });
      return { ...sheet, cells: nextCells };
    });
    notify(`${count} célula(s) atualizada(s).`);
  };

  const handleSwitchSpreadsheet = (item: DriveItem) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setUndoStack([]);
    setRedoStack([]);
    setEditingCellId(null);
    setContextMenu(null);
    setTabMenuId(null);
    const saved = localStorage.getItem(`workspace_sheet_doc_v2_${item.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          setDoc(parsed);
          setActiveSheetId(parsed.sheets[0].id);
          return;
        }
      } catch {
        // ignore
      }
    }
    const nextDoc = createBlankSpreadsheet(item.id, item.name);
    setDoc(nextDoc);
    setActiveSheetId(nextDoc.sheets[0].id);
  };

  const handleCreateNewSpreadsheet = async () => {
    const title = 'Planilha sem título';
    const createdDriveItem = await bridge.createDriveDocument('sheet', title);
    const newSpreadsheet = createBlankSpreadsheet(createdDriveItem.id, createdDriveItem.name);
    localStorage.setItem(`workspace_sheet_doc_v2_${createdDriveItem.id}`, JSON.stringify(newSpreadsheet));
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setUndoStack([]);
    setRedoStack([]);
    setEditingCellId(null);
    setDoc(newSpreadsheet);
    setActiveSheetId(newSpreadsheet.sheets[0].id);
    await loadDriveSheets();
    setShowTemplatesModal(false);
    setOpenMenu(null);
    notify(`Planilha "${createdDriveItem.name}" criada e salva no Google Drive.`);
  };

  const handleAddSheetTab = () => {
    const newTabId = `tab_${Date.now()}`;
    const newTab: SheetTab = {
      id: newTabId,
      name: `Página${doc.sheets.length + 1}`,
      color: '#0F9D58',
      frozenRows: 0,
      frozenCols: 0,
      showGridlines: true,
      colWidths: {},
      cells: {},
      conditionalRules: [],
      charts: [],
    };
    setDoc((prev) => ({ ...prev, sheets: [...prev.sheets, newTab] }));
    setActiveSheetId(newTabId);
    notify(`Guia "${newTab.name}" adicionada.`);
  };

  const handleDuplicateSheetTab = (tabId: string) => {
    const source = doc.sheets.find((s) => s.id === tabId);
    if (!source) return;
    const copy: SheetTab = {
      ...JSON.parse(JSON.stringify(source)),
      id: `tab_${Date.now()}`,
      name: `Cópia de ${source.name}`,
    };
    setDoc((prev) => ({ ...prev, sheets: [...prev.sheets, copy] }));
    setActiveSheetId(copy.id);
    setTabMenuId(null);
    notify(`Guia "${copy.name}" duplicada.`);
  };

  const handleDeleteSheetTab = (tabId: string) => {
    if (doc.sheets.length <= 1) {
      notify('A planilha precisa ter pelo menos uma guia.');
      return;
    }
    const remaining = doc.sheets.filter((s) => s.id !== tabId);
    setDoc((prev) => ({ ...prev, sheets: remaining }));
    if (activeSheetId === tabId) {
      setActiveSheetId(remaining[0].id);
    }
    setTabMenuId(null);
    notify('Guia excluída.');
  };

  const handleExportFile = (ext: 'csv' | 'tsv' | 'json') => {
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    if (ext === 'csv') {
      content = exportCellsToDelimited(activeSheet.cells, ',', TOTAL_ROWS, TOTAL_COLS, doc.namedRanges, doc.sheets);
      mime = 'text/csv;charset=utf-8';
    } else if (ext === 'tsv') {
      content = exportCellsToDelimited(activeSheet.cells, '\t', TOTAL_ROWS, TOTAL_COLS, doc.namedRanges, doc.sheets);
      mime = 'text/tab-separated-values;charset=utf-8';
    } else {
      content = JSON.stringify(doc, null, 2);
      mime = 'application/json;charset=utf-8';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(null);
    notify(`Arquivo exportado como .${ext.toUpperCase()}.`);
  };

  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const importedCells = parseCsvToCells(text);
      const newTabId = `tab_csv_${Date.now()}`;
      const newTab: SheetTab = {
        id: newTabId,
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Importado CSV',
        color: '#0F9D58',
        frozenRows: 1,
        showGridlines: true,
        cells: importedCells,
      };
      setDoc((prev) => ({ ...prev, sheets: [...prev.sheets, newTab] }));
      setActiveSheetId(newTabId);
      notify(`CSV "${file.name}" importado em uma nova guia.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateTaskFromCell = async () => {
    const cellEval = evaluateCell(activeCellId, activeSheet.cells, doc.namedRanges, new Set(), doc.sheets).display;
    const taskTitle = cellEval
      ? `Revisar "${cellEval}" (${activeCellId}) em ${doc.title}`
      : `Revisar célula ${activeCellId} em ${doc.title}`;
    await bridge.createTask(
      taskTitle,
      `Criado a partir do Google Planilhas • Guia: ${activeSheet.name} • Célula: ${activeCellId}`,
      'default',
      new Date().toISOString(),
      undefined,
      {
        starred: true,
        linkedSource: {
          type: 'sheet',
          id: doc.id,
          label: doc.title,
        },
      }
    );
    const allTasks = await bridge.getTasks('all');
    if (onUpdateTasks) onUpdateTasks(allTasks);
    setOpenMenu(null);
    setContextMenu(null);
    notify(`Tarefa vinculada à célula ${activeCellId} criada no Google Tarefas!`);
  };

  const handleCopyRangeToGoogleDocs = async () => {
    const rMin = Math.min(selectedCoord.r, selectionEnd.r);
    const rMax = Math.max(selectedCoord.r, selectionEnd.r);
    const cMin = Math.min(selectedCoord.c, selectionEnd.c);
    const cMax = Math.max(selectedCoord.c, selectionEnd.c);

    let tableHtml = `<table style="border-collapse:collapse;width:100%;margin:16px 0;font-family:sans-serif;">`;
    for (let r = rMin; r <= rMax; r++) {
      tableHtml += `<tr>`;
      for (let c = cMin; c <= cMax; c++) {
        const id = coordToCellId(r, c);
        const disp = evaluateCell(id, activeSheet.cells, doc.namedRanges, new Set(), doc.sheets).display;
        const isHeader = r === rMin;
        tableHtml += `<${isHeader ? 'th' : 'td'} style="border:1px solid #CBD5E1;padding:8px 12px;background:${
          isHeader ? '#E6F4EA' : '#FFFFFF'
        };text-align:${c > cMin ? 'right' : 'left'};">${disp ? escapeHtml(disp) : '&nbsp;'}</${isHeader ? 'th' : 'td'}>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</table>`;

    const docTitle = `Relatório — ${doc.title}`;
    const newDriveDoc = await bridge.createDriveDocument('doc', docTitle);
    const fullHtml = `<h1>${escapeHtml(docTitle)}</h1><p>Tabela sincronizada a partir da planilha <strong>${escapeHtml(doc.title)}</strong> (${escapeHtml(selectedRangeString)}):</p>${tableHtml}`;
    await bridge.saveFileContent(newDriveDoc.id, encodeBase64Utf8(fullHtml));
    setOpenMenu(null);
    notify('Tabela exportada para um novo Google Docs!');
    if (onOpenApp) {
      onOpenApp('doc', { id: newDriveDoc.id, name: newDriveDoc.name });
    }
  };

  const handleOpenShareModal = async () => {
    const [perms, allItems] = await Promise.all([
      bridge.getFilePermissions(doc.id),
      bridge.getAllDriveItems(),
    ]);
    setSharePermissions(perms);
    const meta = allItems.find((item) => item.id === doc.id);
    setGeneralAccess(meta?.generalAccess === 'anyone_with_link' ? 'anyone_with_link' : 'restricted');
    setGeneralAccessRole(meta?.generalRole || 'viewer');
    setShowShareModal(true);
  };

  const selectionStats = useMemo(
    () => computeSelectionStats(selectedRangeIds, activeSheet.cells, doc.namedRanges, doc.sheets),
    [selectedRangeIds, activeSheet.cells, doc.namedRanges, doc.sheets]
  );

  const activeChart = activeSheet.charts?.[0];

  const chartDataPoints = useMemo(
    () => extractChartDataPoints(activeSheet.cells, activeChart, doc.namedRanges, doc.sheets, TOTAL_ROWS, TOTAL_COLS),
    [activeSheet.cells, activeChart, doc.namedRanges, doc.sheets]
  );

  const handleSetChartType = (type: SheetChartConfig['type']) => {
    updateActiveSheet((sheet) => {
      const existing = sheet.charts?.[0];
      const nextChart: SheetChartConfig = existing
        ? { ...existing, type }
        : {
            id: `ch_${Date.now()}`,
            title: `Análise Visual — ${sheet.name}`,
            type,
            dataRange: 'A2:E12',
          };
      return { ...sheet, charts: [nextChart] };
    });
    setShowChartPanel(true);
    setShowCommentsDrawer(false);
    setOpenMenu(null);
  };

  const handleUpdateChartMetricCol = (colIdx: number) => {
    updateActiveSheet((sheet) => {
      const existing = sheet.charts?.[0];
      const colHeader = sheet.cells[coordToCellId(0, colIdx)]?.raw || `Coluna ${colIndexToLetter(colIdx)}`;
      const nextChart: SheetChartConfig = existing
        ? {
            ...existing,
            title: `${colHeader} — ${sheet.name}`,
            labelCol: existing.labelCol ?? 0,
            seriesCols: [colIdx],
          }
        : {
            id: `ch_${Date.now()}`,
            title: `${colHeader} — ${sheet.name}`,
            type: 'column',
            dataRange: `A2:${colIndexToLetter(Math.max(colIdx, 4))}12`,
            labelCol: 0,
            seriesCols: [colIdx],
          };
      return { ...sheet, charts: [nextChart] };
    }, false);
  };

  const pivotRows = useMemo(
    () => computePivotTable(activeSheet.cells, pivotCategoryCol, pivotValueCol, 1, TOTAL_ROWS, doc.namedRanges, doc.sheets),
    [activeSheet.cells, pivotCategoryCol, pivotValueCol, doc.namedRanges, doc.sheets]
  );

  const openCommentsCount = useMemo(
    () => filterSheetComments(doc.comments || [], 'open').length,
    [doc.comments]
  );

  const visibleComments = useMemo(
    () => filterSheetComments(doc.comments || [], commentFilter),
    [doc.comments, commentFilter]
  );

  const formulaSuggestions = useMemo(() => {
    if (!formulaInput.startsWith('=')) return [];
    const tokenMatch = formulaInput.slice(1).match(/([A-Za-zÀ-ÿ.]+)$/);
    const token = tokenMatch ? tokenMatch[1].toUpperCase() : '';
    if (!token) return FORMULA_CATALOG.slice(0, 6);
    return FORMULA_CATALOG.filter((f) => f.name.startsWith(token));
  }, [formulaInput]);

  const visibleRowIndices = useMemo(() => {
    const hiddenSet = new Set(activeSheet.hiddenRows || []);
    const indices: number[] = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      if (hiddenSet.has(r)) continue;
      if (
        activeSheet.filterEnabled &&
        r >= (activeSheet.frozenRows || 1) &&
        activeSheet.filterCol !== null &&
        activeSheet.filterCol !== undefined &&
        activeSheet.filterValue?.trim()
      ) {
        const cellDisp = evaluateCell(
          coordToCellId(r, activeSheet.filterCol),
          activeSheet.cells,
          doc.namedRanges,
          new Set(),
          doc.sheets
        ).display.toLowerCase();
        if (!cellDisp.includes(activeSheet.filterValue.trim().toLowerCase())) {
          continue;
        }
      }
      indices.push(r);
    }
    return indices;
  }, [activeSheet, doc.namedRanges, doc.sheets]);

  const visibleColIndices = useMemo(() => {
    const hiddenSet = new Set(activeSheet.hiddenCols || []);
    const cols: number[] = [];
    for (let c = 0; c < TOTAL_COLS; c++) {
      if (!hiddenSet.has(c)) cols.push(c);
    }
    return cols;
  }, [activeSheet.hiddenCols]);

  const hasHiddenRowsOrCols =
    (activeSheet.hiddenRows?.length || 0) > 0 || (activeSheet.hiddenCols?.length || 0) > 0;

  const activeCellStyle = activeSheet.cells[activeCellId]?.style || {};

  return (
    <div
      className={`relative flex flex-col h-full w-full select-none overflow-hidden ${
        isDarkMode ? 'bg-[#18191C] text-[#E8EAED]' : 'bg-[#F8FAFD] text-[#202124]'
      }`}
    >
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={handleImportCsvFile}
      />

      {/* TOP HEADER & CLASSIC MENU BAR */}
      <div
        ref={topBarRef}
        className={`shrink-0 border-b px-2.5 sm:px-3 pt-2 pb-1.5 ${
          isDarkMode ? 'bg-[#1F2024] border-white/10' : 'bg-[#F8FAFD] border-gray-200'
        }`}
      >
        {/* ROW 1: Icon + Title + Star + Drive Switcher + Right Actions */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
              <GoogleIcons.Sheets className="w-7 h-7" />
            </div>

            <div className="flex items-center gap-1 min-w-0 flex-1">
              <input
                type="text"
                value={doc.title}
                onChange={(e) => setDoc((prev) => ({ ...prev, title: e.target.value }))}
                className={`font-semibold text-sm sm:text-base px-1.5 py-0.5 rounded border border-transparent focus:border-[#0F9D58] outline-none bg-transparent truncate min-w-0 flex-1 max-w-[230px] ${
                  isDarkMode ? 'text-white hover:border-white/20' : 'text-gray-900 hover:border-gray-300'
                }`}
                aria-label="Título da planilha"
              />

              <button
                onClick={() => setDoc((prev) => ({ ...prev, starred: !prev.starred }))}
                title={doc.starred ? 'Com estrela' : 'Adicionar estrela'}
                aria-label={doc.starred ? 'Remover estrela' : 'Adicionar estrela'}
                className={`p-1.5 rounded hover:bg-black/5 shrink-0 ${
                  doc.starred ? 'text-amber-400' : isDarkMode ? 'text-white/50' : 'text-gray-400'
                }`}
              >
                <Star size={15} fill={doc.starred ? 'currentColor' : 'none'} />
              </button>

              <select
                value={doc.id}
                onChange={(e) => {
                  const target = driveSheets.find((d) => d.id === e.target.value);
                  if (target) handleSwitchSpreadsheet(target);
                }}
                className={`hidden md:block text-xs rounded-md px-2 py-1 border outline-none cursor-pointer max-w-[170px] truncate shrink-0 ${
                  isDarkMode
                    ? 'bg-[#28292E] border-white/10 text-white/80'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
                title="Alternar planilha do Google Drive"
                aria-label="Alternar planilha do Google Drive"
              >
                {driveSheets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <span
                className={`hidden xl:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                  isDarkMode ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-50'
                }`}
              >
                <CloudCheck size={12} />
                <span>{saveState === 'saving' ? 'Salvando...' : 'Salvo no Drive'}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border whitespace-nowrap ${
                isDarkMode
                  ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Abrir ou criar planilha"
              aria-label="Planilhas do Drive"
            >
              <FileSpreadsheet size={14} className="text-[#0F9D58]" />
              <span className="hidden lg:inline">Planilhas</span>
            </button>

            <button
              onClick={() => setShowPivotModal(true)}
              className={`hidden sm:flex px-2.5 py-1.5 rounded-full text-xs font-medium items-center gap-1.5 border whitespace-nowrap ${
                isDarkMode
                  ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              title="Tabela Dinâmica"
              aria-label="Tabela Dinâmica"
            >
              <Table2 size={14} className="text-blue-500" />
              <span className="hidden lg:inline">Tabela Dinâmica</span>
            </button>

            <button
              onClick={() => setShowVersionHistoryModal(true)}
              className={`p-1.5 sm:p-2 rounded-full ${
                isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Histórico de versões"
              aria-label="Histórico de versões"
            >
              <History size={16} />
            </button>

            <button
              onClick={() => {
                setShowCommentsDrawer((v) => {
                  const next = !v;
                  if (next && typeof window !== 'undefined' && window.innerWidth < 1280) {
                    setShowChartPanel(false);
                  }
                  return next;
                });
              }}
              className={`p-1.5 sm:p-2 rounded-full relative ${
                showCommentsDrawer
                  ? 'bg-[#0F9D58]/15 text-[#0F9D58]'
                  : isDarkMode
                  ? 'hover:bg-white/10 text-white/70'
                  : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Comentários e Tarefas"
              aria-label="Comentários e Tarefas"
            >
              <MessageSquare size={16} />
              {openCommentsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0F9D58] text-white text-[10px] font-bold flex items-center justify-center">
                  {openCommentsCount}
                </span>
              )}
            </button>

            <button
              onClick={handleOpenShareModal}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-full bg-[#0F9D58] hover:bg-[#0B8043] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              aria-label="Compartilhar planilha"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-full ${
                isDarkMode ? 'hover:bg-white/10 text-white/70' : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
              }`}
              title="Fechar Planilhas"
              aria-label="Fechar Planilhas"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ROW 2: Classic Menu Bar (Full Width) */}
        <div className="flex items-center flex-wrap gap-0.5 mt-1 relative text-xs">
          {[
            { id: 'file', label: 'Arquivo' },
            { id: 'edit', label: 'Editar' },
            { id: 'view', label: 'Ver' },
            { id: 'insert', label: 'Inserir' },
            { id: 'format', label: 'Formatar' },
            { id: 'data', label: 'Dados' },
            { id: 'tools', label: 'Ferramentas' },
          ].map((m) => (
            <div key={m.id} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                className={`px-2 py-1 rounded whitespace-nowrap ${
                  openMenu === m.id
                    ? isDarkMode
                      ? 'bg-white/15 text-white'
                      : 'bg-gray-200 text-gray-900'
                    : isDarkMode
                    ? 'text-white/75 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-200/70'
                }`}
              >
                {m.label}
              </button>

              {openMenu === m.id && (
                <div
                  className={`absolute ${
                    ['format', 'data', 'tools'].includes(m.id)
                      ? 'right-0 sm:left-0 sm:right-auto'
                      : 'left-0'
                  } top-7 w-64 max-w-[calc(100vw-24px)] rounded-xl shadow-2xl border py-1.5 z-50 ${
                    isDarkMode
                      ? 'bg-[#28292E] border-white/15 text-white'
                      : 'bg-white border-gray-200 text-gray-800'
                  }`}
                >
                        {m.id === 'file' && (
                          <>
                            <button
                              onClick={() => handleCreateNewSpreadsheet()}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Nova planilha em branco</span>
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setShowTemplatesModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Abrir planilha do Drive...</span>
                              <FileSpreadsheet size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => {
                                csvInputRef.current?.click();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Importar arquivo CSV...</span>
                              <FileSpreadsheet size={14} />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => handleExportFile('csv')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Baixar como CSV (.csv)</span>
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => handleExportFile('tsv')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Baixar como TSV (.tsv)</span>
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setShowVersionHistoryModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Histórico de versões</span>
                              <History size={14} />
                            </button>
                            <button
                              onClick={() => {
                                window.print();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Imprimir / Exportar PDF</span>
                              <Printer size={14} />
                            </button>
                          </>
                        )}

                        {m.id === 'edit' && (
                          <>
                            <button
                              onClick={() => {
                                handleUndo();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Desfazer</span>
                              <span className="text-[10px] opacity-60">Ctrl+Z</span>
                            </button>
                            <button
                              onClick={() => {
                                handleRedo();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Refazer</span>
                              <span className="text-[10px] opacity-60">Ctrl+Y</span>
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => {
                                handleCopySelection(false);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Copiar seleção</span>
                              <span className="text-[10px] opacity-60">Ctrl+C</span>
                            </button>
                            <button
                              onClick={() => {
                                handleCopySelection(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Recortar seleção</span>
                              <span className="text-[10px] opacity-60">Ctrl+X</span>
                            </button>
                            <button
                              onClick={() => {
                                handlePasteSelection(false);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Colar</span>
                              <span className="text-[10px] opacity-60">Ctrl+V</span>
                            </button>
                            <button
                              onClick={() => {
                                handlePasteSelection(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Colar somente valores</span>
                              <span className="text-[10px] opacity-60">Ctrl+Shift+V</span>
                            </button>
                            <button
                              onClick={handleTransposeSelection}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Transpor linhas e colunas</span>
                              <ArrowLeftRight size={13} className="text-[#0F9D58]" />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => {
                                setShowFindReplaceModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Localizar e substituir...</span>
                              <span className="text-[10px] opacity-60">Ctrl+H</span>
                            </button>
                            <button
                              onClick={handleDeleteRow}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Excluir linha {selectedCoord.r + 1}</span>
                            </button>
                            <button
                              onClick={handleDeleteColumn}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Excluir coluna {colIndexToLetter(selectedCoord.c)}</span>
                            </button>
                            <button
                              onClick={() => {
                                handleClearSelectionValues();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between text-red-500"
                            >
                              <span>Limpar valores da seleção</span>
                              <span className="text-[10px]">Del</span>
                            </button>
                          </>
                        )}

                        {m.id === 'view' && (
                          <>
                            <button
                              onClick={() => {
                                updateActiveSheet((s) => ({
                                  ...s,
                                  showGridlines: s.showGridlines === false,
                                }));
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Mostrar linhas de grade</span>
                              {activeSheet.showGridlines !== false && <Check size={14} className="text-[#0F9D58]" />}
                            </button>
                            <button
                              onClick={() => {
                                setShowFormulaBar((v) => !v);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Mostrar barra de fórmulas</span>
                              {showFormulaBar && <Check size={14} className="text-[#0F9D58]" />}
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => {
                                updateActiveSheet((s) => ({
                                  ...s,
                                  frozenRows: s.frozenRows ? 0 : 1,
                                }));
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Congelar 1ª linha (Cabeçalho)</span>
                              {Boolean(activeSheet.frozenRows) && <Check size={14} className="text-[#0F9D58]" />}
                            </button>
                            <button
                              onClick={() => {
                                updateActiveSheet((s) => ({
                                  ...s,
                                  frozenCols: s.frozenCols ? 0 : 1,
                                }));
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Congelar 1ª coluna (Coluna A)</span>
                              {Boolean(activeSheet.frozenCols) && <Check size={14} className="text-[#0F9D58]" />}
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={handleHideSelectedRow}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Ocultar linha {selectedCoord.r + 1}</span>
                              <EyeOff size={13} />
                            </button>
                            <button
                              onClick={handleHideSelectedCol}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Ocultar coluna {colIndexToLetter(selectedCoord.c)}</span>
                              <EyeOff size={13} />
                            </button>
                            {hasHiddenRowsOrCols && (
                              <button
                                onClick={handleUnhideAll}
                                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between text-[#0F9D58] font-semibold"
                              >
                                <span>Reexibir linhas e colunas ocultas</span>
                                <Eye size={13} />
                              </button>
                            )}
                          </>
                        )}

                        {m.id === 'insert' && (
                          <>
                            <button
                              onClick={() => handleInsertRow('above')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Inserir 1 linha acima</span>
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => handleInsertRow('below')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Inserir 1 linha abaixo</span>
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => handleInsertColumn('left')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Inserir 1 coluna à esquerda</span>
                              <Columns size={14} />
                            </button>
                            <button
                              onClick={() => handleInsertColumn('right')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Inserir 1 coluna à direita</span>
                              <Columns size={14} />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => handleSetChartType('column')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Gráfico de Colunas</span>
                              <BarChart3 size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => handleSetChartType('line')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Gráfico de Linhas</span>
                              <LineChart size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleSetChartType('pie')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Gráfico de Rosca / Pizza</span>
                              <PieChart size={14} className="text-purple-500" />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() =>
                                handleInsertSmartChip({
                                  type: 'person',
                                  label: selfName,
                                  meta: selfEmail,
                                })
                              }
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Smart Chip: @Pessoa</span>
                              <User size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() =>
                                handleInsertSmartChip({
                                  type: 'file',
                                  label: doc.title || 'Documento do Drive',
                                  meta: 'f1',
                                })
                              }
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Smart Chip: @Arquivo do Drive</span>
                              <FileText size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => {
                                setValidationType('checkbox');
                                handleApplyValidation();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Caixa de seleção (Checkbox)</span>
                              <CheckSquare size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setValidationType('dropdown');
                                setShowValidationModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Lista suspensa (Chip Dropdown)</span>
                              <ChevronDown size={14} />
                            </button>
                            <button
                              onClick={() => handleInsertFunction('SPARKLINE')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Minigráfico (=SPARKLINE)</span>
                              <Sparkles size={14} className="text-amber-500" />
                            </button>
                            <button
                              onClick={() => {
                                setLinkTextInput(activeSheet.cells[activeCellId]?.raw || '');
                                setLinkUrlInput(activeSheet.cells[activeCellId]?.linkUrl || 'https://');
                                setShowLinkModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Inserir Link ({activeCellId})</span>
                              <Link2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setCellNoteText(activeSheet.cells[activeCellId]?.note || '');
                                setShowNoteModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Nota na célula ({activeCellId})</span>
                              <FileText size={14} />
                            </button>
                          </>
                        )}

                        {m.id === 'format' && (
                          <>
                            <button
                              onClick={() => {
                                applyStyleToSelection({ numberFormat: 'currency_brl' });
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Moeda (R$ Real Brasileiro)</span>
                              <span className="text-[11px] font-mono">R$ 1.234,56</span>
                            </button>
                            <button
                              onClick={() => {
                                applyStyleToSelection({ numberFormat: 'percent' });
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Porcentagem (%)</span>
                              <span className="text-[11px] font-mono">12,50%</span>
                            </button>
                            <button
                              onClick={() => {
                                applyStyleToSelection({ numberFormat: 'integer' });
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Número Inteiro</span>
                              <span className="text-[11px] font-mono">1.235</span>
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={handleToggleMergeSelection}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Mesclar / Desmesclar células ({selectedRangeString})</span>
                              <Combine size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => {
                                applyStyleToSelection({
                                  wrap: activeCellStyle.wrap === 'wrap' ? 'overflow' : 'wrap',
                                });
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Ajustar texto (Quebrar linha)</span>
                              <WrapText size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setNewRuleRange(selectedRangeString);
                                setShowConditionalModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Formatação condicional & Heatmap...</span>
                              <PaintBucket size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => {
                                updateActiveSheet((s) => ({
                                  ...s,
                                  alternatingColors: {
                                    enabled: !s.alternatingColors?.enabled,
                                    headerBg: '#0F9D58',
                                    evenBg: '#F8FAFC',
                                    oddBg: '#FFFFFF',
                                  },
                                }));
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Cores alternadas (Zebra)</span>
                              {activeSheet.alternatingColors?.enabled && (
                                <Check size={14} className="text-[#0F9D58]" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                handleClearFormatting();
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Limpar formatação</span>
                            </button>
                          </>
                        )}

                        {m.id === 'data' && (
                          <>
                            <button
                              onClick={() => handleSortBySelectedColumn('asc')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Classificar Coluna {colIndexToLetter(selectedCoord.c)} (A → Z)</span>
                              <ArrowUpDown size={14} />
                            </button>
                            <button
                              onClick={() => handleSortBySelectedColumn('desc')}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Classificar Coluna {colIndexToLetter(selectedCoord.c)} (Z → A)</span>
                              <ArrowUpDown size={14} />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={() => {
                                updateActiveSheet((s) => ({
                                  ...s,
                                  filterEnabled: !s.filterEnabled,
                                  filterCol: s.filterCol ?? 0,
                                  filterValue: '',
                                }));
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Ativar / Desativar Filtro</span>
                              <Filter size={14} className="text-[#0F9D58]" />
                            </button>
                            <button
                              onClick={() => {
                                setShowPivotModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Tabela Dinâmica (Pivot Table)</span>
                              <Table2 size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() => {
                                setShowSplitColumnsModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Dividir texto em colunas...</span>
                              <SplitSquareVertical size={14} className="text-amber-500" />
                            </button>
                            <button
                              onClick={() => {
                                setDoc((prev) => ({
                                  ...prev,
                                  sheets: prev.sheets.map((s) =>
                                    s.id === activeSheet.id ? { ...s, protected: !s.protected } : s
                                  ),
                                }));
                                setOpenMenu(null);
                                notify(
                                  activeSheet.protected
                                    ? `Proteção removida da guia "${activeSheet.name}".`
                                    : `Guia "${activeSheet.name}" protegida contra edições.`
                                );
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>
                                {activeSheet.protected ? 'Desbloquear guia protegida' : 'Proteger página / guia'}
                              </span>
                              {activeSheet.protected ? (
                                <Unlock size={14} className="text-amber-500" />
                              ) : (
                                <Lock size={14} className="text-[#0F9D58]" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setShowNamedRangesModal(true);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Intervalos nomeados</span>
                              <Layers size={14} />
                            </button>
                            <div className="my-1 border-t border-gray-200 dark:border-white/10" />
                            <button
                              onClick={handleRemoveDuplicates}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Remover linhas duplicadas</span>
                            </button>
                            <button
                              onClick={handleTrimWhitespace}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Cortar espaços em branco</span>
                            </button>
                          </>
                        )}

                        {m.id === 'tools' && (
                          <>
                            <button
                              onClick={handleCreateTaskFromCell}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Criar tarefa no Google Tarefas ({activeCellId})</span>
                              <CheckSquare size={14} className="text-blue-500" />
                            </button>
                            <button
                              onClick={handleCopyRangeToGoogleDocs}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Exportar seleção para o Google Docs</span>
                              <FileText size={14} className="text-blue-600" />
                            </button>
                            <button
                              onClick={async () => {
                                const res = await bridge.createCalendarEvent({
                                  title: `Revisão de Planilha: ${doc.title}`,
                                  description: `Revisar indicadores da guia "${activeSheet.name}" (${selectedRangeString}).`,
                                  start: new Date(Date.now() + 3600000).toISOString(),
                                  end: new Date(Date.now() + 7200000).toISOString(),
                                  color: '#0F9D58',
                                });
                                if (res.success && onUpdateEvents) {
                                  const evs = await bridge.getAllEvents();
                                  onUpdateEvents(evs);
                                }
                                setOpenMenu(null);
                                notify('Reunião de revisão agendada no Google Agenda!');
                              }}
                              className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
                            >
                              <span>Agendar revisão no Google Agenda</span>
                              <Calendar size={14} className="text-emerald-600" />
                            </button>
                          </>
                        )}
                    </div>
                  )}
                </div>
              ))}
        </div>

        {/* QUICK FORMATTING TOOLBAR (SINGLE-LINE WITH UNCLIPPED POPOVER CONTAINER) */}
        <div className="mt-1.5 relative">
          <div
            className={`px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1 flex-nowrap overflow-x-auto whitespace-nowrap ${
              isDarkMode ? 'bg-[#282A2E]' : 'bg-[#EDF2FA]'
            }`}
          >
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded hover:bg-black/10 disabled:opacity-35 shrink-0"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded hover:bg-black/10 disabled:opacity-35 shrink-0"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
          <button
            onClick={() => window.print()}
            className="p-1.5 rounded hover:bg-black/10 shrink-0"
            title="Imprimir"
          >
            <Printer size={14} />
          </button>
          <button
            onClick={() => {
              if (copiedCellStyle) {
                applyStyleToSelection(copiedCellStyle);
                setCopiedCellStyle(null);
                notify('Formatação colada.');
              } else {
                setCopiedCellStyle(activeCellStyle);
                notify('Formatação copiada. Clique em outra célula para aplicar.');
              }
            }}
            className={`p-1.5 rounded shrink-0 ${
              copiedCellStyle ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Pintar formatação"
          >
            <PaintBucket size={14} />
          </button>

          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={`text-xs px-1 py-0.5 rounded bg-transparent outline-none cursor-pointer shrink-0 ${
              isDarkMode ? 'text-white/80' : 'text-gray-700'
            }`}
            title="Zoom"
          >
            <option value={90}>90%</option>
            <option value={100}>100%</option>
            <option value={115}>115%</option>
            <option value={125}>125%</option>
          </select>

          <div className="w-[1px] h-4 bg-gray-300 dark:bg-white/15 mx-0.5 shrink-0" />

          <button
            onClick={() => applyStyleToSelection({ numberFormat: 'currency_brl' })}
            className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${
              activeCellStyle.numberFormat === 'currency_brl'
                ? 'bg-[#0F9D58]/20 text-[#0F9D58]'
                : 'hover:bg-black/10'
            }`}
            title="Formatar como moeda (R$)"
          >
            R$
          </button>
          <button
            onClick={() => applyStyleToSelection({ numberFormat: 'percent' })}
            className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${
              activeCellStyle.numberFormat === 'percent'
                ? 'bg-[#0F9D58]/20 text-[#0F9D58]'
                : 'hover:bg-black/10'
            }`}
            title="Formatar como porcentagem (%)"
          >
            %
          </button>
          <button
            onClick={() => handleAdjustDecimals(-1)}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-black/10 shrink-0"
            title="Diminuir casas decimais"
          >
            .0
          </button>
          <button
            onClick={() => handleAdjustDecimals(1)}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-black/10 shrink-0"
            title="Aumentar casas decimais"
          >
            .00
          </button>

          <div className="w-[1px] h-4 bg-gray-300 dark:bg-white/15 mx-0.5 shrink-0" />

          <select
            value={activeCellStyle.fontSize || 12}
            onChange={(e) => applyStyleToSelection({ fontSize: Number(e.target.value) })}
            className={`text-xs px-1 py-0.5 rounded bg-transparent outline-none cursor-pointer font-mono shrink-0 ${
              isDarkMode ? 'text-white/80' : 'text-gray-700'
            }`}
            title="Tamanho da fonte"
          >
            <option value={10}>10</option>
            <option value={11}>11</option>
            <option value={12}>12</option>
            <option value={14}>14</option>
            <option value={16}>16</option>
          </select>

          <button
            onClick={() => handleToggleStyleFlag('bold')}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.bold ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Negrito (Ctrl+B)"
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => handleToggleStyleFlag('italic')}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.italic ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Itálico (Ctrl+I)"
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => handleToggleStyleFlag('underline')}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.underline ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Sublinhado (Ctrl+U)"
          >
            <Underline size={14} />
          </button>
          <button
            onClick={() => handleToggleStyleFlag('strikethrough')}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.strikethrough ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Tachado"
          >
            <Strikethrough size={14} />
          </button>

          <label
            className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-black/10 cursor-pointer text-xs shrink-0"
            title="Cor do texto"
          >
            <span className="font-bold underline" style={{ color: activeCellStyle.textColor || '#0F9D58' }}>
              A
            </span>
            <input
              type="color"
              value={activeCellStyle.textColor || '#202124'}
              onChange={(e) => applyStyleToSelection({ textColor: e.target.value })}
              className="w-0 h-0 opacity-0"
            />
          </label>

          <label
            className="flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-black/10 cursor-pointer text-xs shrink-0"
            title="Cor de preenchimento da célula"
          >
            <span
              className="w-3.5 h-3.5 rounded border border-black/20 inline-block"
              style={{ backgroundColor: activeCellStyle.fillColor || '#E6F4EA' }}
            />
            <input
              type="color"
              value={activeCellStyle.fillColor || '#E6F4EA'}
              onChange={(e) => applyStyleToSelection({ fillColor: e.target.value })}
              className="w-0 h-0 opacity-0"
            />
          </label>

          <button
            onClick={() => applyStyleToSelection({ borders: !activeCellStyle.borders })}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.borders ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Bordas destacadas na seleção"
          >
            <Grid size={14} />
          </button>

          <button
            onClick={handleToggleMergeSelection}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.colSpan || activeCellStyle.rowSpan
                ? 'bg-[#0F9D58]/20 text-[#0F9D58]'
                : 'hover:bg-black/10'
            }`}
            title="Mesclar / Desmesclar células selecionadas"
          >
            <Combine size={14} />
          </button>

          <div className="w-[1px] h-4 bg-gray-300 dark:bg-white/15 mx-0.5 shrink-0" />

          <button
            onClick={() => applyStyleToSelection({ align: 'left' })}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.align === 'left' ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Alinhar à esquerda"
          >
            <AlignLeft size={14} />
          </button>
          <button
            onClick={() => applyStyleToSelection({ align: 'center' })}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.align === 'center' ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Centralizar"
          >
            <AlignCenter size={14} />
          </button>
          <button
            onClick={() => applyStyleToSelection({ align: 'right' })}
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.align === 'right' ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Alinhar à direita"
          >
            <AlignRight size={14} />
          </button>

          <button
            onClick={() =>
              applyStyleToSelection({ wrap: activeCellStyle.wrap === 'wrap' ? 'overflow' : 'wrap' })
            }
            className={`p-1.5 rounded shrink-0 ${
              activeCellStyle.wrap === 'wrap' ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Quebrar texto automaticamente (Wrap)"
          >
            <WrapText size={14} />
          </button>

          <div className="w-[1px] h-4 bg-gray-300 dark:bg-white/15 mx-0.5 shrink-0" />

          <button
            onClick={() => setOpenMenu(openMenu === 'sigma' ? null : 'sigma')}
            className={`px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold shrink-0 ${
              openMenu === 'sigma' ? 'bg-[#0F9D58]/20 text-[#0F9D58]' : 'hover:bg-black/10'
            }`}
            title="Inserir função (Σ)"
          >
            <Sigma size={14} className="text-[#0F9D58]" />
            <span>Funções</span>
          </button>

          <button
            onClick={() =>
              updateActiveSheet((s) => ({
                ...s,
                filterEnabled: !s.filterEnabled,
                filterCol: s.filterCol ?? 0,
              }))
            }
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 shrink-0 ${
              activeSheet.filterEnabled
                ? 'bg-[#0F9D58]/20 text-[#0F9D58] font-semibold'
                : 'hover:bg-black/10'
            }`}
            title="Ativar filtro nas colunas"
          >
            <Filter size={13} />
            <span>Filtro</span>
          </button>

          <button
            onClick={() => {
              setShowChartPanel((v) => {
                const next = !v;
                if (next && typeof window !== 'undefined' && window.innerWidth < 1280) {
                  setShowCommentsDrawer(false);
                }
                return next;
              });
            }}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 shrink-0 ${
              showChartPanel
                ? 'bg-[#0F9D58]/20 text-[#0F9D58] font-semibold'
                : 'hover:bg-black/10'
            }`}
            title="Mostrar/ocultar gráfico ao vivo"
          >
            <BarChart3 size={13} />
            <span>Gráfico</span>
          </button>

          <button
            onClick={() => {
              setNewRuleRange(selectedRangeString);
              setShowConditionalModal(true);
            }}
            className="px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-black/10 shrink-0"
            title="Regras de formatação condicional"
          >
            <Sparkles size={13} className="text-amber-500" />
            <span className="hidden xl:inline">Condicional</span>
          </button>
          </div>

          {openMenu === 'sigma' && (
            <div
              className={`absolute right-2 top-10 w-72 max-w-[calc(100vw-24px)] max-h-80 overflow-y-auto rounded-xl shadow-2xl border py-1.5 z-50 ${
                isDarkMode ? 'bg-[#28292E] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b border-gray-200 dark:border-white/10">
                Catálogo de Funções (Σ)
              </div>
              {FORMULA_CATALOG.map((fn) => (
                <button
                  key={fn.name}
                  onClick={() => handleInsertFunction(fn.name)}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#0F9D58]/10 flex flex-col"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-[#0F9D58]">{fn.name}</span>
                    <span className="text-[10px] opacity-60 font-mono truncate">{fn.syntax}</span>
                  </div>
                  <span className="text-[11px] opacity-75 whitespace-normal">{fn.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* NAME BOX & FORMULA BAR (fx) */}
        {showFormulaBar && (
          <div className="mt-1.5 flex items-center flex-wrap gap-1.5 sm:gap-2 relative">
            <input
              type="text"
              value={nameBoxInput}
              onChange={(e) => setNameBoxInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = nameBoxInput.trim();
                  const named = doc.namedRanges?.find(
                    (n) => n.name.toUpperCase() === target.toUpperCase()
                  );
                  const resolved = named ? named.range : target;
                  if (resolved.includes(':')) {
                    const [a, b] = resolved.split(':');
                    const c1 = cellIdToCoord(a);
                    const c2 = cellIdToCoord(b);
                    if (c1 && c2) {
                      setSelectedCoord(c1);
                      setSelectionEnd(c2);
                    }
                  } else {
                    const c = cellIdToCoord(resolved);
                    if (c) {
                      setSelectedCoord(c);
                      setSelectionEnd(c);
                    }
                  }
                }
              }}
              aria-label="Caixa de nome da célula ou intervalo"
              className={`w-20 sm:w-24 px-2 py-1 text-xs font-mono font-semibold text-center rounded border outline-none focus:border-[#0F9D58] shrink-0 ${
                isDarkMode
                  ? 'bg-[#18191C] border-white/15 text-white'
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            />

            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold text-[#0F9D58] bg-[#0F9D58]/10 shrink-0">
              <span>fx</span>
            </div>

            <div className="flex-1 min-w-[140px] relative">
              <input
                type="text"
                value={formulaInput}
                onFocus={() => setShowFormulaAutocomplete(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormulaInput(val);
                  setShowFormulaAutocomplete(val.startsWith('='));
                  commitCellValue(activeCellId, val);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowFormulaAutocomplete(false);
                    setEditingCellId(null);
                  }
                }}
                placeholder="Digite um valor ou fórmula (ex: =SOMA(B2:B6), ='Metas & OKRs'!C2)"
                aria-label="Barra de fórmulas"
                className={`w-full px-2.5 sm:px-3 py-1 text-xs font-mono rounded border outline-none focus:border-[#0F9D58] ${
                  isDarkMode
                    ? 'bg-[#18191C] border-white/15 text-white'
                    : 'bg-white border-gray-300 text-gray-800'
                }`}
              />

              {showFormulaAutocomplete && formulaSuggestions.length > 0 && (
                <div
                  className={`absolute left-0 top-8 w-full max-w-sm rounded-xl shadow-2xl border p-2 z-50 ${
                    isDarkMode
                      ? 'bg-[#28292E] border-white/15 text-white'
                      : 'bg-white border-gray-200 text-gray-800'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-60 px-2 pb-1">
                    Assistente de Fórmulas do Google Planilhas
                  </div>
                  {formulaSuggestions.map((fn) => (
                    <button
                      key={fn.name}
                      onClick={() => {
                        const nextFormula = `=${fn.name}(`;
                        setFormulaInput(nextFormula);
                        commitCellValue(activeCellId, nextFormula);
                        setShowFormulaAutocomplete(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-[#0F9D58]/15 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs text-[#0F9D58] truncate">{fn.syntax}</div>
                        <div className="text-[11px] opacity-75">{fn.desc}</div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0F9D58]/10 text-[#0F9D58] font-mono shrink-0">
                        Inserir
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasHiddenRowsOrCols && (
              <button
                onClick={handleUnhideAll}
                className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                title="Reexibir linhas e colunas ocultas"
              >
                <Eye size={12} />
                <span>Reexibir ocultos</span>
              </button>
            )}

            {activeSheet.filterEnabled && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F9D58]/10 border border-[#0F9D58]/30 text-xs shrink-0 max-w-full">
                <Filter size={12} className="text-[#0F9D58] shrink-0" />
                <select
                  value={activeSheet.filterCol ?? 0}
                  onChange={(e) =>
                    updateActiveSheet((s) => ({ ...s, filterCol: Number(e.target.value) }), false)
                  }
                  className="bg-transparent font-medium outline-none text-xs"
                  aria-label="Coluna do filtro"
                >
                  {Array.from({ length: 9 }).map((_, c) => (
                    <option key={c} value={c} className="text-gray-900">
                      Col {colIndexToLetter(c)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={activeSheet.filterValue || ''}
                  onChange={(e) =>
                    updateActiveSheet((s) => ({ ...s, filterValue: e.target.value }), false)
                  }
                  placeholder="Filtrar texto..."
                  className={`w-24 sm:w-28 px-2 py-0.5 rounded border text-xs outline-none ${
                    isDarkMode
                      ? 'bg-[#18191C] border-white/15 text-white'
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* MAIN WORKSPACE: 2D SPREADSHEET GRID + LIVE CHART / COMMENTS DRAWERS */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div ref={gridContainerRef} className="flex-1 overflow-auto relative">
          <div style={{ zoom: `${zoom}%` }}>
            <table className="border-collapse table-fixed text-xs">
              <thead>
                <tr>
                  <th
                    onClick={() => {
                      setSelectedCoord({ r: 0, c: 0 });
                      setSelectionEnd({ r: 6, c: 8 });
                    }}
                    className={`sticky top-0 left-0 z-30 w-11 min-w-[44px] h-7 border text-[10px] font-semibold cursor-pointer ${
                      isDarkMode
                        ? 'bg-[#25262B] border-white/15 text-white/50'
                        : 'bg-[#F1F3F4] border-gray-300 text-gray-500'
                    }`}
                    title="Selecionar intervalo principal"
                  >
                    ◢
                  </th>

                  {visibleColIndices.map((c) => {
                    const width = activeSheet.colWidths?.[c] || (c === 0 ? 185 : 120);
                    const isColSelected =
                      c >= Math.min(selectedCoord.c, selectionEnd.c) &&
                      c <= Math.max(selectedCoord.c, selectionEnd.c);

                    return (
                      <th
                        key={c}
                        style={{ width, minWidth: width }}
                        onClick={() => {
                          setSelectedCoord({ r: 0, c });
                          setSelectionEnd({ r: 10, c });
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedCoord({ r: 0, c });
                          setSelectionEnd({ r: 10, c });
                          setContextMenu({ x: e.clientX, y: e.clientY, r: 0, c });
                        }}
                        className={`sticky top-0 z-20 h-7 border px-2 font-semibold select-none relative group cursor-pointer ${
                          isColSelected
                            ? isDarkMode
                              ? 'bg-[#0F9D58]/30 text-emerald-300 border-white/20'
                              : 'bg-[#E6F4EA] text-[#137333] border-gray-300'
                            : isDarkMode
                            ? 'bg-[#25262B] border-white/15 text-white/75'
                            : 'bg-[#F1F3F4] border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{colIndexToLetter(c)}</span>
                          {activeSheet.filterEnabled && c < 9 && (
                            <Filter size={10} className="text-[#0F9D58] opacity-80" />
                          )}
                        </div>

                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            resizingColRef.current = { col: c, startX: e.clientX, startWidth: width };
                          }}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0F9D58] transition-colors"
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {visibleRowIndices.map((r) => {
                  const isRowSelected =
                    r >= Math.min(selectedCoord.r, selectionEnd.r) &&
                    r <= Math.max(selectedCoord.r, selectionEnd.r);
                  const isFrozenRow = r < (activeSheet.frozenRows || 0);

                  return (
                    <tr key={r} className="h-7">
                      <td
                        onClick={() => {
                          setSelectedCoord({ r, c: 0 });
                          setSelectionEnd({ r, c: 8 });
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedCoord({ r, c: 0 });
                          setSelectionEnd({ r, c: 8 });
                          setContextMenu({ x: e.clientX, y: e.clientY, r, c: 0 });
                        }}
                        className={`sticky left-0 z-20 border text-center font-medium text-[11px] cursor-pointer ${
                          isRowSelected
                            ? isDarkMode
                              ? 'bg-[#0F9D58]/30 text-emerald-300 border-white/20'
                              : 'bg-[#E6F4EA] text-[#137333] border-gray-300'
                            : isDarkMode
                            ? 'bg-[#25262B] border-white/15 text-white/55'
                            : 'bg-[#F1F3F4] border-gray-300 text-gray-600'
                        }`}
                      >
                        {r + 1}
                      </td>

                      {visibleColIndices.map((c) => {
                        const cellId = coordToCellId(r, c);
                        const cell = activeSheet.cells[cellId];
                        if (cell?.style?.mergedInto) {
                          return null;
                        }

                        const evaluated = evaluateCell(
                          cellId,
                          activeSheet.cells,
                          doc.namedRanges,
                          new Set(),
                          doc.sheets
                        );
                        const condStyle = evaluateConditionalFormatting(
                          cellId,
                          activeSheet.cells,
                          activeSheet.conditionalRules,
                          doc.namedRanges,
                          doc.sheets
                        );

                        const isPrimaryActive = selectedCoord.r === r && selectedCoord.c === c;
                        const isBottomRightOfSelection =
                          r === Math.max(selectedCoord.r, selectionEnd.r) &&
                          c === Math.max(selectedCoord.c, selectionEnd.c);

                        const isInSelection =
                          r >= Math.min(selectedCoord.r, selectionEnd.r) &&
                          r <= Math.max(selectedCoord.r, selectionEnd.r) &&
                          c >= Math.min(selectedCoord.c, selectionEnd.c) &&
                          c <= Math.max(selectedCoord.c, selectionEnd.c);

                        const style = cell?.style || {};

                        let defaultRowBg = isDarkMode ? '#18191C' : '#FFFFFF';
                        if (activeSheet.alternatingColors?.enabled) {
                          if (r === 0) {
                            defaultRowBg = activeSheet.alternatingColors.headerBg;
                          } else if (r % 2 === 0) {
                            defaultRowBg = isDarkMode ? '#1E2025' : activeSheet.alternatingColors.evenBg;
                          } else {
                            defaultRowBg = isDarkMode ? '#18191C' : activeSheet.alternatingColors.oddBg;
                          }
                        }

                        const bgColor = condStyle?.fillColor || style.fillColor || defaultRowBg;
                        const fgColor =
                          condStyle?.textColor ||
                          style.textColor ||
                          (r === 0 && activeSheet.alternatingColors?.enabled
                            ? '#FFFFFF'
                            : isDarkMode
                            ? '#E8EAED'
                            : '#202124');

                        const hasComment = (doc.comments || []).some(
                          (cm) => cm.sheetId === activeSheet.id && cm.cellId === cellId && !cm.resolved
                        );

                        return (
                          <td
                            key={c}
                            colSpan={style.colSpan}
                            rowSpan={style.rowSpan}
                            data-cell-id={cellId}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (!isInSelection) {
                                setSelectedCoord({ r, c });
                                setSelectionEnd({ r, c });
                              }
                              setContextMenu({ x: e.clientX, y: e.clientY, r, c });
                            }}
                            onPointerDown={(e) => {
                              if (e.button === 2) return;
                              if (e.shiftKey) {
                                setSelectionEnd({ r, c });
                              } else {
                                setSelectedCoord({ r, c });
                                setSelectionEnd({ r, c });
                                setIsSelectingCells(true);
                              }
                              if (editingCellId && editingCellId !== cellId) {
                                setEditingCellId(null);
                              }
                            }}
                            onPointerEnter={() => {
                              if (isAutoFilling) {
                                updateActiveSheet(
                                  (sheet) => ({
                                    ...sheet,
                                    cells: autoFillRange(sheet.cells, selectedCoord, selectionEnd, { r, c }),
                                  }),
                                  false
                                );
                                setSelectionEnd({ r, c });
                              } else if (isSelectingCells) {
                                setSelectionEnd({ r, c });
                              }
                            }}
                            onDoubleClick={() => {
                              setSelectedCoord({ r, c });
                              setSelectionEnd({ r, c });
                              setEditingCellId(cellId);
                            }}
                            style={{
                              backgroundColor:
                                isInSelection && !isPrimaryActive && !style.fillColor && !condStyle?.fillColor
                                  ? isDarkMode
                                    ? 'rgba(15, 157, 88, 0.16)'
                                    : 'rgba(15, 157, 88, 0.10)'
                                  : bgColor,
                              color: fgColor,
                              fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
                              fontWeight: condStyle?.bold || style.bold ? 700 : 400,
                              fontStyle: style.italic ? 'italic' : 'normal',
                              textDecoration: [
                                style.underline ? 'underline' : '',
                                style.strikethrough ? 'line-through' : '',
                              ]
                                .filter(Boolean)
                                .join(' '),
                              textAlign: style.align || (typeof evaluated.value === 'number' ? 'right' : 'left'),
                              whiteSpace: style.wrap === 'wrap' ? 'normal' : 'nowrap',
                            }}
                            className={`relative px-2 py-0.5 h-7 ${
                              style.wrap === 'wrap' ? 'break-words' : 'truncate'
                            } transition-colors ${
                              style.borders
                                ? 'border border-gray-700 dark:border-white/60'
                                : activeSheet.showGridlines !== false
                                ? isDarkMode
                                  ? 'border border-white/10'
                                  : 'border border-gray-200'
                                : ''
                            } ${isFrozenRow ? 'border-b-2 border-b-[#0F9D58]/50' : ''} ${
                              isPrimaryActive
                                ? 'outline outline-2 outline-[#0F9D58] z-10'
                                : isInSelection
                                ? 'ring-1 ring-[#0F9D58]/50'
                                : ''
                            }`}
                            title={cell?.note ? `Nota (${cellId}): ${cell.note}` : evaluated.error || undefined}
                          >
                            {cell?.note && (
                              <span
                                className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-amber-500"
                                title={cell.note}
                              />
                            )}

                            {hasComment && (
                              <span
                                className="absolute top-0 left-0 w-0 h-0 border-r-[6px] border-r-transparent border-t-[6px] border-t-[#0F9D58]"
                                title="Comentário ativo nesta célula"
                              />
                            )}

                            {editingCellId === cellId ? (
                              <input
                                autoFocus
                                type="text"
                                value={formulaInput}
                                onChange={(e) => {
                                  setFormulaInput(e.target.value);
                                  commitCellValue(cellId, e.target.value);
                                }}
                                onBlur={() => setEditingCellId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingCellId(null);
                                    setSelectedCoord((prev) => ({
                                      r: Math.min(TOTAL_ROWS - 1, prev.r + 1),
                                      c: prev.c,
                                    }));
                                    setSelectionEnd((prev) => ({
                                      r: Math.min(TOTAL_ROWS - 1, prev.r + 1),
                                      c: prev.c,
                                    }));
                                  } else if (e.key === 'Tab') {
                                    e.preventDefault();
                                    setEditingCellId(null);
                                    setSelectedCoord((prev) => ({
                                      r: prev.r,
                                      c: Math.min(TOTAL_COLS - 1, prev.c + 1),
                                    }));
                                    setSelectionEnd((prev) => ({
                                      r: prev.r,
                                      c: Math.min(TOTAL_COLS - 1, prev.c + 1),
                                    }));
                                  }
                                }}
                                className="w-full h-full bg-white text-gray-900 px-1 outline-none font-mono text-xs"
                              />
                            ) : cell?.smartChip ? (
                              <span
                                onClick={(e) => {
                                  if (cell.smartChip?.type === 'file' && onOpenApp) {
                                    e.stopPropagation();
                                    onOpenApp('doc', {
                                      id: cell.smartChip.meta || 'f1',
                                      name: cell.smartChip.label,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-medium cursor-pointer hover:bg-[#0F9D58]/15"
                              >
                                {cell.smartChip.type === 'person' ? (
                                  <User size={11} className="text-blue-500" />
                                ) : (
                                  <FileText size={11} className="text-[#0F9D58]" />
                                )}
                                <span>{cell.smartChip.label}</span>
                              </span>
                            ) : cell?.linkUrl ? (
                              <a
                                href={cell.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 underline hover:opacity-80"
                              >
                                <span>{evaluated.display || cell.linkUrl}</span>
                                <ExternalLink size={10} />
                              </a>
                            ) : cell?.validation?.type === 'checkbox' ? (
                              <div className="flex items-center justify-center h-full">
                                <input
                                  type="checkbox"
                                  checked={cell.raw.toUpperCase() === 'TRUE'}
                                  onChange={(e) =>
                                    commitCellValue(cellId, e.target.checked ? 'TRUE' : 'FALSE')
                                  }
                                  className="w-3.5 h-3.5 accent-[#0F9D58] cursor-pointer rounded"
                                />
                              </div>
                            ) : cell?.validation?.type === 'dropdown' ? (
                              <select
                                value={cell.raw}
                                onChange={(e) => commitCellValue(cellId, e.target.value)}
                                className="w-full bg-black/5 dark:bg-white/10 rounded-full px-2 py-0.5 text-[11px] font-medium outline-none cursor-pointer"
                              >
                                {(cell.validation.options || ['Concluído', 'Em andamento', 'Em risco']).map(
                                  (opt) => (
                                    <option key={opt} value={opt} className="text-gray-900">
                                      {opt}
                                    </option>
                                  )
                                )}
                              </select>
                            ) : evaluated.sparkline && evaluated.sparkline.length > 0 ? (
                              <svg viewBox="0 0 100 22" className="w-full h-5 overflow-visible">
                                {(() => {
                                  const vals = evaluated.sparkline!;
                                  const maxV = Math.max(...vals, 1);
                                  const minV = Math.min(...vals, 0);
                                  const span = Math.max(1, maxV - minV);
                                  const pts = vals
                                    .map((v, idx) => {
                                      const x =
                                        vals.length === 1 ? 50 : (idx / (vals.length - 1)) * 92 + 4;
                                      const y = 19 - ((v - minV) / span) * 15;
                                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                                    })
                                    .join(' ');
                                  return (
                                    <>
                                      <polyline
                                        fill="none"
                                        stroke="#0F9D58"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        points={pts}
                                      />
                                      {vals.map((v, idx) => {
                                        const x =
                                          vals.length === 1 ? 50 : (idx / (vals.length - 1)) * 92 + 4;
                                        const y = 19 - ((v - minV) / span) * 15;
                                        return <circle key={idx} cx={x} cy={y} r="2.2" fill="#0F9D58" />;
                                      })}
                                    </>
                                  );
                                })()}
                              </svg>
                            ) : (
                              <span>{evaluated.display}</span>
                            )}

                            {/* Interactive Fill Handle square on bottom-right of selection */}
                            {isBottomRightOfSelection && !editingCellId && (
                              <div
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  pushHistory();
                                  setIsAutoFilling(true);
                                }}
                                title="Arraste para preencher série ou propagar fórmula"
                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#0F9D58] border border-white cursor-crosshair z-30"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RIGHT-CLICK CONTEXT MENU */}
          {contextMenu && (
            <div
              style={{
                top: Math.max(12, Math.min(contextMenu.y - 20, (typeof window !== 'undefined' ? window.innerHeight : 700) - 360)),
                left: Math.max(12, Math.min(contextMenu.x - 10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270)),
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`fixed w-64 max-w-[calc(100vw-24px)] max-h-[75vh] overflow-y-auto rounded-xl shadow-2xl border py-1.5 z-50 text-xs ${
                isDarkMode
                  ? 'bg-[#28292E] border-white/15 text-white'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div className="px-3 py-1 text-[10px] font-mono font-bold text-[#0F9D58] border-b border-gray-100 dark:border-white/10">
                Célula {coordToCellId(contextMenu.r, contextMenu.c)} ({selectedRangeString})
              </div>
              <button
                onClick={() => {
                  handleCopySelection(false);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>Copiar</span>
                <span className="text-[10px] opacity-60">Ctrl+C</span>
              </button>
              <button
                onClick={() => {
                  handleCopySelection(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>Recortar</span>
                <span className="text-[10px] opacity-60">Ctrl+X</span>
              </button>
              <button
                onClick={() => {
                  handlePasteSelection(false);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>Colar</span>
                <span className="text-[10px] opacity-60">Ctrl+V</span>
              </button>
              <button
                onClick={() => {
                  handlePasteSelection(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>Colar somente valores</span>
                <span className="text-[10px] opacity-60">Ctrl+Shift+V</span>
              </button>
              <button
                onClick={handleTransposeSelection}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>Transpor linhas ⇄ colunas</span>
                <ArrowLeftRight size={12} />
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-white/10" />
              <button
                onClick={() => handleInsertRow('above')}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Inserir 1 linha acima
              </button>
              <button
                onClick={() => handleInsertRow('below')}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Inserir 1 linha abaixo
              </button>
              <button
                onClick={() => handleInsertColumn('left')}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Inserir 1 coluna à esquerda
              </button>
              <button
                onClick={() => handleInsertColumn('right')}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Inserir 1 coluna à direita
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-white/10" />
              <button
                onClick={handleToggleMergeSelection}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Mesclar / Desmesclar células
              </button>
              <button
                onClick={handleHideSelectedRow}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Ocultar linha {contextMenu.r + 1}
              </button>
              <button
                onClick={handleHideSelectedCol}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Ocultar coluna {colIndexToLetter(contextMenu.c)}
              </button>
              <button
                onClick={() => {
                  setCellNoteText(activeSheet.cells[activeCellId]?.note || '');
                  setShowNoteModal(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Inserir nota na célula
              </button>
              <button
                onClick={handleCreateTaskFromCell}
                className="w-full px-3.5 py-1.5 text-left hover:bg-[#0F9D58]/10 text-[#0F9D58] font-medium"
              >
                + Criar Tarefa no Google Tasks
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-white/10" />
              <button
                onClick={handleDeleteRow}
                className="w-full px-3.5 py-1.5 text-left text-red-500 hover:bg-red-500/10"
              >
                Excluir linha {contextMenu.r + 1}
              </button>
              <button
                onClick={handleDeleteColumn}
                className="w-full px-3.5 py-1.5 text-left text-red-500 hover:bg-red-500/10"
              >
                Excluir coluna {colIndexToLetter(contextMenu.c)}
              </button>
            </div>
          )}
        </div>

        {/* LIVE DOCKED / OVERLAY CHART PANEL */}
        {showChartPanel && (
          <div
            className={`absolute inset-y-0 right-0 z-40 w-[min(320px,calc(100vw-24px))] shadow-2xl xl:static xl:w-80 xl:shadow-none shrink-0 border-l p-4 flex flex-col justify-between overflow-y-auto ${
              isDarkMode ? 'bg-[#1F2024] border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F9D58]">
                    Gráfico Dinâmico ao Vivo
                  </span>
                  <h3 className="text-xs font-bold leading-snug truncate">
                    {activeChart?.title || `Indicadores — ${activeSheet.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => setShowChartPanel(false)}
                  className="p-1.5 rounded hover:bg-black/10 opacity-70 hover:opacity-100 shrink-0"
                  title="Ocultar painel de gráfico"
                  aria-label="Ocultar painel de gráfico"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/5 dark:bg-white/5 mb-3 text-xs">
                {[
                  { id: 'column', label: 'Colunas', icon: <BarChart3 size={12} /> },
                  { id: 'line', label: 'Linhas', icon: <LineChart size={12} /> },
                  { id: 'pie', label: 'Rosca', icon: <PieChart size={12} /> },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSetChartType(t.id as SheetChartConfig['type'])}
                    className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1 font-medium ${
                      (activeChart?.type || 'column') === t.id
                        ? 'bg-[#0F9D58] text-white shadow-sm'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="mb-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
                  Série / Coluna de Métrica
                </label>
                <select
                  value={activeChart?.seriesCols?.[0] ?? 4}
                  onChange={(e) => handleUpdateChartMetricCol(Number(e.target.value))}
                  aria-label="Coluna de métrica do gráfico"
                  className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none ${
                    isDarkMode
                      ? 'bg-[#18191C] border-white/15 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                >
                  {Array.from({ length: 8 }).map((_, c) => {
                    if (c === 0) return null;
                    const header = activeSheet.cells[coordToCellId(0, c)]?.raw || `Coluna ${colIndexToLetter(c)}`;
                    return (
                      <option key={c} value={c}>
                        Col {colIndexToLetter(c)} — {header}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
                }`}
              >
                {chartDataPoints.length === 0 ? (
                  <div className="py-6 text-center text-xs opacity-65">
                    Adicione rótulos na coluna A e valores numéricos positivos para visualizar o gráfico.
                  </div>
                ) : (
                  <>
                {(activeChart?.type || 'column') === 'column' && (
                  <div className="space-y-2.5">
                    {(() => {
                      const maxVal = Math.max(...chartDataPoints.map((d) => d.value), 1);
                      return chartDataPoints.map((pt, idx) => {
                        const pct = Math.max(6, Math.round((pt.value / maxVal) * 100));
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate font-medium min-w-0" title={pt.label}>
                                {pt.label}
                              </span>
                              <span className="font-mono font-semibold text-[#0F9D58] shrink-0">
                                {pt.value.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0F9D58] to-[#34A853] transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {activeChart?.type === 'line' && (
                  <div>
                    <svg viewBox="0 0 240 130" className="w-full h-36 overflow-visible">
                      {(() => {
                        const maxVal = Math.max(...chartDataPoints.map((d) => d.value), 1);
                        const pts = chartDataPoints
                          .map((d, i) => {
                            const x =
                              chartDataPoints.length === 1
                                ? 120
                                : 18 + (i / (chartDataPoints.length - 1)) * 204;
                            const y = 108 - (d.value / maxVal) * 86;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(' ');
                        return (
                          <>
                            <line x1="14" y1="110" x2="226" y2="110" stroke="currentColor" strokeOpacity="0.2" />
                            <polyline
                              fill="none"
                              stroke="#0F9D58"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={pts}
                            />
                            {chartDataPoints.map((d, i) => {
                              const x =
                                chartDataPoints.length === 1
                                  ? 120
                                  : 18 + (i / (chartDataPoints.length - 1)) * 204;
                              const y = 108 - (d.value / maxVal) * 86;
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={y} r="4" fill="#0F9D58" />
                                  <text
                                    x={x}
                                    y={124}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="currentColor"
                                    opacity="0.7"
                                  >
                                    {d.label.slice(0, 7)}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {activeChart?.type === 'pie' && (
                  <div className="flex flex-col items-center gap-3">
                    {(() => {
                      const total = chartDataPoints.reduce((acc, d) => acc + d.value, 0) || 1;
                      const palette = ['#0F9D58', '#1A73E8', '#F9AB00', '#8E24AA', '#EA4335'];
                      let cumulative = 0;
                      const stops = chartDataPoints.map((d, idx) => {
                        const start = (cumulative / total) * 360;
                        cumulative += d.value;
                        const end = (cumulative / total) * 360;
                        return `${palette[idx % palette.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
                      });
                      return (
                        <>
                          <div
                            className="w-28 h-28 rounded-full relative flex items-center justify-center shadow-inner"
                            style={{ background: `conic-gradient(${stops.join(', ')})` }}
                          >
                            <div
                              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center text-[10px] font-bold ${
                                isDarkMode ? 'bg-[#18191C]' : 'bg-white'
                              }`}
                            >
                              <span>Total</span>
                              <span className="text-[#0F9D58]">100%</span>
                            </div>
                          </div>
                          <div className="w-full space-y-1 text-[11px]">
                            {chartDataPoints.map((d, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 truncate">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: palette[idx % palette.length] }}
                                  />
                                  <span className="truncate">{d.label}</span>
                                </span>
                                <span className="font-mono font-semibold">
                                  {Math.round((d.value / total) * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                  </>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold opacity-75">
                    Regras Condicionais ({activeSheet.conditionalRules?.length || 0})
                  </span>
                  <button
                    onClick={() => {
                      setNewRuleRange(selectedRangeString);
                      setShowConditionalModal(true);
                    }}
                    className="text-[11px] text-[#0F9D58] font-semibold hover:underline"
                  >
                    + Nova regra
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(activeSheet.conditionalRules || []).map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                        isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded font-bold text-[10px]"
                          style={{ backgroundColor: rule.fillColor, color: rule.textColor }}
                        >
                          {rule.range}
                        </span>
                        <span className="truncate max-w-[130px]">
                          {rule.operator === 'color_scale'
                            ? 'Escala de Cores'
                            : rule.operator === 'greater_than'
                            ? `> ${rule.value}`
                            : rule.operator === 'less_than'
                            ? `< ${rule.value}`
                            : `Contém "${rule.value}"`}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          updateActiveSheet((s) => ({
                            ...s,
                            conditionalRules: (s.conditionalRules || []).filter((r) => r.id !== rule.id),
                          }))
                        }
                        className="text-gray-400 hover:text-red-500"
                        title="Remover regra"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex flex-col gap-1.5">
              <button
                onClick={handleCopyRangeToGoogleDocs}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText size={13} />
                <span>Copiar Tabela para Google Docs</span>
              </button>
              <button
                onClick={handleCreateTaskFromCell}
                className="w-full py-1.5 px-3 rounded-lg bg-[#0F9D58]/10 hover:bg-[#0F9D58]/20 text-[#0F9D58] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckSquare size={13} />
                <span>Criar Tarefa da Célula ({activeCellId})</span>
              </button>
            </div>
          </div>
        )}

        {/* COMMENTS & ACTION ITEMS DRAWER */}
        {showCommentsDrawer && (
          <div
            className={`absolute inset-y-0 right-0 z-40 w-[min(320px,calc(100vw-24px))] shadow-2xl xl:static xl:w-80 xl:shadow-none shrink-0 border-l p-4 flex flex-col justify-between overflow-y-auto ${
              isDarkMode ? 'bg-[#1F2024] border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <MessageSquare size={15} className="text-[#0F9D58]" />
                  <span>Comentários</span>
                </h3>
                <button
                  onClick={() => setShowCommentsDrawer(false)}
                  className="p-1.5 rounded hover:bg-black/10"
                  aria-label="Fechar painel de comentários"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/5 dark:bg-white/5 mb-3 text-xs">
                {[
                  { id: 'open', label: `Abertos (${openCommentsCount})` },
                  { id: 'resolved', label: `Resolvidos (${filterSheetComments(doc.comments || [], 'resolved').length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCommentFilter(tab.id as 'open' | 'resolved')}
                    className={`flex-1 py-1 rounded-md font-medium ${
                      commentFilter === tab.id
                        ? 'bg-[#0F9D58] text-white shadow-sm'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                className={`p-3 rounded-xl border mb-4 ${
                  isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-[11px] font-semibold text-[#0F9D58] mb-1">
                  Novo comentário na célula {activeCellId}
                </div>
                <textarea
                  rows={2}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Comente ou mencione @pessoa..."
                  className={`w-full p-2 rounded border text-xs outline-none resize-none ${
                    isDarkMode
                      ? 'bg-[#25262B] border-white/15 text-white'
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      if (!newCommentText.trim()) return;
                      const cm: SheetComment = {
                        id: `cm_${Date.now()}`,
                        sheetId: activeSheet.id,
                        cellId: activeCellId,
                        author: selfName,
                        text: newCommentText.trim(),
                        createdAt: 'Agora mesmo',
                        resolved: false,
                        replies: [],
                      };
                      setDoc((prev) => ({
                        ...prev,
                        comments: [cm, ...(prev.comments || [])],
                      }));
                      setNewCommentText('');
                      setCommentFilter('open');
                      notify(`Comentário ancorado em ${activeCellId}.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
                  >
                    Comentar
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {visibleComments.length === 0 ? (
                  <div className="py-6 text-center text-xs opacity-60">
                    {commentFilter === 'resolved'
                      ? 'Nenhum comentário resolvido ainda.'
                      : 'Nenhum comentário aberto nesta planilha.'}
                  </div>
                ) : (
                  visibleComments.map((cm) => (
                    <div
                      key={cm.id}
                      onClick={() => {
                        if (cm.sheetId && doc.sheets.some((s) => s.id === cm.sheetId)) {
                          setActiveSheetId(cm.sheetId);
                        }
                        const coord = cellIdToCoord(cm.cellId);
                        if (coord) {
                          setSelectedCoord(coord);
                          setSelectionEnd(coord);
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#18191C] border-white/10 hover:border-[#0F9D58]/50'
                          : 'bg-white border-gray-200 hover:border-[#0F9D58]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs font-bold truncate">{cm.author}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#0F9D58]/15 text-[#0F9D58] font-mono text-[10px] font-bold shrink-0">
                          {cm.cellId}
                        </span>
                      </div>
                      <p className="text-xs opacity-85 leading-relaxed mb-2">{cm.text}</p>

                      {(cm.replies?.length || 0) > 0 && (
                        <div className="pl-2.5 border-l-2 border-[#0F9D58]/30 space-y-1.5 mb-2">
                          {cm.replies!.map((rep) => (
                            <div key={rep.id} className="text-[11px]">
                              <span className="font-semibold">{rep.author}: </span>
                              <span className="opacity-80">{rep.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div
                        className="flex items-center gap-1 mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={replyDrafts[cm.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [cm.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (replyDrafts[cm.id] || '').trim()) {
                              setDoc((prev) => ({
                                ...prev,
                                comments: addSheetCommentReply(
                                  prev.comments || [],
                                  cm.id,
                                  selfName,
                                  replyDrafts[cm.id] || ''
                                ),
                              }));
                              setReplyDrafts((prev) => ({ ...prev, [cm.id]: '' }));
                            }
                          }}
                          placeholder="Responder..."
                          aria-label={`Responder comentário em ${cm.cellId}`}
                          className={`flex-1 px-2 py-1 rounded border text-[11px] outline-none ${
                            isDarkMode
                              ? 'bg-[#25262B] border-white/15 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-800'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const draft = (replyDrafts[cm.id] || '').trim();
                            if (!draft) return;
                            setDoc((prev) => ({
                              ...prev,
                              comments: addSheetCommentReply(
                                prev.comments || [],
                                cm.id,
                                selfName,
                                draft
                              ),
                            }));
                            setReplyDrafts((prev) => ({ ...prev, [cm.id]: '' }));
                          }}
                          className="p-1.5 rounded bg-[#0F9D58]/15 text-[#0F9D58] hover:bg-[#0F9D58]/25"
                          title="Enviar resposta"
                          aria-label="Enviar resposta"
                        >
                          <Send size={11} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="opacity-60">{cm.createdAt}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDoc((prev) => ({
                                ...prev,
                                comments: toggleResolveSheetComment(prev.comments || [], cm.id),
                              }));
                              notify(cm.resolved ? 'Comentário reaberto.' : 'Comentário resolvido.');
                            }}
                            className="text-[#0F9D58] font-semibold hover:underline flex items-center gap-0.5"
                          >
                            {cm.resolved ? (
                              <>
                                <RotateCcw size={10} />
                                <span>Reabrir</span>
                              </>
                            ) : (
                              <span>Resolver ✓</span>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDoc((prev) => ({
                                ...prev,
                                comments: deleteSheetComment(prev.comments || [], cm.id),
                              }));
                              notify('Comentário excluído.');
                            }}
                            className="text-red-500/80 hover:text-red-500 p-0.5"
                            title="Excluir comentário"
                            aria-label="Excluir comentário"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM MULTI-SHEET TAB BAR & LIVE STATUS AGGREGATOR */}
      <div
        className={`relative h-10 px-2.5 sm:px-3 border-t flex items-center justify-between gap-2 shrink-0 text-xs ${
          isDarkMode ? 'bg-[#1F2024] border-white/10' : 'bg-[#F1F3F4] border-gray-300'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto flex-nowrap min-w-0 flex-1">
          <button
            onClick={handleAddSheetTab}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
            title="Adicionar página (+)"
            aria-label="Adicionar nova guia"
          >
            <Plus size={15} />
          </button>

          {doc.sheets.map((sheet) => {
            const isActive = sheet.id === activeSheet.id;
            return (
              <div key={sheet.id} className="flex items-center shrink-0">
                {renamingTabId === sheet.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renamingTabValue}
                    onChange={(e) => setRenamingTabValue(e.target.value)}
                    onBlur={() => {
                      if (renamingTabValue.trim()) {
                        setDoc((prev) => ({
                          ...prev,
                          sheets: prev.sheets.map((s) =>
                            s.id === sheet.id ? { ...s, name: renamingTabValue.trim() } : s
                          ),
                        }));
                      }
                      setRenamingTabId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (renamingTabValue.trim()) {
                          setDoc((prev) => ({
                            ...prev,
                            sheets: prev.sheets.map((s) =>
                              s.id === sheet.id ? { ...s, name: renamingTabValue.trim() } : s
                            ),
                          }));
                        }
                        setRenamingTabId(null);
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border border-[#0F9D58] bg-white text-gray-900 outline-none w-32"
                  />
                ) : (
                  <div
                    className={`rounded-t-lg font-medium flex items-center border-b-2 whitespace-nowrap shrink-0 ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#282A2E] text-white font-semibold'
                          : 'bg-white text-[#0F9D58] font-semibold shadow-sm'
                        : 'opacity-75 hover:opacity-100 hover:bg-black/5'
                    }`}
                    style={{
                      borderBottomColor: sheet.color || (isActive ? '#0F9D58' : 'transparent'),
                    }}
                  >
                    <button
                      onClick={() => setActiveSheetId(sheet.id)}
                      onDoubleClick={() => {
                        setRenamingTabId(sheet.id);
                        setRenamingTabValue(sheet.name);
                      }}
                      className="pl-2.5 pr-1 py-1.5 flex items-center gap-1.5"
                    >
                      {sheet.protected && <Lock size={11} className="text-amber-500" />}
                      <span>{sheet.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTabMenuId(tabMenuId === sheet.id ? null : sheet.id);
                      }}
                      className="p-1.5 rounded hover:bg-black/10"
                      title={`Opções da guia ${sheet.name}`}
                      aria-label={`Opções da guia ${sheet.name}`}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Unclipped Floating Sheet Tab Options Menu */}
        {tabMenuId && (() => {
          const targetSheet = doc.sheets.find((s) => s.id === tabMenuId);
          if (!targetSheet) return null;
          return (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`absolute bottom-11 left-3 w-52 rounded-xl shadow-2xl border py-1.5 z-50 ${
                isDarkMode
                  ? 'bg-[#28292E] border-white/15 text-white'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b border-gray-200 dark:border-white/10 truncate">
                {targetSheet.name}
              </div>
              <button
                onClick={() => {
                  setRenamingTabId(targetSheet.id);
                  setRenamingTabValue(targetSheet.name);
                  setTabMenuId(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Renomear guia
              </button>
              <button
                onClick={() => handleDuplicateSheetTab(targetSheet.id)}
                className="w-full px-3 py-1.5 text-left hover:bg-[#0F9D58]/10"
              >
                Duplicar guia
              </button>
              <button
                onClick={() => {
                  setDoc((prev) => ({
                    ...prev,
                    sheets: prev.sheets.map((s) =>
                      s.id === targetSheet.id ? { ...s, protected: !s.protected } : s
                    ),
                  }));
                  setTabMenuId(null);
                  notify(targetSheet.protected ? 'Guia desbloqueada.' : 'Guia protegida com cadeado.');
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#0F9D58]/10 flex items-center justify-between"
              >
                <span>{targetSheet.protected ? 'Desbloquear guia' : 'Proteger guia'}</span>
                <Lock size={12} />
              </button>
              <div className="px-3 py-1 text-[10px] opacity-60">Cor da guia:</div>
              <div className="px-3 pb-1.5 flex items-center gap-1.5">
                {TAB_COLORS.filter((c) => c.hex).map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      setDoc((prev) => ({
                        ...prev,
                        sheets: prev.sheets.map((s) =>
                          s.id === targetSheet.id ? { ...s, color: c.hex } : s
                        ),
                      }));
                      setTabMenuId(null);
                    }}
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                    aria-label={`Cor ${c.label}`}
                  />
                ))}
              </div>
              <div className="my-1 border-t border-gray-200 dark:border-white/10" />
              <button
                onClick={() => handleDeleteSheetTab(targetSheet.id)}
                className="w-full px-3 py-1.5 text-left text-red-500 hover:bg-red-500/10"
              >
                Excluir guia
              </button>
            </div>
          );
        })()}

        {/* Right: Live Selection Aggregator */}
        <div className="flex items-center gap-2 shrink-0">
          {selectionStats.count > 0 && (
            <div
              className={`hidden md:flex items-center gap-3 px-3 py-1 rounded-full border text-[11px] font-mono ${
                isDarkMode
                  ? 'bg-[#282A2E] border-white/10 text-white/90'
                  : 'bg-white border-gray-300 text-gray-800 shadow-2xs'
              }`}
            >
              <span className="hidden lg:inline">
                Intervalo: <strong className="text-[#0F9D58]">{selectedRangeString}</strong>
              </span>
              {selectionStats.numericCount > 0 && (
                <>
                  <span>
                    Soma:{' '}
                    <strong>
                      {selectionStats.sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span className="hidden lg:inline">
                    Média:{' '}
                    <strong>
                      {selectionStats.average.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span className="hidden xl:inline">
                    Mín: <strong>{selectionStats.min.toLocaleString('pt-BR')}</strong>
                  </span>
                  <span className="hidden xl:inline">
                    Máx: <strong>{selectionStats.max.toLocaleString('pt-BR')}</strong>
                  </span>
                </>
              )}
              <span className="hidden lg:inline">
                Contagem: <strong>{selectionStats.count}</strong>
              </span>
            </div>
          )}

          <button
            onClick={() => setShowPivotModal(true)}
            className="px-2.5 py-1 rounded-full bg-[#0F9D58]/15 text-[#0F9D58] font-semibold flex items-center gap-1 hover:bg-[#0F9D58]/25 shrink-0"
            title="Explorar Dados (Tabela Dinâmica)"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">Explorar Dados</span>
          </button>
        </div>
      </div>

      {/* MODAL: SPLIT TEXT TO COLUMNS */}
      {showSplitColumnsModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-sm max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <SplitSquareVertical size={16} className="text-[#0F9D58]" />
                <span>Dividir texto em colunas</span>
              </h2>
              <button onClick={() => setShowSplitColumnsModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Separador / Delimitador</label>
                <select
                  value={splitDelimiter}
                  onChange={(e) => setSplitDelimiter(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <option value=",">Vírgula (,)</option>
                  <option value=";">Ponto e vírgula (;)</option>
                  <option value=" ">Espaço</option>
                  <option value="-">Hífen (-)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  const rMin = Math.min(selectedCoord.r, selectionEnd.r);
                  const rMax = Math.max(selectedCoord.r, selectionEnd.r);
                  const rows: number[] = [];
                  for (let r = rMin; r <= rMax; r++) rows.push(r);
                  updateActiveSheet((sheet) => ({
                    ...sheet,
                    cells: splitTextToColumns(sheet.cells, rows, selectedCoord.c, splitDelimiter),
                  }));
                  setShowSplitColumnsModal(false);
                  notify('Texto dividido em colunas adjacentes.');
                }}
                className="px-4 py-1.5 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Dividir agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSERT HYPERLINK */}
      {showLinkModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-sm max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Inserir Link na célula {activeCellId}</h2>
              <button onClick={() => setShowLinkModal(false)} className="p-1 rounded hover:bg-black/10">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Texto de exibição</label>
                <input
                  type="text"
                  value={linkTextInput}
                  onChange={(e) => setLinkTextInput(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">URL de destino</label>
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  updateActiveSheet((sheet) => ({
                    ...sheet,
                    cells: {
                      ...sheet.cells,
                      [activeCellId]: {
                        ...(sheet.cells[activeCellId] || {}),
                        raw: linkTextInput.trim() || linkUrlInput.trim(),
                        linkUrl: linkUrlInput.trim(),
                      },
                    },
                  }));
                  setShowLinkModal(false);
                  notify(`Link adicionado em ${activeCellId}.`);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Aplicar Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PIVOT TABLE / EXPLORAR DADOS */}
      {showPivotModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-2xl max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <Table2 size={20} className="text-[#0F9D58] shrink-0" />
                <h2 className="text-base font-bold truncate">Tabela Dinâmica & Insights Automáticos</h2>
              </div>
              <button onClick={() => setShowPivotModal(false)} className="p-1.5 rounded hover:bg-black/10 shrink-0" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 opacity-75">Coluna de Agrupamento (Dimensão)</label>
                <select
                  value={pivotCategoryCol}
                  onChange={(e) => setPivotCategoryCol(Number(e.target.value))}
                  className={`w-full p-2 rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'
                  }`}
                >
                  {Array.from({ length: 8 }).map((_, c) => (
                    <option key={c} value={c}>
                      Coluna {colIndexToLetter(c)} ({activeSheet.cells[coordToCellId(0, c)]?.raw || colIndexToLetter(c)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 opacity-75">Coluna de Métrica (Valores Numéricos)</label>
                <select
                  value={pivotValueCol}
                  onChange={(e) => setPivotValueCol(Number(e.target.value))}
                  className={`w-full p-2 rounded-lg border outline-none ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300 text-gray-800'
                  }`}
                >
                  {Array.from({ length: 8 }).map((_, c) => (
                    <option key={c} value={c}>
                      Coluna {colIndexToLetter(c)} ({activeSheet.cells[coordToCellId(0, c)]?.raw || colIndexToLetter(c)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-white/10">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0F9D58] text-white">
                    <th className="p-2.5 text-left">Grupo / Categoria</th>
                    <th className="p-2.5 text-right">Contagem</th>
                    <th className="p-2.5 text-right">Soma Total</th>
                    <th className="p-2.5 text-right">Média</th>
                    <th className="p-2.5 text-right">Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-200 dark:border-white/10 hover:bg-[#0F9D58]/5"
                    >
                      <td className="p-2.5 font-medium">{row.groupKey}</td>
                      <td className="p-2.5 text-right font-mono">{row.count}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-[#0F9D58]">
                        {row.sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {row.average.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {row.max.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  const newTabId = `tab_pivot_${Date.now()}`;
                  const pivotCells: Record<string, SheetCell> = {
                    A1: { raw: 'Categoria Agrupada', style: { bold: true, fillColor: '#0F9D58', textColor: '#FFFFFF' } },
                    B1: { raw: 'Contagem', style: { bold: true, fillColor: '#0F9D58', textColor: '#FFFFFF', align: 'right' } },
                    C1: { raw: 'Soma Total', style: { bold: true, fillColor: '#0F9D58', textColor: '#FFFFFF', align: 'right' } },
                    D1: { raw: 'Média', style: { bold: true, fillColor: '#0F9D58', textColor: '#FFFFFF', align: 'right' } },
                  };
                  pivotRows.forEach((r, idx) => {
                    const rowNum = idx + 1;
                    pivotCells[coordToCellId(rowNum, 0)] = { raw: r.groupKey };
                    pivotCells[coordToCellId(rowNum, 1)] = { raw: String(r.count), style: { align: 'right' } };
                    pivotCells[coordToCellId(rowNum, 2)] = {
                      raw: String(r.sum),
                      style: { numberFormat: 'currency_brl', align: 'right', bold: true },
                    };
                    pivotCells[coordToCellId(rowNum, 3)] = {
                      raw: String(r.average),
                      style: { numberFormat: 'currency_brl', align: 'right' },
                    };
                  });
                  setDoc((prev) => ({
                    ...prev,
                    sheets: [
                      ...prev.sheets,
                      {
                        id: newTabId,
                        name: 'Tabela Dinâmica',
                        color: '#1A73E8',
                        frozenRows: 1,
                        showGridlines: true,
                        colWidths: { 0: 220, 1: 110, 2: 150, 3: 150 },
                        cells: pivotCells,
                      },
                    ],
                  }));
                  setActiveSheetId(newTabId);
                  setShowPivotModal(false);
                  notify('Tabela dinâmica inserida em uma nova guia!');
                }}
                className="px-4 py-2 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Inserir em Nova Guia
              </button>
              <button
                onClick={() => setShowPivotModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/15 text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONDITIONAL FORMATTING */}
      {showConditionalModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Nova Regra de Formatação Condicional</h2>
              <button onClick={() => setShowConditionalModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Aplicar ao intervalo</label>
                <input
                  type="text"
                  value={newRuleRange}
                  onChange={(e) => setNewRuleRange(e.target.value.toUpperCase())}
                  className={`w-full p-2 rounded-lg border font-mono ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Formatar células se...</label>
                <select
                  value={newRuleOperator}
                  onChange={(e) => setNewRuleOperator(e.target.value as ConditionalFormatRule['operator'])}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <option value="greater_than">Maior que (&gt;)</option>
                  <option value="less_than">Menor que (&lt;)</option>
                  <option value="equal_to">Igual a (=)</option>
                  <option value="text_contains">O texto contém</option>
                  <option value="color_scale">Escala de Cores (Heatmap Semafórico)</option>
                  <option value="is_not_empty">Não está vazio</option>
                </select>
              </div>

              {newRuleOperator !== 'color_scale' && (
                <div>
                  <label className="block font-semibold mb-1">Valor ou texto de referência</label>
                  <input
                    type="text"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${
                      isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Estilo de destaque</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Verde Sucesso', fill: '#DCFCE7', text: '#166534' },
                    { label: 'Amarelo Alerta', fill: '#FEF3C7', text: '#92400E' },
                    { label: 'Vermelho Crítico', fill: '#FEE2E2', text: '#991B1B' },
                    { label: 'Azul Executivo', fill: '#DBEAFE', text: '#1E40AF' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setNewRuleColor({ fill: preset.fill, text: preset.text })}
                      style={{ backgroundColor: preset.fill, color: preset.text }}
                      className={`py-1.5 px-2 rounded-lg font-bold text-[10px] border-2 ${
                        newRuleColor.fill === preset.fill ? 'border-[#0F9D58]' : 'border-transparent'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  handleAddConditionalRule();
                  setShowConditionalModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FIND & REPLACE */}
      {showFindReplaceModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Localizar e substituir</h2>
              <button onClick={() => setShowFindReplaceModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Localizar</label>
                <input
                  type="text"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Substituir por</label>
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  handleFindAndReplaceAll();
                  setShowFindReplaceModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Substituir tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DRIVE SPREADSHEETS PICKER */}
      {showTemplatesModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-xl max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={18} className="text-[#0F9D58] shrink-0" />
                <h2 className="text-base font-bold truncate">Planilhas do Google Drive</h2>
              </div>
              <button onClick={() => setShowTemplatesModal(false)} className="p-1.5 rounded hover:bg-black/10 shrink-0" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => handleCreateNewSpreadsheet()}
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#0F9D58] text-left flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <h3 className="font-bold text-sm">Planilha em Branco</h3>
                <p className="opacity-70 mt-0.5">
                  Grade limpa pronta para fórmulas, tabelas dinâmicas e importação de CSV.
                </p>
              </div>
              <span className="text-[#0F9D58] font-semibold shrink-0">Criar agora →</span>
            </button>

            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-white/10">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-65 mb-2.5">
                Suas Planilhas no Google Drive
              </h3>
              {driveSheets.length === 0 ? (
                <p className="text-xs opacity-60 py-4 text-center">
                  Nenhuma planilha salva no Drive ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {driveSheets.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleSwitchSpreadsheet(item);
                        setShowTemplatesModal(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 ${
                        item.id === doc.id
                          ? 'border-[#0F9D58] bg-[#0F9D58]/10'
                          : isDarkMode
                          ? 'border-white/10 hover:border-white/25'
                          : 'border-gray-200 hover:border-[#0F9D58]/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet size={15} className="text-[#0F9D58] shrink-0" />
                        <span className="font-medium truncate">{item.name}</span>
                      </div>
                      {item.id === doc.id && (
                        <span className="text-[10px] font-bold text-[#0F9D58] shrink-0">Aberta</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERSION HISTORY */}
      {showVersionHistoryModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <History size={18} className="text-[#0F9D58]" />
                <span>Histórico de Versões</span>
              </h2>
              <button onClick={() => setShowVersionHistoryModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="Nomear versão atual (ex: Fechamento Maio)..."
                className={`flex-1 min-w-0 p-2 rounded-lg border text-xs outline-none ${
                  isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                }`}
              />
              <button
                onClick={() => {
                  const name = newVersionName.trim() || `Versão ${(doc.versions?.length || 0) + 1}`;
                  const snap = JSON.parse(JSON.stringify(doc.sheets));
                  setDoc((prev) => ({
                    ...prev,
                    versions: [
                      {
                        id: `ver_${Date.now()}`,
                        name,
                        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        author: selfName,
                        sheetsSnapshot: snap,
                      },
                      ...(prev.versions || []),
                    ],
                  }));
                  setNewVersionName('');
                  notify(`Versão "${name}" salva.`);
                }}
                className="px-3 py-2 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold shrink-0"
              >
                Salvar
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
              {(doc.versions || []).map((v) => (
                <div
                  key={v.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                    isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold truncate">{v.name}</div>
                    <div className="text-[11px] opacity-65">
                      {v.timestamp} • {v.author}
                    </div>
                  </div>
                  {v.sheetsSnapshot && v.sheetsSnapshot.length > 0 && (
                    <button
                      onClick={() => {
                        pushHistory();
                        const clonedSheets: SheetTab[] = JSON.parse(JSON.stringify(v.sheetsSnapshot));
                        setDoc((prev) => ({ ...prev, sheets: clonedSheets }));
                        if (!clonedSheets.some((s) => s.id === activeSheetId) && clonedSheets[0]) {
                          setActiveSheetId(clonedSheets[0].id);
                        }
                        setShowVersionHistoryModal(false);
                        notify(`Versão "${v.name}" restaurada.`);
                      }}
                      className="px-2.5 py-1.5 rounded bg-[#0F9D58]/15 text-[#0F9D58] font-semibold shrink-0"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DATA VALIDATION */}
      {showValidationModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Validação de Dados ({selectedRangeString})</h2>
              <button onClick={() => setShowValidationModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Critério</label>
                <select
                  value={validationType}
                  onChange={(e) => setValidationType(e.target.value as 'checkbox' | 'dropdown')}
                  className={`w-full p-2 rounded-lg border ${
                    isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <option value="dropdown">Menu suspenso (Chips de Status)</option>
                  <option value="checkbox">Caixa de seleção (Checkbox)</option>
                </select>
              </div>
              {validationType === 'dropdown' && (
                <div>
                  <label className="block font-semibold mb-1">Opções separadas por vírgula</label>
                  <input
                    type="text"
                    value={validationOptionsInput}
                    onChange={(e) => setValidationOptionsInput(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${
                      isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                    }`}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-5">
              <button
                onClick={() => {
                  updateActiveSheet((sheet) => {
                    const nextCells = { ...sheet.cells };
                    for (const id of selectedRangeIds) {
                      if (nextCells[id]) {
                        nextCells[id] = { ...nextCells[id], validation: undefined };
                      }
                    }
                    return { ...sheet, cells: nextCells };
                  });
                  setShowValidationModal(false);
                  notify('Validação removida da seleção.');
                }}
                className="px-3 py-2 rounded-lg border border-red-500/40 text-red-500 text-xs font-semibold"
              >
                Remover validação
              </button>
              <button
                onClick={handleApplyValidation}
                className="px-4 py-2 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Salvar validação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CELL NOTE */}
      {showNoteModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-sm max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Nota na célula {activeCellId}</h2>
              <button onClick={() => setShowNoteModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <textarea
              rows={3}
              value={cellNoteText}
              onChange={(e) => setCellNoteText(e.target.value)}
              placeholder="Adicione observações de auditoria ou contexto para esta célula..."
              className={`w-full p-2.5 rounded-lg border text-xs outline-none ${
                isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-amber-50/60 border-amber-300'
              }`}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  updateActiveSheet((sheet) => ({
                    ...sheet,
                    cells: {
                      ...sheet.cells,
                      [activeCellId]: {
                        ...(sheet.cells[activeCellId] || { raw: '' }),
                        note: cellNoteText.trim() || undefined,
                      },
                    },
                  }));
                  setShowNoteModal(false);
                  notify(`Nota atualizada em ${activeCellId}.`);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
              >
                Salvar Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NAMED RANGES */}
      {showNamedRangesModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Intervalos Nomeados</h2>
              <button onClick={() => setShowNamedRangesModal(false)} className="p-1.5 rounded hover:bg-black/10" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 mb-4 text-xs">
              <input
                type="text"
                value={newNamedRangeName}
                onChange={(e) => setNewNamedRangeName(e.target.value.replace(/\s+/g, '_').toUpperCase())}
                placeholder="Ex: META_TRIMESTRAL"
                className={`flex-1 min-w-[140px] p-2 rounded-lg border font-mono ${
                  isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                }`}
              />
              <input
                type="text"
                value={newNamedRangeRef}
                onChange={(e) => setNewNamedRangeRef(e.target.value.toUpperCase())}
                className={`w-24 p-2 rounded-lg border font-mono text-center ${
                  isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                }`}
              />
              <button
                onClick={() => {
                  if (!newNamedRangeName.trim()) return;
                  setDoc((prev) => ({
                    ...prev,
                    namedRanges: [
                      ...(prev.namedRanges || []),
                      {
                        id: `nr_${Date.now()}`,
                        name: newNamedRangeName.trim(),
                        range: newNamedRangeRef.trim() || selectedRangeString,
                      },
                    ],
                  }));
                  setNewNamedRangeName('');
                  notify('Intervalo nomeado adicionado!');
                }}
                className="px-3 py-2 rounded-lg bg-[#0F9D58] text-white font-semibold shrink-0"
              >
                Adicionar
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              {(doc.namedRanges || []).map((nr) => (
                <div
                  key={nr.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                    isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      if (nr.range.includes(':')) {
                        const [a, b] = nr.range.split(':');
                        const c1 = cellIdToCoord(a);
                        const c2 = cellIdToCoord(b);
                        if (c1 && c2) {
                          setSelectedCoord(c1);
                          setSelectionEnd(c2);
                        }
                      } else {
                        const c = cellIdToCoord(nr.range);
                        if (c) {
                          setSelectedCoord(c);
                          setSelectionEnd(c);
                        }
                      }
                      setShowNamedRangesModal(false);
                    }}
                    className="flex-1 flex items-center justify-between text-left hover:opacity-80"
                    title="Ir para o intervalo"
                  >
                    <span className="font-mono font-bold text-[#0F9D58]">{nr.name}</span>
                    <span className="font-mono opacity-75">{nr.range}</span>
                  </button>
                  <button
                    onClick={() => {
                      setDoc((prev) => ({
                        ...prev,
                        namedRanges: (prev.namedRanges || []).filter((item) => item.id !== nr.id),
                      }));
                      notify(`Intervalo "${nr.name}" removido.`);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500"
                    title="Remover intervalo"
                    aria-label={`Remover intervalo ${nr.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHARE RBAC */}
      {showShareModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-md max-h-[90%] overflow-y-auto rounded-2xl shadow-2xl border p-5 sm:p-6 ${
              isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4 gap-2">
              <h2 className="text-base font-bold truncate">Compartilhar &ldquo;{doc.title}&rdquo;</h2>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 rounded hover:bg-black/10 shrink-0" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-2 mb-4 text-xs">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Adicionar pessoas por e-mail..."
                className={`flex-1 min-w-[160px] p-2 rounded-lg border outline-none ${
                  isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                }`}
              />
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'editor' | 'viewer')}
                aria-label="Papel do convidado"
                className={`p-2 rounded-lg border ${
                  isDarkMode ? 'bg-[#18191C] border-white/15 text-white' : 'bg-gray-50 border-gray-300'
                }`}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Leitor</option>
              </select>
              <button
                onClick={async () => {
                  if (!shareEmail.trim()) return;
                  await bridge.addDrivePermission(doc.id, shareEmail.trim(), shareRole);
                  const updated = await bridge.getFilePermissions(doc.id);
                  setSharePermissions(updated);
                  setShareEmail('');
                  notify(`Acesso concedido para ${shareEmail.trim()}.`);
                }}
                className="px-3.5 py-2 rounded-lg bg-[#0F9D58] text-white font-semibold shrink-0"
              >
                Convidar
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto text-xs mb-4">
              {sharePermissions.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] opacity-65 truncate">{p.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-[#0F9D58]/15 text-[#0F9D58] font-semibold">
                      {p.role === 'owner' ? 'Proprietário' : p.role === 'editor' ? 'Editor' : 'Leitor'}
                    </span>
                    {p.role !== 'owner' && (
                      <button
                        onClick={async () => {
                          await bridge.removeDrivePermission(doc.id, p.email);
                          const updated = await bridge.getFilePermissions(doc.id);
                          setSharePermissions(updated);
                          notify(`Acesso removido para ${p.email}.`);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-red-500"
                        title="Remover acesso"
                        aria-label={`Remover acesso de ${p.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* General Access */}
            <div
              className={`p-3 rounded-xl border mb-4 text-xs ${
                isDarkMode ? 'bg-[#18191C] border-white/10' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-65 mb-2">
                Acesso Geral
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      generalAccess === 'anyone_with_link'
                        ? 'bg-[#0F9D58]/15 text-[#0F9D58]'
                        : 'bg-gray-500/15 text-gray-500'
                    }`}
                  >
                    {generalAccess === 'anyone_with_link' ? <Globe size={15} /> : <Lock size={15} />}
                  </div>
                  <select
                    value={generalAccess}
                    onChange={async (e) => {
                      const next = e.target.value as 'restricted' | 'anyone_with_link';
                      setGeneralAccess(next);
                      await bridge.updateDriveItemMeta(doc.id, {
                        generalAccess: next,
                        generalRole: generalAccessRole,
                      });
                      notify(
                        next === 'anyone_with_link'
                          ? 'Qualquer pessoa com o link pode acessar.'
                          : 'Acesso alterado para Restrito.'
                      );
                    }}
                    aria-label="Nível de acesso geral"
                    className={`px-2 py-1 rounded-lg border font-semibold outline-none ${
                      isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="restricted">Restrito</option>
                    <option value="anyone_with_link">Qualquer pessoa com o link</option>
                  </select>
                </div>

                {generalAccess === 'anyone_with_link' && (
                  <select
                    value={generalAccessRole}
                    onChange={async (e) => {
                      const nextRole = e.target.value as 'viewer' | 'commenter' | 'editor';
                      setGeneralAccessRole(nextRole);
                      await bridge.updateDriveItemMeta(doc.id, {
                        generalAccess: 'anyone_with_link',
                        generalRole: nextRole,
                      });
                      const roleLabel =
                        nextRole === 'editor' ? 'Editor' : nextRole === 'commenter' ? 'Comentador' : 'Leitor';
                      notify(`Link público atualizado para ${roleLabel}.`);
                    }}
                    aria-label="Permissão do acesso geral"
                    className={`px-2 py-1 rounded-lg border outline-none ${
                      isDarkMode ? 'bg-[#202124] border-white/15 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="viewer">Leitor</option>
                    <option value="commenter">Comentador</option>
                    <option value="editor">Editor</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-white/10">
              <button
                onClick={async () => {
                  const link = await bridge.getDriveShareLink(doc.id);
                  if (navigator.clipboard) await navigator.clipboard.writeText(link);
                  notify('Link de compartilhamento copiado!');
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/15 text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copiar link</span>
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#0F9D58] text-white text-xs font-semibold"
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
