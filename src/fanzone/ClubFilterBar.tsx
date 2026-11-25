import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Shield } from 'lucide-react';
import { FavoriteClub } from '../types';
import { GLOBAL_CLUBS, TOP_20_CLUBS } from './config';
import { ClubBadge } from './ClubBadge';

interface Props {
  selectedClub: FavoriteClub | null;
  onSelectClub: (club: FavoriteClub | null) => void;
}

/**
 * Top-of-feed FanZone club filter featuring a live club search dropdown (with crests)
 * and a horizontally scrollable bar of the world's top 20 clubs.
 */
export const ClubFilterBar: React.FC<Props> = ({ selectedClub, onSelectClub }) => {
  const [clubQuery, setClubQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchMatches = useMemo(() => {
    const q = clubQuery.trim().toLowerCase();
    const list = GLOBAL_CLUBS.filter(c => c.id !== 'neutral');
    if (!q) return [];
    return list.filter(club =>
      club.name.toLowerCase().includes(q) ||
      club.shortName.toLowerCase().includes(q) ||
      club.league.toLowerCase().includes(q) ||
      (club.aliases || []).some(a => a.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [clubQuery]);

  const handleChooseFromDropdown = (club: FavoriteClub) => {
    onSelectClub(club);
    setClubQuery('');
    setIsDropdownOpen(false);
  };

  const isSelectedInTop20 = selectedClub ? TOP_20_CLUBS.some(c => c.id === selectedClub.id) : true;

  return (
    <div className="space-y-2.5 bg-white/90 dark:bg-ink-900/90 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-emerald-500/20 dark:border-emerald-500/20 shadow-soft">
      {/* Row 1: Club Search + Selected Non-Top-20 Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div ref={wrapperRef} className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={clubQuery}
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => {
              setClubQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            placeholder="Filter by club name or nickname (e.g. Arsenal, Barça, Gunners)..."
            className="w-full text-xs pl-9 pr-8 py-2 rounded-xl bg-slate-100/80 dark:bg-ink-950 text-ink-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 border border-transparent focus:border-emerald-500/50 focus:bg-white dark:focus:bg-ink-900 focus:outline-none transition-all"
          />
          {clubQuery && (
            <button
              type="button"
              onClick={() => {
                setClubQuery('');
                setIsDropdownOpen(false);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              aria-label="Clear club search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dropdown results outside overflow container */}
          {isDropdownOpen && clubQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-ink-900 rounded-2xl shadow-lift border border-slate-200 dark:border-white/15 max-h-72 overflow-y-auto py-1.5 animate-fade-in">
              {searchMatches.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">
                  No matching club found for &quot;{clubQuery}&quot;.
                </div>
              ) : (
                searchMatches.map((club) => {
                  const isActive = selectedClub?.id === club.id;
                  return (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => handleChooseFromDropdown(club)}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'hover:bg-slate-50 dark:hover:bg-ink-800 text-ink-900 dark:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubBadge club={club} size="md" />
                        <span className="text-xs font-bold truncate">{club.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-ink-950 text-slate-500 dark:text-zinc-400 shrink-0">
                        {club.league}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Active Filter Pill (always shows active club when one is selected) */}
        {selectedClub && (
          <button
            type="button"
            onClick={() => onSelectClub(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Clear club filter"
          >
            <ClubBadge club={selectedClub} size="xs" />
            <span>{isSelectedInTop20 ? `Filtering: ${selectedClub.name}` : selectedClub.name}</span>
            <X className="w-3.5 h-3.5 ml-0.5" />
          </button>
        )}
      </div>

      {/* Row 2: Horizontal Scrollable Top 20 Clubs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => onSelectClub(null)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
            selectedClub === null
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
              : 'bg-slate-100/90 dark:bg-ink-950 text-slate-700 dark:text-zinc-300 border-slate-200/70 dark:border-white/10 hover:border-emerald-500/40'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>All Clubs</span>
        </button>

        {TOP_20_CLUBS.map((club) => {
          const isSelected = selectedClub?.id === club.id;
          return (
            <button
              key={club.id}
              type="button"
              onClick={() => onSelectClub(isSelected ? null : club)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-soft scale-[1.02]'
                  : 'bg-white dark:bg-ink-950 text-ink-900 dark:text-zinc-200 border-slate-200/80 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/10'
              }`}
            >
              <ClubBadge club={club} size="sm" />
              <span>{club.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
