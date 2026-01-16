import React from 'react';
import MailApp from './apps/MailApp';
import DriveApp from './apps/DriveApp';
import EditorApp from './apps/EditorApp';
import MeetApp from './apps/MeetApp';
import KeepApp from './apps/KeepApp';
import TasksApp from './apps/TasksApp';
import SearchApp from './apps/SearchApp';

interface AppViewerProps {
  type: string;
  onClose: () => void;
  data: any;
  searchQuery?: string;
}

export default function AppViewer({ type, onClose, data, searchQuery }: AppViewerProps) {
  const glassContainer = "bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[20px] shadow-2xl animate-in zoom-in duration-300 font-sans text-white overflow-hidden";

  const renderApp = () => {
    switch (type) {
        case 'mail': return <MailApp onClose={onClose} data={data} searchQuery={searchQuery} />;
        case 'drive': return <DriveApp onClose={onClose} data={data} />;
        case 'doc':
        case 'sheet':
        case 'slide': return <EditorApp onClose={onClose} type={type} data={data} />;
        case 'meet': return <MeetApp onClose={onClose} data={data} />;
        case 'keep': return <KeepApp onClose={onClose} data={data} />;
        case 'tasks': return <TasksApp onClose={onClose} data={data} />;
        case 'search': return <SearchApp onClose={onClose} data={data} />;
        default: return null;
    }
  };

  return (
    <div className={`fixed inset-4 z-50 flex flex-col ${glassContainer} bg-[#191919]`}>
        {renderApp()}
    </div>
  );
}