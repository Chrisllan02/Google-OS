import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coordToCellId,
  cellIdToCoord,
  expandRange,
  evaluateCell,
  computeSelectionStats,
  sortSheetRows,
  removeDuplicateRows,
  evaluateConditionalFormatting,
  parseCsvToCells,
  exportCellsToDelimited,
  computePivotTable,
  insertRowInCells,
  deleteRowInCells,
  mergeCellsInSelection,
  unmergeCellsInSelection,
  autoFillRange,
  splitTextToColumns,
  transposeRangeInCells,
  evaluateSafeArithmetic,
  extractChartDataPoints,
  filterSheetComments,
  toggleResolveSheetComment,
  addSheetCommentReply,
  deleteSheetComment,
  SheetCell,
  SheetTab,
  SheetComment,
} from './sheetsLogic';

test('coordToCellId, cellIdToCoord, and expandRange handle cell coordinates and 2D ranges accurately', () => {
  assert.equal(coordToCellId(0, 0), 'A1');
  assert.equal(coordToCellId(11, 2), 'C12');
  assert.deepEqual(cellIdToCoord('$B$5'), { r: 4, c: 1 });
  assert.deepEqual(expandRange('A1:B2'), ['A1', 'B1', 'A2', 'B2']);
});

test('evaluateCell supports SUM/SOMA, AVERAGE/MÉDIA, IF/SE, VLOOKUP/PROCV, XLOOKUP/PROCX, INDEX/MATCH, SUMIF/SOMASE, arithmetic, and cycle detection', () => {
  const cells: Record<string, SheetCell> = {
    A1: { raw: 'Produto A' },
    B1: { raw: '1200' },
    A2: { raw: 'Produto B' },
    B2: { raw: '1800' },
    A3: { raw: 'Produto C' },
    B3: { raw: '3000' },
    C1: { raw: '=SOMA(B1:B3)' },
    C2: { raw: '=MÉDIA(B1:B3)' },
    C3: { raw: '=SE(B3>2500; "Meta Batida"; "Abaixo")' },
    C4: { raw: '=PROCV("Produto B"; A1:B3; 2)' },
    C5: { raw: '=SOMASE(B1:B3; ">1500")' },
    C6: { raw: '=B1*1.15+50' },
    C7: { raw: '=PROCX("Produto C"; A1:A3; B1:B3)' },
    C8: { raw: '=ÍNDICE(A1:B3; 2; 2)' },
    C9: { raw: '=CORRESP("Produto B"; A1:A3)' },
    D1: { raw: '=D2' },
    D2: { raw: '=D1' },
  };

  assert.equal(evaluateCell('C1', cells).value, 6000);
  assert.equal(evaluateCell('C2', cells).value, 2000);
  assert.equal(evaluateCell('C3', cells).value, 'Meta Batida');
  assert.equal(evaluateCell('C4', cells).value, 1800);
  assert.equal(evaluateCell('C5', cells).value, 4800);
  assert.equal(evaluateCell('C6', cells).value, 1430);
  assert.equal(evaluateCell('C7', cells).value, 3000);
  assert.equal(evaluateCell('C8', cells).value, 1800);
  assert.equal(evaluateCell('C9', cells).value, 2);
  assert.equal(evaluateCell('D1', cells).value, '#REF!');
});

test('computeSelectionStats, sortSheetRows, removeDuplicateRows, and computePivotTable work accurately', () => {
  const cells: Record<string, SheetCell> = {
    A1: { raw: 'Canal' },
    B1: { raw: 'Receita' },
    A2: { raw: 'Orgânico' },
    B2: { raw: '400' },
    A3: { raw: 'Pago' },
    B3: { raw: '900' },
    A4: { raw: 'Orgânico' },
    B4: { raw: '400' },
    A5: { raw: 'Orgânico' },
    B5: { raw: '600' },
  };

  const stats = computeSelectionStats(['B2', 'B3', 'B5'], cells);
  assert.equal(stats.sum, 1900);
  assert.equal(stats.numericCount, 3);

  const dedup = removeDuplicateRows(cells, 1, 10, 5);
  assert.equal(dedup.removedCount, 1);

  const sorted = sortSheetRows(dedup.cells, 1, 'desc', 1, 10, 5);
  assert.equal(sorted['B2']?.raw, '900');
  assert.equal(sorted['B3']?.raw, '600');
  assert.equal(sorted['B4']?.raw, '400');

  const pivot = computePivotTable(dedup.cells, 0, 1, 1, 10);
  const organico = pivot.find((p) => p.groupKey === 'Orgânico');
  assert.ok(organico);
  assert.equal(organico.sum, 1000);
  assert.equal(organico.count, 2);
});

test('insertRowInCells, deleteRowInCells, merge/unmerge, autoFillRange, and splitTextToColumns work accurately', () => {
  const base: Record<string, SheetCell> = {
    A1: { raw: '10' },
    A2: { raw: '20' },
    B1: { raw: '=A1*2' },
    C1: { raw: 'Marketing, Growth, SEO' },
  };

  // AutoFill numeric series A1:A2 -> A4 and formula B1 -> B3
  const filledNums = autoFillRange(base, { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 3, c: 0 });
  assert.equal(filledNums['A3']?.raw, '30');
  assert.equal(filledNums['A4']?.raw, '40');

  const filledFormula = autoFillRange(filledNums, { r: 0, c: 1 }, { r: 0, c: 1 }, { r: 2, c: 1 });
  assert.equal(filledFormula['B2']?.raw, '=A2*2');
  assert.equal(filledFormula['B3']?.raw, '=A3*2');

  // Insert row at index 1 shifts row 1 -> row 2 and updates formula references
  const afterInsert = insertRowInCells(filledFormula, 1);
  assert.equal(afterInsert['A3']?.raw, '20');
  const afterDelete = deleteRowInCells(afterInsert, 1);
  assert.equal(afterDelete['A2']?.raw, '20');

  // Merge A1:B1 and unmerge
  const merged = mergeCellsInSelection(afterDelete, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.equal(merged['A1']?.style?.colSpan, 2);
  assert.equal(merged['B1']?.style?.mergedInto, 'A1');
  const unmerged = unmergeCellsInSelection(merged, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.equal(unmerged['A1']?.style?.colSpan, undefined);
  assert.equal(unmerged['B1']?.style?.mergedInto, undefined);

  // Split text to columns on C1
  const split = splitTextToColumns(unmerged, [0], 2, ',');
  assert.equal(split['C1']?.raw, 'Marketing');
  assert.equal(split['D1']?.raw, 'Growth');
  assert.equal(split['E1']?.raw, 'SEO');
});

test('evaluateConditionalFormatting and CSV round-trip work cleanly', () => {
  const csv = 'Mês,Receita\nJan,1500\nFev,800';
  const parsed = parseCsvToCells(csv);
  assert.equal(parsed['A1']?.raw, 'Mês');
  assert.equal(parsed['B2']?.raw, '1500');

  const cond = evaluateConditionalFormatting('B2', parsed, [
    {
      id: 'r1',
      range: 'B2:B10',
      operator: 'greater_than',
      value: '1000',
      fillColor: '#DCFCE7',
      textColor: '#166534',
      bold: true,
    },
  ]);
  assert.equal(cond?.fillColor, '#DCFCE7');

  const exported = exportCellsToDelimited(parsed, ',');
  assert.ok(exported.includes('Jan,1.500'));
});

test('cross-sheet references, SOMASES/CONT.SES, PGTO/MED/DESVPAD, and transposeRangeInCells work accurately', () => {
  const okrTab: SheetTab = {
    id: 'tab-okr',
    name: 'Metas & OKRs',
    color: '#0D9488',
    frozenRows: 1,
    frozenCols: 0,
    colWidths: {},
    rowHeights: {},
    cells: {
      C2: { raw: '120000' },
      C3: { raw: '80000' },
      C4: { raw: '50000' },
    },
    conditionalRules: [],
  };

  const mainCells: Record<string, SheetCell> = {
    A1: { raw: 'Vendas' },
    B1: { raw: 'Sul' },
    C1: { raw: '1000' },
    A2: { raw: 'Vendas' },
    B2: { raw: 'Norte' },
    C2: { raw: '2000' },
    A3: { raw: 'Vendas' },
    B3: { raw: 'Sul' },
    C3: { raw: '3000' },
    D1: { raw: "='Metas & OKRs'!C2" },
    D2: { raw: "=SOMA('Metas & OKRs'!C2:C4)" },
    D3: { raw: '=SOMASES(C1:C3; A1:A3; "Vendas"; B1:B3; "Sul")' },
    D4: { raw: '=CONT.SES(A1:A3; "Vendas"; B1:B3; "Sul")' },
    D5: { raw: '=MED(C1:C3)' },
    D6: { raw: '=DESVPAD(C1:C3)' },
    D7: { raw: '=PGTO(0.01; 12; 10000)' },
  };

  assert.equal(evaluateCell('D1', mainCells, [], new Set(), [okrTab]).value, 120000);
  assert.equal(evaluateCell('D2', mainCells, [], new Set(), [okrTab]).value, 250000);
  assert.equal(evaluateCell('D3', mainCells, [], new Set(), [okrTab]).value, 4000);
  assert.equal(evaluateCell('D4', mainCells, [], new Set(), [okrTab]).value, 2);
  assert.equal(evaluateCell('D5', mainCells, [], new Set(), [okrTab]).value, 2000);
  assert.equal(evaluateCell('D6', mainCells, [], new Set(), [okrTab]).value, 1000);
  const pmtVal = Number(evaluateCell('D7', mainCells, [], new Set(), [okrTab]).value);
  assert.ok(pmtVal < -880 && pmtVal > -890);

  const transposed = transposeRangeInCells(
    {
      A1: { raw: 'Jan' },
      B1: { raw: 'Fev' },
      A2: { raw: '100' },
      B2: { raw: '200' },
    },
    { r: 0, c: 0 },
    { r: 1, c: 1 }
  );
  assert.equal(transposed['A1']?.raw, 'Jan');
  assert.equal(transposed['B1']?.raw, '100');
  assert.equal(transposed['A2']?.raw, 'Fev');
  assert.equal(transposed['B2']?.raw, '200');
});

test('evaluateSafeArithmetic handles precedence, parentheses, unary ops, percentages, division by zero, and rejects injection', () => {
  assert.equal(evaluateSafeArithmetic('2 + 3 * 4'), 14);
  assert.equal(evaluateSafeArithmetic('(2 + 3) * 4'), 20);
  assert.equal(evaluateSafeArithmetic('-5 + 12 / 3'), -1);
  assert.equal(evaluateSafeArithmetic('200 * 15%'), 30);
  assert.equal(evaluateSafeArithmetic('10 / 0'), Infinity);
  assert.equal(evaluateCell('A1', { A1: { raw: '=10/0' } }).value, '#DIV/0!');
  assert.equal(evaluateSafeArithmetic('process.exit(1)'), null);
  assert.equal(evaluateSafeArithmetic('1 + alert(1)'), null);
  assert.equal(evaluateSafeArithmetic('(1 + 2'), null);
});

test('extractChartDataPoints respects config, auto-detects metrics on custom sheets, skips totals, and evaluates cross-sheet formulas', () => {
  const refTab: SheetTab = {
    id: 'tab_ref',
    name: 'Metas',
    cells: { B2: { raw: '500' } },
  };
  const budgetCells: Record<string, SheetCell> = {
    A1: { raw: 'Área' },
    B1: { raw: 'Orçado' },
    C1: { raw: 'Realizado' },
    A2: { raw: 'Engenharia' },
    B2: { raw: '300' },
    C2: { raw: '280' },
    A3: { raw: 'Produto' },
    B3: { raw: '150' },
    C3: { raw: "=Metas!B2" },
    A4: { raw: 'TOTAL CORPORATIVO' },
    B4: { raw: '=SOMA(B2:B3)' },
    C4: { raw: '=SOMA(C2:C3)' },
  };

  // Auto-detect without explicit chartConfig
  const autoPts = extractChartDataPoints(budgetCells, undefined, [], [refTab]);
  assert.equal(autoPts.length, 2);
  assert.equal(autoPts[0].label, 'Engenharia');
  assert.equal(autoPts[0].value, 300);

  // Configured seriesCols pointing to C (index 2) including cross-sheet formula
  const configuredPts = extractChartDataPoints(
    budgetCells,
    { id: 'ch1', title: 'Realizado', type: 'column', dataRange: 'A2:C4', labelCol: 0, seriesCols: [2] },
    [],
    [refTab]
  );
  assert.equal(configuredPts.length, 2);
  assert.equal(configuredPts[1].label, 'Produto');
  assert.equal(configuredPts[1].value, 500);

  // Cross-sheet computeSelectionStats
  const stats = computeSelectionStats(['C2', 'C3'], budgetCells, [], [refTab]);
  assert.equal(stats.sum, 780);
  assert.equal(stats.numericCount, 2);
});

test('sheet comment lifecycle helpers filter, resolve/reopen, reply, and delete cleanly', () => {
  const initial: SheetComment[] = [
    { id: 'c1', sheetId: 'tab_1', cellId: 'E2', author: 'Ana', text: 'Checar ROAS', createdAt: '10:00' },
    { id: 'c2', sheetId: 'tab_1', cellId: 'B4', author: 'Leo', text: 'Ajustado', createdAt: '11:00', resolved: true },
  ];

  assert.equal(filterSheetComments(initial, 'open').length, 1);
  assert.equal(filterSheetComments(initial, 'resolved').length, 1);
  assert.equal(filterSheetComments(initial, 'all').length, 2);

  const toggled = toggleResolveSheetComment(initial, 'c1');
  assert.equal(filterSheetComments(toggled, 'open').length, 0);
  assert.equal(filterSheetComments(toggled, 'resolved').length, 2);

  const withReply = addSheetCommentReply(toggled, 'c1', 'Chrisllan', 'Confirmado no dashboard!');
  assert.equal(withReply[0].replies?.length, 1);
  assert.equal(withReply[0].replies?.[0].text, 'Confirmado no dashboard!');

  const afterDelete = deleteSheetComment(withReply, 'c2');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'c1');
});



