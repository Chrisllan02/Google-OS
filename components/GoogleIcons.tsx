import React from 'react';

interface IconProps {
  className?: string;
  stroke?: string;
  size?: number | string;
  [key: string]: any;
}

export const GoogleIcons = {
  // Official Gmail (2020 4-color M)
  Gmail: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="52 42 88 66" className={className}>
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
    </svg>
  ),

  // Official Google Drive (2020 3-color Triangle)
  Drive: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78" className={className}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  ),

  // Official Google Calendar (2020 4-color with 31)
  Calendar: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 201 201" className={className}>
      <path fill="#FFFFFF" d="M148.9 43.6l-47.4-5.3-57.9 5.3-5.2 52.6 5.2 52.6 52.6 6.6 52.6-6.6 5.3-53.9-5.2-51.3z"/>
      <path fill="#1A73E8" d="M65.2 125.3c-3.9-2.7-6.7-6.5-8.1-11.7l9.1-3.8c.8 3.2 2.3 5.6 4.3 7.3 2.1 1.7 4.6 2.6 7.5 2.6 3 0 5.6-.9 7.7-2.7 2.1-1.8 3.2-4.1 3.2-6.9 0-2.9-1.1-5.2-3.4-7s-5.1-2.7-8.5-2.7H72v-9h4.5c2.9 0 5.4-.8 7.4-2.4 2-1.6 3-3.7 3-6.5 0-2.4-.9-4.4-2.7-5.9s-4.1-2.2-6.8-2.2c-2.7 0-4.8.7-6.4 2.1-1.6 1.4-2.7 3.2-3.4 5.3l-9-3.8c1.2-3.4 3.4-6.4 6.6-9 3.2-2.6 7.3-3.9 12.3-3.9 3.7 0 7 .7 10 2.1 2.9 1.4 5.3 3.4 6.9 5.9 1.7 2.5 2.5 5.4 2.5 8.5 0 3.2-.8 5.9-2.3 8.2-1.6 2.2-3.5 3.9-5.7 5.1v.5c3 1.3 5.4 3.2 7.3 5.7s2.9 5.6 2.9 9.2c0 3.6-.9 6.8-2.7 9.6-1.8 2.8-4.3 5-7.5 6.6-3.2 1.6-6.8 2.4-10.8 2.4-4.8.1-9-1.2-12.9-3.9z"/>
      <path fill="#1A73E8" d="M121.3 80l-10 7.2-5-7.6 18-13h6.9v61.2h-9.9V80z"/>
      <path fill="#EA4335" d="M148.9 196.2l47.4-47.4-23.7-10.5-23.7 10.5-10.5 23.7 10.5 23.7z"/>
      <path fill="#34A853" d="M33.1 172.6l10.5 23.7h105.3v-47.4H43.6l-10.5 23.7z"/>
      <path fill="#4285F4" d="M12-3.8C3.3-3.8-3.8 3.3-3.8 12v136.8l23.7 10.5 23.7-10.5V43.6h105.3l10.5-23.7L148.9-3.8H12z"/>
      <path fill="#188038" d="M-3.8 148.9v31.6c0 8.7 7.1 15.8 15.8 15.8h31.6v-47.4H-3.8z"/>
      <path fill="#FBBC04" d="M148.9 43.6v105.3h47.4V43.6l-23.7-10.5-23.7 10.5z"/>
      <path fill="#1967D2" d="M196.2 43.6V12c0-8.7-7.1-15.8-15.8-15.8h-31.6v47.4h47.4z"/>
    </svg>
  ),

  // Official Google Meet (2020 4-color Camera)
  Meet: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 87.5 72" className={className}>
      <path fill="#00832d" d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"/>
      <path fill="#0066da" d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"/>
      <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z"/>
      <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z"/>
      <path fill="#00ac47" d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"/>
      <path fill="#ffba00" d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"/>
    </svg>
  ),

  // Official Google Docs (2020 Document)
  Docs: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 88" className={className}>
      <path d="M 42,0 64,22 53,24 42,22 40,11 Z" fill="#1967d2" />
      <path d="M 42,22 V 0 H 6 C 2.685,0 0,2.685 0,6 v 76 c 0,3.315 2.685,6 6,6 h 52 c 3.315,0 6,-2.685 6,-6 V 22 Z" fill="#4285f4" />
      <path d="M 16,39 h 32 v 5 H 16 Z M 16,49 h 32 v 5 H 16 Z M 16,59 h 20 v 5 H 16 Z" fill="#fff" />
    </svg>
  ),

  // Official Google Sheets (2020 Spreadsheet)
  Sheets: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 88" className={className}>
      <path d="M 42,0 64,22 53,24 42,22 40,11 Z" fill="#188038" />
      <path d="M 42,22 V 0 H 6 C 2.685,0 0,2.685 0,6 v 76 c 0,3.315 2.685,6 6,6 h 52 c 3.315,0 6,-2.685 6,-6 V 22 Z" fill="#34a853" />
      <path d="M 12,34 V 63 H 52 V 34 Z M 29.5,58 H 17 v -7 h 12.5 z m 0,-12 H 17 V 39 H 29.5 Z M 47,58 H 34.5 V 51 H 47 Z M 47,46 H 34.5 V 39 H 47 Z" fill="#fff" />
    </svg>
  ),

  // Official Google Slides (2020 Presentation)
  Slides: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 88" className={className}>
      <path d="M 42,0 64,22 53,24 42,22 40,11 Z" fill="#e37400" />
      <path d="M 42,22 V 0 H 6 C 2.685,0 0,2.685 0,6 v 76 c 0,3.315 2.685,6 6,6 h 52 c 3.315,0 6,-2.685 6,-6 V 22 Z" fill="#fbbc04" />
      <rect x="14" y="35" width="36" height="24" rx="2" fill="#fff" />
      <rect x="17" y="38" width="30" height="18" rx="1" fill="#fbbc04" />
    </svg>
  ),

  // Official Google Keep (2020 Note with Lightbulb)
  Keep: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 88" className={className}>
      <path d="M 42,22 54.065,24.28 64,22 42,0 38.965,10.43 Z" fill="#f29900" />
      <path d="M 42,22 V 0 H 6 C 2.685,0 0,2.685 0,6 v 76 c 0,3.315 2.685,6 6,6 h 52 c 3.315,0 6,-2.685 6,-6 V 22 Z" fill="#fbbc04" />
      <path d="M 39,64 H 25 V 59 H 39 Z M 38.92501,54 H 25.075 C 21.425,51.7 19,47.635 19,43 c 0,-7.18 5.82,-13 13,-13 7.18,0 13,5.82 13,13 0,4.635 -2.425,8.7 -6.075,11 z" fill="#fff" />
    </svg>
  ),

  // Official Google Tasks (2021 Blue Checkmark Loop)
  Tasks: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 535 500" className={className}>
      <polygon fill="#0066DA" points="410.4,58.3 368.8,81.2 348.2,120.6 368.8,168.8 407.8,211 450,187.5 475.9,142.8 450,87.5" />
      <path fill="#2684FC" d="M249.3,219.4l98.9-98.9c29.1,22.1,50.5,53.8,59.6,90.4L272.1,346.7c-12.2,12.2-32,12.2-44.2,0l-91.5-91.5 c-9.8-9.8-9.8-25.6,0-35.3l39-39c9.8-9.8,25.6-9.8,35.3,0L249.3,219.4z M519.8,63.6l-39.7-39.7c-9.7-9.7-25.6-9.7-35.3,0 l-34.4,34.4c27.5,23,49.9,51.8,65.5,84.5l43.9-43.9C529.6,89.2,529.6,73.3,519.8,63.6z M412.5,250c0,89.8-72.8,162.5-162.5,162.5 S87.5,339.8,87.5,250S160.2,87.5,250,87.5c36.9,0,70.9,12.3,98.2,33.1l62.2-62.2C367,21.9,311.1,0,250,0C111.9,0,0,111.9,0,250 s111.9,250,250,250s250-111.9,250-250c0-38.3-8.7-74.7-24.1-107.2L407.8,211C410.8,223.5,412.5,236.6,412.5,250z" />
    </svg>
  ),

  // Official Google 4-Color "G" (Search)
  Search: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
    </svg>
  ),

  // Official Google Security / Admin Shield
  Security: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path fill="#1A73E8" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
      <path fill="#4285F4" d="M12 1v22c5.16-1.26 9-6.45 9-12V5l-9-4z"/>
      <path fill="#FFFFFF" d="M12 6a3 3 0 0 0-3 3v2H8v6h8v-6h-1V9a3 3 0 0 0-3-3zm0 2a1 1 0 0 1 1 1v2h-2V9a1 1 0 0 1 1-1z"/>
    </svg>
  ),

  // Official Google Contacts (Permissions / Users)
  Contacts: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" className={className}>
      <path fill="#86a9ff" d="M199 244c-89 0-161 71-161 160v67c0 16 13 29 29 29h77l77-256z"/>
      <path fill="#578cff" d="M462 349c0-58-48-105-106-105h-77v256h77c58 0 106-47 106-106"/>
      <path fill="#0057cc" d="M115 349c0-58 48-105 106-105h58c58 0 106 47 106 105v45c0 59-48 106-106 106H144c-16 0-29-13-29-29z"/>
      <circle cx="250" cy="99.4" r="99.4" fill="#0057cc"/>
    </svg>
  ),

  // Official Google Material 3 Settings
  Settings: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path fill="#8AB4F8" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  ),

  // Google 9-dots App Launcher (Waffle)
  AppsGrid: ({ className }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="6" cy="6" r="2"/>
      <circle cx="12" cy="6" r="2"/>
      <circle cx="18" cy="6" r="2"/>
      <circle cx="6" cy="12" r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="18" cy="12" r="2"/>
      <circle cx="6" cy="18" r="2"/>
      <circle cx="12" cy="18" r="2"/>
      <circle cx="18" cy="18" r="2"/>
    </svg>
  ),

  // Legacy Glass Aliases (redirect to the official icons)
  GmailGlass: (props: IconProps) => <GoogleIcons.Gmail {...props} />,
  DriveGlass: (props: IconProps) => <GoogleIcons.Drive {...props} />,
  DocsGlass: (props: IconProps) => <GoogleIcons.Docs {...props} />,
  SheetsGlass: (props: IconProps) => <GoogleIcons.Sheets {...props} />,
  SlidesGlass: (props: IconProps) => <GoogleIcons.Slides {...props} />,
  MeetGlass: (props: IconProps) => <GoogleIcons.Meet {...props} />,
};

export const GeminiLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M11.6048 0.749534C11.8318 -0.249845 13.0682 -0.249845 13.2952 0.749534C14.0722 4.16248 16.7375 6.82782 20.1505 7.60475C21.1499 7.83181 21.1499 9.06819 20.1505 9.29525C16.7375 10.0722 14.0722 12.7375 13.2952 16.1505C13.0682 17.1498 11.8318 17.1498 11.6048 16.1505C10.8278 12.7375 8.16248 10.0722 4.74953 9.29525C3.75016 9.06819 3.75016 7.83181 4.74953 7.60475C8.16248 6.82782 10.8278 4.16248 11.6048 0.749534Z" fill="url(#gemini-gradient-logo)" />
    <path d="M19.1662 14.3948C19.2633 13.9669 19.7929 13.9669 19.8901 14.3948C20.2229 15.8576 21.365 16.9997 22.8277 17.3325C23.2556 17.4297 23.2556 17.9593 22.8277 18.0565C21.365 18.3892 20.2229 19.5314 19.8901 20.9941C19.7929 21.4221 19.2633 21.4221 19.1662 20.9941C18.8333 19.5314 17.6912 18.3892 16.2285 18.0565C15.8006 17.9593 15.8006 17.4297 16.2285 17.3325C17.6912 16.9997 18.8333 15.8576 19.1662 14.3948Z" fill="url(#gemini-gradient-logo)" />
    <defs>
      <linearGradient id="gemini-gradient-logo" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4E79F3"/>
        <stop offset="50%" stopColor="#9c51b6"/>
        <stop offset="100%" stopColor="#E95C67"/>
      </linearGradient>
    </defs>
  </svg>
);