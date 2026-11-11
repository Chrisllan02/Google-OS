import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  isSeparator?: boolean;
  isDestructive?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  isDarkMode?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose, isDarkMode = false }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuWidth = menuRef.current.offsetWidth;
      const menuHeight = menuRef.current.offsetHeight;
      const { innerWidth, innerHeight } = window;

      let newX = x;
      let newY = y;

      if (x + menuWidth > innerWidth) {
        newX = innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > innerHeight) {
        newY = innerHeight - menuHeight - 10;
      }
      setPosition({ top: newY, left: newX });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[100] glass-popover rounded-2xl p-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
    >
      {items.map((item, index) => {
        if (item.isSeparator) {
          return <div key={index} className={`h-[1px] my-1 mx-1 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />;
        }
        return (
          <button
            key={index}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-lg transition-colors ${
              item.isDestructive
                ? 'text-red-500 hover:bg-red-500/10'
                : isDarkMode
                  ? 'text-white/80 hover:bg-white/10 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {item.icon && <div className="w-4">{item.icon}</div>}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;
