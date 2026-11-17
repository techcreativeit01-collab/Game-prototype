import React from 'react';
import { WeaponId } from '../types/game';

interface Props {
  weaponId: WeaponId;
  className?: string;
}

export const WeaponIllustration: React.FC<Props> = ({ weaponId, className = 'w-full h-20' }) => {
  switch (weaponId) {
    case WeaponId.KATANA:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <path d="M26 44 Q115 41 198 24 L204 29 Q118 47 26 48 Z" fill="#cbd5e1" />
          <rect x="52" y="34" width="5" height="22" rx="1.5" fill="#d97706" transform="rotate(-5 52 34)" />
          <path d="M16 45 L52 43 L53 49 L17 51 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
        </svg>
      );
    case WeaponId.M1911:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="64" y="18" width="94" height="15" rx="2" fill="#94a3b8" />
          <rect x="70" y="33" width="66" height="8" fill="#475569" />
          <path d="M72 36 L62 60 L82 60 L90 36 Z" fill="#7c4a2d" />
          <rect x="94" y="38" width="18" height="12" rx="2" stroke="#64748b" strokeWidth="2.5" />
          <rect x="155" y="21" width="10" height="7" fill="#cbd5e1" />
        </svg>
      );
    case WeaponId.UZI:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="58" y="20" width="90" height="18" rx="2" fill="#475569" />
          <rect x="148" y="24" width="32" height="7" fill="#94a3b8" />
          <rect x="94" y="38" width="16" height="26" rx="1" fill="#334155" />
          <rect x="90" y="36" width="24" height="12" fill="#1e293b" />
          <rect x="42" y="24" width="16" height="8" fill="#64748b" />
        </svg>
      );
    case WeaponId.BENELLI_M4:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="82" y="22" width="114" height="7" fill="#64748b" />
          <rect x="92" y="30" width="94" height="6" fill="#475569" />
          <rect x="108" y="29" width="46" height="11" rx="2" fill="#1e293b" />
          <rect x="60" y="22" width="46" height="14" rx="2" fill="#334155" />
          <path d="M22 30 L62 24 L62 36 L22 44 Z" fill="#1e293b" />
          <path d="M56 35 L50 54 L64 54 L68 35 Z" fill="#334155" />
        </svg>
      );
    case WeaponId.AK74:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="140" y="24" width="60" height="5" fill="#64748b" />
          <rect x="196" y="22" width="10" height="9" fill="#94a3b8" />
          <rect x="114" y="22" width="44" height="12" rx="1" fill="#7c4a2d" />
          <rect x="64" y="22" width="52" height="14" fill="#334155" />
          <path d="M20 28 L64 23 L64 35 L20 44 Z" fill="#7c4a2d" />
          <path d="M100 36 Q104 54 116 62 L128 57 Q117 48 114 36 Z" fill="#9a4e26" />
          <path d="M72 36 L66 55 L78 55 L82 36 Z" fill="#7c4a2d" />
        </svg>
      );
    case WeaponId.M4:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="148" y="25" width="52" height="5" fill="#475569" />
          <rect x="108" y="21" width="46" height="12" fill="#64748b" />
          <rect x="62" y="21" width="48" height="15" fill="#334155" />
          <rect x="76" y="13" width="22" height="8" rx="1" fill="#475569" />
          <circle cx="87" cy="17" r="2" fill="#ef4444" />
          <rect x="16" y="21" width="46" height="16" rx="2" fill="#1e293b" />
          <path d="M98 36 L102 58 L116 57 L112 36 Z" fill="#475569" />
          <path d="M68 36 L61 54 L73 54 L78 36 Z" fill="#1e293b" />
        </svg>
      );
    case WeaponId.M107:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="122" y="25" width="76" height="6" fill="#64748b" />
          <rect x="196" y="22" width="14" height="12" rx="1" fill="#94a3b8" />
          <rect x="58" y="22" width="66" height="16" fill="#334155" />
          <rect x="74" y="11" width="54" height="9" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <rect x="12" y="24" width="46" height="15" fill="#1e293b" />
          <rect x="92" y="38" width="24" height="18" fill="#475569" />
          <path d="M148 31 L160 52 M148 31 L138 52" stroke="#64748b" strokeWidth="2.5" />
        </svg>
      );
    case WeaponId.M249:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="124" y="23" width="74" height="6" fill="#94a3b8" />
          <rect x="112" y="19" width="44" height="13" fill="#475569" />
          <rect x="58" y="19" width="56" height="17" fill="#334155" />
          <rect x="86" y="36" width="32" height="22" rx="2" fill="#3f5236" />
          <rect x="14" y="21" width="44" height="16" fill="#1e293b" />
          <rect x="122" y="11" width="24" height="6" fill="#1e293b" />
        </svg>
      );
    case WeaponId.M2:
      return (
        <svg viewBox="0 0 220 70" className={className} fill="none">
          <rect x="122" y="24" width="84" height="7" fill="#cbd5e1" />
          <rect x="108" y="19" width="46" height="16" fill="#475569" />
          <rect x="40" y="17" width="70" height="22" rx="2" fill="#334155" />
          <rect x="24" y="18" width="14" height="20" rx="2" stroke="#94a3b8" strokeWidth="2.5" />
          <rect x="64" y="39" width="38" height="22" rx="2" fill="#364731" />
          <rect x="68" y="33" width="14" height="7" fill="#d97706" />
        </svg>
      );
  }
};
