import React, { useState } from 'react';

interface TooltipProps {
  label: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip = ({ label, children, position = 'top', delay = 200, className = '' }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      onMouseEnter={show} 
      onMouseLeave={hide} 
      onFocus={show} 
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${positions[position]} z-[100] px-3 py-1.5 text-xs font-medium text-white bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.5)] whitespace-nowrap animate-in fade-in zoom-in duration-200 pointer-events-none select-none`}>
          {label}
        </div>
      )}
    </div>
  );
};