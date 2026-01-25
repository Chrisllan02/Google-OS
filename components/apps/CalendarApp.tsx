
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Search, Settings, HelpCircle, 
  Menu, Plus, Calendar as CalendarIcon, MapPin, Users, 
  Video, X, Clock, AlignLeft, Check, MoreVertical
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge } from '../../utils/GASBridge';

interface CalendarAppProps {
  onClose: () => void;
  data: any;
  onOpenApp?: (type: string, data?: any) => void;
  showToast?: (msg: string) => void;
}

export default function CalendarApp({ onClose, data, onOpenApp, showToast }: CalendarAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', description: '' });

  const toast = (msg: string) => showToast && showToast(msg);

  // Load events
  useEffect(() => {
    if (data?.events) {
      setEvents(data.events.map((e: any) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end)
      })));
    }
  }, [data]);

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => setCurrentDate(new Date());

  const getMonthName = () => currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Grid Generators
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    const day = currentDate.getDay();
    const diff = d.getDate() - day + i;
    d.setDate(diff);
    return d;
  });

  const handleCreateEvent = async () => {
      if (!newEvent.title) return;
      const start = new Date(currentDate);
      start.setHours(9, 0, 0); // Default 9 AM
      const end = new Date(start);
      end.setHours(10, 0, 0);

      const event = {
          id: Date.now().toString(),
          title: newEvent.title,
          start: start.toISOString(),
          end: end.toISOString(),
          description: newEvent.description,
          location: '',
          colorId: '1'
      };

      // Optimistic Update
      setEvents(prev => [...prev, { ...event, start, end }]);
      setIsCreating(false);
      setNewEvent({ title: '', start: '', end: '', description: '' });
      toast("Evento criado com sucesso");
      
      await bridge.createCalendarEvent(event);
  };

  const openMeet = () => {
      if (onOpenApp) {
          onOpenApp('meet');
      }
  };

  return (
    <div className="flex flex-col h-full bg-white text-[#3c4043] font-sans relative overflow-hidden">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="text-blue-600"><CalendarIcon size={24} fill="currentColor" className="text-blue-600"/></div>
                    <span className="text-[22px] text-gray-600 font-normal tracking-tight hidden md:inline">Calendar</span>
                </div>
                <button onClick={handleToday} className="px-3 py-1.5 border border-gray-300 rounded-[4px] text-sm font-medium hover:bg-gray-50 transition-colors ml-4">Hoje</button>
                <div className="flex items-center gap-1">
                    <button onClick={handlePrev} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button>
                    <button onClick={handleNext} className="p-1 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button>
                </div>
                <h2 className="text-xl text-gray-800 font-normal capitalize ml-2">{getMonthName()}</h2>
            </div>
            <div className="flex items-center gap-3">
                <div className="bg-gray-100 rounded-[4px] p-0.5 flex border border-gray-200">
                    <button onClick={() => setView('day')} className={`px-3 py-1 text-sm rounded-[2px] transition-colors ${view === 'day' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}>Dia</button>
                    <button onClick={() => setView('week')} className={`px-3 py-1 text-sm rounded-[2px] transition-colors ${view === 'week' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}>Semana</button>
                    <button onClick={() => setView('month')} className={`px-3 py-1 text-sm rounded-[2px] transition-colors ${view === 'month' ? 'bg-white shadow-sm font-medium' : 'hover:bg-gray-200'}`}>Mês</button>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><X size={24}/></button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-200 p-3 hidden md:flex flex-col gap-4">
                <button 
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-3 pl-3 pr-6 py-3 bg-white hover:bg-gray-50 rounded-full shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all w-fit"
                >
                    <Plus size={24} className="text-google-multi" />
                    <span className="font-medium text-sm font-google">Criar</span>
                </button>

                {/* Mini Calendar Mock */}
                <div className="px-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{getMonthName()}</span>
                        <div className="flex gap-2">
                            <span className="text-xs text-gray-500 cursor-pointer"><ChevronLeft size={16}/></span>
                            <span className="text-xs text-gray-500 cursor-pointer"><ChevronRight size={16}/></span>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 text-center text-[10px] text-gray-500 mb-1">
                        <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs gap-y-2">
                        {Array.from({length: 30}, (_, i) => (
                            <span key={i} className={`w-6 h-6 flex items-center justify-center rounded-full ${i+1 === currentDate.getDate() ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 cursor-pointer'}`}>{i+1}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col">
                {/* Week Header */}
                {view === 'week' && (
                    <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10 pl-14">
                        {weekDays.map((day, i) => {
                             const isToday = day.toDateString() === new Date().toDateString();
                             return (
                                <div key={i} className="flex-1 py-3 text-center border-l border-gray-200">
                                    <span className={`text-xs font-medium uppercase ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{day.toLocaleDateString('pt-BR', {weekday: 'short'})}</span>
                                    <div className={`text-2xl mt-1 w-10 h-10 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{day.getDate()}</div>
                                </div>
                             );
                        })}
                    </div>
                )}

                <div className="flex flex-1 relative">
                    {/* Time Column */}
                    {(view === 'day' || view === 'week') && (
                        <div className="w-14 shrink-0 flex flex-col items-end pr-2 pt-2 border-r border-gray-200 text-xs text-gray-500 gap-[44px]">
                            {hours.map(h => (
                                <span key={h} className="-mt-2">{h === 0 ? '' : `${h}:00`}</span>
                            ))}
                        </div>
                    )}

                    {/* Events Grid */}
                    <div className="flex-1 relative min-h-[1440px]">
                        {/* Horizontal Lines */}
                        {(view === 'day' || view === 'week') && hours.map(h => (
                            <div key={h} className="absolute w-full border-b border-gray-100 h-[60px]" style={{ top: h * 60 }}></div>
                        ))}

                        {/* Events Render */}
                        {events.map((ev: any) => {
                            // Filter logic for current view
                            const evStart = new Date(ev.start);
                            const evEnd = new Date(ev.end);
                            
                            // Simplified view logic
                            let isVisible = false;
                            let left = 0;
                            let width = 100;
                            
                            if (view === 'week') {
                                const startOfWeek = weekDays[0];
                                const endOfWeek = new Date(weekDays[6]);
                                endOfWeek.setHours(23,59,59);
                                if (evStart >= startOfWeek && evStart <= endOfWeek) {
                                    isVisible = true;
                                    left = (evStart.getDay()) * (100/7);
                                    width = (100/7) - 1;
                                }
                            } else if (view === 'day') {
                                if (evStart.getDate() === currentDate.getDate()) {
                                    isVisible = true;
                                }
                            }

                            if (!isVisible && view !== 'month') return null;

                            const startH = evStart.getHours() + (evStart.getMinutes()/60);
                            const duration = (evEnd.getTime() - evStart.getTime()) / (1000 * 60 * 60);

                            return (
                                <div 
                                    key={ev.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                    className={`absolute rounded-[4px] px-2 py-1 text-xs text-white cursor-pointer shadow-sm hover:brightness-105 border-l-4 border-black/10 overflow-hidden z-10 transition-all ${ev.color || 'bg-blue-600'}`}
                                    style={{ 
                                        top: `${startH * 60}px`, 
                                        height: `${duration * 60}px`,
                                        left: `${left}%`,
                                        width: `${width}%`
                                    }}
                                >
                                    <span className="font-medium">{ev.title}</span>
                                    <div className="text-[10px] opacity-90">{evStart.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {evEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* CREATE MODAL */}
        {isCreating && (
            <div className="absolute inset-0 bg-black/20 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-[448px] overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-gray-100 px-4 py-2 flex justify-end cursor-move">
                        <button onClick={() => setIsCreating(false)} className="hover:bg-gray-200 p-1 rounded"><X size={16}/></button>
                    </div>
                    <div className="p-6">
                        <input 
                            type="text" 
                            placeholder="Adicionar título" 
                            className="text-2xl w-full border-b border-gray-200 pb-2 mb-6 outline-none focus:border-blue-500 placeholder:text-gray-400"
                            autoFocus
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                        />
                        <div className="space-y-4">
                            <div className="flex gap-4 items-center text-sm text-gray-600">
                                <Clock size={18}/>
                                <span>{currentDate.toLocaleDateString()} • 09:00 - 10:00</span>
                            </div>
                            
                            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-[4px] py-2.5 font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all">
                                <Video size={18}/> Adicionar videoconferência do Google Meet
                            </button>

                            <div className="flex gap-4 items-start text-sm text-gray-600">
                                <AlignLeft size={18} className="mt-1"/>
                                <textarea 
                                    placeholder="Adicionar descrição" 
                                    className="w-full outline-none hover:bg-gray-50 p-1 rounded resize-none h-20"
                                    value={newEvent.description}
                                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-6">
                            <button onClick={handleCreateEvent} className="bg-blue-600 text-white px-6 py-2 rounded-[4px] text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* EVENT DETAIL POPOVER */}
        {selectedEvent && (
            <div className="absolute inset-0 z-50 flex items-center justify-center" onClick={() => setSelectedEvent(null)}>
                <div className="bg-white rounded-lg shadow-xl w-96 p-0 border border-gray-200 overflow-hidden animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end p-2 bg-gray-50">
                        <button className="p-1.5 hover:bg-gray-200 rounded"><MoreVertical size={16} className="text-gray-500"/></button>
                        <button onClick={() => setSelectedEvent(null)} className="p-1.5 hover:bg-gray-200 rounded"><X size={16} className="text-gray-500"/></button>
                    </div>
                    <div className="p-5 pt-2">
                        <div className="flex gap-4 mb-4">
                            <div className={`w-4 h-4 rounded-[4px] mt-1.5 ${selectedEvent.color || 'bg-blue-600'}`}></div>
                            <div>
                                <h3 className="text-xl font-normal text-gray-800">{selectedEvent.title}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {new Date(selectedEvent.start).toLocaleDateString()} • {new Date(selectedEvent.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(selectedEvent.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                        </div>

                        <button onClick={openMeet} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-[4px] py-2.5 font-medium text-sm flex items-center justify-center gap-2 mb-4 shadow-sm transition-all">
                            <Video size={18}/> Entrar com Google Meet
                        </button>
                        
                        <div className="space-y-3 pl-8">
                            {selectedEvent.description && (
                                <div className="flex gap-3 text-sm text-gray-600">
                                    <AlignLeft size={16} className="mt-0.5"/>
                                    <p>{selectedEvent.description}</p>
                                </div>
                            )}
                            <div className="flex gap-3 text-sm text-gray-600">
                                <CalendarIcon size={16} className="mt-0.5"/>
                                <p>{data.user.name}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
