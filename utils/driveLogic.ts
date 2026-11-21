import type { DriveItem, FileVersion, Permission } from './GASBridge';

export type DriveCategory =
  | 'home'
  | 'my-drive'
  | 'shared'
  | 'recent'
  | 'starred'
  | 'spam'
  | 'trash'
  | 'storage';

export type DriveFileTypeFilter = 'all' | 'folder' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'image';
export type DriveOwnerFilter = 'all' | 'me' | 'others';
export type DriveModifiedFilter = 'any' | 'today' | 'week' | 'month';
export type DriveSortField = 'name' | 'date' | 'size';
export type DriveSortOrder = 'asc' | 'desc';

export interface DriveActivityEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface EnrichedDriveItem extends DriveItem {
  folderColor?: string;
  description?: string;
  createdAt?: string;
  modifiedIso?: string;
  lastOpenedIso?: string;
  sizeBytes?: number;
  offlineAvailable?: boolean;
  spam?: boolean;
  generalAccess?: 'restricted' | 'anyone_with_link';
  generalRole?: 'viewer' | 'commenter' | 'editor';
  activityLog?: DriveActivityEntry[];
  versions?: FileVersion[];
}

export interface FolderTreeNode {
  folder: EnrichedDriveItem;
  depth: number;
}

export const DRIVE_FOLDER_COLORS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'graphite', name: 'Grafite (Padrão)', hex: '#5F6368' },
  { id: 'blue', name: 'Azul Céu', hex: '#1A73E8' },
  { id: 'emerald', name: 'Verde Esmeralda', hex: '#0F9D58' },
  { id: 'amber', name: 'Amarelo Solar', hex: '#F4B400' },
  { id: 'red', name: 'Vermelho Coral', hex: '#DB4437' },
  { id: 'purple', name: 'Roxo Ametista', hex: '#8E24AA' },
  { id: 'teal', name: 'Turquesa', hex: '#00897B' },
  { id: 'pink', name: 'Rosa Quartzo', hex: '#D81B60' },
  { id: 'orange', name: 'Laranja Tangerina', hex: '#F4511E' },
  { id: 'indigo', name: 'Índigo', hex: '#3949AB' },
];

export function formatBytes(bytes = 0): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function formatStoragePercent(
  usedBytes: number,
  totalQuotaBytes: number
): { label: string; barWidthPercent: number } {
  if (!usedBytes || usedBytes <= 0 || !totalQuotaBytes || totalQuotaBytes <= 0) {
    return { label: '0%', barWidthPercent: 0 };
  }
  const exact = (usedBytes / totalQuotaBytes) * 100;
  if (exact < 1) {
    return { label: '< 1%', barWidthPercent: 2 };
  }
  const clamped = Math.min(100, Math.round(exact));
  return { label: `${clamped}%`, barWidthPercent: clamped };
}

export function isDescendantFolder(
  allItems: EnrichedDriveItem[],
  sourceFolderId: string,
  candidateTargetId: string | null
): boolean {
  if (!candidateTargetId) return false;
  if (sourceFolderId === candidateTargetId) return true;
  let pointer: string | null = candidateTargetId;
  const visited = new Set<string>();
  while (pointer && !visited.has(pointer)) {
    visited.add(pointer);
    const node = allItems.find((i) => i.id === pointer);
    if (!node) break;
    if (node.parentId === sourceFolderId) return true;
    pointer = node.parentId || null;
  }
  return false;
}

export function buildFolderTreeNodes(allItems: EnrichedDriveItem[]): FolderTreeNode[] {
  const activeFolders = allItems.filter((i) => i.type === 'folder' && !i.trashed && !i.spam);
  const byParent = new Map<string | null, EnrichedDriveItem[]>();
  const activeIds = new Set(activeFolders.map((f) => f.id));

  for (const fld of activeFolders) {
    const parentKey = fld.parentId && activeIds.has(fld.parentId) ? fld.parentId : null;
    const list = byParent.get(parentKey) || [];
    list.push(fld);
    byParent.set(parentKey, list);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }

  const result: FolderTreeNode[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) || [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ folder: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

export function buildFolderBreadcrumbs(
  allItems: EnrichedDriveItem[],
  currentFolderId: string | null
): Array<{ id: string | null; name: string }> {
  const trail: Array<{ id: string | null; name: string }> = [];
  let pointerId = currentFolderId;
  const visited = new Set<string>();

  while (pointerId && !visited.has(pointerId)) {
    visited.add(pointerId);
    const folder = allItems.find((i) => i.id === pointerId && i.type === 'folder');
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name });
    pointerId = folder.parentId || null;
  }

  trail.unshift({ id: null, name: 'Meu Drive' });
  return trail;
}

export function filterAndSortDriveItems(
  items: EnrichedDriveItem[],
  options: {
    category: DriveCategory;
    currentFolderId: string | null;
    searchQuery?: string;
    typeFilter?: DriveFileTypeFilter;
    ownerFilter?: DriveOwnerFilter;
    modifiedFilter?: DriveModifiedFilter;
    sortField?: DriveSortField;
    sortOrder?: DriveSortOrder;
  }
): { folders: EnrichedDriveItem[]; files: EnrichedDriveItem[] } {
  const {
    category,
    currentFolderId,
    searchQuery = '',
    typeFilter = 'all',
    ownerFilter = 'all',
    modifiedFilter = 'any',
    sortField = 'name',
    sortOrder = 'asc',
  } = options;

  let q = searchQuery.trim().toLowerCase();
  let forcedType: DriveFileTypeFilter | null = null;
  let forcedStarred = false;
  let forcedOffline = false;
  let forcedOwner: DriveOwnerFilter | null = null;

  const typeOperators: Array<[string, DriveFileTypeFilter]> = [
    ['type:doc', 'doc'],
    ['type:sheet', 'sheet'],
    ['type:slide', 'slide'],
    ['type:pdf', 'pdf'],
    ['type:folder', 'folder'],
    ['type:image', 'image'],
  ];
  for (const [token, mapped] of typeOperators) {
    if (q.includes(token)) {
      forcedType = mapped;
      q = q.replace(token, '').trim();
      break;
    }
  }

  if (q.includes('is:starred')) {
    forcedStarred = true;
    q = q.replace('is:starred', '').trim();
  }
  if (q.includes('is:offline')) {
    forcedOffline = true;
    q = q.replace('is:offline', '').trim();
  }
  if (q.includes('owner:me')) {
    forcedOwner = 'me';
    q = q.replace('owner:me', '').trim();
  } else if (q.includes('owner:others')) {
    forcedOwner = 'others';
    q = q.replace('owner:others', '').trim();
  }

  const nowMs = Date.now();

  const filtered = items.filter((item) => {
    // Trash & Spam isolation
    if (category === 'trash') {
      if (!item.trashed) return false;
    } else if (category === 'spam') {
      if (!item.spam || item.trashed) return false;
    } else {
      if (item.trashed || item.spam) return false;
    }

    // Category specific rules when no global search query is active
    if (!searchQuery.trim()) {
      if (category === 'my-drive') {
        const itemParent = item.parentId || null;
        if (itemParent !== currentFolderId) return false;
      } else if (category === 'shared') {
        if (item.owner === 'eu') return false;
      } else if (category === 'starred') {
        if (!item.isStarred) return false;
      } else if (category === 'recent' || category === 'storage') {
        if (item.type === 'folder') return false;
      }
    }

    // Type filter
    const effectiveType = forcedType || typeFilter;
    if (effectiveType !== 'all' && item.type !== effectiveType) {
      return false;
    }

    // Starred & Offline operators
    if (forcedStarred && !item.isStarred) return false;
    if (forcedOffline && !item.offlineAvailable) return false;

    // Owner filter
    const effectiveOwner = forcedOwner || ownerFilter;
    if (effectiveOwner === 'me' && item.owner !== 'eu') return false;
    if (effectiveOwner === 'others' && item.owner === 'eu') return false;

    // Modified filter
    if (modifiedFilter !== 'any' && item.modifiedIso) {
      const modMs = new Date(item.modifiedIso).getTime();
      const diffDays = (nowMs - modMs) / 86400000;
      if (modifiedFilter === 'today' && diffDays > 1) return false;
      if (modifiedFilter === 'week' && diffDays > 7) return false;
      if (modifiedFilter === 'month' && diffDays > 31) return false;
    }

    // Text search
    if (q) {
      const hay = `${item.name} ${item.owner} ${item.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  const getActivityTime = (item: EnrichedDriveItem) => {
    const iso = item.lastOpenedIso || item.modifiedIso;
    return iso ? new Date(iso).getTime() : 0;
  };

  const comparator = (a: EnrichedDriveItem, b: EnrichedDriveItem) => {
    let cmp = 0;
    if (category === 'storage' && sortField === 'name') {
      return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    }
    if ((category === 'recent' || category === 'home') && sortField === 'name' && sortOrder === 'asc') {
      return getActivityTime(b) - getActivityTime(a);
    }
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    } else if (sortField === 'size') {
      cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
    } else if (sortField === 'date') {
      cmp = getActivityTime(a) - getActivityTime(b);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  };

  const folders = filtered.filter((i) => i.type === 'folder').sort(comparator);
  const files = filtered.filter((i) => i.type !== 'folder').sort(comparator);

  return { folders, files };
}

export function calculateStorageBreakdown(items: EnrichedDriveItem[]): {
  totalQuotaBytes: number;
  usedBytes: number;
  byType: Record<string, number>;
} {
  const totalQuotaBytes = 15 * 1024 * 1024 * 1024; // 15 GB Google Workspace Standard
  const byType: Record<string, number> = {
    doc: 0,
    sheet: 0,
    slide: 0,
    pdf: 0,
    image: 0,
    other: 0,
  };

  let usedBytes = 0;
  for (const item of items) {
    if (item.type === 'folder') continue;
    const sz = item.sizeBytes || 0;
    usedBytes += sz;
    if (byType[item.type] !== undefined) {
      byType[item.type] += sz;
    } else {
      byType.other += sz;
    }
  }

  return { totalQuotaBytes, usedBytes, byType };
}
