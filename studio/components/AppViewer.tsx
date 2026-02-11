import React from 'react';
import MailApp from './apps/MailApp';
import DriveApp from './apps/DriveApp';
import EditorApp from './apps/EditorApp';
import MeetApp from './apps/MeetApp';
import KeepApp from './apps/KeepApp';
import TasksApp from './apps/TasksApp';
import SearchApp from './apps/SearchApp';
import SettingsApp from './apps/SettingsApp';

interface AppViewerProps {
  type: string;
  onClose: () => void;
  data: any;
  searchQuery?: string;
  onOpenApp?: (type: string, fileData?: any) => void;
  onUpdateTasks?: (tasks: any[]) => void;
  onUpdateNotes?: (notes: any[]) => void;
  showToast?: (msg: string) => void;
  toggleTheme?: () => void;
  isDarkMode?: boolean;
}

export default function AppViewer({ type, onClose, data, searchQuery, onOpenApp, onUpdateTasks, onUpdateNotes, showToast, toggleTheme, isDarkMode }: AppViewerProps) {
  const glassContainer = isDarkMode 
    ? "bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl text-white" 
    : "bg-white/80 backdrop-blur-3xl border border-black/10 shadow-2xl text-black";

  const renderApp = () => {
    switch (type) {
        case 'mail': return <MailApp onClose={onClose} data={data} searchQuery={searchQuery} onUpdateTasks={onUpdateTasks} onUpdateNotes={onUpdateNotes} showToast={showToast} />;
        case 'drive': return <DriveApp onClose={onClose} data={data} onOpenApp={onOpenApp} />;
        case 'doc':
        case 'sheet':
        case 'slide': return <EditorApp onClose={onClose} type={type} data={data} />;
        case 'meet': return <MeetApp onClose={onClose} data={data} />;
        case 'keep': return <KeepApp onClose={onClose} data={data} onUpdate={onUpdateNotes} />;
        case 'tasks': return <TasksApp onClose={onClose} data={data} onUpdate={onUpdateTasks} />;
        case 'search': return <SearchApp onClose={onClose} data={data} searchQuery={searchQuery} onOpenApp={onOpenApp} />;
        case 'settings': return <SettingsApp onClose={onClose} data={data} toggleTheme={toggleTheme} isDarkMode={isDarkMode} />;
        default: return null;
    }
  };

  return (
    <div className={`fixed top-4 left-4 right-4 bottom-32 z-50 flex flex-col ${glassContainer} rounded-[20px] animate-in zoom-in duration-300 font-sans overflow-hidden`}>
        {renderApp()}
    </div>
  );
}