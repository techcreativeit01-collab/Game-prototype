import React from 'react';
import { AVATAR_PRESETS } from '../data/GameData';

interface Props {
  avatarId: number;
  size?: number;
  className?: string;
}

export const AvatarBadge: React.FC<Props> = ({ avatarId, size = 36, className = '' }) => {
  const preset = AVATAR_PRESETS[Math.abs(avatarId) % AVATAR_PRESETS.length] ?? AVATAR_PRESETS[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`rounded-md border border-white/20 shrink-0 ${className}`}
      aria-label={preset.label}
    >
      <rect width="40" height="40" rx="6" fill={preset.bg} />
      {/* Tactical shoulder silhouette */}
      <path d="M6 39 C8 29 14 26 20 26 C26 26 32 29 34 39 Z" fill="#0f141c" stroke={preset.trim} strokeWidth="1.2" />
      {/* Helmet & hood */}
      <path d="M12 18 C12 10 15.5 7 20 7 C24.5 7 28 10 28 18 L27 24 L13 24 Z" fill="#18202c" stroke={preset.trim} strokeWidth="1.2" />
      {/* Visor */}
      <rect x="14" y="15" width="12" height="4" rx="1.5" fill={preset.visor} />
      <rect x="15.5" y="16" width="4" height="1.2" rx="0.5" fill="#ffffff" fillOpacity="0.65" />
    </svg>
  );
};
