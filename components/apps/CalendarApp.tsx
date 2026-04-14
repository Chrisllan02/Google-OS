
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Search, Settings, HelpCircle, 
  Menu, Plus, Calendar as CalendarIcon, MapPin, Users, 
  Video, X, Clock, AlignLeft, Check, MoreVertical, RotateCw, Eye, EyeOff, Bell,
  Globe, Video as VideoIcon, Trash2, Pencil, CheckCircle
} from 'lucide-react';
import { GoogleIcons } from '../GoogleIcons';
import { bridge, CalendarEvent, CalendarListEntry, EventGuest } from '../../utils/GASBridge';

interface CalendarAppProps {
  onClose: () => void;
  data: any;
  onOpenApp?: (type: string, data?: any) => void;
  showToast?: (msg: string) => void;
}

// FIX: Define an internal event type with Date objects to avoid type conflicts.
interface InternalCalendarEvent extends Omit<CalendarEvent, 'start' | 'end'> {
  start: Date;
  end: Date;
}

const arrangeEventsForDay = (events: InternalCalendarEvent[]) => {
    if (!events || events.length === 0) return [];
    const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    
    let columns: InternalCalendarEvent[][] = [];
    
    sortedEvents.forEach(event => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i][columns[i].length - 1].end.getTime() <= event.start.getTime()) {
                columns[i].push(event);
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
        }
    });

    const positionedEvents: (InternalCalendarEvent & { colIndex: number; totalCols: number })[] = [];
    for (let i = 0; i < columns.length; i++) {
        for (const event of columns[i]) {
            positionedEvents.push({
                ...event,
                colIndex: i,
                totalCols: columns.length
            });
        }
    }
    return positionedEvents;
};


export default function CalendarApp({ onClose, data, onOpenApp, showToast }: CalendarAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<InternalCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());
  
  const [editingEvent, setEditingEvent] = useState<InternalCalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<{event: InternalCalendarEvent, target: HTMLElement} | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<InternalCalendarEvent>>({});
  const [guestInput, setGuestInput] = useState('');

  const toast = (msg: string) => showToast && showToast(msg);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.event) {
        const initialEvent: InternalCalendarEvent = { ...data.event, start: new Date(data.event.start), end: new Date(data.event.end) };
        setCurrentDate(initialEvent.start);
        // We can't set a target, so we just open the editor directly
        setEditingEvent(initialEvent);
    }
  }, [data?.event]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewingEvent && popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setViewingEvent(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [viewingEvent]);

  useEffect(() => {
    const loadInitialData = async () => {
        const cals = await bridge.getCalendars();
        setCalendars(cals);
        setVisibleCalendars(new Set(cals.filter(c => c.checked).map(c => c.id)));
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      let start = new Date(currentDate);
      let end = new Date(currentDate);
      if (view === 'month') {
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
      } else if (view === 'week') {
        start.setDate(start.getDate() - start.getDay());
        end.setDate(end.getDate() - end.getDay() + 6);
      }
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      
      const allEvents: InternalCalendarEvent[] = [];
      for(const calId of visibleCalendars) {
          const calEvents = await bridge.getEvents(calId, start.toISOString(), end.toISOString());
          allEvents.push(...calEvents.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
      }
      setEvents(allEvents);
    };
    if (visibleCalendars.size > 0) fetchEvents();
  }, [currentDate, view, visibleCalendars]);

  const handleCreateOrUpdateEvent = async () => {
    const eventData = isCreating ? newEvent : editingEvent;
    if (!eventData || !eventData.title) { toast("O título é obrigatório."); return; }

    const isUpdate = !isCreating && eventData.id;

    const eventToSend: Partial<CalendarEvent> = {
      ...eventData,
      start: eventData.start ? new Date(eventData.start).toISOString() : undefined,
      end: eventData.end ? new Date(eventData.end).toISOString() : undefined,
    };

    if (isUpdate) {
        await bridge.updateCalendarEvent(eventToSend);
        setEvents(prev => prev.map(e => e.id === eventData.id ? (eventData as InternalCalendarEvent) : e));
        toast("Evento atualizado!");
    } else {
        const res = await bridge.createCalendarEvent(eventToSend);
        if(res.success && res.id) {
            setEvents(prev => [...prev, { ...eventData, id: res.id } as InternalCalendarEvent]);
            toast("Evento criado!");
        }
    }
    setIsCreating(false);
    setEditingEvent(null);
    setNewEvent({});
  };

  const handleDeleteEvent = async (id: string, calId?: string) => {
      await bridge.deleteCalendarEvent(id, calId);
      setEvents(prev => prev.filter(e => e.id !== id));
      setEditingEvent(null);
      setViewingEvent(null);
      toast("Evento excluído");
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };
  const handleToday = () => setCurrentDate(new Date());

  const getMonthName = () => currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  }), [currentDate]);

  const monthGrid = useMemo(() => {
    if (view !== 'month') return [];
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
    return grid;
  }, [currentDate, view]);
  
  const EventComponent: React.FC<{ event: InternalCalendarEvent & { colIndex: number; totalCols: number } }> = ({ event }) => {
    const top = event.start.getHours() * 60 + event.start.getMinutes();
    const height = Math.max(30, (event.end.getTime() - event.start.getTime()) / 60000);
    const width = 100 / event.totalCols;
    const left = event.colIndex * width;

    const isShort = height < 45;

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); setViewingEvent({event, target: e.currentTarget as HTMLElement}); }}
            className={`absolute rounded p-1.5 text-white text-xs overflow-hidden cursor-pointer border-l-4`}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                left: `${left}%`,
                width: `calc(${width}% - 2px)`,
                backgroundColor: event.color ? event.color + 'cc' : 'rgba(66,133,244,0.8)',
                borderColor: event.color || 'rgb(66,133,244)',
            }}
        >
            <p className="font-bold truncate">{event.title}</p>
            {!isShort && <p className="opacity-80">{event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {event.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>}
        </div>
    );
  };

  const renderDayOrWeekView = () => {
    const days = view === 'day' ? [currentDate] : weekDays;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex shrink-0 border-b border-gray-200">
                <div className="w-14 shrink-0"></div>
                {days.map(day => (
                    <div key={day.toISOString()} className="flex-1 border-l border-gray-200 p-2 text-center">
                        <span className={`text-xs ${day.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-gray-500'}`}>{day.toLocaleDateString('pt-BR', {weekday: 'short'})}</span>
                        <p className={`text-2xl ${day.toDateString() === new Date().toDateString() ? 'text-blue-600 font-bold bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center mx-auto' : 'text-gray-800'}`}>{day.getDate()}</p>
                    </div>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex h-full min-h-[1440px] relative">
                    <div className="w-14 shrink-0 -mt-2.5">
                        {hours.map(h => h > 0 && <div key={h} className="h-[60px] text-right pr-2 text-xs text-gray-400 relative pt-2.5">{h}:00</div>)}
                    </div>
                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                        {days.map((day, dayIndex) => (
                            <div key={dayIndex} className="relative border-l border-gray-200">
                                {hours.map(h => <div key={h} className="h-[60px] border-b border-gray-100"></div>)}
                                {arrangeEventsForDay(events.filter(e => e.start.toDateString() === day.toDateString())).map(ev => <EventComponent key={ev.id} event={ev} />)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const popoverStyle = useMemo(() => {
      if (!viewingEvent) return { display: 'none' };
      const rect = viewingEvent.target.getBoundingClientRect();
      const parentRect = popoverRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return { display: 'none' };
      return {
          display: 'block',
          top: `${rect.top - parentRect.top}px`,
          left: `${rect.right - parentRect.left + 8}px`,
      };
  }, [viewingEvent]);

  return (
    <div className="flex flex-col h-full bg-white text-[#3c4043] font-sans relative overflow-hidden">
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><CalendarIcon size={24} className="text-blue-600"/><span className="text-xl text-gray-600 tracking-tight hidden md:inline">Agenda</span></div>
                <button onClick={handleToday} className="px-3 py-1.5 border border-gray-300 rounded-[4px] text-sm font-medium hover:bg-gray-50 transition-colors ml-4">Hoje</button>
                <div className="flex items-center gap-1"><button onClick={handlePrev} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeft size={20}/></button><button onClick={handleNext} className="p-1 rounded-full hover:bg-gray-100"><ChevronRight size={20}/></button></div>
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

        <div className="flex-1 flex overflow-hidden relative">
            <div className="w-64 border-r border-gray-200 p-3 hidden md:flex flex-col gap-4 overflow-y-auto bg-gray-50 shrink-0">
                <button onClick={() => { setIsCreating(true); setNewEvent({ start: new Date(), end: new Date(Date.now() + 3600000), calendarId: 'primary' } as any); }} className="flex items-center gap-3 pl-3 pr-6 py-3 bg-white hover:bg-gray-50 rounded-full shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-lg transition-all w-fit"><Plus size={24} /><span className="font-medium text-sm">Criar</span></button>
                {calendars.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">Meus Calendários</p>
                    <div className="space-y-1">
                      {calendars.map(cal => (
                        <label key={cal.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleCalendars.has(cal.id)}
                            onChange={() => {
                              setVisibleCalendars(prev => {
                                const next = new Set(prev);
                                if (next.has(cal.id)) next.delete(cal.id); else next.add(cal.id);
                                return next;
                              });
                            }}
                            className="sr-only"
                          />
                          <div className="w-3 h-3 rounded-sm shrink-0 flex items-center justify-center border-2" style={{ borderColor: cal.color, backgroundColor: visibleCalendars.has(cal.id) ? cal.color : 'transparent' }}>
                            {visibleCalendars.has(cal.id) && <Check size={8} className="text-white" strokeWidth={3}/>}
                          </div>
                          <span className="text-sm text-gray-700 truncate">{cal.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            {view === 'month' ? (
                <div className="flex-1 grid grid-cols-7 grid-rows-6">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day} className="text-center text-xs font-medium text-gray-500 py-2 border-b border-gray-200">{day}</div>)}
                    {monthGrid.map((day, i) => (
                        <div key={i} className="border-l border-b border-gray-100 p-1 overflow-hidden">
                           {day && <span className={`text-xs ${day.toDateString() === new Date().toDateString() ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>{day.getDate()}</span>}
                           {day && events.filter(e => e.start.toDateString() === day.toDateString()).map(e => <div key={e.id} className="bg-blue-100 text-blue-800 text-[10px] rounded px-1 truncate mt-1">{e.title}</div>)}
                        </div>
                    ))}
                </div>
            ) : renderDayOrWeekView()}

            {viewingEvent && (
                <div ref={popoverRef} style={popoverStyle} className="absolute z-40 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 p-4 animate-in fade-in zoom-in duration-200 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-medium text-gray-800">{viewingEvent.event.title}</h3>
                        <div className="flex gap-1">
                            <button onClick={() => { setEditingEvent(viewingEvent.event); setViewingEvent(null); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><Pencil size={18}/></button>
                            <button onClick={() => handleDeleteEvent(viewingEvent.event.id)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><Trash2 size={18}/></button>
                            <button onClick={() => setViewingEvent(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={18}/></button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-600 flex items-center gap-2"><Clock size={16}/> {viewingEvent.event.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {viewingEvent.event.end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                    {viewingEvent.event.meetLink && <div className="text-sm text-blue-600 flex items-center gap-2"><VideoIcon size={16}/> Participar com Google Meet</div>}
                    {viewingEvent.event.location && <div className="text-sm text-gray-600 flex items-center gap-2"><MapPin size={16}/> {viewingEvent.event.location}</div>}
                </div>
            )}
        </div>
        
        {(isCreating || editingEvent) && (
             <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-sm" onClick={() => {setIsCreating(false); setEditingEvent(null)}}>
                <div className="bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden animate-in zoom-in" onClick={e => e.stopPropagation()}>
                    <div className="h-2 bg-blue-600"></div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-medium text-gray-700">{isCreating ? 'Novo evento' : 'Editar evento'}</h3>
                          <div className="flex gap-1">
                            {!isCreating && editingEvent && <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500" onClick={() => handleDeleteEvent(editingEvent.id, editingEvent.calendarId)}><Trash2 size={16}/></button>}
                            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500" onClick={() => {setIsCreating(false); setEditingEvent(null)}}><X size={16}/></button>
                          </div>
                        </div>
                        <input
                          type="text" placeholder="Adicionar título"
                          className="text-2xl w-full outline-none border-b border-gray-200 pb-2 focus:border-blue-500 transition-colors"
                          value={(isCreating ? newEvent.title : editingEvent?.title) || ''}
                          onChange={e => isCreating ? setNewEvent({...newEvent, title: e.target.value}) : editingEvent && setEditingEvent({...editingEvent, title: e.target.value})}
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Clock size={12}/> Início</label>
                            <input type="datetime-local"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                              value={(() => { const d = isCreating ? newEvent.start : editingEvent?.start; if (!d) return ''; const dt = new Date(d as any); return new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16); })()}
                              onChange={e => { const d = new Date(e.target.value); isCreating ? setNewEvent({...newEvent, start: d as any}) : editingEvent && setEditingEvent({...editingEvent, start: d}); }}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Clock size={12}/> Fim</label>
                            <input type="datetime-local"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                              value={(() => { const d = isCreating ? newEvent.end : editingEvent?.end; if (!d) return ''; const dt = new Date(d as any); return new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16); })()}
                              onChange={e => { const d = new Date(e.target.value); isCreating ? setNewEvent({...newEvent, end: d as any}) : editingEvent && setEditingEvent({...editingEvent, end: d}); }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><MapPin size={12}/> Local</label>
                          <input type="text" placeholder="Adicionar local"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                            value={(isCreating ? newEvent.location : editingEvent?.location) || ''}
                            onChange={e => isCreating ? setNewEvent({...newEvent, location: e.target.value}) : editingEvent && setEditingEvent({...editingEvent, location: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><AlignLeft size={12}/> Descrição</label>
                          <textarea placeholder="Adicionar descrição" rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                            value={(isCreating ? newEvent.description : editingEvent?.description) || ''}
                            onChange={e => isCreating ? setNewEvent({...newEvent, description: e.target.value}) : editingEvent && setEditingEvent({...editingEvent, description: e.target.value})}
                          />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-2">
                        <button onClick={() => {setIsCreating(false); setEditingEvent(null)}} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                        <button onClick={handleCreateOrUpdateEvent} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/30">Salvar</button>
                    </div>
                </div>
             </div>
        )}
    </div>
  );
}
