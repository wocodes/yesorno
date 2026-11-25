import React, { useState } from 'react';
import { FavoriteClub } from '../types';

interface Props {
  club: FavoriteClub;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  showShortName?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { box: 'w-4 h-4', text: 'text-[8px]', label: 'text-[10px]' },
  sm: { box: 'w-5 h-5', text: 'text-[9px]', label: 'text-xs' },
  md: { box: 'w-6 h-6', text: 'text-[10px]', label: 'text-xs' },
  lg: { box: 'w-8 h-8', text: 'text-xs', label: 'text-sm' },
};

/**
 * Renders a club crest image with automatic fallback to a colored shield monogram.
 */
export const ClubBadge: React.FC<Props> = ({
  club,
  size = 'sm',
  showName = false,
  showShortName = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const dims = SIZE_MAP[size];

  const badge = !club.logoUrl || imgError ? (
    <span
      className={`${dims.box} rounded-full inline-flex items-center justify-center font-black text-white shrink-0 shadow-2xs border border-white/25 ${dims.text}`}
      style={{ backgroundColor: club.color || '#10b981' }}
      title={club.name}
    >
      {club.shortName.slice(0, 3)}
    </span>
  ) : (
    <img
      src={club.logoUrl}
      alt={`${club.name} crest`}
      loading="lazy"
      onError={() => setImgError(true)}
      className={`${dims.box} object-contain shrink-0`}
    />
  );

  if (!showName && !showShortName) {
    return <span className={`inline-flex items-center ${className}`}>{badge}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {badge}
      <span className={`${dims.label} font-bold truncate`}>
        {showName ? club.name : club.shortName}
      </span>
    </span>
  );
};
