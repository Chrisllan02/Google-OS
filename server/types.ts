/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  mfaSecret: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export type LogStatus = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
  status: LogStatus;
  ipAddress: string;
  device: string;
}

export type ResourceType = 'calendar' | 'tasks' | 'all';
export type AccessLevel = 'read' | 'write';
export type PermissionStatus = 'ACTIVE' | 'REVOKED' | 'PENDING';

export interface SharedPermission {
  id: string;
  ownerId: string;
  ownerEmail: string;
  collaboratorEmail: string;
  resourceType: ResourceType;
  accessLevel: AccessLevel;
  status: PermissionStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  ownerId: string;
  ownerEmail: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  sharedWith: string[]; // collaborator emails
  hangoutLink?: string;
  conferenceData?: any;
  colorId?: string;
  
  // Advanced Calendar Features
  reminders?: { useDefault: boolean, overrides?: { method: 'email' | 'popup', minutes: number }[] };
  recurrence?: string[];
  timeZone?: string;
  transparency?: 'opaque' | 'transparent'; // busy / free
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface TaskList {
  id: string;
  ownerId: string;
  ownerEmail: string;
  title: string;
  createdAt: string;
}

export interface GoogleTask {
  id: string;
  listId: string;
  ownerId: string;
  ownerEmail: string;
  title: string;
  notes: string;
  due: string;
  status: 'needsAction' | 'completed';
  completedAt: string | null;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  progress?: 'todo' | 'inProgress' | 'completed';
  subtasks?: { id: string; title: string; completed: boolean }[];
}

export interface SessionInfo {
  token: string;
  user: UserProfile;
  mfaRequired: boolean;
  mfaVerified: boolean;
}
