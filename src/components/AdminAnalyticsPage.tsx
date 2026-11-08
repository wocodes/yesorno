import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Clock, Repeat, Search, MousePointerClick, Palette,
  Sun, Moon, TrendingUp, Vote, MessageSquare, Heart, Bookmark,
  Download, RotateCcw, ArrowLeft, Eye, Activity, Layers, Globe2,
  Mail, Check, Loader2, Sparkles, Power, Bot, Users2, Key,
  ChevronDown, ChevronUp, RefreshCw, Play, Pause
} from 'lucide-react';
import { Issue, UserProfile, AppView } from '../types';
import { ColorTone, ThemeMode } from '../utils/theme';
import { generatePolarizingQuestionNow } from '../utils/geminiDailyGenerator';
import { saveIssues } from '../utils/storage';
import { SEED_PERSONAS } from '../data/seedPersonas';
import {
  loadAnalyticsStore,
  resetAnalyticsStore,
  formatDurationSeconds,
  AdminAnalyticsStore,
} from '../utils/analytics';

interface Props {
  issues: Issue[];
  currentUser: UserProfile | null;
  colorTone: ColorTone;
  theme: ThemeMode;
  onNavigate: (view: AppView) => void;
  onOpenIssue: (issue: Issue) => void;
}

export const AdminAnalyticsPage: React.FC<Props> = ({
  issues,
  currentUser,
  colorTone,
  theme,
  onNavigate,
  onOpenIssue,
}) => {
  const [store, setStore] = useState<AdminAnalyticsStore>(() => loadAnalyticsStore());
  const [clickFilter, setClickFilter] = useState<'all' | 'button' | 'link'>('all');
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);
  const [geminiResultStatus, setGeminiResultStatus] = useState<string | null>(null);

  const handleGenerateGeminiQuestion = async () => {
    setIsGeneratingGemini(true);
    setGeminiResultStatus(null);
    try {
      const newIssue = await generatePolarizingQuestionNow();
      const updated = [newIssue, ...issues];
      saveIssues(updated);
      setGeminiResultStatus(`Posted: "${newIssue.title}" (${newIssue.category}) under william.odiomonafe@gmail.com!`);
      setTimeout(() => {
        onOpenIssue(newIssue);
      }, 1500);
    } catch (err) {
      console.error('Failed to generate Gemini issue:', err);
      setGeminiResultStatus('Failed to generate. Check console.');
    } finally {
      setIsGeneratingGemini(false);
      setTimeout(() => setGeminiResultStatus(null), 10000);
    }
  };

  const handleTriggerTestEmail = async () => {
    setIsSendingTest(true);
    setTestEmailStatus(null);
    try {
      const endpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'https://yesorno.chillon.top/notify.php?test=1'
        : '/notify.php?test=1';

      const res = await fetch(endpoint);
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setTestEmailStatus('Test alert dispatched to william.odiomonafe@gmail.com! Check your inbox (and spam).');
      } else {
        setTestEmailStatus('Test request delivered to server. Check william.odiomonafe@gmail.com.');
      }
    } catch {
      setTestEmailStatus('Trigger sent to server. Check william.odiomonafe@gmail.com.');
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestEmailStatus(null), 8000);
    }
  };

  // AI Autonomous Curator & Debate Engine State
  const [curatorData, setCuratorData] = useState<any | null>(null);
  const [isCuratorLoading, setIsCuratorLoading] = useState(false);
  const [isTogglingCurator, setIsTogglingCurator] = useState(false);
  const [isGeneratingDebate, setIsGeneratingDebate] = useState(false);
  const [isSeedingPersonas, setIsSeedingPersonas] = useState(false);
  const [curatorFeedback, setCuratorFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPersonasModal, setShowPersonasModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [personaFilter, setPersonaFilter] = useState('');

  const getCuratorEndpoint = (action: string) => {
    const base = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'https://yesorno.chillon.top/ai-curator.php'
      : '/ai-curator.php';
    return `${base}?action=${action}`;
  };

  const fetchCuratorStatus = async () => {
    setIsCuratorLoading(true);
    try {
      const res = await fetch(getCuratorEndpoint('status'));
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setCuratorData(json);
      }
    } catch (e) {
      console.warn('Could not reach ai-curator status endpoint:', e);
    } finally {
      setIsCuratorLoading(false);
    }
  };

  const handleToggleCurator = async () => {
    setIsTogglingCurator(true);
    setCuratorFeedback(null);
    try {
      const res = await fetch(getCuratorEndpoint('toggle'), { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setCuratorFeedback({
          type: 'success',
          message: json.message || (json.isEnabled ? 'Engine resumed' : 'Engine paused')
        });
        await fetchCuratorStatus();
      } else {
        setCuratorFeedback({ type: 'error', message: 'Failed to toggle engine state' });
      }
    } catch (err: any) {
      setCuratorFeedback({ type: 'error', message: err?.message || 'Network error toggling engine' });
    } finally {
      setIsTogglingCurator(false);
      setTimeout(() => setCuratorFeedback(null), 8000);
    }
  };

  const handleGenerateCuratedDebate = async () => {
    setIsGeneratingDebate(true);
    setCuratorFeedback(null);
    try {
      const res = await fetch(getCuratorEndpoint('generate_issue'), { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setCuratorFeedback({
          type: 'success',
          message: json.message || 'New curated debate published successfully!'
        });
        await fetchCuratorStatus();
      } else {
        setCuratorFeedback({
          type: 'error',
          message: json?.message || 'Failed to generate curated debate'
        });
      }
    } catch (err: any) {
      setCuratorFeedback({ type: 'error', message: err?.message || 'Network error triggering debate' });
    } finally {
      setIsGeneratingDebate(false);
      setTimeout(() => setCuratorFeedback(null), 10000);
    }
  };

  const handleSeedPersonas = async () => {
    setIsSeedingPersonas(true);
    setCuratorFeedback(null);
    try {
      const res = await fetch(getCuratorEndpoint('seed_users'), { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setCuratorFeedback({
          type: 'success',
          message: json.message || `Synchronized ${json.seededCount} personas into database.`
        });
        await fetchCuratorStatus();
      } else {
        setCuratorFeedback({ type: 'error', message: 'Failed to sync personas into database' });
      }
    } catch (err: any) {
      setCuratorFeedback({ type: 'error', message: err?.message || 'Error syncing personas' });
    } finally {
      setIsSeedingPersonas(false);
      setTimeout(() => setCuratorFeedback(null), 8000);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      const res = await fetch(getCuratorEndpoint('save_settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: apiKeyInput.trim() })
      });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        setIsEditingApiKey(false);
        setApiKeyInput('');
        setCuratorFeedback({ type: 'success', message: 'Gemini API key configured successfully' });
        await fetchCuratorStatus();
      }
    } catch {
      setCuratorFeedback({ type: 'error', message: 'Failed to update Gemini API key' });
    }
  };

  useEffect(() => {
    fetchCuratorStatus();
  }, []);

  useEffect(() => {
    const refresh = () => setStore(loadAnalyticsStore());
    window.addEventListener('yesorno-analytics-updated', refresh);
    const interval = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener('yesorno-analytics-updated', refresh);
      window.clearInterval(interval);
    };
  }, []);

  // Compute aggregate platform metrics from live issues + telemetry store
  const platformTotals = useMemo(() => {
    let totalVotes = 0;
    let totalYes = 0;
    let totalNo = 0;
    let totalReplies = 0;
    let totalVoiceNotes = 0;
    let totalLikes = 0;
    let totalFavorites = 0;

    const categoryDistribution: Record<string, { issues: number; votes: number }> = {};
    const regionDistribution: Record<string, { issues: number; votes: number }> = {};

    issues.forEach((iss) => {
      const issVotes = iss.yesCount + iss.noCount;
      totalVotes += issVotes;
      totalYes += iss.yesCount;
      totalNo += iss.noCount;
      totalReplies += iss.responses.length;
      totalVoiceNotes += iss.responses.filter((r) => !!r.voiceNote).length + (iss.creatorVoiceNote ? 1 : 0);
      totalLikes += iss.likesCount || 0;
      totalFavorites += iss.favoritesCount || 0;

      if (!categoryDistribution[iss.category]) {
        categoryDistribution[iss.category] = { issues: 0, votes: 0 };
      }
      categoryDistribution[iss.category].issues += 1;
      categoryDistribution[iss.category].votes += issVotes;

      const reg = iss.region || 'Global / Remote';
      if (!regionDistribution[reg]) {
        regionDistribution[reg] = { issues: 0, votes: 0 };
      }
      regionDistribution[reg].issues += 1;
      regionDistribution[reg].votes += issVotes;
    });

    return {
      totalIssues: issues.length,
      activeIssues: issues.filter((i) => !i.isDeletedByAuthor && (!i.closingDate || new Date(i.closingDate).getTime() > Date.now())).length,
      deletedIssues: issues.filter((i) => i.isDeletedByAuthor).length,
      privateIssues: issues.filter((i) => i.visibility === 'private').length,
      totalVotes,
      totalYes,
      totalNo,
      totalReplies,
      totalVoiceNotes,
      totalLikes,
      totalFavorites,
      categoryDistribution,
      regionDistribution,
    };
  }, [issues]);

  // Color Scheme Comparison: Full-Coloured (Vibrant) vs Toned-Down (Muted)
  const colorSchemeMetrics = useMemo(() => {
    const { vibrantActiveSeconds, tonedActiveSeconds, vibrantSwitches, tonedSwitches } = store.colorSchemeUsage;
    const totalTime = vibrantActiveSeconds + tonedActiveSeconds;
    const vibrantTimePct = totalTime > 0 ? Math.round((vibrantActiveSeconds / totalTime) * 100) : (colorTone === 'vibrant' ? 100 : 0);
    const tonedTimePct = totalTime > 0 ? 100 - vibrantTimePct : (colorTone === 'toned' ? 100 : 0);

    const totalSwitches = vibrantSwitches + tonedSwitches;
    const vibrantSwitchPct = totalSwitches > 0 ? Math.round((vibrantSwitches / totalSwitches) * 100) : 50;
    const tonedSwitchPct = totalSwitches > 0 ? 100 - vibrantSwitchPct : 50;

    const winner =
      vibrantActiveSeconds > tonedActiveSeconds
        ? 'Full-Coloured (Vibrant)'
        : tonedActiveSeconds > vibrantActiveSeconds
        ? 'Toned-Down (Muted)'
        : colorTone === 'vibrant'
        ? 'Full-Coloured (Vibrant)'
        : 'Toned-Down (Muted)';

    return {
      vibrantActiveSeconds,
      tonedActiveSeconds,
      vibrantTimePct,
      tonedTimePct,
      vibrantSwitches,
      tonedSwitches,
      vibrantSwitchPct,
      tonedSwitchPct,
      winner,
    };
  }, [store.colorSchemeUsage, colorTone]);

  // Theme Mode Comparison: Dark vs Light
  const themeModeMetrics = useMemo(() => {
    const { darkActiveSeconds, lightActiveSeconds, darkSwitches, lightSwitches } = store.themeModeUsage;
    const totalTime = darkActiveSeconds + lightActiveSeconds;
    const darkTimePct = totalTime > 0 ? Math.round((darkActiveSeconds / totalTime) * 100) : (theme === 'dark' ? 100 : 0);
    const lightTimePct = totalTime > 0 ? 100 - darkTimePct : (theme === 'light' ? 100 : 0);

    return {
      darkActiveSeconds,
      lightActiveSeconds,
      darkTimePct,
      lightTimePct,
      darkSwitches,
      lightSwitches,
    };
  }, [store.themeModeUsage, theme]);

  // Ranked Pages & Modals Viewed
  const rankedPageViews = useMemo(() => {
    return Object.values(store.pageViews).sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return b.totalSecondsSpent - a.totalSecondsSpent;
    });
  }, [store.pageViews]);

  // Ranked Buttons, Links & Interactive Elements Clicked
  const rankedElementClicks = useMemo(() => {
    const all = Object.values(store.elementClicks);
    const filtered =
      clickFilter === 'all'
        ? all
        : all.filter((item) => item.elementType === clickFilter);
    return filtered.sort((a, b) => b.clicks - a.clicks);
  }, [store.elementClicks, clickFilter]);

  // Ranked Search Queries
  const rankedSearches = useMemo(() => {
    return Object.values(store.searchQueries).sort((a, b) => b.count - a.count);
  }, [store.searchQueries]);

  // Top Performing Issues Ranking
  const topPerformingIssues = useMemo(() => {
    return [...issues]
      .sort((a, b) => {
        const scoreA = a.yesCount + a.noCount + a.responses.length * 3 + (a.likesCount || 0) * 2 + (a.favoritesCount || 0) * 2;
        const scoreB = b.yesCount + b.noCount + b.responses.length * 3 + (b.likesCount || 0) * 2 + (b.favoritesCount || 0) * 2;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [issues]);

  // Daily Growth Timeline (Last 7 days)
  const dailyBuckets = useMemo(() => {
    const entries = Object.values(store.dailyTimeline).sort((a, b) => a.date.localeCompare(b.date));
    return entries.slice(-7);
  }, [store.dailyTimeline]);

  const avgSessionDuration =
    store.totalSessions > 0 ? Math.round(store.totalActiveSeconds / store.totalSessions) : store.currentSessionSeconds;

  const totalElementClicksCount = useMemo(
    () => Object.values(store.elementClicks).reduce((acc, el) => acc + el.clicks, 0),
    [store.elementClicks]
  );

  const totalPageViewsCount = useMemo(
    () => Object.values(store.pageViews).reduce((acc, pv) => acc + pv.views, 0),
    [store.pageViews]
  );

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Category', 'Metric / Item', 'Value / Count', 'Secondary Metric', 'Last Recorded'],
      ['Retention & Time', 'Total Sessions', String(store.totalSessions), `Returning Visits: ${store.returningVisits}`, store.lastUpdatedAt],
      ['Retention & Time', 'Total Time Spent (s)', String(store.totalActiveSeconds), formatDurationSeconds(store.totalActiveSeconds), store.lastUpdatedAt],
      ['Retention & Time', 'Average Session Duration', formatDurationSeconds(avgSessionDuration), `Longest: ${formatDurationSeconds(store.longestSessionSeconds)}`, store.lastUpdatedAt],
      ['Color Scheme', 'Full-Coloured (Vibrant)', `${colorSchemeMetrics.vibrantTimePct}% time (${formatDurationSeconds(colorSchemeMetrics.vibrantActiveSeconds)})`, `${colorSchemeMetrics.vibrantSwitches} switches`, store.lastUpdatedAt],
      ['Color Scheme', 'Toned-Down (Muted)', `${colorSchemeMetrics.tonedTimePct}% time (${formatDurationSeconds(colorSchemeMetrics.tonedActiveSeconds)})`, `${colorSchemeMetrics.tonedSwitches} switches`, store.lastUpdatedAt],
      ['Theme Mode', 'Dark Mode', `${themeModeMetrics.darkTimePct}% time (${formatDurationSeconds(themeModeMetrics.darkActiveSeconds)})`, `${themeModeMetrics.darkSwitches} switches`, store.lastUpdatedAt],
      ['Theme Mode', 'Light Mode', `${themeModeMetrics.lightTimePct}% time (${formatDurationSeconds(themeModeMetrics.lightActiveSeconds)})`, `${themeModeMetrics.lightSwitches} switches`, store.lastUpdatedAt],
      ['Search', 'Total Searches', String(store.totalSearches), `${rankedSearches.length} unique terms`, store.lastUpdatedAt],
    ];

    rankedPageViews.forEach((pv, idx) => {
      rows.push([
        'Page & View Ranking',
        `#${idx + 1} ${pv.label}`,
        `${pv.views} views`,
        `Time: ${formatDurationSeconds(pv.totalSecondsSpent)}`,
        pv.lastViewedAt,
      ]);
    });

    rankedElementClicks.forEach((el, idx) => {
      rows.push([
        `Clicked ${el.elementType.toUpperCase()} Ranking`,
        `#${idx + 1} ${el.label} (${el.location})`,
        `${el.clicks} clicks`,
        el.elementType,
        el.lastClickedAt,
      ]);
    });

    rankedSearches.forEach((sq, idx) => {
      rows.push([
        'Search Queries Ranking',
        `#${idx + 1} "${sq.query}"`,
        `${sq.count} searches`,
        '',
        sq.lastSearchedAt,
      ]);
    });

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yesorno-admin-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Executive Admin Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-aurora-dark p-5 sm:p-7 text-white shadow-soft">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 text-[11px] font-bold uppercase tracking-wider">
                <BarChart3 className="w-3.5 h-3.5" /> Admin Telemetry &amp; Growth Command Center
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Tracking Active
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
              YesOrNo Platform Performance &amp; Usage Analytics
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
              Real-time behavioral telemetry capturing user dwell time, return frequency, color palette preference (Full-Coloured vs. Toned-Down), search velocity, and a ranked leaderboard of every button, link, and page viewed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('app')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Feed</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerTestEmail}
              disabled={isSendingTest}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-400/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Send a test notification alert to william.odiomonafe@gmail.com"
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Test...</span>
                </>
              ) : testEmailStatus ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Sent!</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGenerateGeminiQuestion}
              disabled={isGeneratingGemini}
              className="px-3.5 py-2 rounded-xl bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-400/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Generate a polarizing question with Gemini and post under william.odiomonafe@gmail.com"
            >
              {isGeneratingGemini ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating (Gemini)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>Generate Question (Gemini)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-brand text-xs py-2 px-4 shadow-glow flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Report</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all recorded analytics counters to zero?')) {
                  setStore(resetAnalyticsStore());
                }
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/30 text-zinc-300 hover:text-rose-200 transition-colors cursor-pointer"
              title="Reset analytics telemetry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {testEmailStatus && (
          <div className="mt-4 p-3 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-100 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Mail className="w-4 h-4 text-indigo-300 shrink-0" />
            <span>{testEmailStatus}</span>
          </div>
        )}

        {geminiResultStatus && (
          <div className="mt-4 p-3 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-purple-100 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
            <span>{geminiResultStatus}</span>
          </div>
        )}
      </section>

      {/* Primary KPI Strip: Time Spent, Return Visits, Searches, Clicks, Page Views, Votes */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Time on App</span>
            <Clock className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {formatDurationSeconds(store.totalActiveSeconds)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Current: {formatDurationSeconds(store.currentSessionSeconds)} • Avg: {formatDurationSeconds(avgSessionDuration)}
          </div>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Return Visits</span>
            <Repeat className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {store.returningVisits}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {store.totalSessions} total sessions ({store.longestSessionSeconds > 0 ? `Max ${formatDurationSeconds(store.longestSessionSeconds)}` : 'Active'})
          </div>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Searches Run</span>
            <Search className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {store.totalSearches}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {rankedSearches.length} distinct search terms
          </div>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Buttons &amp; Links</span>
            <MousePointerClick className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {totalElementClicksCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {Object.keys(store.elementClicks).length} tracked UI elements
          </div>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Page &amp; Modal Views</span>
            <Eye className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {totalPageViewsCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            Across {rankedPageViews.length} views &amp; dialogs
          </div>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-400 font-semibold">
            <span>Total Votes &amp; Replies</span>
            <Vote className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
            {platformTotals.totalVotes}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {platformTotals.totalReplies} replies • {platformTotals.totalVoiceNotes} audio
          </div>
        </div>
      </section>

      {/* AUTONOMOUS CURATION & SYNTHETIC DEBATE ENGINE (GEMINI AI & 51 PERSONAS) */}
      <section className="card p-5 sm:p-6 space-y-5 border-2 border-purple-500/20 dark:border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-transparent to-brand-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Bot className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Autonomous Curation &amp; Debate Engine
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase flex items-center gap-1.5 ${
                curatorData?.status === 'ACTIVE'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}>
                {isCuratorLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <span className={`w-2 h-2 rounded-full ${curatorData?.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                )}
                {curatorData?.status === 'ACTIVE' ? 'Active & Scheduled' : 'Paused by Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Bootstraps community discussion by autonomously publishing high-friction binary questions, seeding authentic multi-perspective debates (Economists, Historians, Analysts), and ramping votes to ~120.
            </p>
          </div>

          {/* Master Kill Switch & Key Settings */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEditingApiKey(!isEditingApiKey)}
              className="p-2 rounded-xl bg-ink-100 dark:bg-zinc-800 text-ink-700 dark:text-zinc-300 hover:bg-ink-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Configure Gemini API Key"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleCurator}
              disabled={isTogglingCurator}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                curatorData?.status === 'ACTIVE'
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {isTogglingCurator ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : curatorData?.status === 'ACTIVE' ? (
                <>
                  <Pause className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Pause Engine (Kill Switch)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-white" />
                  <span>Resume Autonomous Engine</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Optional Gemini API Key Drawer */}
        {isEditingApiKey && (
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-400/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fade-in">
            <div className="text-xs font-bold text-purple-900 dark:text-purple-200 shrink-0 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>Gemini API Key:</span>
            </div>
            <input
              type="password"
              placeholder={curatorData?.settings?.hasApiKey ? '•••••••••••••••••••• (Configured on server)' : 'Paste your Gemini API key (AIzaSy...)'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="input-brand text-xs py-1.5 px-3 flex-1"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="btn-brand text-xs py-1.5 px-3 whitespace-nowrap cursor-pointer"
              >
                Save Key
              </button>
              <button
                type="button"
                onClick={() => setIsEditingApiKey(false)}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert if any */}
        {curatorFeedback && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in ${
            curatorFeedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-500/15 border border-rose-400/30 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {curatorFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-500" /> : <Power className="w-4 h-4 text-rose-500" />}
              <span>{curatorFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCuratorFeedback(null)}
              className="text-[10px] underline hover:no-underline opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-grid: Engine Metrics & Control Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Box 1: Persona Library */}
          <div className="p-4 rounded-2xl bg-white/50 dark:bg-zinc-900/60 border border-ink-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-bold">
              <span>Resident Personas</span>
              <Users2 className="w-4 h-4 text-brand-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-ink-950 dark:text-white">
                {curatorData?.totalDatabaseMembers || SEED_PERSONAS.length}
              </span>
              <span className="text-xs text-slate-400">profiles across 12 disciplines</span>
            </div>
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedPersonas}
                disabled={isSeedingPersonas}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 transition-colors cursor-pointer flex items-center gap-1"
              >
                {isSeedingPersonas ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>Sync to Database</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPersonasModal(!showPersonasModal)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink-100 dark:bg-zinc-800 text-ink-700 dark:text-zinc-300 hover:bg-ink-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{showPersonasModal ? 'Hide Library' : 'Inspect 51 Personas'}</span>
                {showPersonasModal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Box 2: Target Vote Velocity */}
          <div className="p-4 rounded-2xl bg-white/50 dark:bg-zinc-900/60 border border-ink-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-bold">
              <span>Target Vote Ramp</span>
              <Activity className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-ink-950 dark:text-white">
                85 – 140
              </span>
              <span className="text-xs text-slate-400">votes / issue (natural split)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
              Natural arrival simulation: 4–6 perspectives + 1 threaded rebuttal.
            </p>
          </div>

          {/* Box 3: Trigger Actions */}
          <div className="p-4 rounded-2xl bg-white/50 dark:bg-zinc-900/60 border border-ink-100 dark:border-zinc-800 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-bold">
              <span>Instant Triggers</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <button
              type="button"
              onClick={handleGenerateCuratedDebate}
              disabled={isGeneratingDebate || curatorData?.status === 'PAUSED'}
              className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingDebate ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing Debate...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>Publish Curated Debate Now</span>
                </>
              )}
            </button>
            <div className="text-[10px] text-slate-400 text-center">
              {curatorData?.settings?.lastRunAt 
                ? `Last run: ${new Date(curatorData.settings.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                : 'Runs every 6 hours automatically via cron'}
            </div>
          </div>
        </div>

        {/* Expandable 51 Resident Personas Drawer */}
        {showPersonasModal && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-900 border border-ink-100 dark:border-zinc-800 space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ink-100 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-extrabold text-ink-950 dark:text-white flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-brand-500" />
                  Persona Library (51 Distinct Intellectual Archetypes)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Economists, Historians, Political Analysts, Doctors, Blue-Collar Artisans, Tech Operators, and Community Leaders.
                </p>
              </div>
              <input
                type="text"
                placeholder="Filter personas by name, archetype, or role..."
                value={personaFilter}
                onChange={(e) => setPersonaFilter(e.target.value)}
                className="input-brand text-xs py-1.5 px-3 w-full sm:w-64"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {SEED_PERSONAS.filter((p) => {
                if (!personaFilter.trim()) return true;
                const q = personaFilter.toLowerCase();
                return (
                  p.name.toLowerCase().includes(q) ||
                  p.role.toLowerCase().includes(q) ||
                  p.archetype.toLowerCase().includes(q) ||
                  p.region.toLowerCase().includes(q)
                );
              }).map((persona) => (
                <div
                  key={persona.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-extrabold text-ink-950 dark:text-white">
                        {persona.name}
                      </div>
                      <div className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">
                        @{persona.username}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                      {persona.archetype}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 line-clamp-1">
                    {persona.role}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {persona.bio}
                  </p>
                  <div className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-200/40 dark:border-zinc-700/40 line-clamp-1">
                    Tone: {persona.toneGuidelines}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* COLOR SCHEME & APPEARANCE HEAD-TO-HEAD COMPARISON */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Full-Coloured (Vibrant) vs Toned-Down (Muted) */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Color Palette Preference Telemetry
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white mt-0.5">
                Full-Coloured vs. Toned-Down Usage
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 shrink-0">
              Leading: {colorSchemeMetrics.winner}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3.5 rounded-2xl border transition-all ${
              colorTone === 'vibrant'
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/15'
                : 'border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-ink-950/60'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-ink-950 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  Full-Coloured
                </span>
                {colorTone === 'vibrant' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-600 text-white">Active</span>
                )}
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
                {colorSchemeMetrics.vibrantTimePct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Dwell time: <strong className="text-ink-900 dark:text-white">{formatDurationSeconds(colorSchemeMetrics.vibrantActiveSeconds)}</strong>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Selected {colorSchemeMetrics.vibrantSwitches} times ({colorSchemeMetrics.vibrantSwitchPct}%)
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border transition-all ${
              colorTone === 'toned'
                ? 'border-slate-500 bg-slate-100 dark:bg-ink-800'
                : 'border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-ink-950/60'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-ink-950 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  Toned-Down
                </span>
                {colorTone === 'toned' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-white">Active</span>
                )}
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
                {colorSchemeMetrics.tonedTimePct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Dwell time: <strong className="text-ink-900 dark:text-white">{formatDurationSeconds(colorSchemeMetrics.tonedActiveSeconds)}</strong>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Selected {colorSchemeMetrics.tonedSwitches} times ({colorSchemeMetrics.tonedSwitchPct}%)
              </div>
            </div>
          </div>

          {/* Visual Split Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              <span>Full-Coloured ({colorSchemeMetrics.vibrantTimePct}% of active time)</span>
              <span>Toned-Down ({colorSchemeMetrics.tonedTimePct}% of active time)</span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden flex p-0.5">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${colorSchemeMetrics.vibrantTimePct}%` }}
              />
              <div
                className="bg-slate-500 rounded-full transition-all duration-500 ml-0.5"
                style={{ width: `${colorSchemeMetrics.tonedTimePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Dark Mode vs Light Mode & Session Retention */}
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />} Appearance &amp; Session Depth
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white mt-0.5">
                Dark vs. Light Mode &amp; User Engagement
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              {themeModeMetrics.darkTimePct >= themeModeMetrics.lightTimePct ? 'Dark Mode Preferred' : 'Light Mode Preferred'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-ink-950/60 border border-slate-200/70 dark:border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-950 dark:text-white">
                <Moon className="w-3.5 h-3.5 text-brand-400" />
                <span>Dark Mode</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
                {themeModeMetrics.darkTimePct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Time: <strong className="text-ink-900 dark:text-white">{formatDurationSeconds(themeModeMetrics.darkActiveSeconds)}</strong> ({themeModeMetrics.darkSwitches} switches)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-ink-950/60 border border-slate-200/70 dark:border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-950 dark:text-white">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light Mode</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold font-mono text-ink-950 dark:text-white">
                {themeModeMetrics.lightTimePct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Time: <strong className="text-ink-900 dark:text-white">{formatDurationSeconds(themeModeMetrics.lightActiveSeconds)}</strong> ({themeModeMetrics.lightSwitches} switches)
              </div>
            </div>
          </div>

          {/* Engagement Action Breakdown */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10">
              <div className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-300">{platformTotals.totalYes}</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">YES Votes</div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-500/10">
              <div className="text-sm font-extrabold font-mono text-rose-700 dark:text-rose-300">{platformTotals.totalNo}</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">NO Votes</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-500/10">
              <div className="text-sm font-extrabold font-mono text-amber-700 dark:text-amber-300">{platformTotals.totalFavorites}</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Favourites</div>
            </div>
            <div className="p-2 rounded-xl bg-brand-50/70 dark:bg-brand-500/10">
              <div className="text-sm font-extrabold font-mono text-brand-700 dark:text-brand-300">{platformTotals.totalLikes}</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Heart Likes</div>
            </div>
          </div>
        </div>
      </section>

      {/* RANKING OF BUTTONS, LINKS & INTERACTIVE ELEMENTS + RANKING OF PAGES VIEWED */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 7 Cols: Ranked Leaderboard of Clicked Buttons, Links & Controls */}
        <div className="lg:col-span-7 card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <MousePointerClick className="w-3.5 h-3.5" /> Interactive Click Leaderboard
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Ranking of Buttons, Links &amp; Controls Clicked
              </h2>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-ink-950 text-xs self-start">
              {(['all', 'button', 'link'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setClickFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize cursor-pointer transition-all ${
                    clickFilter === tab
                      ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {tab === 'all' ? 'All Elements' : `${tab}s`}
                </button>
              ))}
            </div>
          </div>

          {rankedElementClicks.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-ink-950/50 text-xs text-slate-400">
              Interact with buttons or links across the app to populate the real-time click leaderboard.
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {rankedElementClicks.map((item, index) => {
                const maxClicks = rankedElementClicks[0]?.clicks || 1;
                const widthPct = Math.max(6, Math.round((item.clicks / maxClicks) * 100));

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50/80 dark:bg-ink-950/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-mono font-extrabold text-[11px] flex items-center justify-center shrink-0">
                          #{index + 1}
                        </span>
                        <span className="font-bold text-ink-950 dark:text-white truncate">
                          {item.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 dark:bg-ink-800 text-slate-600 dark:text-zinc-400 uppercase shrink-0">
                          {item.elementType}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate hidden sm:inline">
                          • {item.location}
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-xs text-brand-600 dark:text-brand-400 shrink-0">
                        {item.clicks} {item.clicks === 1 ? 'click' : 'clicks'}
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-200/70 dark:bg-ink-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Ranking of Pages & Views + Dwell Time */}
        <div className="lg:col-span-5 card p-5 sm:p-6 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Page &amp; View Telemetry
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
              Ranking of Pages &amp; Modals Viewed
            </h2>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {rankedPageViews.map((pv, idx) => {
              const maxViews = rankedPageViews[0]?.views || 1;
              const barPct = Math.max(8, Math.round((pv.views / maxViews) * 100));

              return (
                <div
                  key={pv.view}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-ink-950/70 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-mono font-extrabold text-[11px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-ink-950 dark:text-white truncate">
                        {pv.label}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-extrabold text-ink-950 dark:text-white">
                        {pv.views} views
                      </span>
                      {pv.totalSecondsSpent > 0 && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block">
                          {formatDurationSeconds(pv.totalSecondsSpent)} spent
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200/70 dark:bg-ink-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SEARCH ANALYTICS + TOP PERFORMING ISSUES LEADERBOARD */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Search Queries Ranking (5 cols) */}
        <div className="lg:col-span-5 card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> Search Intelligence
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Top Search Queries ({store.totalSearches} total)
              </h2>
            </div>
          </div>

          {rankedSearches.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-ink-950/50 text-xs text-slate-400">
              No search queries recorded yet. Searches typed in the navbar or mobile search bar appear here automatically.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {rankedSearches.map((sq, idx) => (
                <div
                  key={sq.query}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-ink-950/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-ink-950 dark:text-white truncate">
                      &ldquo;{sq.query}&rdquo;
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {sq.count} {sq.count === 1 ? 'search' : 'searches'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Category Filter Clicks */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-2">
            <span className="text-xs font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-500" /> Spheres / Categories Distribution
            </span>
            <div className="space-y-1.5">
              {Object.entries(platformTotals.categoryDistribution)
                .sort((a, b) => b[1].votes - a[1].votes)
                .map(([cat, stats]) => (
                  <div key={cat} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{cat}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 shrink-0">
                      {stats.issues} issues • <strong className="text-ink-950 dark:text-white">{stats.votes} votes</strong>
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Top Performing Issues Ranking (7 cols) */}
        <div className="lg:col-span-7 card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Issue Engagement Ranking
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Top Performing Issues by Votes, Replies, Likes &amp; Favourites
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {platformTotals.activeIssues} active / {platformTotals.totalIssues} total
            </span>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {topPerformingIssues.map((iss, idx) => {
              const votes = iss.yesCount + iss.noCount;
              const yesPct = votes > 0 ? Math.round((iss.yesCount / votes) * 100) : 50;
              return (
                <div
                  key={iss.id}
                  onClick={() => onOpenIssue(iss)}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-ink-950/70 hover:bg-slate-100 dark:hover:bg-ink-800/70 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-mono font-extrabold text-[11px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white truncate">
                          {iss.isDeletedByAuthor ? 'Deleted by Author' : iss.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>{iss.category}</span>
                          <span>•</span>
                          <span>By {iss.author}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0">
                      {votes} votes
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-brand-500" /> {iss.responses.length} replies
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500" /> {iss.likesCount || 0} likes
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-amber-500" /> {iss.favoritesCount || 0} saved
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      YES {yesPct}% / NO {100 - yesPct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DAILY GROWTH TIMELINE & LIVE EVENT STREAM */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Daily Activity Table (6 cols) */}
        <div className="lg:col-span-6 card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5" /> Daily Growth &amp; Retention Log
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Daily Activity Breakdown
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-white/10 text-[11px] text-slate-400 uppercase">
                  <th className="pb-2 font-bold">Date</th>
                  <th className="pb-2 font-bold">Sessions</th>
                  <th className="pb-2 font-bold">Views</th>
                  <th className="pb-2 font-bold">Clicks</th>
                  <th className="pb-2 font-bold">Votes</th>
                  <th className="pb-2 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {dailyBuckets.map((b) => (
                  <tr key={b.date}>
                    <td className="py-2.5 font-bold text-ink-950 dark:text-white">{b.date}</td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-300">{b.sessions}</td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-300">{b.pageViews}</td>
                    <td className="py-2.5 text-brand-600 dark:text-brand-400 font-bold">{b.clicks}</td>
                    <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{b.votesCast}</td>
                    <td className="py-2.5 text-slate-500 dark:text-zinc-400">{formatDurationSeconds(b.activeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Telemetry Event Stream (6 cols) */}
        <div className="lg:col-span-6 card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Real-Time Telemetry Stream
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Recent User Actions ({store.recentEvents.length})
              </h2>
            </div>
            {currentUser && (
              <span className="text-[11px] text-slate-400">
                Admin: <strong className="text-ink-950 dark:text-white">{currentUser.name}</strong>
              </span>
            )}
          </div>

          {store.recentEvents.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-ink-950/50 text-xs text-slate-400">
              Events appear here in real time as users navigate, click, search, and vote.
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {store.recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-ink-950/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0">
                      {evt.type.replace('_', ' ')}
                    </span>
                    <span className="font-semibold text-ink-950 dark:text-white truncate">
                      {evt.label}
                    </span>
                    {evt.detail && (
                      <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                        ({evt.detail})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
