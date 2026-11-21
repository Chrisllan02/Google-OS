import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EnrichedDriveItem,
  buildFolderBreadcrumbs,
  buildFolderTreeNodes,
  filterAndSortDriveItems,
  calculateStorageBreakdown,
  formatStoragePercent,
  isDescendantFolder,
} from './driveLogic';

const NOW = Date.now();
const SAMPLE_ITEMS: EnrichedDriveItem[] = [
  {
    id: 'fld_1',
    name: 'Projetos Q2',
    type: 'folder',
    owner: 'eu',
    date: 'Hoje',
    parentId: undefined,
  },
  {
    id: 'fld_2',
    name: 'Arquitetura',
    type: 'folder',
    owner: 'eu',
    date: 'Hoje',
    parentId: 'fld_1',
  },
  {
    id: 'fld_3',
    name: 'Diagramas',
    type: 'folder',
    owner: 'eu',
    date: 'Hoje',
    parentId: 'fld_2',
  },
  {
    id: 'f1',
    name: 'Plano Trimestral Q2 2026',
    type: 'doc',
    owner: 'eu',
    date: 'Editado hoje',
    modifiedIso: new Date(NOW - 3600_000).toISOString(),
    sizeBytes: 2500000,
    isStarred: true,
    offlineAvailable: true,
    parentId: undefined,
  },
  {
    id: 'f2',
    name: 'Budget 2026',
    type: 'sheet',
    owner: 'Ana Lima',
    date: 'Ontem',
    modifiedIso: new Date(NOW - 86400_000).toISOString(),
    lastOpenedIso: new Date(NOW - 1000).toISOString(),
    sizeBytes: 5400000,
    isStarred: false,
    parentId: undefined,
  },
  {
    id: 'f3',
    name: 'Especificacao_Tecnica.pdf',
    type: 'pdf',
    owner: 'eu',
    date: 'Hoje',
    modifiedIso: new Date(NOW - 7200_000).toISOString(),
    sizeBytes: 12000000,
    parentId: 'fld_2',
  },
  {
    id: 'f_img',
    name: 'Mockup_Home.png',
    type: 'image',
    owner: 'eu',
    date: 'Hoje',
    modifiedIso: new Date(NOW - 1800_000).toISOString(),
    sizeBytes: 1800000,
    parentId: undefined,
  },
  {
    id: 'f_spam',
    name: 'Premio_Suspeito.pdf',
    type: 'pdf',
    owner: 'Desconhecido',
    date: 'Ontem',
    spam: true,
    sizeBytes: 120000,
  },
  {
    id: 'f4',
    name: 'Rascunho Antigo',
    type: 'doc',
    owner: 'eu',
    date: 'Mês passado',
    trashed: true,
    sizeBytes: 500000,
  },
];

test('buildFolderBreadcrumbs returns full nested folder trail from Meu Drive', () => {
  const trail = buildFolderBreadcrumbs(SAMPLE_ITEMS, 'fld_3');
  assert.equal(trail.length, 4);
  assert.deepEqual(
    trail.map((t) => t.name),
    ['Meu Drive', 'Projetos Q2', 'Arquitetura', 'Diagramas']
  );
});

test('isDescendantFolder detects self, children, and grandchildren to prevent circular moves', () => {
  assert.equal(isDescendantFolder(SAMPLE_ITEMS, 'fld_1', 'fld_1'), true);
  assert.equal(isDescendantFolder(SAMPLE_ITEMS, 'fld_1', 'fld_2'), true);
  assert.equal(isDescendantFolder(SAMPLE_ITEMS, 'fld_1', 'fld_3'), true);
  assert.equal(isDescendantFolder(SAMPLE_ITEMS, 'fld_2', 'fld_1'), false);
  assert.equal(isDescendantFolder(SAMPLE_ITEMS, 'fld_1', null), false);
});

test('buildFolderTreeNodes returns nested folders in hierarchical depth order', () => {
  const nodes = buildFolderTreeNodes(SAMPLE_ITEMS);
  assert.deepEqual(
    nodes.map((n) => [n.folder.id, n.depth]),
    [
      ['fld_1', 0],
      ['fld_2', 1],
      ['fld_3', 2],
    ]
  );
});

test('filterAndSortDriveItems handles categories, search operators, recent sorting, and spam', () => {
  // Root of my-drive
  const rootRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: null,
  });
  assert.equal(rootRes.folders.length, 1);
  assert.equal(rootRes.files.length, 3);

  // Inside fld_2
  const nestedRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: 'fld_2',
  });
  assert.equal(nestedRes.folders.length, 1);
  assert.equal(nestedRes.files.length, 1);
  assert.equal(nestedRes.files[0].name, 'Especificacao_Tecnica.pdf');

  // Shared with me
  const sharedRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'shared',
    currentFolderId: null,
  });
  assert.equal(sharedRes.files.length, 1);
  assert.equal(sharedRes.files[0].owner, 'Ana Lima');

  // Spam category isolates spam items
  const spamRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'spam',
    currentFolderId: null,
  });
  assert.equal(spamRes.files.length, 1);
  assert.equal(spamRes.files[0].id, 'f_spam');

  // Trash
  const trashRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'trash',
    currentFolderId: null,
  });
  assert.equal(trashRes.files.length, 1);
  assert.equal(trashRes.files[0].id, 'f4');

  // Recent excludes folders and sorts newest lastOpenedIso/modifiedIso first
  const recentRes = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'recent',
    currentFolderId: null,
  });
  assert.equal(recentRes.folders.length, 0);
  assert.equal(recentRes.files[0].id, 'f2'); // opened 1s ago

  // Search operators: type:pdf, type:image, is:offline, owner:others
  const pdfSearch = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: null,
    searchQuery: 'type:pdf',
  });
  assert.equal(pdfSearch.files.length, 1);
  assert.equal(pdfSearch.files[0].id, 'f3');

  const imageSearch = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: null,
    searchQuery: 'type:image',
  });
  assert.equal(imageSearch.files.length, 1);
  assert.equal(imageSearch.files[0].id, 'f_img');

  const offlineSearch = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: null,
    searchQuery: 'is:offline',
  });
  assert.equal(offlineSearch.files.length, 1);
  assert.equal(offlineSearch.files[0].id, 'f1');

  const othersSearch = filterAndSortDriveItems(SAMPLE_ITEMS, {
    category: 'my-drive',
    currentFolderId: null,
    searchQuery: 'owner:others',
  });
  assert.equal(othersSearch.files.length, 1);
  assert.equal(othersSearch.files[0].id, 'f2');
});

test('calculateStorageBreakdown and formatStoragePercent compute honest 15 GB metrics', () => {
  const breakdown = calculateStorageBreakdown(SAMPLE_ITEMS);
  assert.equal(breakdown.usedBytes, 2500000 + 5400000 + 12000000 + 1800000 + 120000 + 500000);
  assert.equal(breakdown.byType.pdf, 12120000);
  assert.equal(breakdown.byType.image, 1800000);

  assert.deepEqual(formatStoragePercent(0, breakdown.totalQuotaBytes), { label: '0%', barWidthPercent: 0 });
  assert.deepEqual(formatStoragePercent(breakdown.usedBytes, breakdown.totalQuotaBytes), {
    label: '< 1%',
    barWidthPercent: 2,
  });
  assert.deepEqual(formatStoragePercent(3 * 1024 * 1024 * 1024, breakdown.totalQuotaBytes), {
    label: '20%',
    barWidthPercent: 20,
  });
});
