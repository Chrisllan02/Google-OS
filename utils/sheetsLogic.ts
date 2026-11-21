export type NumberFormatType =
  | 'automatic'
  | 'currency_brl'
  | 'currency_usd'
  | 'percent'
  | 'number'
  | 'integer'
  | 'date';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: 'overflow' | 'wrap' | 'clip';
  textColor?: string;
  fillColor?: string;
  fontSize?: number;
  fontFamily?: string;
  borders?: boolean;
  numberFormat?: NumberFormatType;
  decimals?: number;
  colSpan?: number;
  rowSpan?: number;
  mergedInto?: string; // e.g., 'A1' if this cell is covered by a merge starting at A1
}

export interface CellValidation {
  type: 'checkbox' | 'dropdown';
  options?: string[]; // for dropdown
}

export interface CellSmartChip {
  type: 'person' | 'file' | 'date' | 'rating';
  label: string;
  meta?: string;
}

export interface SheetCell {
  raw: string;
  style?: CellStyle;
  validation?: CellValidation;
  smartChip?: CellSmartChip;
  linkUrl?: string;
  locked?: boolean;
  note?: string;
  commentId?: string;
}

export interface ConditionalFormatRule {
  id: string;
  range: string; // e.g. 'A2:F20'
  operator:
    | 'greater_than'
    | 'less_than'
    | 'equal_to'
    | 'text_contains'
    | 'is_empty'
    | 'is_not_empty'
    | 'color_scale';
  value?: string;
  fillColor: string;
  textColor: string;
  bold?: boolean;
}

export interface SheetChartConfig {
  id: string;
  title: string;
  type: 'column' | 'line' | 'pie' | 'area';
  dataRange: string; // e.g. 'A1:E6'
  labelCol?: number;
  seriesCols?: number[];
  x?: number;
  y?: number;
}

export interface NamedRange {
  id: string;
  name: string;
  range: string;
}

export interface SheetTab {
  id: string;
  name: string;
  color?: string;
  protected?: boolean;
  frozenRows?: number;
  frozenCols?: number;
  showGridlines?: boolean;
  alternatingColors?: {
    enabled: boolean;
    headerBg: string;
    evenBg: string;
    oddBg: string;
  };
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  hiddenRows?: number[];
  hiddenCols?: number[];
  cells: Record<string, SheetCell>;
  conditionalRules?: ConditionalFormatRule[];
  charts?: SheetChartConfig[];
  filterEnabled?: boolean;
  filterCol?: number | null;
  filterValue?: string;
}

export interface SheetComment {
  id: string;
  sheetId: string;
  cellId: string;
  author: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
  replies?: Array<{ id: string; author: string; text: string; createdAt: string }>;
}

export interface SpreadsheetDocument {
  id: string;
  title: string;
  starred?: boolean;
  updatedAt: string;
  sheets: SheetTab[];
  namedRanges?: NamedRange[];
  comments?: SheetComment[];
  versions?: Array<{
    id: string;
    name: string;
    timestamp: string;
    author: string;
    sheetsSnapshot: SheetTab[];
  }>;
}

export function colIndexToLetter(col: number): string {
  let n = col;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function letterToColIndex(letters: string): number {
  const clean = letters.trim().toUpperCase();
  let col = 0;
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function coordToCellId(r: number, c: number): string {
  return `${colIndexToLetter(c)}${r + 1}`;
}

export function cellIdToCoord(cellId: string): { r: number; c: number } | null {
  const match = cellId.trim().toUpperCase().match(/^\$?([A-Z]+)\$?(\d+)$/);
  if (!match) return null;
  const c = letterToColIndex(match[1]);
  const r = parseInt(match[2], 10) - 1;
  if (r < 0 || c < 0 || Number.isNaN(r) || Number.isNaN(c)) return null;
  return { r, c };
}

export function expandRange(rangeStr: string, namedRanges: NamedRange[] = []): string[] {
  const trimmed = rangeStr.trim();
  const named = namedRanges.find((nr) => nr.name.toUpperCase() === trimmed.toUpperCase());
  const target = named ? named.range.trim().toUpperCase() : trimmed.toUpperCase();

  if (!target.includes(':')) {
    const single = cellIdToCoord(target);
    return single ? [coordToCellId(single.r, single.c)] : [];
  }

  const [startPart, endPart] = target.split(':');
  const start = cellIdToCoord(startPart);
  const end = cellIdToCoord(endPart);
  if (!start || !end) return [];

  const rMin = Math.min(start.r, end.r);
  const rMax = Math.max(start.r, end.r);
  const cMin = Math.min(start.c, end.c);
  const cMax = Math.max(start.c, end.c);

  const ids: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      ids.push(coordToCellId(r, c));
    }
  }
  return ids;
}

export function parseNumericValue(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;

  const cleaned = s
    .replace(/^R\$\s*/i, '')
    .replace(/^US\$\s*/i, '')
    .replace(/%$/, '')
    .trim();

  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
  }
  if (/^-?\d+,\d+$/.test(cleaned)) {
    const n = Number(cleaned.replace(',', '.'));
    return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
  }
  const n = Number(cleaned.replace(/,/g, ''));
  if (Number.isFinite(n)) {
    return s.endsWith('%') ? n / 100 : n;
  }
  return null;
}

function splitTopLevelArgs(argsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (!inQuotes && ch === '(') {
      depth++;
      current += ch;
    } else if (!inQuotes && ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (!inQuotes && depth === 0 && (ch === ',' || ch === ';')) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) {
    result.push(current.trim());
  }
  return result;
}

export interface EvaluatedCellResult {
  value: string | number;
  display: string;
  isFormula: boolean;
  error?: string;
  sparkline?: number[];
}

function resolveSheetAndRange(
  rawRef: string,
  defaultCells: Record<string, SheetCell>,
  allSheets: SheetTab[] = []
): { targetCells: Record<string, SheetCell>; cleanRef: string } {
  const trimmed = rawRef.trim();
  const bangIdx = trimmed.indexOf('!');
  if (bangIdx === -1) {
    return { targetCells: defaultCells, cleanRef: trimmed };
  }
  const sheetNameRaw = trimmed.slice(0, bangIdx).replace(/^'|'$/g, '').trim().toLowerCase();
  const cleanRef = trimmed.slice(bangIdx + 1).trim();
  const matchedSheet = allSheets.find((s) => s.name.trim().toLowerCase() === sheetNameRaw);
  return {
    targetCells: matchedSheet ? matchedSheet.cells : defaultCells,
    cleanRef,
  };
}

export function evaluateCell(
  cellId: string,
  cells: Record<string, SheetCell>,
  namedRanges: NamedRange[] = [],
  visited: Set<string> = new Set(),
  allSheets: SheetTab[] = []
): EvaluatedCellResult {
  const normalizedId = cellId.toUpperCase();
  if (visited.has(normalizedId)) {
    return { value: '#REF!', display: '#REF!', isFormula: true, error: 'Referência circular detectada' };
  }

  const cell = cells[normalizedId];
  const raw = (cell?.raw ?? '').trim();

  if (!raw.startsWith('=')) {
    const num = parseNumericValue(raw);
    const val = num !== null && /^-?\d+([.,]\d+)?%?$/.test(raw) ? num : raw;
    return {
      value: val,
      display: formatCellValue(val, cell?.style?.numberFormat, cell?.style?.decimals, raw),
      isFormula: false,
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(normalizedId);

  const expr = raw.slice(1).trim();
  try {
    const evaluated = evaluateExpression(expr, cells, namedRanges, nextVisited, allSheets);
    if (typeof evaluated === 'object' && evaluated !== null && 'sparkline' in evaluated) {
      return {
        value: '[SPARKLINE]',
        display: '',
        isFormula: true,
        sparkline: evaluated.sparkline,
      };
    }
    if (typeof evaluated === 'string' && evaluated.startsWith('#')) {
      return { value: evaluated, display: evaluated, isFormula: true, error: evaluated };
    }
    const scalarVal: string | number =
      typeof evaluated === 'number' ? evaluated : String(evaluated);
    return {
      value: scalarVal,
      display: formatCellValue(scalarVal, cell?.style?.numberFormat, cell?.style?.decimals),
      isFormula: true,
    };
  } catch {
    return { value: '#ERROR!', display: '#ERROR!', isFormula: true, error: 'Erro na fórmula' };
  }
}

function collectNumericValuesFromArgs(
  args: string[],
  cells: Record<string, SheetCell>,
  namedRanges: NamedRange[],
  visited: Set<string>,
  allSheets: SheetTab[] = []
): number[] {
  const nums: number[] = [];
  for (const arg of args) {
    const { targetCells, cleanRef } = resolveSheetAndRange(arg, cells, allSheets);
    const expanded = expandRange(cleanRef, namedRanges);
    if (
      expanded.length > 0 &&
      (cleanRef.includes(':') ||
        cellIdToCoord(cleanRef) ||
        namedRanges.some((n) => n.name.toUpperCase() === cleanRef.toUpperCase()))
    ) {
      for (const id of expanded) {
        const res = evaluateCell(id, targetCells, namedRanges, visited, allSheets);
        const n = typeof res.value === 'number' ? res.value : parseNumericValue(res.value);
        if (n !== null) nums.push(n);
      }
    } else {
      const val = evaluateExpression(arg.trim(), cells, namedRanges, visited, allSheets);
      const n = typeof val === 'number' ? val : parseNumericValue(val);
      if (n !== null) nums.push(n);
    }
  }
  return nums;
}

function evaluateCondition(left: string | number, op: string, right: string | number): boolean {
  const lNum = typeof left === 'number' ? left : parseNumericValue(left);
  const rNum = typeof right === 'number' ? right : parseNumericValue(right);

  if (lNum !== null && rNum !== null) {
    switch (op) {
      case '>=': return lNum >= rNum;
      case '<=': return lNum <= rNum;
      case '<>':
      case '!=': return lNum !== rNum;
      case '>': return lNum > rNum;
      case '<': return lNum < rNum;
      case '=':
      case '==': return lNum === rNum;
    }
  }

  const lStr = String(left).toLowerCase();
  const rStr = String(right).toLowerCase();
  switch (op) {
    case '<>':
    case '!=': return lStr !== rStr;
    case '=':
    case '==': return lStr === rStr;
    case '>': return lStr > rStr;
    case '<': return lStr < rStr;
    case '>=': return lStr >= rStr;
    case '<=': return lStr <= rStr;
    default: return false;
  }
}

function matchesCriterion(cellVal: string | number, criterionRaw: string): boolean {
  const cleanCrit = criterionRaw.replace(/^"|"$/g, '').trim();
  const opMatch = cleanCrit.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);
  if (opMatch) {
    const op = opMatch[1];
    const rhs = opMatch[2].trim();
    return evaluateCondition(cellVal, op, rhs);
  }
  return evaluateCondition(cellVal, '=', cleanCrit);
}

function evaluateLogicalClause(
  clause: string,
  cells: Record<string, SheetCell>,
  namedRanges: NamedRange[],
  visited: Set<string>,
  allSheets: SheetTab[] = []
): boolean {
  const condMatch = clause.match(/^(.+?)(>=|<=|<>|!=|>|<|=)(.+)$/);
  if (condMatch) {
    const left = evaluateExpression(condMatch[1], cells, namedRanges, visited, allSheets);
    const right = evaluateExpression(condMatch[3], cells, namedRanges, visited, allSheets);
    if (typeof left !== 'object' && typeof right !== 'object') {
      return evaluateCondition(left, condMatch[2], right);
    }
    return false;
  }
  const v = evaluateExpression(clause, cells, namedRanges, visited, allSheets);
  return Boolean(v && v !== 0 && String(v).toUpperCase() !== 'FALSE');
}

function evaluateExpression(
  expr: string,
  cells: Record<string, SheetCell>,
  namedRanges: NamedRange[],
  visited: Set<string>,
  allSheets: SheetTab[] = []
): string | number | { sparkline: number[] } {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  const directNum = parseNumericValue(trimmed);
  if (directNum !== null && /^-?\d+([.,]\d+)?%?$/.test(trimmed)) {
    return directNum;
  }

  // Cross-sheet direct cell reference e.g. 'Metas & OKRs'!C2 or Metas!B2
  if (trimmed.includes('!') && !trimmed.includes('(')) {
    const { targetCells, cleanRef } = resolveSheetAndRange(trimmed, cells, allSheets);
    const c = cellIdToCoord(cleanRef);
    if (c) {
      const refEval = evaluateCell(coordToCellId(c.r, c.c), targetCells, namedRanges, visited, allSheets);
      return refEval.value === '' ? 0 : refEval.value;
    }
  }

  const fnMatch = trimmed.match(/^([A-Za-zÀ-ÿ0-9_.]+)\(([\s\S]*)\)$/);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const inside = fnMatch[2];
    const args = splitTopLevelArgs(inside);

    switch (fnName) {
      case 'SUM':
      case 'SOMA': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return Number(nums.reduce((acc, v) => acc + v, 0).toFixed(8));
      }
      case 'AVERAGE':
      case 'MEDIA':
      case 'MÉDIA': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        if (nums.length === 0) return '#DIV/0!';
        return Number((nums.reduce((acc, v) => acc + v, 0) / nums.length).toFixed(8));
      }
      case 'MIN':
      case 'MINIMO':
      case 'MÍNIMO': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return nums.length ? Math.min(...nums) : 0;
      }
      case 'MAX':
      case 'MAXIMO':
      case 'MÁXIMO': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return nums.length ? Math.max(...nums) : 0;
      }
      case 'MEDIAN':
      case 'MED': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets).sort((a, b) => a - b);
        if (nums.length === 0) return 0;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }
      case 'STDEV':
      case 'DESVPAD': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        if (nums.length < 2) return 0;
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / (nums.length - 1);
        return Number(Math.sqrt(variance).toFixed(4));
      }
      case 'COUNT':
      case 'CONT.NUM':
      case 'CONT.NÚM': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return nums.length;
      }
      case 'COUNTA':
      case 'CONT.VALORES': {
        let count = 0;
        for (const arg of args) {
          const { targetCells, cleanRef } = resolveSheetAndRange(arg, cells, allSheets);
          const ids = expandRange(cleanRef, namedRanges);
          if (ids.length > 0) {
            for (const id of ids) {
              const r = evaluateCell(id, targetCells, namedRanges, visited, allSheets);
              if (String(r.value).trim() !== '') count++;
            }
          } else {
            const v = evaluateExpression(arg, cells, namedRanges, visited, allSheets);
            if (String(v).trim() !== '') count++;
          }
        }
        return count;
      }
      case 'PRODUCT':
      case 'MULT': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return nums.length ? nums.reduce((acc, v) => acc * v, 1) : 0;
      }
      case 'ROUND':
      case 'ARRED': {
        const val = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        const dec = Number(evaluateExpression(args[1] || '0', cells, namedRanges, visited, allSheets));
        if (Number.isNaN(val)) return '#VALUE!';
        const factor = Math.pow(10, Number.isNaN(dec) ? 0 : dec);
        return Math.round(val * factor) / factor;
      }
      case 'ABS': {
        const val = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        return Number.isNaN(val) ? '#VALUE!' : Math.abs(val);
      }
      case 'SQRT':
      case 'RAIZ': {
        const val = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        return Number.isNaN(val) || val < 0 ? '#NUM!' : Number(Math.sqrt(val).toFixed(8));
      }
      case 'POWER':
      case 'POTENCIA':
      case 'POTÊNCIA': {
        const base = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        const exp = Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets));
        return Number(Math.pow(base, exp).toFixed(8));
      }
      case 'PMT':
      case 'PGTO': {
        const rate = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        const nper = Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets));
        const pv = Number(evaluateExpression(args[2] || '0', cells, namedRanges, visited, allSheets));
        if (nper <= 0) return '#NUM!';
        if (rate === 0) return Number((-pv / nper).toFixed(2));
        const pmt = (rate * pv) / (1 - Math.pow(1 + rate, -nper));
        return Number((-pmt).toFixed(2));
      }
      case 'NPV':
      case 'VPL': {
        const rate = Number(evaluateExpression(args[0] || '0', cells, namedRanges, visited, allSheets));
        const flows = collectNumericValuesFromArgs(args.slice(1), cells, namedRanges, visited, allSheets);
        const npv = flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i + 1), 0);
        return Number(npv.toFixed(2));
      }
      case 'AND':
      case 'E': {
        const allTrue = args.every((a) => evaluateLogicalClause(a, cells, namedRanges, visited, allSheets));
        return allTrue ? 'TRUE' : 'FALSE';
      }
      case 'OR':
      case 'OU': {
        const anyTrue = args.some((a) => evaluateLogicalClause(a, cells, namedRanges, visited, allSheets));
        return anyTrue ? 'TRUE' : 'FALSE';
      }
      case 'IF':
      case 'SE': {
        const condExpr = args[0] || '';
        const trueVal = args[1] !== undefined ? args[1] : 'TRUE';
        const falseVal = args[2] !== undefined ? args[2] : 'FALSE';
        const isTrue = evaluateLogicalClause(condExpr, cells, namedRanges, visited, allSheets);
        return evaluateExpression(isTrue ? trueVal : falseVal, cells, namedRanges, visited, allSheets);
      }
      case 'IFERROR':
      case 'SEERRO': {
        const primary = evaluateExpression(args[0] || '', cells, namedRanges, visited, allSheets);
        if (typeof primary === 'string' && primary.startsWith('#')) {
          return evaluateExpression(args[1] || '""', cells, namedRanges, visited, allSheets);
        }
        return primary;
      }
      case 'SUMIF':
      case 'SOMASE': {
        const { targetCells, cleanRef } = resolveSheetAndRange(args[0] || '', cells, allSheets);
        const rangeIds = expandRange(cleanRef, namedRanges);
        const criterion = String(evaluateExpression(args[1] || '""', cells, namedRanges, visited, allSheets));
        const sumResolved = args[2]
          ? resolveSheetAndRange(args[2], cells, allSheets)
          : { targetCells, cleanRef };
        const sumRangeIds = args[2] ? expandRange(sumResolved.cleanRef, namedRanges) : rangeIds;
        let total = 0;
        for (let i = 0; i < rangeIds.length; i++) {
          const checkVal = evaluateCell(rangeIds[i], targetCells, namedRanges, visited, allSheets).value;
          if (matchesCriterion(checkVal, criterion)) {
            const targetId = sumRangeIds[i] || rangeIds[i];
            const addVal = evaluateCell(targetId, sumResolved.targetCells, namedRanges, visited, allSheets).value;
            const n = typeof addVal === 'number' ? addVal : parseNumericValue(addVal);
            if (n !== null) total += n;
          }
        }
        return Number(total.toFixed(8));
      }
      case 'SUMIFS':
      case 'SOMASES': {
        const sumRangeIds = expandRange(args[0] || '', namedRanges);
        let total = 0;
        for (let i = 0; i < sumRangeIds.length; i++) {
          let allMatch = true;
          for (let p = 1; p + 1 < args.length; p += 2) {
            const critRange = expandRange(args[p] || '', namedRanges);
            const crit = String(evaluateExpression(args[p + 1] || '""', cells, namedRanges, visited, allSheets));
            const checkVal = evaluateCell(critRange[i] || sumRangeIds[i], cells, namedRanges, visited, allSheets).value;
            if (!matchesCriterion(checkVal, crit)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            const v = evaluateCell(sumRangeIds[i], cells, namedRanges, visited, allSheets).value;
            const n = typeof v === 'number' ? v : parseNumericValue(v);
            if (n !== null) total += n;
          }
        }
        return Number(total.toFixed(8));
      }
      case 'COUNTIF':
      case 'CONT.SE': {
        const { targetCells, cleanRef } = resolveSheetAndRange(args[0] || '', cells, allSheets);
        const rangeIds = expandRange(cleanRef, namedRanges);
        const criterion = String(evaluateExpression(args[1] || '""', cells, namedRanges, visited, allSheets));
        let count = 0;
        for (const id of rangeIds) {
          const checkVal = evaluateCell(id, targetCells, namedRanges, visited, allSheets).value;
          if (matchesCriterion(checkVal, criterion)) count++;
        }
        return count;
      }
      case 'COUNTIFS':
      case 'CONT.SES': {
        const firstRange = expandRange(args[0] || '', namedRanges);
        let count = 0;
        for (let i = 0; i < firstRange.length; i++) {
          let allMatch = true;
          for (let p = 0; p + 1 < args.length; p += 2) {
            const critRange = expandRange(args[p] || '', namedRanges);
            const crit = String(evaluateExpression(args[p + 1] || '""', cells, namedRanges, visited, allSheets));
            const checkVal = evaluateCell(critRange[i] || firstRange[i], cells, namedRanges, visited, allSheets).value;
            if (!matchesCriterion(checkVal, crit)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) count++;
        }
        return count;
      }
      case 'VLOOKUP':
      case 'PROCV': {
        const searchKey = evaluateExpression(args[0] || '', cells, namedRanges, visited, allSheets);
        const { targetCells, cleanRef } = resolveSheetAndRange(args[1] || '', cells, allSheets);
        const rangeStr = cleanRef.toUpperCase();
        const colIdx = Number(evaluateExpression(args[2] || '1', cells, namedRanges, visited, allSheets));
        if (!rangeStr.includes(':') || colIdx < 1) return '#N/A';
        const [startPart, endPart] = rangeStr.split(':');
        const start = cellIdToCoord(startPart);
        const end = cellIdToCoord(endPart);
        if (!start || !end) return '#N/A';
        const rMin = Math.min(start.r, end.r);
        const rMax = Math.max(start.r, end.r);
        const cMin = Math.min(start.c, end.c);
        const targetCol = cMin + colIdx - 1;
        for (let r = rMin; r <= rMax; r++) {
          const keyCell = evaluateCell(coordToCellId(r, cMin), targetCells, namedRanges, visited, allSheets).value;
          if (String(keyCell).toLowerCase() === String(searchKey).toLowerCase()) {
            return evaluateCell(coordToCellId(r, targetCol), targetCells, namedRanges, visited, allSheets).value;
          }
        }
        return '#N/A';
      }
      case 'XLOOKUP':
      case 'PROCX': {
        const searchKey = evaluateExpression(args[0] || '', cells, namedRanges, visited, allSheets);
        const lookupResolved = resolveSheetAndRange(args[1] || '', cells, allSheets);
        const returnResolved = resolveSheetAndRange(args[2] || '', cells, allSheets);
        const lookupIds = expandRange(lookupResolved.cleanRef, namedRanges);
        const returnIds = expandRange(returnResolved.cleanRef, namedRanges);
        const fallback = args[3] ? evaluateExpression(args[3], cells, namedRanges, visited, allSheets) : '#N/A';
        for (let i = 0; i < lookupIds.length; i++) {
          const val = evaluateCell(lookupIds[i], lookupResolved.targetCells, namedRanges, visited, allSheets).value;
          if (String(val).toLowerCase() === String(searchKey).toLowerCase()) {
            const targetId = returnIds[i];
            return targetId
              ? evaluateCell(targetId, returnResolved.targetCells, namedRanges, visited, allSheets).value
              : '#N/A';
          }
        }
        return fallback;
      }
      case 'INDEX':
      case 'INDICE':
      case 'ÍNDICE': {
        const { targetCells, cleanRef } = resolveSheetAndRange(args[0] || '', cells, allSheets);
        const rangeStr = cleanRef.toUpperCase();
        const rowNum = Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets));
        const colNum = Number(evaluateExpression(args[2] || '1', cells, namedRanges, visited, allSheets));
        if (!rangeStr.includes(':')) {
          const single = cellIdToCoord(rangeStr);
          return single
            ? evaluateCell(coordToCellId(single.r, single.c), targetCells, namedRanges, visited, allSheets).value
            : '#REF!';
        }
        const [startPart, endPart] = rangeStr.split(':');
        const start = cellIdToCoord(startPart);
        const end = cellIdToCoord(endPart);
        if (!start || !end) return '#REF!';
        const rMin = Math.min(start.r, end.r);
        const cMin = Math.min(start.c, end.c);
        const targetR = rMin + Math.max(0, rowNum - 1);
        const targetC = cMin + Math.max(0, colNum - 1);
        return evaluateCell(coordToCellId(targetR, targetC), targetCells, namedRanges, visited, allSheets).value;
      }
      case 'MATCH':
      case 'CORRESP': {
        const searchKey = evaluateExpression(args[0] || '', cells, namedRanges, visited, allSheets);
        const { targetCells, cleanRef } = resolveSheetAndRange(args[1] || '', cells, allSheets);
        const lookupIds = expandRange(cleanRef, namedRanges);
        for (let i = 0; i < lookupIds.length; i++) {
          const val = evaluateCell(lookupIds[i], targetCells, namedRanges, visited, allSheets).value;
          if (String(val).toLowerCase() === String(searchKey).toLowerCase()) {
            return i + 1;
          }
        }
        return '#N/A';
      }
      case 'CONCAT':
      case 'CONCATENATE':
      case 'CONCATENAR': {
        return args
          .map((a) => {
            const v = evaluateExpression(a, cells, namedRanges, visited, allSheets);
            return typeof v === 'object' ? '' : String(v);
          })
          .join('');
      }
      case 'LEFT':
      case 'ESQUERDA': {
        const text = String(evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets));
        const n = Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets));
        return text.slice(0, Math.max(0, n));
      }
      case 'RIGHT':
      case 'DIREITA': {
        const text = String(evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets));
        const n = Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets));
        return n <= 0 ? '' : text.slice(-n);
      }
      case 'MID':
      case 'EXT.TEXTO': {
        const text = String(evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets));
        const startIdx = Math.max(1, Number(evaluateExpression(args[1] || '1', cells, namedRanges, visited, allSheets))) - 1;
        const len = Math.max(0, Number(evaluateExpression(args[2] || '1', cells, namedRanges, visited, allSheets)));
        return text.slice(startIdx, startIdx + len);
      }
      case 'PROPER':
      case 'PRI.MAIUSCULA':
      case 'PRI.MAIÚSCULA': {
        const text = String(evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets));
        return text
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
      case 'UPPER':
      case 'MAIUSCULA':
      case 'MAIÚSCULA': {
        const v = evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets);
        return String(v).toUpperCase();
      }
      case 'LOWER':
      case 'MINUSCULA':
      case 'MINÚSCULA': {
        const v = evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets);
        return String(v).toLowerCase();
      }
      case 'TRIM':
      case 'ARRUMAR': {
        const v = evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets);
        return String(v).trim().replace(/\s+/g, ' ');
      }
      case 'LEN':
      case 'NUM.CARACT':
      case 'NÚM.CARACT': {
        const v = evaluateExpression(args[0] || '""', cells, namedRanges, visited, allSheets);
        return String(v).length;
      }
      case 'TODAY':
      case 'HOJE': {
        return new Date().toLocaleDateString('pt-BR');
      }
      case 'SPARKLINE': {
        const nums = collectNumericValuesFromArgs(args, cells, namedRanges, visited, allSheets);
        return { sparkline: nums };
      }
      default:
        return '#NAME?';
    }
  }

  const singleCoord = cellIdToCoord(trimmed);
  if (singleCoord) {
    const refId = coordToCellId(singleCoord.r, singleCoord.c);
    const refEval = evaluateCell(refId, cells, namedRanges, visited, allSheets);
    return refEval.value === '' ? 0 : refEval.value;
  }

  let arithmeticStr = trimmed.replace(/([A-Za-zÀ-ÿ0-9_.]+)\(([^()]*)\)/g, (full) => {
    const res = evaluateExpression(full, cells, namedRanges, visited, allSheets);
    if (typeof res === 'string' && res.startsWith('#')) throw new Error(res);
    return typeof res === 'number' ? String(res) : '0';
  });

  arithmeticStr = arithmeticStr.replace(/\$?[A-Za-z]+\$?\d+/g, (match) => {
    const c = cellIdToCoord(match);
    if (!c) return match;
    const refRes = evaluateCell(coordToCellId(c.r, c.c), cells, namedRanges, visited, allSheets);
    if (typeof refRes.value === 'string' && refRes.value.startsWith('#')) {
      throw new Error(refRes.value);
    }
    const n = typeof refRes.value === 'number' ? refRes.value : parseNumericValue(refRes.value);
    return String(n ?? 0);
  });

  if (/^[0-9+\-*/().\s%]+$/.test(arithmeticStr)) {
    const result = evaluateSafeArithmetic(arithmeticStr);
    if (result === null) return '#ERROR!';
    if (!Number.isFinite(result)) return '#DIV/0!';
    return Number(result.toFixed(8));
  }

  return '#ERROR!';
}

export function evaluateSafeArithmetic(expression: string): number | null {
  const normalized = expression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  const tokens: string[] = [];
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
        if (normalized[i] === '.') dotCount++;
        if (dotCount > 1) return null;
        numStr += normalized[i++];
      }
      if (numStr === '.') return null;
      tokens.push(numStr);
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    return null;
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseUnary();
      if (right === null) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };

  const parseUnary = (): number | null => {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      const val = parseUnary();
      return val === null ? null : -val;
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    const tok = peek();
    if (tok === undefined) return null;
    if (tok === '(') {
      consume();
      const inner = parseExpr();
      if (inner === null || consume() !== ')') return null;
      return inner;
    }
    consume();
    const num = Number(tok);
    return Number.isNaN(num) ? null : num;
  };

  const value = parseExpr();
  if (value === null || pos !== tokens.length) return null;
  return value;
}

export function formatCellValue(
  value: string | number,
  format: NumberFormatType = 'automatic',
  decimals?: number,
  rawOriginal?: string
): string {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'string' && value.startsWith('#')) return value;

  const num = typeof value === 'number' ? value : parseNumericValue(value);
  if (num === null) return String(value);

  if (format === 'automatic') {
    if (rawOriginal && rawOriginal.trim().endsWith('%')) {
      const pctDecimals = decimals ?? 1;
      return `${(num * 100).toLocaleString('pt-BR', {
        minimumFractionDigits: pctDecimals,
        maximumFractionDigits: pctDecimals,
      })}%`;
    }
    if (rawOriginal && /^R\$\s*/i.test(rawOriginal.trim())) {
      return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
    }
    if (decimals !== undefined) {
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return Number.isInteger(num)
      ? num.toLocaleString('pt-BR')
      : num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  switch (format) {
    case 'currency_brl':
      return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
    case 'currency_usd':
      return num.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
    case 'percent': {
      const d = decimals ?? 2;
      return `${(num * 100).toLocaleString('pt-BR', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })}%`;
    }
    case 'integer':
      return Math.round(num).toLocaleString('pt-BR');
    case 'number': {
      const d = decimals ?? 2;
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
    }
    default:
      return String(value);
  }
}

export interface SelectionStats {
  count: number;
  numericCount: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export function computeSelectionStats(
  cellIds: string[],
  cells: Record<string, SheetCell>,
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = []
): SelectionStats {
  let count = 0;
  const nums: number[] = [];

  for (const id of cellIds) {
    const evaluated = evaluateCell(id, cells, namedRanges, new Set(), allSheets);
    if (String(evaluated.value).trim() !== '') {
      count++;
      const n = typeof evaluated.value === 'number' ? evaluated.value : parseNumericValue(evaluated.value);
      if (n !== null) {
        nums.push(n);
      }
    }
  }

  const numericCount = nums.length;
  const sum = numericCount > 0 ? nums.reduce((a, b) => a + b, 0) : 0;
  const average = numericCount > 0 ? sum / numericCount : 0;
  const min = numericCount > 0 ? Math.min(...nums) : 0;
  const max = numericCount > 0 ? Math.max(...nums) : 0;

  return { count, numericCount, sum, average, min, max };
}

export function shiftFormulaReferences(
  formula: string,
  rowDelta: number,
  colDelta: number,
  minRow = 0,
  minCol = 0
): string {
  if (!formula.startsWith('=')) return formula;
  return formula.replace(/(\$?)([A-Za-z]+)(\$?)(\d+)/g, (full, colDollar, colLetters, rowDollar, rowDigits) => {
    const c = letterToColIndex(colLetters);
    const r = parseInt(rowDigits, 10) - 1;
    if (r < 0 || c < 0) return full;

    const nextC = !colDollar && c >= minCol ? Math.max(0, c + colDelta) : c;
    const nextR = !rowDollar && r >= minRow ? Math.max(0, r + rowDelta) : r;
    return `${colDollar}${colIndexToLetter(nextC)}${rowDollar}${nextR + 1}`;
  });
}

export function insertRowInCells(
  cells: Record<string, SheetCell>,
  insertAtRow: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  (Object.entries(cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
    const coord = cellIdToCoord(id);
    if (!coord) return;
    const shiftedRaw = cell.raw.startsWith('=')
      ? shiftFormulaReferences(cell.raw, 1, 0, insertAtRow, 0)
      : cell.raw;
    const targetRow = coord.r >= insertAtRow ? coord.r + 1 : coord.r;
    next[coordToCellId(targetRow, coord.c)] = { ...cell, raw: shiftedRaw };
  });
  return next;
}

export function deleteRowInCells(
  cells: Record<string, SheetCell>,
  deleteAtRow: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  (Object.entries(cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
    const coord = cellIdToCoord(id);
    if (!coord || coord.r === deleteAtRow) return;
    const shiftedRaw = cell.raw.startsWith('=')
      ? shiftFormulaReferences(cell.raw, -1, 0, deleteAtRow + 1, 0)
      : cell.raw;
    const targetRow = coord.r > deleteAtRow ? coord.r - 1 : coord.r;
    next[coordToCellId(targetRow, coord.c)] = { ...cell, raw: shiftedRaw };
  });
  return next;
}

export function insertColInCells(
  cells: Record<string, SheetCell>,
  insertAtCol: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  (Object.entries(cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
    const coord = cellIdToCoord(id);
    if (!coord) return;
    const shiftedRaw = cell.raw.startsWith('=')
      ? shiftFormulaReferences(cell.raw, 0, 1, 0, insertAtCol)
      : cell.raw;
    const targetCol = coord.c >= insertAtCol ? coord.c + 1 : coord.c;
    next[coordToCellId(coord.r, targetCol)] = { ...cell, raw: shiftedRaw };
  });
  return next;
}

export function deleteColInCells(
  cells: Record<string, SheetCell>,
  deleteAtCol: number
): Record<string, SheetCell> {
  const next: Record<string, SheetCell> = {};
  (Object.entries(cells) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
    const coord = cellIdToCoord(id);
    if (!coord || coord.c === deleteAtCol) return;
    const shiftedRaw = cell.raw.startsWith('=')
      ? shiftFormulaReferences(cell.raw, 0, -1, 0, deleteAtCol + 1)
      : cell.raw;
    const targetCol = coord.c > deleteAtCol ? coord.c - 1 : coord.c;
    next[coordToCellId(coord.r, targetCol)] = { ...cell, raw: shiftedRaw };
  });
  return next;
}

export function mergeCellsInSelection(
  cells: Record<string, SheetCell>,
  startCoord: { r: number; c: number },
  endCoord: { r: number; c: number }
): Record<string, SheetCell> {
  const rMin = Math.min(startCoord.r, endCoord.r);
  const rMax = Math.max(startCoord.r, endCoord.r);
  const cMin = Math.min(startCoord.c, endCoord.c);
  const cMax = Math.max(startCoord.c, endCoord.c);
  if (rMin === rMax && cMin === cMax) return cells;

  const next = { ...cells };
  const anchorId = coordToCellId(rMin, cMin);
  const anchorCell = next[anchorId] || { raw: '' };

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const id = coordToCellId(r, c);
      if (r === rMin && c === cMin) {
        next[id] = {
          ...anchorCell,
          style: {
            ...(anchorCell.style || {}),
            rowSpan: rMax - rMin + 1,
            colSpan: cMax - cMin + 1,
            mergedInto: undefined,
          },
        };
      } else {
        const existing = next[id] || { raw: '' };
        next[id] = {
          ...existing,
          style: {
            ...(existing.style || {}),
            mergedInto: anchorId,
            rowSpan: undefined,
            colSpan: undefined,
          },
        };
      }
    }
  }
  return next;
}

export function unmergeCellsInSelection(
  cells: Record<string, SheetCell>,
  startCoord: { r: number; c: number },
  endCoord: { r: number; c: number }
): Record<string, SheetCell> {
  const rMin = Math.min(startCoord.r, endCoord.r);
  const rMax = Math.max(startCoord.r, endCoord.r);
  const cMin = Math.min(startCoord.c, endCoord.c);
  const cMax = Math.max(startCoord.c, endCoord.c);

  const next = { ...cells };
  const anchorsToClear = new Set<string>();

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const id = coordToCellId(r, c);
      const st = next[id]?.style;
      if (st?.rowSpan || st?.colSpan) anchorsToClear.add(id);
      if (st?.mergedInto) anchorsToClear.add(st.mergedInto);
    }
  }

  (Object.entries(next) as Array<[string, SheetCell]>).forEach(([id, cell]) => {
    if (anchorsToClear.has(id) || (cell.style?.mergedInto && anchorsToClear.has(cell.style.mergedInto))) {
      next[id] = {
        ...cell,
        style: {
          ...(cell.style || {}),
          rowSpan: undefined,
          colSpan: undefined,
          mergedInto: undefined,
        },
      };
    }
  });
  return next;
}

export function autoFillRange(
  cells: Record<string, SheetCell>,
  sourceStart: { r: number; c: number },
  sourceEnd: { r: number; c: number },
  targetEnd: { r: number; c: number }
): Record<string, SheetCell> {
  const next = { ...cells };
  const rMin = Math.min(sourceStart.r, sourceEnd.r);
  const rMax = Math.max(sourceStart.r, sourceEnd.r);
  const cMin = Math.min(sourceStart.c, sourceEnd.c);
  const cMax = Math.max(sourceStart.c, sourceEnd.c);

  // Downward fill
  if (targetEnd.r > rMax) {
    for (let c = cMin; c <= cMax; c++) {
      const srcRows: SheetCell[] = [];
      for (let r = rMin; r <= rMax; r++) {
        srcRows.push(next[coordToCellId(r, c)] || { raw: '' });
      }
      // Check numeric step if 2+ numbers
      const firstNum = parseNumericValue(srcRows[0]?.raw);
      const secondNum = srcRows.length > 1 ? parseNumericValue(srcRows[1]?.raw) : null;
      const step =
        firstNum !== null && secondNum !== null && !srcRows[0].raw.startsWith('=')
          ? secondNum - firstNum
          : null;

      for (let r = rMax + 1; r <= targetEnd.r; r++) {
        const offset = r - rMin;
        const templateCell = srcRows[offset % srcRows.length];
        const templateOriginRow = rMin + (offset % srcRows.length);
        let nextRaw = templateCell.raw;

        if (templateCell.raw.startsWith('=')) {
          nextRaw = shiftFormulaReferences(templateCell.raw, r - templateOriginRow, 0);
        } else if (step !== null && firstNum !== null) {
          nextRaw = String(firstNum + step * offset);
        }

        next[coordToCellId(r, c)] = {
          ...templateCell,
          raw: nextRaw,
        };
      }
    }
  }

  // Rightward fill
  if (targetEnd.c > cMax) {
    for (let r = rMin; r <= rMax; r++) {
      const srcCols: SheetCell[] = [];
      for (let c = cMin; c <= cMax; c++) {
        srcCols.push(next[coordToCellId(r, c)] || { raw: '' });
      }
      for (let c = cMax + 1; c <= targetEnd.c; c++) {
        const offset = c - cMin;
        const templateCell = srcCols[offset % srcCols.length];
        const templateOriginCol = cMin + (offset % srcCols.length);
        const nextRaw = templateCell.raw.startsWith('=')
          ? shiftFormulaReferences(templateCell.raw, 0, c - templateOriginCol)
          : templateCell.raw;
        next[coordToCellId(r, c)] = {
          ...templateCell,
          raw: nextRaw,
        };
      }
    }
  }

  return next;
}

export function splitTextToColumns(
  cells: Record<string, SheetCell>,
  rowIndices: number[],
  sourceCol: number,
  delimiter = ','
): Record<string, SheetCell> {
  const next = { ...cells };
  for (const r of rowIndices) {
    const srcId = coordToCellId(r, sourceCol);
    const raw = next[srcId]?.raw || '';
    if (!raw || raw.startsWith('=')) continue;
    const parts = raw.split(delimiter).map((p) => p.trim());
    parts.forEach((part, idx) => {
      const targetId = coordToCellId(r, sourceCol + idx);
      next[targetId] = {
        ...(next[targetId] || {}),
        raw: part,
      };
    });
  }
  return next;
}

export function sortSheetRows(
  cells: Record<string, SheetCell>,
  colIndex: number,
  direction: 'asc' | 'desc',
  headerRows = 1,
  maxRow = 50,
  maxCol = 20,
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = []
): Record<string, SheetCell> {
  const nextCells: Record<string, SheetCell> = {};

  for (let r = 0; r < headerRows; r++) {
    for (let c = 0; c < maxCol; c++) {
      const id = coordToCellId(r, c);
      if (cells[id]) nextCells[id] = { ...cells[id] };
    }
  }

  const rowsData: Array<{ originalRow: number; rowCells: Record<number, SheetCell>; sortVal: string | number }> = [];
  for (let r = headerRows; r < maxRow; r++) {
    const rowCells: Record<number, SheetCell> = {};
    let hasContent = false;
    for (let c = 0; c < maxCol; c++) {
      const id = coordToCellId(r, c);
      if (cells[id] && (cells[id].raw.trim() !== '' || cells[id].style || cells[id].validation)) {
        rowCells[c] = { ...cells[id] };
        if (cells[id].raw.trim() !== '') hasContent = true;
      }
    }
    if (hasContent) {
      const targetId = coordToCellId(r, colIndex);
      const evaluated = evaluateCell(targetId, cells, namedRanges, new Set(), allSheets).value;
      const num = typeof evaluated === 'number' ? evaluated : parseNumericValue(evaluated);
      rowsData.push({
        originalRow: r,
        rowCells,
        sortVal: num !== null ? num : String(evaluated).toLowerCase(),
      });
    }
  }

  rowsData.sort((a, b) => {
    if (typeof a.sortVal === 'number' && typeof b.sortVal === 'number') {
      return direction === 'asc' ? a.sortVal - b.sortVal : b.sortVal - a.sortVal;
    }
    const sA = String(a.sortVal);
    const sB = String(b.sortVal);
    return direction === 'asc' ? sA.localeCompare(sB, 'pt-BR') : sB.localeCompare(sA, 'pt-BR');
  });

  rowsData.forEach((item, idx) => {
    const targetRow = headerRows + idx;
    Object.entries(item.rowCells).forEach(([colStr, cellObj]) => {
      const c = Number(colStr);
      nextCells[coordToCellId(targetRow, c)] = cellObj;
    });
  });

  return nextCells;
}

export function removeDuplicateRows(
  cells: Record<string, SheetCell>,
  headerRows = 1,
  maxRow = 60,
  maxCol = 20
): { cells: Record<string, SheetCell>; removedCount: number } {
  const nextCells: Record<string, SheetCell> = {};

  for (let r = 0; r < headerRows; r++) {
    for (let c = 0; c < maxCol; c++) {
      const id = coordToCellId(r, c);
      if (cells[id]) nextCells[id] = { ...cells[id] };
    }
  }

  const seenSignatures = new Set<string>();
  let targetRow = headerRows;
  let removedCount = 0;

  for (let r = headerRows; r < maxRow; r++) {
    const rowValues: string[] = [];
    let hasAny = false;
    for (let c = 0; c < maxCol; c++) {
      const raw = (cells[coordToCellId(r, c)]?.raw ?? '').trim();
      if (raw !== '') hasAny = true;
      rowValues.push(raw.toLowerCase());
    }
    if (!hasAny) continue;

    const sig = rowValues.join('||');
    if (seenSignatures.has(sig)) {
      removedCount++;
      continue;
    }
    seenSignatures.add(sig);

    for (let c = 0; c < maxCol; c++) {
      const orig = cells[coordToCellId(r, c)];
      if (orig) {
        nextCells[coordToCellId(targetRow, c)] = { ...orig };
      }
    }
    targetRow++;
  }

  return { cells: nextCells, removedCount };
}

export function evaluateConditionalFormatting(
  cellId: string,
  cells: Record<string, SheetCell>,
  rules: ConditionalFormatRule[] = [],
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = []
): { fillColor?: string; textColor?: string; bold?: boolean } | null {
  if (!rules.length) return null;
  const evalRes = evaluateCell(cellId, cells, namedRanges, new Set(), allSheets);
  const val = evalRes.value;
  const strVal = String(val).trim();
  const numVal = typeof val === 'number' ? val : parseNumericValue(val);

  for (const rule of rules) {
    const rangeIds = expandRange(rule.range);
    if (!rangeIds.includes(cellId.toUpperCase())) continue;

    if (rule.operator === 'color_scale' && numVal !== null) {
      const numsInRange = rangeIds
        .map((id) => {
          const v = evaluateCell(id, cells, namedRanges, new Set(), allSheets).value;
          return typeof v === 'number' ? v : parseNumericValue(v);
        })
        .filter((n): n is number => n !== null);
      if (numsInRange.length > 0) {
        const min = Math.min(...numsInRange);
        const max = Math.max(...numsInRange);
        const ratio = max > min ? (numVal - min) / (max - min) : 0.5;
        if (ratio >= 0.66) return { fillColor: '#BBF7D0', textColor: '#14532D', bold: true };
        if (ratio >= 0.33) return { fillColor: '#FEF08A', textColor: '#713F12', bold: false };
        return { fillColor: '#FECACA', textColor: '#7F1D1D', bold: false };
      }
    }

    const targetNum = parseNumericValue(rule.value ?? '');
    const targetStr = (rule.value ?? '').trim().toLowerCase();

    let matched = false;
    switch (rule.operator) {
      case 'greater_than':
        matched = numVal !== null && targetNum !== null && numVal > targetNum;
        break;
      case 'less_than':
        matched = numVal !== null && targetNum !== null && numVal < targetNum;
        break;
      case 'equal_to':
        matched =
          (numVal !== null && targetNum !== null && numVal === targetNum) ||
          strVal.toLowerCase() === targetStr;
        break;
      case 'text_contains':
        matched = targetStr.length > 0 && strVal.toLowerCase().includes(targetStr);
        break;
      case 'is_empty':
        matched = strVal === '';
        break;
      case 'is_not_empty':
        matched = strVal !== '';
        break;
    }

    if (matched) {
      return {
        fillColor: rule.fillColor,
        textColor: rule.textColor,
        bold: rule.bold,
      };
    }
  }

  return null;
}

export function exportCellsToDelimited(
  cells: Record<string, SheetCell>,
  delimiter = ',',
  maxRow = 40,
  maxCol = 15,
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = []
): string {
  let lastNonEmptyRow = 0;
  let lastNonEmptyCol = 0;

  for (let r = 0; r < maxRow; r++) {
    for (let c = 0; c < maxCol; c++) {
      const id = coordToCellId(r, c);
      if (cells[id]?.raw?.trim()) {
        if (r > lastNonEmptyRow) lastNonEmptyRow = r;
        if (c > lastNonEmptyCol) lastNonEmptyCol = c;
      }
    }
  }

  const lines: string[] = [];
  for (let r = 0; r <= lastNonEmptyRow; r++) {
    const rowVals: string[] = [];
    for (let c = 0; c <= lastNonEmptyCol; c++) {
      const id = coordToCellId(r, c);
      const disp = evaluateCell(id, cells, namedRanges, new Set(), allSheets).display;
      if (disp.includes(delimiter) || disp.includes('"') || disp.includes('\n')) {
        rowVals.push(`"${disp.replace(/"/g, '""')}"`);
      } else {
        rowVals.push(disp);
      }
    }
    lines.push(rowVals.join(delimiter));
  }
  return lines.join('\n');
}

export function parseCsvToCells(csvContent: string): Record<string, SheetCell> {
  const cells: Record<string, SheetCell> = {};
  const lines = csvContent.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, r) => {
    if (!line.trim() && r === lines.length - 1) return;
    const cols: string[] = [];
    let curr = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && (ch === ',' || ch === ';')) {
        cols.push(curr);
        curr = '';
      } else {
        curr += ch;
      }
    }
    cols.push(curr);

    cols.forEach((val, c) => {
      const trimmed = val.trim();
      if (trimmed !== '') {
        cells[coordToCellId(r, c)] = {
          raw: trimmed,
          style: r === 0 ? { bold: true, fillColor: '#E8F0FE', textColor: '#1A73E8' } : undefined,
        };
      }
    });
  });
  return cells;
}

export interface PivotSummaryRow {
  groupKey: string;
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export function computePivotTable(
  cells: Record<string, SheetCell>,
  categoryCol: number,
  valueCol: number,
  headerRows = 1,
  maxRow = 50,
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = []
): PivotSummaryRow[] {
  const groups = new Map<string, number[]>();

  for (let r = headerRows; r < maxRow; r++) {
    const catEval = evaluateCell(coordToCellId(r, categoryCol), cells, namedRanges, new Set(), allSheets).display.trim();
    if (!catEval || /^total\b/i.test(catEval)) continue;
    const valRaw = evaluateCell(coordToCellId(r, valueCol), cells, namedRanges, new Set(), allSheets).value;
    const num = typeof valRaw === 'number' ? valRaw : parseNumericValue(valRaw);
    if (!groups.has(catEval)) {
      groups.set(catEval, []);
    }
    if (num !== null) {
      groups.get(catEval)!.push(num);
    }
  }

  const rows: PivotSummaryRow[] = [];
  groups.forEach((nums, groupKey) => {
    const count = nums.length;
    const sum = count > 0 ? nums.reduce((a, b) => a + b, 0) : 0;
    const average = count > 0 ? sum / count : 0;
    const min = count > 0 ? Math.min(...nums) : 0;
    const max = count > 0 ? Math.max(...nums) : 0;
    rows.push({ groupKey, count, sum, average, min, max });
  });

  return rows.sort((a, b) => b.sum - a.sum);
}

export function transposeRangeInCells(
  cells: Record<string, SheetCell>,
  startCoord: { r: number; c: number },
  endCoord: { r: number; c: number }
): Record<string, SheetCell> {
  const rMin = Math.min(startCoord.r, endCoord.r);
  const rMax = Math.max(startCoord.r, endCoord.r);
  const cMin = Math.min(startCoord.c, endCoord.c);
  const cMax = Math.max(startCoord.c, endCoord.c);

  const next = { ...cells };
  const snapshot: Record<string, SheetCell> = {};

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const id = coordToCellId(r, c);
      if (next[id]) {
        snapshot[`${r - rMin}_${c - cMin}`] = JSON.parse(JSON.stringify(next[id]));
        delete next[id];
      }
    }
  }

  const rowCount = rMax - rMin + 1;
  const colCount = cMax - cMin + 1;

  for (let dr = 0; dr < rowCount; dr++) {
    for (let dc = 0; dc < colCount; dc++) {
      const cell = snapshot[`${dr}_${dc}`];
      if (cell) {
        const targetR = rMin + dc;
        const targetC = cMin + dr;
        next[coordToCellId(targetR, targetC)] = cell;
      }
    }
  }

  return next;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

export function extractChartDataPoints(
  cells: Record<string, SheetCell>,
  chartConfig?: SheetChartConfig,
  namedRanges: NamedRange[] = [],
  allSheets: SheetTab[] = [],
  maxScanRows = 30,
  maxScanCols = 10
): ChartDataPoint[] {
  let startRow = 1;
  let endRow = maxScanRows - 1;
  let labelCol = chartConfig?.labelCol ?? 0;
  let valueCol: number | null =
    chartConfig?.seriesCols && chartConfig.seriesCols.length > 0
      ? chartConfig.seriesCols[0]
      : null;

  if (chartConfig?.dataRange && chartConfig.dataRange.includes(':')) {
    const [a, b] = chartConfig.dataRange.split(':');
    const c1 = cellIdToCoord(a);
    const c2 = cellIdToCoord(b);
    if (c1 && c2) {
      startRow = Math.min(c1.r, c2.r);
      endRow = Math.max(c1.r, c2.r);
      if (chartConfig.labelCol === undefined) {
        labelCol = Math.min(c1.c, c2.c);
      }
      if (valueCol === null) {
        const rangeEndCol = Math.max(c1.c, c2.c);
        // Check if rangeEndCol has positive numeric values; if not, scan inward
        for (let c = rangeEndCol; c > labelCol; c--) {
          let positiveCount = 0;
          for (let r = startRow; r <= endRow; r++) {
            const v = evaluateCell(coordToCellId(r, c), cells, namedRanges, new Set(), allSheets).value;
            const num = typeof v === 'number' ? v : parseNumericValue(v);
            if (num !== null && num > 0) positiveCount++;
          }
          if (positiveCount > 0) {
            valueCol = c;
            break;
          }
        }
      }
    }
  }

  if (valueCol === null) {
    // Auto-detect first numeric metric column after labelCol with positive values
    for (let c = labelCol + 1; c < maxScanCols; c++) {
      let positiveCount = 0;
      for (let r = 1; r < maxScanRows; r++) {
        const label = evaluateCell(coordToCellId(r, labelCol), cells, namedRanges, new Set(), allSheets).display.trim();
        if (!label || /^total\b/i.test(label)) continue;
        const v = evaluateCell(coordToCellId(r, c), cells, namedRanges, new Set(), allSheets).value;
        const num = typeof v === 'number' ? v : parseNumericValue(v);
        if (num !== null && num > 0) positiveCount++;
      }
      if (positiveCount > 0) {
        valueCol = c;
        break;
      }
    }
  }

  if (valueCol === null) return [];

  const secondaryCol =
    chartConfig?.seriesCols && chartConfig.seriesCols.length > 1
      ? chartConfig.seriesCols[1]
      : valueCol !== 1 && labelCol !== 1
      ? 1
      : undefined;

  const points: ChartDataPoint[] = [];
  for (let r = startRow; r <= endRow; r++) {
    const label = evaluateCell(coordToCellId(r, labelCol), cells, namedRanges, new Set(), allSheets).display.trim();
    if (!label || /^total\b/i.test(label)) continue;
    const valRaw = evaluateCell(coordToCellId(r, valueCol), cells, namedRanges, new Set(), allSheets).value;
    const num = typeof valRaw === 'number' ? valRaw : parseNumericValue(valRaw);
    if (num === null || num <= 0) continue;

    let secNum: number | undefined;
    if (secondaryCol !== undefined) {
      const secRaw = evaluateCell(coordToCellId(r, secondaryCol), cells, namedRanges, new Set(), allSheets).value;
      const parsedSec = typeof secRaw === 'number' ? secRaw : parseNumericValue(secRaw);
      if (parsedSec !== null) secNum = parsedSec;
    }

    points.push({
      label,
      value: num,
      secondaryValue: secNum,
    });
    if (points.length >= 12) break;
  }

  return points;
}

export function filterSheetComments(
  comments: SheetComment[],
  filter: 'open' | 'resolved' | 'all' = 'open'
): SheetComment[] {
  if (filter === 'all') return comments;
  if (filter === 'resolved') return comments.filter((c) => Boolean(c.resolved));
  return comments.filter((c) => !c.resolved);
}

export function toggleResolveSheetComment(
  comments: SheetComment[],
  commentId: string
): SheetComment[] {
  return comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c));
}

export function addSheetCommentReply(
  comments: SheetComment[],
  commentId: string,
  author: string,
  text: string,
  createdAt = 'Agora mesmo'
): SheetComment[] {
  const trimmed = text.trim();
  if (!trimmed) return comments;
  return comments.map((c) =>
    c.id === commentId
      ? {
          ...c,
          replies: [
            ...(c.replies || []),
            { id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, author, text: trimmed, createdAt },
          ],
        }
      : c
  );
}

export function deleteSheetComment(
  comments: SheetComment[],
  commentId: string
): SheetComment[] {
  return comments.filter((c) => c.id !== commentId);
}


