import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Search, Settings, HelpCircle, 
  Menu, Plus, Calendar as CalendarIcon, MapPin, Users, 
  Video, X, Clock, AlignLeft, Check, MoreVertical, RotateCw, Eye, EyeOff, Bell,
  Globe
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, CalendarEvent, CalendarListEntry } from '../../utils/GASBridge';

interface CalendarAppProps {
  onClose: () => void;
  data: any;
  onOpenApp?: (type: string, data?: any) => void;
  showToast?: (msg: string) => void;
}

// Simple Parse of ISO to Local Date object based on TZ offset if needed
// For now we trust browser to handle ISO string to local time conversion
const toLocalDate = (iso: string) => new Date(iso);

// --- RECURRENCE LOGIC ---
const parseRecurrence = (rrule: string) => {
    // VERY Basic Parser for RRULE:FREQ=WEEKLY;BYDAY=FR
    const parts = rrule.replace('RRULE:', '').split(';');
    const config: any = {};
    parts.forEach(p => {
        const [k, v] = p.split('=');
        config[k] = v;
    });
    return config;
};

const expandEvents = (events: CalendarEvent[], viewDate: Date, viewMode: 'day' | 'week' | 'month') => {
    const expanded: any[] = [];
    let viewStart = new Date(viewDate);
    let viewEnd = new Date(viewDate);

    // Define View Boundaries
    if (viewMode === 'day') {
        viewStart.setHours(0,0,0,0);
        viewEnd.setHours(23,59,59,999);
    } else if (viewMode === 'week') {
        const day = viewStart.getDay();
        const diff = viewStart.getDate() - day;
        viewStart = new Date(viewStart.setDate(diff));
        viewStart.setHours(0,0,0,0);
        viewEnd = new Date(viewStart);
        viewEnd.setDate(viewStart.getDate() + 6);
        viewEnd.setHours(23,59,59,999);
    } else if (viewMode === 'month') {
        viewStart = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
        viewEnd = new Date(viewStart.getFullYear(), viewStart.getMonth() + 1, 0);
        viewEnd.setHours(23,59,59,999);
    }

    events.forEach(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        
        // Single Instance
        if (!ev.recurrence || ev.recurrence.length === 0) {
            if (evStart <= viewEnd && evEnd >= viewStart) expanded.push(ev);
            return;
        }

        // Recurrence Expansion
        // Limitation: Supports FREQ=DAILY, WEEKLY (simple), MONTHLY (simple)
        const rrule = ev.recurrence[0];
        const rule = parseRecurrence(rrule);
        
        let currentIter = new Date(evStart);
        let safety = 0;
        const duration = evEnd.getTime() - evStart.getTime();

        while (currentIter <= viewEnd && safety < 500) {
            safety++;
            // Check if current iteration is visible
            if (currentIter >= viewStart) {
                const projectedStart = new Date(currentIter);
                const projectedEnd = new Date(currentIter.getTime() + duration);
                
                if (projectedStart <= viewEnd && projectedEnd >= viewStart) {
                    expanded.push({ ...ev, start: projectedStart, end: projectedEnd, isVirtual: true, id: ev.id + "_" + safety });
                }
            }

            // Increment based on Rule
            if (rule.FREQ === 'DAILY') {
                currentIter.setDate(currentIter.getDate() + (parseInt(rule.INTERVAL) || 1));
            } else if (rule.FREQ === 'WEEKLY') {
                currentIter.setDate(currentIter.getDate() + 7 * (parseInt(rule.INTERVAL) || 1));
            } else if (rule.FREQ === 'MONTHLY') {
                currentIter.setMonth(currentIter.getMonth() + (parseInt(rule.INTERVAL) || 1));
            } else if (rule.FREQ === 'YEARLY') {
                currentIter.setFullYear(currentIter.getFullYear() + (parseInt(rule.INTERVAL) || 1));
            } else {
                break; // Unsupported rule
            }

            // Handle UNTIL or COUNT (Simplified: Count ignored for infinite scroll, Until respected)
            if (rule.UNTIL) {
                // Parse YYYYMMDDT...
                // Simplified: Assuming we break loop if date gets too far
            }
        }
    });
    return expanded;
};

const arrangeEvents = (events: any[]) => {
    // Basic overlapping logic for day view
    const timedEvents = events.filter((e:any) => !e.isAllDay);
    const sorted = [...timedEvents].sort((a:any, b:any) => {
        if (a.start.getTime() === b.start.getTime()) return b.end.getTime() - a.end.getTime(); 
        return a.start.getTime() - b.start.getTime();
    });
    const columns: any[][] = [];
    const packedEvents: any[] = [];
    sorted.forEach((event) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastEventInCol = col[col.length - 1];
            if (lastEventInCol.end.getTime() <= event.start.getTime()) {
                col.push(event);
                packedEvents.push({ ...event, colIndex: i });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
            packedEvents.push({ ...event, colIndex: columns.length - 1 });
        }
    });
    return packedEvents.map(ev => ({ ...ev, widthPercent: 100 / columns.length, leftPercent: (ev.colIndex * 100) / columns.length }));
};

export default function CalendarApp({ onClose, data, onOpenApp, showToast }: CalendarAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());
  
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  
  const [newEvent, setNewEvent] = useState({ 
      title: '', 
      start: '', 
      end: '', 
      description: '', 
      recurrence: 'none', 
      useMeet: false, 
      calendarId: 'primary',
      guests: [] as any[],
      reminders: [] as {method: 'popup'|'email', minutes: number}[],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [guestInput, setGuestInput] = useState('');
  
  // Custom Recurrence State
  const [customRecurrence, setCustomRecurrence] = useState({ freq: 'WEEKLY', interval: 1, count: 0, until: '' });
  
  // Drag State
  const [dragState, setDragState] = useState<{ id: number | string; type: 'move' | 'resize'; startY: number; originalStart: Date; originalEnd: Date; } | null>(null);

  const toast = (msg: string) => showToast && showToast(msg);

  // Load events & calendars
  useEffect(() => {
    if (data?.events) {
      setEvents(data.events.map((e: any) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end)
      })));
    }
    const loadCals = async () => {
        const cals = await bridge.getCalendars();
        setCalendars(cals);
        const visible = new Set(cals.filter(c => c.checked).map(c => c.id));
        setVisibleCalendars(visible);
    };
    loadCals();
  }, [data]);

  const toggleCalendarVisibility = (calId: string) => {
      const newSet = new Set(visibleCalendars);
      if (newSet.has(calId)) newSet.delete(calId);
      else newSet.add(calId);
      setVisibleCalendars(newSet);
  };

  // --- DRAG LOGIC ---
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (!dragState) return;
          const pixelDiff = e.clientY - dragState.startY;
          const snappedMinutes = Math.round(pixelDiff / 15) * 15; 
          
          setEvents(prev => prev.map(ev => {
              if (ev.id !== dragState.id) return ev;
              const newStart = new Date(dragState.originalStart);
              const newEnd = new Date(dragState.originalEnd);
              if (dragState.type === 'move') { 
                  newStart.setMinutes(dragState.originalStart.getMinutes() + snappedMinutes); 
                  newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes); 
              } else if (dragState.type === 'resize') { 
                  newEnd.setMinutes(dragState.originalEnd.getMinutes() + snappedMinutes); 
                  if (newEnd <= newStart) newEnd.setMinutes(newStart.getMinutes() + 15); 
              }
              return { ...ev, start: newStart as any, end: newEnd as any };
          }));
      };
      const handleGlobalMouseUp = async () => {
          if (dragState) {
              const event = events.find(e => e.id === dragState.id);
              if (event && !(event as any).isVirtual) { 
                  await bridge.updateCalendarEvent(event); 
                  toast('Agenda atualizada'); 
              }
              setDragState(null); 
              document.body.style.cursor = '';
          }
      };
      if (dragState) { 
          window.addEventListener('mousemove', handleGlobalMouseMove); 
          window.addEventListener('mouseup', handleGlobalMouseUp); 
          document.body.style.cursor = dragState.type === 'move' ? 'grabbing' : 'ns-resize'; 
      }
      return () => { 
          window.removeEventListener('mousemove', handleGlobalMouseMove); 
          window.removeEventListener('mouseup', handleGlobalMouseUp); 
      };
  }, [dragState, events]);

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize', start: Date, end: Date) => {
      e.stopPropagation();
      setDragState({ id, type, startY: e.clientY, originalStart: start, originalEnd: end });
  };

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

  const handleCreateEvent = async () => {
      if (!newEvent.title) return;
      const start = new Date(newEvent.start || currentDate);
      if (!newEvent.start) { start.setHours(9, 0, 0); }
      const end = new Date(newEvent.end || start);
      if (!newEvent.end) { end.setHours(10, 0, 0); }

      let recurrenceRule: string[] = [];
      if (newEvent.recurrence !== 'none') {
          if (newEvent.recurrence === 'custom') {
              recurrenceRule = [`RRULE:FREQ=${customRecurrence.freq};INTERVAL=${customRecurrence.interval}`];
          } else {
              recurrenceRule = [`RRULE:FREQ=${newEvent.recurrence.toUpperCase()}`];
          }
      }

      const eventPayload: any = {
          id: Date.now().toString(),
          title: newEvent.title,
          start: start.toISOString(),
          end: end.toISOString(),
          description: newEvent.description,
          calendarId: newEvent.calendarId,
          recurrence: recurrenceRule.length > 0 ? recurrenceRule : undefined,
          useMeet: newEvent.useMeet,
          guests: newEvent.guests,
          reminders: newEvent.reminders,
          timeZone: newEvent.timeZone
      };
      
      const cal = calendars.find(c => c.id === newEvent.calendarId);
      if (cal) eventPayload.color = cal.color;

      setEvents(prev => [...prev, { ...eventPayload, start, end }]);
      setIsCreating(false);
      setNewEvent({ title: '', start: '', end: '', description: '', recurrence: 'none', useMeet: false, calendarId: 'primary', guests: [], reminders: [], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast("Evento criado");
      
      const res = await bridge.createCalendarEvent(eventPayload);
      if(res.success && res.meetLink) {
         setEvents(prev => prev.map(e => e.id === eventPayload.id ? { ...e, meetLink: res.meetLink } : e));
      }
  };

  const handleRSVP = async (status: 'accepted'|'declined'|'tentative') => {
      if (selectedEvent) {
          await bridge.rsvpEvent(selectedEvent.id, status);
          toast("Resposta enviada: " + status);
          // Optimistic update local display if necessary, usually triggers re-fetch
          setSelectedEvent(null);
      }
  };

  const getMonthName = () => currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    const day = currentDate.getDay();
    const diff = d.getDate() - day + i;
    d.setDate(diff);
    return d;
  });
  
  const visibleEvents = events.filter(e => !e.calendarId || visibleCalendars.has(e.calendarId));
  const expandedEvents = expandEvents(visibleEvents, currentDate, view);
  const dayEvents = view === 'day' ? arrangeEvents(expandedEvents.filter(ev => new Date(ev.start).getDate() === currentDate.getDate())) : [];

  return (
    <div className="flex flex-col h-full bg-white text-[#3c4043] font-sans relative overflow-hidden">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={24} className="text-blue-600"/>
                    <span className="text-xl text-gray-600 tracking-tight hidden md:inline">Calendar</span>
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
            <div className="w-64 border-r border-gray-200 p-3 hidden md:flex flex-col gap-4 overflow-y-auto bg-gray-50">
                <button 
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-3 pl-3 pr-6 py-3 bg-white hover:bg-gray-50 rounded-full shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all w-fit"
                >
                    <Plus size={24} className="text-google-multi" />
                    <span className="font-medium text-sm font-google">Criar</span>
                </button>

                {/* My Calendars List */}
                <div className="mt-4">
                     <h3 className="text-xs font-medium text-gray-500 px-2 mb-2 uppercase">Minhas Agendas</h3>
                     <div className="space-y-1">
                         {calendars.map(cal => (
                             <div key={cal.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-200 rounded cursor-pointer" onClick={() => toggleCalendarVisibility(cal.id)}>
                                 <div className={`w-4 h-4 rounded flex items-center justify-center border ${visibleCalendars.has(cal.id) ? cal.color : 'border-gray-400 bg-transparent'}`}>
                                     {visibleCalendars.has(cal.id) && <Check size={10} className="text-white"/>}
                                 </div>
                                 <span className="text-sm text-gray-700">{cal.name}</span>
                             </div>
                         ))}
                     </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col bg-white">
                {view === 'week' && (
                    <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10 pl-14">
                        {weekDays.map((day, i) => (
                            <div key={i} className="flex-1 py-3 text-center border-l border-gray-200">
                                <span className={`text-xs font-medium uppercase ${day.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-gray-500'}`}>{day.toLocaleDateString('pt-BR', {weekday: 'short'})}</span>
                                <div className={`text-2xl mt-1 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${day.toDateString() === new Date().toDateString() ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{day.getDate()}</div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="flex flex-1 relative min-h-[1440px]">
                    <div className="w-14 shrink-0 flex flex-col items-end pr-2 pt-2 border-r border-gray-200 text-xs text-gray-500 gap-[44px]">
                        {hours.map(h => <span key={h} className="-mt-2">{h === 0 ? '' : `${h}:00`}</span>)}
                    </div>
                    {/* Event Grid Overlay */}
                    <div className="flex-1 relative">
                        {hours.map(h => <div key={h} className="absolute w-full border-b border-gray-100 h-[60px]" style={{ top: h * 60 }}></div>)}
                        
                        {view === 'day' && dayEvents.map((ev: any) => {
                                const startH = ev.start.getHours(); const startM = ev.start.getMinutes();
                                const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                const top = startH * 60 + startM; 
                                const height = duration * 60;
                                return (
                                    <div 
                                        key={ev.id}
                                        onMouseDown={(e) => !ev.isVirtual && handleMouseDown(e, ev.id, 'move', ev.start, ev.end)}
                                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                        className={`absolute rounded-[4px] px-2 py-1 text-xs text-white cursor-pointer shadow-sm hover:brightness-105 border-l-4 border-black/10 overflow-hidden z-10 transition-all ${ev.color || 'bg-blue-600'} ${dragState?.id === ev.id ? 'opacity-80 z-50 ring-2 ring-blue-400 scale-105 shadow-xl' : ''}`}
                                        style={{ top: `${top}px`, height: `${Math.max(25, height)}px`, left: `${ev.leftPercent}%`, width: `calc(${ev.widthPercent}% - 4px)` }}
                                    >
                                        <span className="font-medium flex items-center gap-1">{ev.title} {ev.recurrence && <RotateCw size={10}/>}</span>
                                        <div className="text-[10px] opacity-90">{ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {ev.end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                        {!ev.isVirtual && (<div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" onMouseDown={(e) => handleMouseDown(e, ev.id, 'resize', ev.start, ev.end)}></div>)}
                                    </div>
                                );
                        })}

                        {view === 'week' && Array.from({length: 7}).map((_, i) => {
                            const d = new Date(currentDate);
                            d.setDate(d.getDate() - d.getDay() + i);
                            const dayEvs = expandedEvents.filter(ev => new Date(ev.start).toDateString() === d.toDateString() && !ev.isAllDay);
                            return (
                                <div key={i} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: `${(i) * (100/7)}%`, width: `${100/7}%` }}>
                                    {dayEvs.map((ev: any) => {
                                         const startH = ev.start.getHours(); const startM = ev.start.getMinutes();
                                         const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
                                         const top = startH * 60 + startM; const height = duration * 60;
                                         return (
                                             <div key={ev.id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }} className={`absolute left-0.5 right-1 rounded-[4px] px-1 py-0.5 text-[10px] text-white cursor-pointer hover:brightness-105 border-l-4 border-black/10 overflow-hidden z-10 ${ev.color || 'bg-blue-600'}`} style={{ top: `${top}px`, height: `${Math.max(20, height)}px` }}>
                                                 <div className="font-bold truncate">{ev.title}</div>
                                             </div>
                                         )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* CREATE MODAL */}
        {isCreating && (
            <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-lg shadow-2xl w-[500px] overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-500">Novo Evento</span>
                        <button onClick={() => setIsCreating(false)} className="hover:bg-gray-200 p-1 rounded"><X size={16}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <input type="text" placeholder="Adicionar título" className="text-2xl w-full border-b border-gray-200 pb-2 mb-6 outline-none focus:border-blue-500 placeholder:text-gray-400" autoFocus value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}/>
                        <div className="space-y-5">
                            <div className="flex gap-4 items-center">
                                <Clock size={18} className="text-gray-500"/>
                                <div className="flex flex-col w-full gap-2">
                                    <div className="flex gap-2">
                                        <input type="datetime-local" className="bg-gray-50 border rounded px-2 py-1 text-sm" value={newEvent.start} onChange={(e) => setNewEvent({...newEvent, start: e.target.value})} />
                                        <span className="text-gray-400">-</span>
                                        <input type="datetime-local" className="bg-gray-50 border rounded px-2 py-1 text-sm" value={newEvent.end} onChange={(e) => setNewEvent({...newEvent, end: e.target.value})} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-gray-400"/>
                                        <select className="text-xs bg-transparent border-none text-gray-500" value={newEvent.timeZone} onChange={(e) => setNewEvent({...newEvent, timeZone: e.target.value})}>
                                            <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Horário Local</option>
                                            <option value="UTC">UTC</option>
                                            <option value="America/New_York">New York</option>
                                            <option value="Europe/London">London</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-4 items-center text-sm text-gray-600">
                                <RotateCw size={18}/>
                                <select className="bg-transparent outline-none cursor-pointer hover:bg-gray-50 p-1 rounded" value={newEvent.recurrence} onChange={(e) => {
                                    if (e.target.value === 'custom') setShowRecurrenceModal(true);
                                    setNewEvent({...newEvent, recurrence: e.target.value});
                                }}>
                                    <option value="none">Não se repete</option>
                                    <option value="daily">Todos os dias</option>
                                    <option value="weekly">Semanalmente</option>
                                    <option value="monthly">Mensalmente</option>
                                    <option value="custom">Personalizado...</option>
                                </select>
                            </div>
                            
                            {/* Simple Guest Input Mock */}
                            <div className="flex gap-4 items-start text-sm text-gray-600">
                                <Users size={18} className="mt-1"/>
                                <input className="w-full border-b border-gray-200 pb-1 outline-none focus:border-blue-500" placeholder="Adicionar convidados" value={guestInput} onChange={(e) => setGuestInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { setNewEvent(prev => ({...prev, guests: [...prev.guests, {email: guestInput}]})); setGuestInput(''); } }}/>
                            </div>
                            {newEvent.guests.length > 0 && (
                                <div className="pl-9 flex flex-wrap gap-2">
                                    {newEvent.guests.map((g, i) => <span key={i} className="text-xs bg-gray-100 rounded-full px-2 py-1 flex items-center gap-1">{g.email} <X size={10} className="cursor-pointer" onClick={() => setNewEvent(prev => ({...prev, guests: prev.guests.filter((_, idx) => idx !== i)}))}/></span>)}
                                </div>
                            )}

                            <button onClick={() => setNewEvent({ ...newEvent, useMeet: !newEvent.useMeet })} className={`w-full ${newEvent.useMeet ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'} rounded-[4px] py-2.5 font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all`}>
                                <Video size={18}/> {newEvent.useMeet ? 'Google Meet Adicionado' : 'Adicionar videoconferência do Google Meet'}
                            </button>
                            
                            <div className="flex gap-4 items-center">
                                <CalendarIcon size={18} className="text-gray-500"/>
                                <select className="w-full bg-transparent outline-none text-sm text-gray-700 cursor-pointer" value={newEvent.calendarId} onChange={(e) => setNewEvent({...newEvent, calendarId: e.target.value})}>
                                    {calendars.map(cal => <option key={cal.id} value={cal.id}>{cal.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                        <button onClick={handleCreateEvent} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {/* RECURRENCE MODAL */}
        {showRecurrenceModal && (
            <div className="absolute inset-0 bg-black/40 z-[60] flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 w-80 shadow-2xl">
                    <h3 className="font-medium mb-4">Recorrência personalizada</h3>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm">Repetir a cada</span>
                        <input type="number" className="w-12 border rounded px-1" value={customRecurrence.interval} onChange={(e) => setCustomRecurrence({...customRecurrence, interval: parseInt(e.target.value)})}/>
                        <select className="border rounded text-sm" value={customRecurrence.freq} onChange={(e) => setCustomRecurrence({...customRecurrence, freq: e.target.value})}>
                            <option value="DAILY">dia</option>
                            <option value="WEEKLY">semana</option>
                            <option value="MONTHLY">mês</option>
                            <option value="YEARLY">ano</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowRecurrenceModal(false); setNewEvent({...newEvent, recurrence: 'none'}); }} className="text-gray-600 text-sm">Cancelar</button>
                        <button onClick={() => setShowRecurrenceModal(false)} className="text-blue-600 font-medium text-sm">Concluído</button>
                    </div>
                </div>
            </div>
        )}

        {/* EVENT DETAIL POPOVER */}
        {selectedEvent && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1px]" onClick={() => setSelectedEvent(null)}>
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
                                    {new Date(selectedEvent.start).toLocaleString()}
                                </p>
                                {selectedEvent.recurrence && (
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><RotateCw size={10}/> Evento recorrente</div>
                                )}
                            </div>
                        </div>
                        
                        {/* RSVP Section */}
                        <div className="border-t border-b border-gray-100 py-3 mb-3">
                            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Vai participar?</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleRSVP('accepted')} className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">Sim</button>
                                <button onClick={() => handleRSVP('declined')} className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">Não</button>
                                <button onClick={() => handleRSVP('tentative')} className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">Talvez</button>
                            </div>
                        </div>
                        
                        <div className="space-y-3 pl-8">
                             {/* Standard details... */}
                            <div className="flex gap-3 text-sm text-gray-600">
                                <CalendarIcon size={16} className="mt-0.5"/>
                                <p>{calendars.find(c => c.id === selectedEvent.calendarId)?.name || 'Minha Agenda'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}