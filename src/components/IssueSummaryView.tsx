import React, { useState, useEffect } from 'react';
import { 
  Sparkles, ThumbsUp, ThumbsDown, Clock, ShieldCheck, 
  Mic, BarChart3, RefreshCw 
} from 'lucide-react';
import { Issue, IssueSummaryInsights } from '../types';
import { computeIssueMetrics, generateIssueSummary, generateLiveAISummary } from '../utils/summary';

interface Props {
  issue: Issue;
}

export const IssueSummaryView: React.FC<Props> = ({ issue }) => {
  const metrics = computeIssueMetrics(issue);
  const [summary, setSummary] = useState<IssueSummaryInsights>(() => issue.summary || generateIssueSummary(issue));
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setSummary(issue.summary || generateIssueSummary(issue));
  }, [issue]);

  const handleRefreshSummary = async () => {
    setIsRefreshing(true);
    try {
      const updated = await generateLiveAISummary(issue);
      setSummary(updated);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSentimentBadge = (trend: string) => {
    switch (trend) {
      case 'Strongly Favor':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/30';
      case 'Leaning Yes':
        return 'bg-teal-50 text-teal-800 border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-400/30';
      case 'Strongly Oppose':
        return 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/30';
      case 'Leaning No':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-ink-800 dark:text-zinc-300 dark:border-white/10';
    }
  };

  return (
    <div className="space-y-4">
      {/* Consensus Headline Card */}
      <div className="card p-4 sm:p-5 space-y-3 border border-brand-100/80 dark:border-brand-500/20 shadow-2xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-950 dark:text-white">
              AI Consensus Summary
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getSentimentBadge(summary.sentimentTrend)}`}>
              {summary.sentimentTrend}
            </span>
            <button
              type="button"
              onClick={handleRefreshSummary}
              disabled={isRefreshing}
              title="Re-synthesize summary from latest responses"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-ink-800 hover:bg-brand-50 dark:hover:bg-brand-500/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-500' : ''}`} />
            </button>
          </div>
        </div>

        <p className="text-xs sm:text-sm font-semibold text-ink-950 dark:text-slate-100 leading-relaxed">
          {summary.consensusHeadline}
        </p>
      </div>

      {/* 4 Telemetry Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-white dark:bg-ink-900 p-3 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <BarChart3 className="w-3.5 h-3.5 text-brand-500" />
            <span>Turnout</span>
          </div>
          <div className="text-base font-bold text-ink-950 dark:text-white mt-0.5">
            {metrics.totalVotes}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {metrics.yesPercent}% Yes • {metrics.noPercent}% No
          </div>
        </div>

        <div className="bg-white dark:bg-ink-900 p-3 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
            <span>Anonymous</span>
          </div>
          <div className="text-base font-bold text-ink-950 dark:text-white mt-0.5">
            {metrics.anonymousPercent}%
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {metrics.anonymousVotes} masked votes
          </div>
        </div>

        <div className="bg-white dark:bg-ink-900 p-3 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <Mic className="w-3.5 h-3.5 text-brand-500" />
            <span>Audio Notes</span>
          </div>
          <div className="text-base font-bold text-ink-950 dark:text-white mt-0.5">
            {metrics.voiceNotesCount}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {metrics.voicePercent}% vocal share
          </div>
        </div>

        <div className="bg-white dark:bg-ink-900 p-3 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-2xs">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-brand-500" />
            <span>Window</span>
          </div>
          <div className="text-sm font-bold text-ink-950 dark:text-white mt-0.5 truncate">
            {issue.durationLabel || '7 Days'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {metrics.timeRemaining.text}
          </div>
        </div>
      </div>

      {/* Pro / Con Arguments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Key YES Rationales ({metrics.yesPercent}%)</span>
          </div>
          <ul className="space-y-1.5">
            {summary.keyArgumentsYes.map((arg, idx) => (
              <li key={idx} className="text-xs text-emerald-950 dark:text-emerald-100/90 flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-500 font-bold shrink-0">•</span>
                <span>{arg}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-300">
            <ThumbsDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Key NO Rationales ({metrics.noPercent}%)</span>
          </div>
          <ul className="space-y-1.5">
            {summary.keyArgumentsNo.map((arg, idx) => (
              <li key={idx} className="text-xs text-rose-950 dark:text-rose-100/90 flex items-start gap-2 leading-relaxed">
                <span className="text-rose-500 font-bold shrink-0">•</span>
                <span>{arg}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
