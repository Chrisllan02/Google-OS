import React from 'react';

interface IconProps {
  className?: string;
  stroke?: string;
  size?: number | string;
  [key: string]: any;
}

export const GoogleIcons = {
  Gmail: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#EA4335" d="M19.5,4H4.5C2.5,4,1,5.5,1,7.5v12c0,2,1.5,3.5,3.5,3.5h15c2,0,3.5-1.5,3.5-3.5v-12C23,5.5,21.5,4,19.5,4z"/>
      <path fill="#FFF" d="M20.5,6.5L12,13L3.5,6.5"/>
      <path fill="#C5221F" d="M4.5,4h-1v15h1V4z"/>
      <path fill="#C5221F" d="M20.5,4h-1v15h1V4z"/>
      <g><path fill="#EA4335" d="M12,14L2,6.4V6l10,7.6L22,6v0.4L12,14z"/></g>
      <path d="M2,6l10,7.5L22,6v12c0,1.1-0.9,2-2,2H4c-1.1,0-2-0.9-2-2V6z" fill="none" stroke="none"/> 
    </svg>
  ),
  GmailGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="glassBodyDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#303134" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#202124" stopOpacity="0.4"/>
        </linearGradient>
        <linearGradient id="googleFluxDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285f4"/>
          <stop offset="35%" stopColor="#ea4335"/>
          <stop offset="65%" stopColor="#fbbc04"/>
          <stop offset="100%" stopColor="#34a853"/>
        </linearGradient>
        <linearGradient id="edgeShineDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
          <stop offset="50%" stopColor="white" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="236" height="236" rx="48" fill="url(#glassBodyDark)" stroke="url(#edgeShineDark)" strokeWidth="3"/>
      <path d="M48 80 L128 140 L208 80 v100 a20,20 0 0 1 -20,20 h-120 a20,20 0 0 1 -20,-20 Z" fill="none" stroke="url(#googleFluxDark)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}/>
      <path d="M10 50 Q 128 90 246 50 v-10 a48,48 0 0 0 -48,-48 h-140 a48,48 0 0 0 -48,48 Z" fill="white" fillOpacity="0.05"/>
    </svg>
  ),
  DriveGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="glassDrive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#303134" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#202124" stopOpacity="0.4"/>
        </linearGradient>
        <linearGradient id="edgeDrive" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
          <stop offset="50%" stopColor="white" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.2"/>
        </linearGradient>
        <linearGradient id="fluxDrive" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34A853"/>
          <stop offset="33%" stopColor="#FBBC04"/>
          <stop offset="66%" stopColor="#EA4335"/>
          <stop offset="100%" stopColor="#4285F4"/>
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="236" height="236" rx="48" fill="url(#glassDrive)" stroke="url(#edgeDrive)" strokeWidth="3"/>
      <path d="M 128 65 L 203 195 H 53 Z" stroke="url(#fluxDrive)" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{filter: 'drop-shadow(0 0 12px rgba(52, 168, 83, 0.4))'}} />
      <path d="M10 50 Q 128 90 246 50 v-10 a48,48 0 0 0 -48,-48 h-140 a48,48 0 0 0 -48,48 Z" fill="white" fillOpacity="0.05"/>
    </svg>
  ),
  SheetsGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="glassSheets" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b3022" stopOpacity="0.95"/>
          <stop offset="1" stopColor="#0d1f12" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="fluxSheets" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34a853"/>
          <stop offset="1" stopColor="#81c995"/>
        </linearGradient>
      </defs>
      <path d="M50 20 H160 L220 80 V226 C220 237 211 246 200 246 H50 C39 246 30 237 30 226 V46 C30 35 39 20 50 20 Z" fill="url(#glassSheets)" stroke="white" strokeWidth="2" strokeOpacity="0.15"/>
      <path d="M160 20 V70 C160 75.5 164.5 80 170 80 H220" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <g stroke="url(#fluxSheets)" strokeWidth="10" strokeLinecap="round" style={{filter: 'drop-shadow(0 0 6px rgba(129,201,149,0.5))'}}>
        <rect x="65" y="110" width="55" height="45" rx="6" fill="none"/>
        <rect x="130" y="110" width="55" height="45" rx="6" fill="none"/>
        <rect x="65" y="170" width="55" height="45" rx="6" fill="none"/>
        <rect x="130" y="170" width="55" height="45" rx="6" fill="none"/>
      </g>
    </svg>
  ),
  SlidesGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="glassSlides" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#332b1a" stopOpacity="0.95"/>
          <stop offset="1" stopColor="#1f190a" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="fluxSlides" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbc04"/>
          <stop offset="1" stopColor="#fdd663"/>
        </linearGradient>
      </defs>
      <path d="M50 20 H160 L220 80 V226 C220 237 211 246 200 246 H50 C39 246 30 237 30 226 V46 C30 35 39 20 50 20 Z" fill="url(#glassSlides)" stroke="white" strokeWidth="2" strokeOpacity="0.15"/>
      <path d="M160 20 V70 C160 75.5 164.5 80 170 80 H220" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <rect x="55" y="110" width="146" height="95" rx="8" stroke="url(#fluxSlides)" strokeWidth="6" fill="none" style={{filter: 'drop-shadow(0 0 4px rgba(253,214,99,0.3))'}}/>
      <g fill="url(#fluxSlides)" style={{filter: 'drop-shadow(0 0 8px rgba(253,214,99,0.6))'}}>
        <rect x="75" y="155" width="25" height="35" rx="4" />
        <rect x="115" y="140" width="25" height="50" rx="4" />
        <rect x="155" y="125" width="25" height="65" rx="4" />
      </g>
    </svg>
  ),
  DocsGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="glassDocs" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e2a3b" stopOpacity="0.9"/>
          <stop offset="1" stopColor="#0f172a" stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      <path d="M50 20 H160 L220 80 V226 C220 237 211 246 200 246 H50 C39 246 30 237 30 226 V46 C30 35 39 20 50 20 Z" fill="url(#glassDocs)" stroke="white" strokeWidth="2" strokeOpacity="0.15"/>
      <path d="M160 20 V70 C160 75.5 164.5 80 170 80 H220" fill="white" fillOpacity="0.1" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <g stroke="#4285f4" strokeWidth="16" strokeLinecap="round" fill="none" style={{filter: 'drop-shadow(0 0 8px rgba(66,133,244,0.8))'}}>
        <line x1="70" y1="120" x2="180" y2="120" />
        <line x1="70" y1="165" x2="180" y2="165" />
        <line x1="70" y1="210" x2="140" y2="210" />
      </g>
    </svg>
  ),
  MeetGlass: ({ className, size, ...props }: IconProps) => (
    <svg viewBox="0 0 256 256" className={className} width={size} height={size} {...props}>
      <defs>
        <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ea4335"/>
          <stop offset="100%" stopColor="#fbbc04"/>
        </linearGradient>
        <linearGradient id="gRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbc04"/>
          <stop offset="100%" stopColor="#34a853"/>
        </linearGradient>
        <linearGradient id="gBottom" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#34a853"/>
          <stop offset="100%" stopColor="#4285f4"/>
        </linearGradient>
        <linearGradient id="gLeft" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4285f4"/>
          <stop offset="100%" stopColor="#ea4335"/>
        </linearGradient>
      </defs>
      <path d="M 64 60 L 166 60 A 24 24 0 0 1 190 84" stroke="url(#gTop)" strokeWidth="20" strokeLinecap="round" fill="none" style={{filter: 'drop-shadow(0 0 6px rgba(234,67,53,0.4))'}} />
      <path d="M 190 84 V 100 L 240 70 V 186 L 190 156 V 172 A 24 24 0 0 1 166 196" stroke="url(#gRight)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{filter: 'drop-shadow(0 0 6px rgba(52,168,83,0.4))'}} />
      <path d="M 166 196 L 64 196 A 24 24 0 0 1 40 172" stroke="url(#gBottom)" strokeWidth="20" strokeLinecap="round" fill="none" style={{filter: 'drop-shadow(0 0 6px rgba(66,133,244,0.4))'}} />
      <path d="M 40 172 L 40 84 A 24 24 0 0 1 64 60" stroke="url(#gLeft)" strokeWidth="20" strokeLinecap="round" fill="none" style={{filter: 'drop-shadow(0 0 6px rgba(66,133,244,0.4))'}} />
    </svg>
  ),
  Drive: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#FFC107" d="M15.4,3L8.6,3L2.6,14L9.4,14L15.4,3Z"/>
      <path fill="#4285F4" d="M9.4,14L2.6,14L6,20L19.6,20L15.4,12.7L9.4,14Z"/>
      <path fill="#34A853" d="M15.4,3L15.4,12.7L19.6,20L23,14L15.4,3Z"/>
    </svg>
  ),
  Docs: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M14.5,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V7.5L14.5,2z"/>
      <path fill="#E0E0E0" d="M14,2v6h6"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="#FFF" strokeWidth="2"/>
      <line x1="8" y1="17" x2="13" y2="17" stroke="#FFF" strokeWidth="2"/>
      <line x1="8" y1="9" x2="10" y2="9" stroke="#FFF" strokeWidth="2"/>
    </svg>
  ),
  Sheets: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#34A853" d="M14.5,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V7.5L14.5,2z"/>
      <path fill="#E0E0E0" d="M14,2v6h6"/>
      <rect x="7" y="10" width="10" height="2" fill="#FFF"/>
      <rect x="7" y="14" width="6" height="2" fill="#FFF"/>
      <rect x="7" y="18" width="10" height="2" fill="#FFF"/>
      <line x1="10" y1="10" x2="10" y2="20" stroke="#FFF" strokeWidth="1"/>
    </svg>
  ),
  Slides: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#FBBC04" d="M14.5,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V7.5L14.5,2z"/>
      <path fill="#E0E0E0" d="M14,2v6h6"/>
      <rect x="7" y="11" width="10" height="7" rx="1" fill="#FFF" opacity="0.8"/>
      <path d="M14.5,2L20,7.5V20c0,1.1-0.9,2-2,2H6c-1.1,0-2-0.9-2-2V4c0-1.1,0.9-2,2-2H14.5z" fill="none" stroke="#E0E0E0" strokeWidth="0"/>
    </svg>
  ),
  Meet: ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="3" y="6" width="14" height="12" rx="2" fill="#00AC47"/>
      <path d="M17,12l5-4v8l-5-4z" fill="#00832D"/>
      <path d="M9,10l-1.5,3h3L9,10z" fill="#FFF"/> 
    </svg>
  ),
  Search: ({ className, stroke }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke || "currentColor"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  )
};

export const GeminiLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M11.6048 0.749534C11.8318 -0.249845 13.0682 -0.249845 13.2952 0.749534C14.0722 4.16248 16.7375 6.82782 20.1505 7.60475C21.1499 7.83181 21.1499 9.06819 20.1505 9.29525C16.7375 10.0722 14.0722 12.7375 13.2952 16.1505C13.0682 17.1498 11.8318 17.1498 11.6048 16.1505C10.8278 12.7375 8.16248 10.0722 4.74953 9.29525C3.75016 9.06819 3.75016 7.83181 4.74953 7.60475C8.16248 6.82782 10.8278 4.16248 11.6048 0.749534Z" fill="url(#gemini-gradient-logo)" />
    <path d="M19.1662 14.3948C19.2633 13.9669 19.7929 13.9669 19.8901 14.3948C20.2229 15.8576 21.365 16.9997 22.8277 17.3325C23.2556 17.4297 23.2556 17.9593 22.8277 18.0565C21.365 18.3892 20.2229 19.5314 19.8901 20.9941C19.7929 21.4221 19.2633 21.4221 19.1662 20.9941C18.8333 19.5314 17.6912 18.3892 16.2285 18.0565C15.8006 17.9593 15.8006 17.4297 16.2285 17.3325C17.6912 16.9997 18.8333 15.8576 19.1662 14.3948Z" fill="url(#gemini-gradient-logo)" />
    <defs>
      <linearGradient id="gemini-gradient-logo" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4E79F3"/>
        <stop offset="0.5" stopColor="#9c51b6"/>
        <stop offset="1" stopColor="#E95C67"/>
      </linearGradient>
      <linearGradient id="gemini-gradient-search" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4E79F3"/>
          <stop offset="50%" stopColor="#9c51b6"/>
          <stop offset="100%" stopColor="#E95C67"/>
      </linearGradient>
    </defs>
  </svg>
);