import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface DayForecast {
    date: string;
    dayName: string;
    code: number;
    max: number;
    min: number;
}

interface WmoInfo { emoji: string; label: string; anim?: string; }

const WMO: Record<number, WmoInfo> = {
    0:  { emoji: '☀️',  label: 'Ensolarado',          anim: 'spin-slow' },
    1:  { emoji: '🌤️', label: 'Principalmente limpo', anim: 'pulse-slow' },
    2:  { emoji: '⛅',  label: 'Parcialmente nublado' },
    3:  { emoji: '☁️',  label: 'Nublado' },
    45: { emoji: '🌫️', label: 'Névoa' },
    48: { emoji: '🌫️', label: 'Névoa gelada' },
    51: { emoji: '🌦️', label: 'Chuvisco leve',        anim: 'bounce-slow' },
    53: { emoji: '🌦️', label: 'Chuvisco',             anim: 'bounce-slow' },
    55: { emoji: '🌦️', label: 'Chuvisco intenso',     anim: 'bounce-slow' },
    61: { emoji: '🌧️', label: 'Chuva leve',           anim: 'bounce-slow' },
    63: { emoji: '🌧️', label: 'Chuva',                anim: 'bounce-slow' },
    65: { emoji: '🌧️', label: 'Chuva forte',          anim: 'bounce-slow' },
    71: { emoji: '🌨️', label: 'Neve leve',            anim: 'pulse-slow' },
    73: { emoji: '🌨️', label: 'Neve',                 anim: 'pulse-slow' },
    75: { emoji: '🌨️', label: 'Neve forte',           anim: 'pulse-slow' },
    80: { emoji: '🌦️', label: 'Pancadas leves',       anim: 'bounce-slow' },
    81: { emoji: '🌦️', label: 'Pancadas',             anim: 'bounce-slow' },
    82: { emoji: '🌦️', label: 'Pancadas fortes',      anim: 'bounce-slow' },
    85: { emoji: '🌨️', label: 'Neve em pancadas' },
    86: { emoji: '🌨️', label: 'Neve forte em pancadas' },
    95: { emoji: '⛈️',  label: 'Trovoada',            anim: 'pulse-slow' },
    96: { emoji: '⛈️',  label: 'Trovoada c/ granizo', anim: 'pulse-slow' },
    99: { emoji: '⛈️',  label: 'Trovoada c/ granizo', anim: 'pulse-slow' },
};

function getWmo(code: number): WmoInfo {
    if (WMO[code]) return WMO[code];
    // fallback: find nearest lower key
    const keys = Object.keys(WMO).map(Number).sort((a, b) => b - a);
    const match = keys.find(k => k <= code);
    return match !== undefined ? WMO[match] : { emoji: '🌡️', label: 'Desconhecido' };
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface WeatherWidgetProps {
    darkMode: boolean;
    textColor: string;
    fallbackTemp?: string;
}

const animStyle = (anim?: string): React.CSSProperties => {
    if (anim === 'spin-slow')   return { animation: 'spin 8s linear infinite' };
    if (anim === 'pulse-slow')  return { animation: 'pulse 3s ease-in-out infinite' };
    if (anim === 'bounce-slow') return { animation: 'bounce 2s ease-in-out infinite' };
    return {};
};

export default function WeatherWidget({ darkMode, textColor, fallbackTemp }: WeatherWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [currentTemp, setCurrentTemp] = useState<string | null>(null);
    const [currentCode, setCurrentCode] = useState<number>(0);
    const [location, setLocation] = useState<string>('');
    const [forecast, setForecast] = useState<DayForecast[]>([]);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const panelRef = useRef<HTMLDivElement>(null);
    const didLoad = useRef(false);

    const loadWeather = () => {
        setLoadState('loading');
        setErrorMsg('');
        if (!navigator.geolocation) {
            setErrorMsg('Geolocalização não suportada');
            setLoadState('error');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                try {
                    const { latitude, longitude } = coords;
                    const res = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
                        `&daily=weathercode,temperature_2m_max,temperature_2m_min&current_weather=true&timezone=auto&forecast_days=7`
                    );
                    if (!res.ok) throw new Error('API error');
                    const json = await res.json();

                    // derive city from timezone string e.g. "America/Sao_Paulo" → "Sao Paulo"
                    const tz: string = json.timezone || '';
                    const city = tz.split('/').pop()?.replace(/_/g, ' ') || 'Minha localização';
                    setLocation(city);
                    setCurrentTemp(`${Math.round(json.current_weather.temperature)}°`);
                    setCurrentCode(json.current_weather.weathercode);

                    const days: DayForecast[] = (json.daily.time as string[]).map((date: string, i: number) => ({
                        date,
                        dayName: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DAYS_PT[new Date(date + 'T12:00:00').getDay()],
                        code: json.daily.weathercode[i],
                        max: Math.round(json.daily.temperature_2m_max[i]),
                        min: Math.round(json.daily.temperature_2m_min[i]),
                    }));
                    setForecast(days);
                    setLoadState('done');
                } catch {
                    setErrorMsg('Não foi possível obter o clima');
                    setLoadState('error');
                }
            },
            () => {
                setErrorMsg('Permissão de localização negada');
                setLoadState('error');
            },
            { timeout: 10000 }
        );
    };

    // Auto-load once on mount
    useEffect(() => {
        if (!didLoad.current) {
            didLoad.current = true;
            loadWeather();
        }
    }, []);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const displayTemp = currentTemp || fallbackTemp || '--°';
    const wmo = getWmo(currentCode);

    const pillClass = `flex items-center gap-2 px-4 py-2 backdrop-blur-2xl border rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
        darkMode
            ? 'bg-white/5 border-white/10 hover:bg-white/10'
            : 'bg-black/5 border-black/5 hover:bg-black/10'
    } ${textColor}`;

    const subColor = darkMode ? 'text-white/40' : 'text-black/40';
    const panelBg  = darkMode ? 'bg-[#1e1e1e]/95 border-white/10' : 'bg-white/95 border-black/10';
    const rowHover = darkMode ? 'hover:bg-white/5' : 'hover:bg-black/5';

    return (
        <div className="relative hidden md:block" ref={panelRef}>
            {/* Pill trigger */}
            <button onClick={() => setIsOpen(v => !v)} className={pillClass} aria-label="Previsão do tempo">
                <span
                    className="text-base leading-none"
                    style={loadState === 'done' ? animStyle(wmo.anim) : undefined}
                >
                    {loadState === 'done' ? wmo.emoji : '🌡️'}
                </span>
                <span>{displayTemp}</span>
                {location && (
                    <span className={subColor}>· {location}</span>
                )}
            </button>

            {/* Expanded forecast panel */}
            {isOpen && (
                <div
                    className={`absolute top-12 right-0 w-[300px] ${panelBg} backdrop-blur-xl border rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200`}
                >
                    {/* Panel header */}
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className={`text-sm font-semibold ${textColor}`}>
                                {location || 'Previsão do Tempo'}
                            </h3>
                            {loadState === 'done' && (
                                <p className={`text-xs ${subColor}`}>{wmo.label}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={loadWeather}
                                className={`p-1.5 rounded-full ${darkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/5 text-black/40'} transition-colors`}
                                title="Atualizar"
                            >
                                <RefreshCw size={13} className={loadState === 'loading' ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className={`p-1.5 rounded-full ${darkMode ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/5 text-black/40'} transition-colors`}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Loading state */}
                    {loadState === 'loading' && (
                        <div className={`text-center py-8 text-xs ${subColor}`}>
                            Obtendo localização e clima…
                        </div>
                    )}

                    {/* Error state */}
                    {loadState === 'error' && (
                        <div className="text-center py-6">
                            <p className={`text-xs ${subColor} mb-3`}>{errorMsg}</p>
                            <button
                                onClick={loadWeather}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {/* 7-day forecast */}
                    {loadState === 'done' && forecast.length > 0 && (
                        <div className="space-y-0.5">
                            {forecast.map((day, i) => {
                                const dWmo = getWmo(day.code);
                                const isToday = i === 0;
                                return (
                                    <div
                                        key={day.date}
                                        className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${rowHover} ${isToday ? (darkMode ? 'bg-white/[0.06]' : 'bg-black/[0.04]') : ''}`}
                                    >
                                        <span className={`text-xs w-14 ${isToday ? `${textColor} font-semibold` : subColor}`}>
                                            {day.dayName}
                                        </span>
                                        <span
                                            className="text-lg leading-none"
                                            style={isToday ? animStyle(dWmo.anim) : undefined}
                                        >
                                            {dWmo.emoji}
                                        </span>
                                        <div className="flex items-center gap-3 text-xs min-w-[52px] justify-end">
                                            <span className={`font-medium ${textColor}`}>{day.max}°</span>
                                            <span className={subColor}>{day.min}°</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
