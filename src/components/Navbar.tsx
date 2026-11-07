import React, { useState } from 'react';
import { 
  Vote, Plus, ShieldCheck, Search, SlidersHorizontal, 
  RotateCcw, User, Home, Lock, Download, Sun, Moon, Settings 
} from 'lucide-react';
import { IssueCategory, AppView, UserProfile } from '../types';
import { ThemeMode } from '../utils/theme';

export type FeedSortOption = 'for-you' | 'active' | 'closing' | 'yes' | 'perspectives';

interface Props {
  selectedCategory: IssueCategory;
  onSelectCategory: (cat: IssueCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: FeedSortOption;
  onSortChange: (sort: FeedSortOption) => void;
  onOpenGuidelines: () => void;
  onOpenCreateModal: () => void;
  onOpenProfileSettings: () => void;
  onResetData: () => void;
  categoryCounts: Record<string, number>;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: UserProfile | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const CATEGORIES: { key: IssueCategory; shortLabel: string; emoji: string }[] = [
  { key: 'All', shortLabel: 'All Issues', emoji: '🌐' },
  { key: 'Workplace & Career', shortLabel: 'Workplace', emoji: '💼' },
  { key: 'Family & Home', shortLabel: 'Family', emoji: '👨‍👩‍👧' },
  { key: 'Community & Neighborhood', shortLabel: 'Community', emoji: '🏡' },
  { key: 'Religious & Faith', shortLabel: 'Faith', emoji: '🕊️' },
  { key: 'Clubs & Groups', shortLabel: 'Clubs', emoji: '👥' },
  { key: 'Politics & Policy', shortLabel: 'Policy', emoji: '🏛️' },
  { key: 'Environment & Climate', shortLabel: 'Climate', emoji: '🌱' },
  { key: 'Economy & Finance', shortLabel: 'Economy', emoji: '📈' },
  { key: 'Education & Campus', shortLabel: 'Education', emoji: '🎓' },
  { key: 'Private & Internal', shortLabel: 'Private Circles', emoji: '🔒' },
];

export const Navbar: React.FC<Props> = ({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onOpenGuidelines,
  onOpenCreateModal,
  onOpenProfileSettings,
  onResetData,
  categoryCounts,
  onNavigate,
  currentUser,
  theme,
  onToggleTheme
}) => {
  const [showSearchMobile, setShowSearchMobile] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl shadow-soft transition-colors">
      {/* Top Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div 
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform">
              <Vote className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-ink-950 dark:text-white font-sans">
              Yes<span className="text-gradient">Or</span>No
            </span>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search issues, tags, or circles..."
                className="w-full text-xs pl-10 pr-3 py-2 bg-zinc-100/80 dark:bg-ink-950 hover:bg-zinc-100 dark:hover:bg-ink-950/80 focus:bg-white dark:focus:bg-ink-900 rounded-xl focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-zinc-400 dark:text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Home link */}
            <button
              onClick={() => onNavigate('landing')}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-ink-800 rounded-xl transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Landing Page"
            >
              <Home className="w-4 h-4" />
              <span className="hidden lg:inline">Home</span>
            </button>

            {/* Mobile Search Toggle */}
            <button
              onClick={() => setShowSearchMobile(!showSearchMobile)}
              className="md:hidden p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-ink-800 rounded-xl transition-colors"
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-ink-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-ink-700 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
            </button>

            {/* Install PWA Button */}
            <button
              onClick={() => {
                localStorage.removeItem('yesorno_pwa_dismissed_v1');
                window.dispatchEvent(new Event('show-pwa-install'));
              }}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-brand-600 hover:bg-zinc-100 dark:hover:bg-ink-800 rounded-xl transition-colors hidden lg:flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Install App"
            >
              <Download className="w-4 h-4 text-brand-500" />
            </button>

            {/* Community Guidelines Button */}
            <button
              onClick={onOpenGuidelines}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-ink-800 text-zinc-600 dark:text-zinc-300 hover:text-emerald-700 text-xs font-semibold transition-all cursor-pointer"
              title="Community Guidelines"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </button>

            {/* User Profile & Settings Button */}
            <button
              onClick={() => (currentUser ? onOpenProfileSettings() : onNavigate('auth'))}
              className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-zinc-100/90 dark:bg-ink-800 hover:bg-zinc-200/80 dark:hover:bg-ink-700 text-xs font-semibold transition-all cursor-pointer"
              title="Profile, Preferences & Settings"
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover ring-1 ring-black/10" />
              ) : (
                <User className="w-4 h-4 text-brand-500" />
              )}
              <span className="max-w-[90px] truncate hidden sm:inline text-ink-900 dark:text-white font-semibold">
                {currentUser ? currentUser.name.split(' ')[0] : 'Sign In'}
              </span>
              {currentUser && (
                <Settings className="w-3.5 h-3.5 text-zinc-400 hidden sm:inline" />
              )}
            </button>

            {/* Create Issue Button */}
            <button
              onClick={onOpenCreateModal}
              className="btn-brand text-xs py-2 px-3.5 shadow-glow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Issue</span>
            </button>

            {/* Reset data (Local Dev Only) */}
            {import.meta.env.DEV && (
              <button
                onClick={onResetData}
                title="Reset local dev sample issues"
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-ink-800 rounded-xl transition-colors hidden lg:flex cursor-pointer"
                aria-label="Reset local dev sample issues"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search Input */}
        {showSearchMobile && (
          <div className="mt-2.5 md:hidden animate-fade-in">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search issues, topics, or circles..."
                className="w-full text-xs pl-10 pr-3 py-2 bg-zinc-50 dark:bg-ink-950 border border-black/[0.06] dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Categories & Filter Bar */}
      <div className="bg-slate-100/60 dark:bg-ink-950/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          {/* Scrollable Categories Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map(({ key, shortLabel, emoji }) => {
              const isSelected = selectedCategory === key;
              const count = key === 'All' 
                ? categoryCounts['All'] || 0
                : categoryCounts[key] || 0;

              return (
                <button
                  key={key}
                  onClick={() => onSelectCategory(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-ink-950 dark:bg-brand-600 text-white shadow-soft'
                      : 'bg-white/90 dark:bg-ink-900 hover:bg-white dark:hover:bg-ink-800 text-zinc-600 dark:text-zinc-300 hover:text-ink-900 dark:hover:text-white'
                  }`}
                >
                  {key === 'Private & Internal' ? (
                    <Lock className="w-3 h-3 text-purple-500" />
                  ) : (
                    <span>{emoji}</span>
                  )}
                  <span>{shortLabel}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-ink-800 text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as FeedSortOption)}
              className="text-xs bg-white/90 dark:bg-ink-900 rounded-xl px-2.5 py-1.5 text-ink-900 dark:text-white font-semibold focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              <option value="for-you">✨ For You (Priority)</option>
              <option value="active">Most Active</option>
              <option value="closing">Closing Soon</option>
              <option value="yes">Highest Yes%</option>
              <option value="perspectives">Most Responses</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
