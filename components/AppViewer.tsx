import React, { Suspense, lazy } from 'react';
import GoogleLoader from './GoogleLoader';
import type {
  AppOpenPayload,
  AuroraSettings,
  CalendarEvent,
  CloudUserProfile,
  DashboardData,
  EmailItem,
  NoteItem,
  TaskItem,
} from '../utils/GASBridge';

const MailApp = lazy(() => import('./apps/MailApp'));
const DriveApp = lazy(() => import('./apps/DriveApp'));
const DocsApp = lazy(() => import('./apps/DocsApp'));
const SheetsApp = lazy(() => import('./apps/SheetsApp'));
const SlidesApp = lazy(() => import('./apps/SlidesApp'));
const MeetApp = lazy(() => import('./apps/MeetApp'));
const KeepApp = lazy(() => import('./apps/KeepApp'));
const TasksApp = lazy(() => import('./apps/TasksApp'));
const SearchApp = lazy(() => import('./apps/SearchApp'));
const SettingsApp = lazy(() => import('./apps/SettingsApp'));
const CalendarApp = lazy(() => import('./apps/CalendarApp'));
const SecurityApp = lazy(() => import('./apps/SecurityApp'));
const PermissionsApp = lazy(() => import('./apps/PermissionsApp'));

interface AppViewerProps {
  type: string;
  onClose: () => void;
  data: DashboardData;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: AppOpenPayload) => void;
  onUpdateTasks?: (tasks: TaskItem[]) => void;
  onUpdateNotes?: (notes: NoteItem[]) => void;
  onUpdateEvents?: (events: CalendarEvent[]) => void;
  onUpdateEmails?: (emails: EmailItem[]) => void;
  showToast?: (msg: string) => void;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  onUpdateTheme?: (settings: Partial<AuroraSettings>) => void;
  onUpdateNickname?: (nickname: string) => void;
  showAurora?: boolean;
  onToggleAurora?: () => void;
  cloudUser?: CloudUserProfile | null;
  hasWorkspaceToken?: boolean;
  authBusy?: boolean;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
  onSyncGoogleWorkspace?: () => void;
}

export default function AppViewer({
  type,
  onClose,
  data,
  searchQuery,
  onOpenApp,
  onUpdateTasks,
  onUpdateNotes,
  onUpdateEvents,
  onUpdateEmails,
  showToast,
  toggleTheme,
  isDarkMode,
  onUpdateTheme,
  onUpdateNickname,
  showAurora,
  onToggleAurora,
  cloudUser,
  hasWorkspaceToken,
  authBusy,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncGoogleWorkspace,
}: AppViewerProps) {
  const glassContainer = isDarkMode
    ? 'glass-app-shell text-white'
    : 'glass-app-shell text-[#202124]';

  const renderApp = () => {
    switch (type) {
      case 'mail':
        return (
          <MailApp
            onClose={onClose}
            data={data}
            searchQuery={searchQuery}
            onUpdateTasks={onUpdateTasks}
            onUpdateNotes={onUpdateNotes}
            onUpdateEmails={onUpdateEmails}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'drive':
        return (
          <DriveApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateTasks={onUpdateTasks}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'calendar':
        return (
          <CalendarApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateEvents={onUpdateEvents}
            onUpdateTasks={onUpdateTasks}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'doc':
        return (
          <DocsApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateTasks={onUpdateTasks}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'sheet':
        return (
          <SheetsApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateTasks={onUpdateTasks}
            onUpdateEvents={onUpdateEvents}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'slide':
        return (
          <SlidesApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateTasks={onUpdateTasks}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'meet':
        return (
          <MeetApp
            onClose={onClose}
            data={data}
            onOpenApp={onOpenApp}
            onUpdateEvents={onUpdateEvents}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'keep':
        return (
          <KeepApp
            onClose={onClose}
            data={data}
            onUpdate={onUpdateNotes}
            onUpdateTasks={onUpdateTasks}
            onUpdateEvents={onUpdateEvents}
            onOpenApp={onOpenApp}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'tasks':
        return (
          <TasksApp
            onClose={onClose}
            data={data}
            onUpdate={onUpdateTasks}
            onOpenApp={onOpenApp}
            showToast={showToast}
            isDarkMode={isDarkMode}
          />
        );
      case 'search':
        return (
          <SearchApp
            onClose={onClose}
            data={data}
            searchQuery={searchQuery}
            onOpenApp={onOpenApp}
            isDarkMode={isDarkMode}
          />
        );
      case 'settings':
        return (
          <SettingsApp
            onClose={onClose}
            data={data}
            toggleTheme={toggleTheme}
            isDarkMode={isDarkMode}
            showToast={showToast}
            onUpdateTheme={onUpdateTheme}
            onUpdateNickname={onUpdateNickname}
            onOpenApp={onOpenApp}
            showAurora={showAurora}
            onToggleAurora={onToggleAurora}
            cloudUser={cloudUser}
            hasWorkspaceToken={hasWorkspaceToken}
            authBusy={authBusy}
            onSignInGoogle={onSignInGoogle}
            onSignOutGoogle={onSignOutGoogle}
            onSyncGoogleWorkspace={onSyncGoogleWorkspace}
          />
        );
      case 'security':
        return (
          <SecurityApp
            onClose={onClose}
            data={data}
            isDarkMode={isDarkMode}
            showToast={showToast}
            onOpenApp={onOpenApp}
          />
        );
      case 'permissions':
        return (
          <PermissionsApp
            onClose={onClose}
            data={data}
            isDarkMode={isDarkMode}
            showToast={showToast}
            onOpenApp={onOpenApp}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`fixed top-2 left-2 right-2 bottom-24 sm:top-4 sm:left-4 sm:right-4 sm:bottom-28 z-50 flex flex-col ${glassContainer} rounded-[20px] sm:rounded-[24px] animate-in zoom-in duration-300 font-sans overflow-hidden`}
    >
      <Suspense fallback={<GoogleLoader darkMode={isDarkMode} />}>
        {renderApp()}
      </Suspense>
    </div>
  );
}