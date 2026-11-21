import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVE_SESSIONS,
  DEFAULT_OAUTH_APPS,
  auditLogsToCsv,
  calculateSecurityScore,
  derivePreviewTotpCode,
  evaluateSecurityChecklist,
  extractDrivePermissionRows,
  filterAuditLogs,
  filterDrivePermissionRows,
  filterWorkspacePermissions,
  generateBackupCodes,
  isExternalCollaborator,
  isValidSixDigitCode,
  permissionsToCsv,
  revokeActiveSession,
  revokeOAuthGrant,
  revokeOtherSessions,
  validateShareRuleInput,
  verifyTotpCode,
} from './securityPermissionsLogic';
import type { AuditLog, DriveItem, SharedPermission } from './GASBridge';

test('MFA code validation, TOTP verification, backup code rotation, and security score work properly', () => {
  assert.equal(isValidSixDigitCode('123456'), true);
  assert.equal(isValidSixDigitCode('12ab56'), false);
  assert.equal(isValidSixDigitCode('12345'), false);

  const codeA = derivePreviewTotpCode('JBSWY3DPEHPK3PXP');
  const codeB = derivePreviewTotpCode('JBSWY3DPEHPK3PXP');
  assert.equal(codeA.length, 6);
  assert.equal(codeA, codeB);
  assert.equal(verifyTotpCode('JBSWY3DPEHPK3PXP', codeA), true);
  assert.equal(verifyTotpCode('JBSWY3DPEHPK3PXP', '000000'), false);

  const backup = generateBackupCodes('JBSWY3DPEHPK3PXP', 6, 0);
  const rotated = generateBackupCodes('JBSWY3DPEHPK3PXP', 6, 1);
  assert.equal(backup.length, 6);
  assert.match(backup[0], /^\d{4}-\d{4}$/);
  assert.notEqual(backup[0], rotated[0]);

  const partialChecklist = evaluateSecurityChecklist({
    mfaEnabled: false,
    activeSessionsCount: 3,
    oauthAppsCount: 2,
    blockedAttacksCount: 0,
  });
  const score = calculateSecurityScore(partialChecklist);
  assert.equal(score.passed, 2);
  assert.equal(score.total, 4);
  assert.equal(score.percentage, 50);
  assert.equal(partialChecklist.find((c) => c.id === 'chk_sessions')?.actionLabel, 'Encerrar antigas');
});

test('filterAuditLogs filters by status and search query and exports valid CSV', () => {
  const logs: AuditLog[] = [
    {
      id: '1',
      action: 'LOGIN_SUCCESS',
      details: 'Sessão iniciada com sucesso',
      status: 'SUCCESS',
      timestamp: '2026-11-18T10:00:00.000Z',
      ipAddress: '187.45.101.20',
      device: 'Chromium',
    },
    {
      id: '2',
      action: 'SQL_INJECTION',
      details: 'Payload bloqueado no Keep',
      status: 'BLOCKED',
      timestamp: '2026-11-18T10:05:00.000Z',
      ipAddress: '45.22.10.9',
      device: 'curl',
    },
  ];

  assert.equal(filterAuditLogs(logs, '', 'ALL').length, 2);
  assert.equal(filterAuditLogs(logs, '', 'BLOCKED').length, 1);
  assert.equal(filterAuditLogs(logs, '45.22', 'ALL')[0].id, '2');

  const csv = auditLogsToCsv(logs);
  assert.match(csv, /"SQL_INJECTION","BLOCKED","45\.22\.10\.9"/);
});

test('session and OAuth app revocation keep current session intact', () => {
  const withoutMac = revokeActiveSession(DEFAULT_ACTIVE_SESSIONS, 'sess_mac');
  assert.equal(withoutMac.some((s) => s.id === 'sess_mac'), false);
  assert.equal(withoutMac.some((s) => s.isCurrent), true);

  // Attempting to remove current session should be a no-op
  const stillHasCurrent = revokeActiveSession(DEFAULT_ACTIVE_SESSIONS, 'sess_current');
  assert.equal(stillHasCurrent.some((s) => s.isCurrent), true);

  const onlyCurrent = revokeOtherSessions(DEFAULT_ACTIVE_SESSIONS);
  assert.equal(onlyCurrent.length, 1);
  assert.equal(onlyCurrent[0].isCurrent, true);

  const remainingApps = revokeOAuthGrant(DEFAULT_OAUTH_APPS, 'oauth_slack');
  assert.equal(remainingApps.some((a) => a.id === 'oauth_slack'), false);
});

test('extractDrivePermissionRows and workspace permission filters accurately reflect Drive and Workspace rules', () => {
  const driveFiles: DriveItem[] = [
    {
      id: 'd1',
      name: 'Métricas de Marketing & Funil Q2',
      type: 'sheet',
      owner: 'eu',
      date: 'Hoje',
      sharedWith: [
        { id: 'o1', name: 'Chrisllan', email: 'chrisllan@workspace.os', role: 'owner' },
        { id: 'e1', name: 'Gabriel', email: 'gabriel@workspace.os', role: 'editor' },
      ],
    },
    {
      id: 'd2',
      name: 'Arquivo na Lixeira',
      type: 'doc',
      owner: 'eu',
      date: 'Ontem',
      trashed: true,
      sharedWith: [{ id: 'v1', name: 'Ana', email: 'ana@workspace.os', role: 'viewer' }],
    },
  ];

  const driveRows = extractDrivePermissionRows(driveFiles);
  assert.equal(driveRows.length, 1);
  assert.equal(driveRows[0].email, 'gabriel@workspace.os');
  assert.equal(filterDrivePermissionRows(driveRows, 'funil').length, 1);
  assert.equal(filterDrivePermissionRows(driveRows, 'ana').length, 0);

  const wsPerms: SharedPermission[] = [
    {
      id: 'p1',
      ownerEmail: 'chrisllan@workspace.os',
      collaboratorEmail: 'ana@workspace.os',
      resourceType: 'drive',
      accessLevel: 'write',
      status: 'ACTIVE',
      createdAt: '2026-11-18T12:00:00.000Z',
    },
    {
      id: 'p2',
      ownerEmail: 'chrisllan@workspace.os',
      collaboratorEmail: 'pedro@workspace.os',
      resourceType: 'calendar',
      accessLevel: 'read',
      status: 'ACTIVE',
      createdAt: '2026-11-18T12:00:00.000Z',
    },
  ];

  assert.equal(filterWorkspacePermissions(wsPerms, '', 'drive').length, 1);
  assert.equal(filterWorkspacePermissions(wsPerms, 'pedro', 'ALL').length, 1);

  const checklist = evaluateSecurityChecklist({
    mfaEnabled: true,
    activeSessionsCount: 2,
    oauthAppsCount: 2,
    blockedAttacksCount: 1,
  });
  assert.equal(checklist.every((c) => c.passed), true);

  assert.equal(isExternalCollaborator('parceiro@externo.com', 'chrisllan@workspace.os'), true);
  assert.equal(isExternalCollaborator('ana@workspace.os', 'chrisllan@workspace.os'), false);

  assert.equal(validateShareRuleInput('chrisllan@workspace.os', 'chrisllan@workspace.os').valid, false);
  assert.equal(validateShareRuleInput('invalido', 'chrisllan@workspace.os').valid, false);
  assert.equal(
    validateShareRuleInput('parceiro@externo.com', 'chrisllan@workspace.os', '2026-11-01', '2026-11-21').valid,
    false
  );
  assert.equal(
    validateShareRuleInput('parceiro@externo.com', 'chrisllan@workspace.os', '2026-12-01', '2026-11-21').valid,
    true
  );

  assert.equal(filterWorkspacePermissions(wsPerms, '', 'ALL', 'write').length, 1);
  assert.equal(filterDrivePermissionRows(driveRows, '', 'read').length, 0);
  assert.equal(filterDrivePermissionRows(driveRows, '', 'write').length, 1);

  const csv = permissionsToCsv(driveRows, wsPerms);
  assert.match(csv, /"Drive","Métricas de Marketing & Funil Q2","gabriel@workspace\.os","Editor"/);
  assert.match(csv, /"Workspace","Drive & Arquivos","ana@workspace\.os","Editor"/);
});
