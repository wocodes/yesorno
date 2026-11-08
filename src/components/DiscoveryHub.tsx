import React, { useState, useMemo } from 'react';
import { 
  Flame, Globe2, Clock, Sparkles, Scale, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, MapPin, Layers
} from 'lucide-react';
import { Issue, IssueCategory, IssueRegion, VoteChoice } from '../types';
import { computeIssueMetrics } from '../utils/summary';

interface Props {
  issues: Issue[];
  onOpenDetails: (issue: Issue) => void;
  onQuickVote: (issue: Issue, choice?: VoteChoice) => void;
  onFilterByCategory?: (cat: IssueCategory) => void;
  fullPage?: boolean;
  userVotes?: Record<string, { choice: 'YES' | 'NO'; responseId?: string }>;
}

type DiscoveryMode = 'trending' | 'region' | 'category' | 'closing' | 'debated';

const REGIONS: { key: IssueRegion | 'All Regions'; icon: string }[] = [
  { key: 'All Regions', icon: '🌍' },
  { key: 'Global / Remote', icon: '🌐' },
  { key: 'North America', icon: '🇺🇸' },
  { key: 'Europe & UK', icon: '🇪🇺' },
  { key: 'Africa & Middle East', icon: '🌍' },
  { key: 'Asia-Pacific', icon: '🌏' },
];

const SPHERE_ICONS: Record<string, string> = {
  'Business': '💼',
  'Gender': '⚧️',
  'Entertainment': '🎬',
  'Workplace & Career': '🏢',
  'Family & Home': '👨‍👩‍👧',
  'Community & Neighborhood': '🏡',
  'Religious & Faith': '🕊️',
  'Clubs & Groups': '👥',
  'Politics & Policy': '🏛️',
  'Environment & Climate': '🌱',
  'Economy & Finance': '📈',
  'Education & Campus': '🎓',
  'Private & Internal': '🔒',
};

export function inferIssueRegion(issue: Issue): IssueRegion {
  if (issue.region) return issue.region;
  if (import.meta.env.DEV) {
    const map: Record<string, IssueRegion> = {
      'issue-workplace-1': 'Global / Remote',
      'issue-family-1': 'North America',
      'issue-faith-1': 'Africa & Middle East',
      'issue-clubs-1': 'Europe & UK',
      'issue-economy-1': 'North America',
      'issue-education-1': 'Europe & UK',
      'issue-1': 'Local District',
      'issue-2': 'Asia-Pacific',
      'issue-3': 'Local District',
      'issue-4': 'North America',
      'issue-5': 'Local District',
    };
    return map[issue.id] || 'Global / Remote';
  }
  return 'Global / Remote';
}

export const DiscoveryHub: React.FC<Props> = ({
  issues,
  onOpenDetails,
  onQuickVote,
  onFilterByCategory,
  fullPage = false,
  userVotes = {}
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mode, setMode] = useState<DiscoveryMode>('trending');
  const [selectedRegion, setSelectedRegion] = useState<IssueRegion | 'All Regions'>('All Regions');
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('Workplace & Career');

  // Enrich issues with region and computed metrics
  const enrichedIssues = useMemo(() => {
    return issues
      .filter(issue => !issue.isDeletedByAuthor)
      .map(issue => {
        const metrics = computeIssueMetrics(issue);
      const region = inferIssueRegion(issue);
      // Trending velocity score: votes + 4x responses + 8x voice notes
      const trendingScore = metrics.totalVotes + (issue.responses.length * 4) + (metrics.voiceNotesCount * 8);
      // Contested score: closeness to 50/50 split weighted by turnout
      const splitCloseness = 100 - Math.abs(metrics.yesPercent - 50) * 2;
      const debatedScore = splitCloseness * Math.log10(Math.max(10, metrics.totalVotes));

      return {
        issue,
        metrics,
        region,
        trendingScore,
        debatedScore
      };
    });
  }, [issues]);

  // Compute displayed issues based on active Discovery lens
  const topSpotlight = useMemo(() => {
    let list = [...enrichedIssues];

    if (mode === 'trending') {
      list.sort((a, b) => b.trendingScore - a.trendingScore);
    } else if (mode === 'region') {
      if (selectedRegion !== 'All Regions') {
        list = list.filter(item => item.region === selectedRegion);
      }
      list.sort((a, b) => b.trendingScore - a.trendingScore);
    } else if (mode === 'category') {
      list = list.filter(item => item.issue.category === selectedCategory);
      list.sort((a, b) => b.trendingScore - a.trendingScore);
    } else if (mode === 'closing') {
      list = list.filter(item => !item.metrics.isClosed);
      list.sort((a, b) => new Date(a.issue.closingDate).getTime() - new Date(b.issue.closingDate).getTime());
    } else if (mode === 'debated') {
      list.sort((a, b) => b.debatedScore - a.debatedScore);
    }

    return fullPage ? list : list.slice(0, 3);
  }, [enrichedIssues, mode, selectedRegion, selectedCategory, fullPage]);

  // Count per region
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Regions': enrichedIssues.length };
    enrichedIssues.forEach(item => {
      counts[item.region] = (counts[item.region] || 0) + 1;
    });
    return counts;
  }, [enrichedIssues]);

  if (issues.length === 0) {
    return (
      <section className="card p-10 sm:p-12 text-center space-y-3 border-dashed">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto border border-brand-100 dark:border-brand-400/30">
          <Globe2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Discovery Radar is Ready
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          No deliberations have been published yet. Be the first to launch an issue or participate in your community.
        </p>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden bg-gradient-to-b from-white to-slate-50/70 dark:from-ink-900 dark:to-ink-950/90 shadow-soft">
      {/* Header Bar */}
      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-brand-600 text-white flex items-center justify-center shadow-glow">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-ink-950 dark:text-white tracking-tight">
                Discovery &amp; Trending Pulse
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                Live Radar
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:block">
              Explore top deliberations overall, by region, category, or closing urgency
            </p>
          </div>
        </div>

        {/* Lens Switcher Pills */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-950 p-1 rounded-xl text-[11px] sm:text-xs overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setMode('trending')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'trending'
                  ? 'bg-white dark:bg-brand-600 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Overall Top</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('region')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'region'
                  ? 'bg-white dark:bg-brand-600 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>By Region</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('category')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'category'
                  ? 'bg-white dark:bg-brand-600 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>By Category</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('closing')}
              className={`px-2.5 py-1 rounded-lg font-bold hidden sm:flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'closing'
                  ? 'bg-white dark:bg-brand-600 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Closing Soon</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('debated')}
              className={`px-2.5 py-1 rounded-lg font-bold hidden md:flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                mode === 'debated'
                  ? 'bg-white dark:bg-brand-600 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Hotly Debated</span>
            </button>
          </div>

          {!fullPage && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              title={isExpanded ? 'Collapse Discovery Hub' : 'Expand Discovery Hub'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {(isExpanded || fullPage) && (
        <div className="p-5 space-y-4 animate-fade-in">
          {/* Sub-filter bar when Region or Category lens is active */}
          {mode === 'region' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {REGIONS.map(({ key, icon }) => {
                const active = selectedRegion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRegion(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-ink-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 hover:border-emerald-400'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{key}</span>
                    <span className={`text-[10px] px-1.5 rounded-full font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-ink-900 text-slate-500 dark:text-zinc-400'
                    }`}>
                      {regionCounts[key] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {mode === 'category' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {(Object.keys(SPHERE_ICONS) as IssueCategory[]).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                      active
                        ? 'bg-brand-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-ink-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 hover:border-brand-400'
                    }`}
                  >
                    <span>{SPHERE_ICONS[cat]}</span>
                    <span>{cat.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Top 3 Leaderboard Cards */}
          {topSpotlight.length === 0 ? (
            <div className="card p-8 sm:p-10 text-center space-y-2.5 border-dashed">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                No issues match this view
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                No active deliberations in this category or region yet. Explore overall trending or pick another filter.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('trending');
                    setSelectedRegion('All Regions');
                  }}
                  className="btn-brand text-xs py-1.5 px-3.5 cursor-pointer"
                >
                  Show All Top Deliberations
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${fullPage ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-3'} gap-3.5`}>
            {topSpotlight.map(({ issue, metrics, region }, index) => {
              const rankColors = [
                'from-amber-500 to-orange-500 text-white',
                'from-brand-500 to-purple-500 text-white',
                'from-emerald-500 to-teal-500 text-white'
              ];

              return (
                <div
                  key={issue.id}
                  className="bg-slate-50/80 dark:bg-ink-950/70 rounded-2xl p-4 hover:bg-slate-100/80 dark:hover:bg-ink-950 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    {/* Top Row: Rank Badge + Region + Time */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-6 h-6 rounded-lg bg-gradient-to-br ${rankColors[index] || rankColors[0]} font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs`}>
                          #{index + 1}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-brand-500 shrink-0" />
                          {region}
                        </span>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300 shrink-0">
                        {SPHERE_ICONS[issue.category] || '🗳️'} {issue.category.split(' ')[0]}
                      </span>
                    </div>

                    {/* Issue Title */}
                    <h3
                      onClick={() => onOpenDetails(issue)}
                      className={`text-xs sm:text-sm font-bold transition-colors line-clamp-2 cursor-pointer leading-snug ${
                        issue.isDeletedByAuthor
                          ? 'italic text-slate-400 dark:text-zinc-500'
                          : 'text-ink-950 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400'
                      }`}
                    >
                      {issue.isDeletedByAuthor ? 'Deleted by Author' : issue.title}
                    </h3>
                  </div>

                  {/* Bottom Telemetry & Quick Vote */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                    {/* Mini Consensus Bar or Lock if not voted */}
                    {userVotes[issue.id] ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">YES {metrics.yesPercent}%</span>
                          <span className="text-slate-400 dark:text-zinc-500 font-mono text-[10px]">
                            {metrics.totalVotes} votes
                            {metrics.voiceNotesCount > 0 && ` • ${metrics.voiceNotesCount} 🎙️`}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400">NO {metrics.noPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${metrics.yesPercent}%` }} />
                          <div className="bg-rose-500 h-full" style={{ width: `${metrics.noPercent}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 py-0.5">
                        <span className="font-medium">Vote to reveal results</span>
                        <span className="font-mono text-[10px] text-slate-400">{metrics.totalVotes} votes</span>
                      </div>
                    )}

                    {/* Quick Action Row */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(issue)}
                        className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        View Digest →
                      </button>

                      {!issue.isDeletedByAuthor && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onQuickVote(issue, 'YES')}
                            className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <ThumbsUp className="w-2.5 h-2.5" /> YES
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickVote(issue, 'NO')}
                            className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <ThumbsDown className="w-2.5 h-2.5" /> NO
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Category Quick-Jump Footer */}
          {mode === 'category' && onFilterByCategory && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => onFilterByCategory(selectedCategory)}
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Filter main issues feed by {selectedCategory} →</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
