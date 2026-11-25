import React, { useState, useMemo } from 'react';
import { X, Search, Check, Flag } from 'lucide-react';
import { FavoriteClub } from '../types';
import { GLOBAL_CLUBS, NATIONAL_TEAMS } from './config';
import { ClubBadge } from './ClubBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentClub?: FavoriteClub | null;
  currentNationalTeam?: string;
  onSaveClub: (club: FavoriteClub | null, nationalTeam?: string) => void;
}

/**
 * Modal allowing users to choose their favorite club crest & optional national team flair for FanZone.
 */
export const ClubPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentClub = null,
  currentNationalTeam = '',
  onSaveClub,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<FavoriteClub | null>(currentClub);
  const [nationalTeam, setNationalTeam] = useState<string>(currentNationalTeam || '');

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GLOBAL_CLUBS;
    return GLOBAL_CLUBS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q) ||
        c.league.toLowerCase().includes(q) ||
        (c.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [search]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveClub(selectedClub, nationalTeam || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-ink-950 to-emerald-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <span>⚽</span>
              <span>Choose Your Club Flair</span>
            </h2>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Your club crest appears beside your name on FanZone takes and banter.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Clubs Grid */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs (e.g. Arsenal, Real Madrid, Flamengo)..."
              className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-950 text-ink-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredClubs.map((club) => {
              const isSelected = selectedClub?.id === club.id;
              return (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => setSelectedClub(club)}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-white shadow-2xs'
                      : 'bg-slate-50/70 dark:bg-ink-950/60 border-slate-200/70 dark:border-white/10 hover:border-emerald-500/40 text-ink-900 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClubBadge club={club} size="md" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{club.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{club.league}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Optional National Team */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-white/10">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-emerald-500" />
              <span>National Team (Optional)</span>
            </label>
            <select
              value={nationalTeam}
              onChange={(e) => setNationalTeam(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-950 text-ink-950 dark:text-white border border-transparent focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="">None selected</option>
              {NATIONAL_TEAMS.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-ink-950/50">
          <button
            type="button"
            onClick={() => {
              onSaveClub(null, undefined);
              onClose();
            }}
            className="text-xs font-semibold text-slate-500 hover:text-rose-500 px-3 py-2 cursor-pointer"
          >
            Clear Flair
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-ink-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft cursor-pointer"
            >
              Save Club Flair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
