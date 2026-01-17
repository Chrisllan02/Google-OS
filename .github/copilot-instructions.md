npm run dev
# Abrir http://localhost:3000
# Clicar em "Novo" → Menu aparece ✅# AI Coding Agent Instructions for Google-OS

## Project Overview
**Google-OS** is a React + TypeScript dashboard UI that simulates Google workspace applications (Gmail, Drive, Docs, Meet, etc.) with a modern glass-morphism design. It uses **Vite** for bundling, **Tailwind CSS** for styling, and **ogl** for WebGL effects (Aurora background animation).

The architecture is component-based with a main dashboard (`App.tsx`) that renders individual app modules on demand through a centralized `AppViewer` component.

---

## Architecture & Component Patterns

### Core Component Structure
- **[App.tsx](App.tsx)**: Main dashboard component managing global state (loading, chat, active app, search)
- **[components/AppViewer.tsx](components/AppViewer.tsx)**: Router component that conditionally renders specific apps based on `type` prop
- **[components/apps/](components/apps/)**: Individual app implementations (7 modules: Mail, Drive, Editor, Meet, Keep, Tasks, Search)

### Key State Management Pattern
Apps receive data as props from the parent component and manage internal UI state independently. No external state library (Redux/Zustand) is used. Example from [components/apps/MailApp.tsx](components/apps/MailApp.tsx#L1):
```tsx
const [folder, setFolder] = useState('inbox');
const [selectedEmails, setSelectedEmails] = useState<Set<number>>(new Set());
const [isTyping, setIsTyping] = useState(false);
```

### Design System Patterns
- **Glass-morphism containers**: `bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[20px]`
- **Dark theme**: Primary bg `#191919`, secondary `#2d2e30`, borders use `white/10` opacity
- **Icon system**: Custom SVG Google icons in [GoogleIcons.tsx](components/GoogleIcons.tsx), combined with `lucide-react` for system icons
- **Reusable sub-components**: Custom components (Checkbox, ToggleSwitch, AdvancedFilterPanel) are defined within app files, not extracted

---

## Build & Development Workflow

### Commands
- `npm run dev`: Start Vite dev server on port 3000
- `npm run build`: Production build (outputs to `dist/`)
- `npm run preview`: Preview built output locally

### Environment Configuration
- **API Key**: `GEMINI_API_KEY` is injected via `.env.local` and exposed to the client in [vite.config.ts](vite.config.ts) as `process.env.GEMINI_API_KEY`
- **Vite alias**: `@/` resolves to workspace root for absolute imports

### TypeScript Configuration
- **Target**: ES2022 with JSX support (`react-jsx`)
- **Module resolution**: bundler mode (works with Vite's native ESM)
- **Path alias**: `@/*` maps to project root

---

## Critical Patterns & Conventions

### Mock Data Pattern
Apps receive a `data` prop containing mock information. Example from [App.tsx](App.tsx#L79-L110):
```tsx
const data = {
  user: { name, email, avatar },
  emails: [...],
  files: [...],
  tasks: [...]
};
```
New apps should follow this structure and consume data via props, not fetch.

### App Module Interface Pattern
All app components follow this interface:
```tsx
interface [AppName]Props {
  onClose: () => void;      // Callback to close modal
  data: any;                // Mock data object
  searchQuery?: string;     // Optional search filter
}
```

### Conditional Rendering in AppViewer
Apps are mapped via a switch statement in [AppViewer.tsx](components/AppViewer.tsx#L19-L28). To add a new app:
1. Create component in `components/apps/[AppName].tsx`
2. Add case in AppViewer's `renderApp()` switch
3. Register type string (e.g., `'mail'`, `'drive'`)

### Animation & Transitions
- Use Tailwind classes: `animate-in`, `zoom-in`, `fade-in`, `slide-in-from-right-10`
- Custom keyframes defined in [index.html](index.html#L32-L49) (not using external animate library)
- Duration: `duration-300` is standard

### Custom UI Components (Sub-component Pattern)
Reusable controls are defined within app files rather than extracted:
- `Checkbox`: Toggle with checkmark indicator (MailApp)
- `ToggleSwitch`: Animated toggle control (MailApp)
- `AdvancedFilterPanel`: Expandable filter overlay (MailApp)

---

## File Organization & Import Conventions

```
/components
  ├── AppViewer.tsx          (App router)
  ├── Aurora.tsx             (WebGL effect component)
  ├── GoogleIcons.tsx        (Custom SVG icon library)
  ├── GoogleLoader.tsx       (Loading spinner)
  └── /apps
      ├── MailApp.tsx        (Largest ~1100 lines)
      ├── DriveApp.tsx
      └── [5 other apps]
```

Use absolute imports where possible:
```tsx
import AppViewer from './components/AppViewer';
import { GoogleIcons } from './components/GoogleIcons';
```

---

## Performance & Code Quality Considerations

1. **No external HTTP calls**: All data is mocked and returned via `fetchMockData()` promise in App.tsx
2. **Heavy WebGL component**: Aurora.tsx uses `ogl` library for GPU-accelerated background—avoid re-renders with `useRef` and `useEffect` callbacks
3. **Large component files**: MailApp.tsx is ~1138 lines; split into sub-components for maintainability if exceeding 1500 lines
4. **Styling approach**: All Tailwind, no CSS modules or CSS-in-JS—ensure className strings are kept in templates

---

## Common Tasks

### Adding a New App
1. Create [components/apps/NewApp.tsx](components/apps/) with props interface
2. Add case in [AppViewer.tsx](components/AppViewer.tsx#L19-L28) switch statement
3. Call `App.tsx` to pass `data` prop and `onClose` handler

### Implementing New Menus (Like "Novo")
The "Novo" menu in [MailApp.tsx](components/apps/MailApp.tsx#L637-L665) shows the pattern:
1. Add state: `const [showNewMenu, setShowNewMenu] = useState(false);`
2. Add ref to close on outside click: `const newMenuRef = useRef<HTMLDivElement>(null);`
3. Add useEffect for click-outside handler
4. Render dropdown with options that trigger state changes (e.g., `setActivePane('compose')`)
5. Use glass-morphism styling: `bg-[#2d2e30] border border-white/10 rounded-2xl`

### Updating Mock Data
Edit `fetchMockData()` in [App.tsx](App.tsx#L61-L110) and return new property structure.

### Extending GoogleIcons
Add SVG icon to [GoogleIcons.tsx](components/GoogleIcons.tsx) export object following existing pattern (gradient defs + paths).

### Debugging Dev Environment
- Check GEMINI_API_KEY is set in `.env.local` (though not used in current mock implementation)
- Vite proxy configured on `0.0.0.0:3000` for network access
- Browser DevTools: React DevTools extension works with `react@19.2.3`

---

## Deployment Architecture

**Dual Deployment Model:**
- **Option 1 - Apps Script** (`script/`): Production environment integrated with Google Workspace
- **Option 2 - Vercel** (`studio/`): Public demo for UX testing

**Critical Rule**: Everything developed in `studio/` must be replicated in `script/` as vanilla HTML/JavaScript.

See [DEPLOYMENT_GUIDE.md](.github/DEPLOYMENT_GUIDE.md) for complete instructions.

---

## References
- **React**: v19.2.3 (latest)
- **TypeScript**: ~5.8.2
- **Vite**: v6.2.0
- **Tailwind**: CDN-loaded (not npm)
- **Icons**: lucide-react + custom GoogleIcons
- **Graphics**: ogl (WebGL renderer)
