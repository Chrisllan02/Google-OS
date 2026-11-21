/**
 * Deterministic local SVG data-URI avatars & visual previews.
 * Eliminates fragile external stock photo dependencies (e.g., Unsplash).
 */
export function makeInitialsAvatar(name: string, bgHex = '#2563EB', fgHex = '#FFFFFF'): string {
  const parts = (name || 'U').trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : (parts[0] || 'U').slice(0, 2).toUpperCase();
  const safeInitials = initials.replace(/[^A-Z0-9]/g, '') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${bgHex}"/><text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle" fill="${fgHex}" font-family="Inter,system-ui,-apple-system,sans-serif" font-size="36" font-weight="600">${safeInitials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function makePreviewArtwork(title: string, accentFrom = '#2563EB', accentTo = '#7C3AED'): string {
  const safeTitle = (title || 'Preview').replace(/[<>&"']/g, '').slice(0, 32);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${accentFrom}"/><stop offset="100%" stop-color="${accentTo}"/></linearGradient></defs><rect width="600" height="360" fill="url(#g)"/><circle cx="480" cy="90" r="110" fill="rgba(255,255,255,0.14)"/><circle cx="130" cy="290" r="130" fill="rgba(255,255,255,0.10)"/><rect x="44" y="236" width="512" height="80" rx="18" fill="rgba(255,255,255,0.22)"/><text x="68" y="284" fill="#FFFFFF" font-family="Inter,system-ui,-apple-system,sans-serif" font-size="22" font-weight="600">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const TEAM_AVATARS = {
  chrisllan: makeInitialsAvatar('Chrisllan Franco', '#2563EB'),
  gabriel: makeInitialsAvatar('Gabriel Silva', '#7C3AED'),
  ana: makeInitialsAvatar('Ana Lima', '#DB2777'),
  pedro: makeInitialsAvatar('Pedro Moreira', '#0284C7'),
  carlos: makeInitialsAvatar('Carlos Eduardo', '#059669'),
  marina: makeInitialsAvatar('Marina Costa', '#D97706'),
} as const;
