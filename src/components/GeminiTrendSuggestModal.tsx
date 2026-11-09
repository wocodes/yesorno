import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, TrendingUp, Check, Loader2, RefreshCw,
  Globe2, Newspaper, Tag, ShieldCheck, Edit3
} from 'lucide-react';
import { IssueCategory, IssueRegion, UserProfile } from '../types';
import {
  QuestionSuggestion,
  fetchTrendingQuestionSuggestions
} from '../utils/geminiDailyGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: (issue: {
    title: string;
    description: string;
    category: IssueCategory;
    region: IssueRegion;
    tags: string[];
    durationLabel: string;
  }) => void;
  currentUser: UserProfile | null;
  initialContext?: string;
}

const CATEGORY_OPTIONS: IssueCategory[] = [
  'Politics & Policy',
  'Economy & Finance',
  'Workplace & Career',
  'Business',
  'Environment & Climate',
  'Education & Campus',
  'Community & Neighborhood',
  'Family & Home',
  'Entertainment',
  'Counselling',
  'Gender',
  'Religious & Faith',
];

const INSPIRATION_PILLS = [
  { label: '🏛️ Lagos Governorship Debate', context: 'the recent Lagos governorship debate and transport policies' },
  { label: '💰 Remote USD Income Tax', context: 'progressive tax bill on remote workers earning in USD' },
  { label: '🎓 Campus AI & Essays Ban', context: 'universities banning generative AI for student assignments' },
  { label: '⚡ Electricity Band-A Tariffs', context: 'national electricity tariff hikes and cost reflective billing' },
  { label: '⛽ Fuel Subsidy Transport Fares', context: 'public transport fares and mass transit after fuel subsidy' },
];

export const GeminiTrendSuggestModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirmPublish,
  currentUser,
  initialContext = '',
}) => {
  const [topicContext, setTopicContext] = useState(initialContext);
  const [selectedCategory, setSelectedCategory] = useState<string>('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [trendSourceMeta, setTrendSourceMeta] = useState<{ source: string; grounded: boolean } | null>(null);

  // Editable Form for the Selected Suggestion
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<IssueCategory>('Politics & Policy');
  const [editDuration, setEditDuration] = useState('Indefinite (No Expiry)');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (initialContext) {
      setTopicContext(initialContext);
    }
  }, [initialContext]);

  // Sync editor fields whenever selected suggestion changes
  useEffect(() => {
    if (suggestions.length > 0 && suggestions[selectedIndex]) {
      const active = suggestions[selectedIndex];
      setEditTitle(active.title);
      setEditDescription(active.description);
      setEditCategory(active.category || 'Politics & Policy');
      setEditTags(active.tags || []);
    }
  }, [suggestions, selectedIndex]);

  if (!isOpen) return null;

  const handleGenerate = async (overrideContext?: string) => {
    const ctx = overrideContext !== undefined ? overrideContext : topicContext;
    setIsGenerating(true);
    try {
      const res = await fetchTrendingQuestionSuggestions({
        context: ctx.trim(),
        category: selectedCategory === 'auto' ? undefined : selectedCategory,
        region: currentUser?.region || 'Africa & Middle East',
      });

      if (res && res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setSelectedIndex(0);
        setTrendSourceMeta({
          source: res.source,
          grounded: Boolean(res.grounded),
        });
      }
    } catch (err) {
      console.error('Failed to generate trend questions:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPill = (context: string) => {
    setTopicContext(context);
    handleGenerate(context);
  };

  const handleConfirm = () => {
    if (!editTitle.trim() || !editDescription.trim()) return;

    setIsPublishing(true);
    onConfirmPublish({
      title: editTitle.trim(),
      description: editDescription.trim(),
      category: editCategory,
      region: currentUser?.region || 'Africa & Middle East',
      tags: editTags.length > 0 ? editTags : [editCategory, 'Trending'],
      durationLabel: editDuration,
    });
    setIsPublishing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-ink-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-3xl my-auto bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-ink-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-brand-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  AI Trend Deliberation Studio
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                  Gemini + Google Trends
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Ground debate questions in current news, public controversies &amp; viral stories.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Context & Options Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-200/80 dark:border-white/10 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Topic, News Story or Context (Optional)</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Leave blank to auto-detect viral trends
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={topicContext}
                  onChange={(e) => setTopicContext(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="e.g., 'the recent Lagos governorship debate', 'Nigeria crypto tax bill', 'tuition hike'..."
                  className="w-full px-4 py-3 text-sm rounded-xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                {topicContext && (
                  <button
                    type="button"
                    onClick={() => setTopicContext('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Inspiration Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-purple-400" />
                <span>Try:</span>
              </span>
              {INSPIRATION_PILLS.map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => handleSelectPill(pill.context)}
                  className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-ink-900 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-slate-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Category Filter & Search Trigger Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                  Category:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="auto">✨ Auto-Detect from Trends</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="btn-brand py-2.5 px-5 text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Searching News &amp; Trends with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Research Trends &amp; Suggest Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Suggestions List Section */}
          {suggestions.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-purple-500" />
                  <span>Suggested Debate Angles ({suggestions.length})</span>
                </h4>
                {trendSourceMeta && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Globe2 className="w-3 h-3 text-emerald-500" />
                    <span>
                      {trendSourceMeta.grounded
                        ? 'Grounded with Google Search Live News'
                        : 'Curated Trend Analysis'}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {suggestions.map((sug, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-400 dark:border-purple-500/50 shadow-sm ring-2 ring-purple-400/20'
                          : 'bg-white dark:bg-ink-950 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      {/* Trend Context Banner */}
                      {sug.trendContext && (
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-semibold mb-2 bg-purple-100/60 dark:bg-purple-500/15 px-2.5 py-1 rounded-lg w-fit">
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                          <span>{sug.trendContext}</span>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300">
                              {sug.category}
                            </span>
                            {(sug.tags || []).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] text-slate-400 flex items-center gap-0.5"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                <span>{tag}</span>
                              </span>
                            ))}
                          </div>

                          <h5 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                            {sug.title}
                          </h5>
                          <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                            {sug.description}
                          </p>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'border-slate-300 dark:border-white/20'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Review & Tweak Active Question */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-purple-200 dark:border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Review &amp; Customize Before Publishing</span>
                  </h5>
                  <span className="text-[11px] text-slate-400">
                    Option {selectedIndex + 1} of {suggestions.length}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                    Question Title:
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                    Dilemma Context (YES vs NO):
                  </label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      Category:
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as IssueCategory)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 focus:outline-none"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
                      Voting Window:
                    </label>
                    <select
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="Indefinite (No Expiry)">Indefinite (No Expiry)</option>
                      <option value="24 Hours">24 Hours</option>
                      <option value="48 Hours">48 Hours</option>
                      <option value="7 Days">7 Days</option>
                      <option value="30 Days">30 Days</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    Will be published under{' '}
                    <strong className="text-slate-700 dark:text-zinc-200">
                      {currentUser?.name || 'William Odiomonafe'}
                    </strong>{' '}
                    ({currentUser?.email || 'william.odiomonafe@gmail.com'})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Initial State / Empty Prompt */}
          {suggestions.length === 0 && !isGenerating && (
            <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <Globe2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                Ready to Discover Trends
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                Provide a context like{' '}
                <span className="font-semibold text-purple-600 dark:text-purple-300">
                  &quot;the recent Lagos governorship debate&quot;
                </span>{' '}
                or leave it blank to browse live breaking headlines. Click below to fetch suggestions.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  className="btn-brand py-2 px-5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-soft"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Suggestions Now</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-ink-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Regenerate alternative debate angles on this topic"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate Ideas</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={suggestions.length === 0 || isPublishing || !editTitle.trim()}
              className="btn-brand py-2.5 px-5 text-xs font-bold shadow-glow flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm &amp; Publish to Feed</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
