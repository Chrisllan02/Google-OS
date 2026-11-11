import React from 'react';
import MailApp from './apps/MailApp';
import DriveApp from './apps/DriveApp';
import EditorApp from './apps/EditorApp';
import MeetApp from './apps/MeetApp';
import KeepApp from './apps/KeepApp';
import TasksApp from './apps/TasksApp';
import SearchApp from './apps/SearchApp';
import SettingsApp from './apps/SettingsApp';
import CalendarApp from './apps/CalendarApp';
import SecurityApp from './apps/SecurityApp';
import PermissionsApp from './apps/PermissionsApp';

interface AppViewerProps {
  type: string;
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: any) => void;
  onUpdateTasks?: (tasks: any[]) => void;
  onUpdateNotes?: (notes: any[]) => void;
  onUpdateEvents?: (events: any[]) => void;
  showToast?: (msg: string) => void;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
  onUpdateTheme?: (settings: any) => void;
  onUpdateNickname?: (nickname: string) => void;
  showAurora?: boolean;
  onToggleAurora?: () => void;
}

export default function AppViewer({ type, onClose, data, searchQuery, onOpenApp, onUpdateTasks, onUpdateNotes, onUpdateEvents, showToast, toggleTheme, isDarkMode, onUpdateTheme, onUpdateNickname, showAurora, onToggleAurora }: AppViewerProps) {
  const glassContainer = isDarkMode 
    ? "glass-popover text-white" 
    : "glass-popover text-[#202124]";

  const renderApp = () => {
    switch (type) {
        case 'mail': return <MailApp onClose={onClose} data={data} searchQuery={searchQuery} onUpdateTasks={onUpdateTasks} onUpdateNotes={onUpdateNotes} showToast={showToast} isDarkMode={isDarkMode} />;
        case 'drive': return <DriveApp onClose={onClose} data={data} onOpenApp={onOpenApp} showToast={showToast} isDarkMode={isDarkMode} />;
        case 'calendar': return <CalendarApp onClose={onClose} data={data} onOpenApp={onOpenApp} showToast={showToast} isDarkMode={isDarkMode} />;
        case 'doc':
        case 'sheet':
        case 'slide': return <EditorApp onClose={onClose} type={type} data={data} isDarkMode={isDarkMode} />;
        case 'meet': return <MeetApp onClose={onClose} data={data} showToast={showToast} isDarkMode={isDarkMode} />;
        case 'keep': return (
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
        case 'tasks': return <TasksApp onClose={onClose} data={data} onUpdate={onUpdateTasks} showToast={showToast} isDarkMode={isDarkMode} />;
        case 'search': return <SearchApp onClose={onClose} data={data} searchQuery={searchQuery} onOpenApp={onOpenApp} isDarkMode={isDarkMode} />;
        case 'settings': return <SettingsApp onClose={onClose} data={data} toggleTheme={toggleTheme} isDarkMode={isDarkMode} showToast={showToast} onUpdateTheme={onUpdateTheme} onUpdateNickname={onUpdateNickname} showAurora={showAurora} onToggleAurora={onToggleAurora} />;
        case 'security': return <SecurityApp onClose={onClose} data={data} isDarkMode={isDarkMode} showToast={showToast} />;
        case 'permissions': return <PermissionsApp onClose={onClose} data={data} isDarkMode={isDarkMode} showToast={showToast} />;
        default: return null;
    }
  };

  return (
    <div className={`fixed top-4 left-4 right-4 bottom-28 z-50 flex flex-col ${glassContainer} rounded-[24px] animate-in zoom-in duration-300 font-sans overflow-hidden`}>
        {renderApp()}
    </div>
  );
}