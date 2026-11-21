import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_USER_SETTINGS,
  WORKSPACE_SETTINGS_KEY,
  parseUserSettings,
  computeWorkspaceStorageStats,
  clearTransientWorkspaceCache,
  exportSettingsJson,
  resetUserSettings,
} from './settingsLogic';

test('parseUserSettings merges stored partial settings with safe defaults and supports export/reset', () => {
  const defaults = parseUserSettings(null);
  assert.equal(defaults.storagePlanGb, 15);
  assert.equal(defaults.language, 'pt-BR');
  assert.equal(defaults.timezone, 'America/Sao_Paulo');
  assert.equal(defaults.density, 'comfortable');
  assert.equal(defaults.privacy.sessionLockOnIdle, true);

  const corrupted = parseUserSettings('{invalid json');
  assert.deepEqual(corrupted, DEFAULT_USER_SETTINGS);

  const partial = parseUserSettings(
    JSON.stringify({
      storagePlanGb: 100,
      language: 'en-US',
      timezone: 'Europe/Lisbon',
      density: 'compact',
      notifications: { emailPriority: false, doNotDisturb: true },
      privacy: { historyRetentionDays: 365, telemetryEnabled: true },
    })
  );
  assert.equal(partial.storagePlanGb, 100);
  assert.equal(partial.language, 'en-US');
  assert.equal(partial.timezone, 'Europe/Lisbon');
  assert.equal(partial.density, 'compact');
  assert.equal(partial.notifications.emailPriority, false);
  assert.equal(partial.notifications.doNotDisturb, true);
  assert.equal(partial.notifications.calendarInvites, true);
  assert.equal(partial.privacy.historyRetentionDays, 365);
  assert.equal(partial.privacy.telemetryEnabled, true);

  const exported = exportSettingsJson(partial);
  assert.deepEqual(parseUserSettings(exported), partial);

  const reset = resetUserSettings('Ana Lima');
  assert.equal(reset.displayName, 'Ana Lima');
  assert.equal(reset.storagePlanGb, 15);
  assert.equal(reset.density, 'comfortable');
});

test('computeWorkspaceStorageStats calculates accurate storage breakdown and percentage by plan', () => {
  const stats15 = computeWorkspaceStorageStats(
    [
      { type: 'doc', sizeBytes: 10 * 1024 * 1024 },
      { type: 'pdf', sizeBytes: 50 * 1024 * 1024 },
      { type: 'image', sizeBytes: 100 * 1024 * 1024, trashed: true },
    ],
    10,
    15
  );
  assert.equal(stats15.planGb, 15);
  assert.equal(stats15.categories.length, 4);
  assert.ok(stats15.totalUsedGb > 10 && stats15.totalUsedGb < 15);
  assert.ok(stats15.percentUsed > 50 && stats15.percentUsed <= 100);

  const stats100 = computeWorkspaceStorageStats([], 10, 100);
  assert.ok(stats100.percentUsed < stats15.percentUsed);
});

test('clearTransientWorkspaceCache removes transient workspace keys while preserving settings', () => {
  const store = new Map<string, string>([
    [WORKSPACE_SETTINGS_KEY, '{}'],
    ['workspace_nickname', 'Cris'],
    ['workspace_tasks_v2', '[]'],
    ['workspace_emails_v2', '[]'],
    ['unrelated_key', 'keep'],
  ]);

  const mockStorage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  const removedCount = clearTransientWorkspaceCache(mockStorage);
  assert.equal(removedCount, 2);
  assert.equal(store.has(WORKSPACE_SETTINGS_KEY), true);
  assert.equal(store.has('workspace_nickname'), true);
  assert.equal(store.has('unrelated_key'), true);
  assert.equal(store.has('workspace_tasks_v2'), false);
});
