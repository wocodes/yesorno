import { AppView, IssueCategory } from '../types';
import { ColorTone, ThemeMode } from './theme';

const STORAGE_KEY_ANALYTICS = 'yesorno_admin_analytics_v1';
const SESSION_FLAG_KEY = 'yesorno_active_session_v1';

export interface ClickedElementMetric {
  id: string;
  label: string;
  elementType: 'button' | 'link' | 'tab' | 'card' | 'icon';
  location: string;
  clicks: number;
  lastClickedAt: string;
}

export interface PageViewMetric {
  view: string;
  label: string;
  views: number;
  totalSecondsSpent: number;
  lastViewedAt: string;
}

export interface SearchQueryMetric {
  query: string;
  count: number;
  lastSearchedAt: string;
}

export interface DailyActivityBucket {
  date: string; // YYYY-MM-DD
  sessions: number;
  pageViews: number;
  clicks: number;
  votesCast: number;
  issuesCreated: number;
  searches: number;
  activeSeconds: number;
}

export interface RecentTelemetryEvent {
  id: string;
  timestamp: string;
  type: 'page_view' | 'click' | 'search' | 'vote' | 'issue_created' | 'share' | 'color_switch' | 'theme_switch';
  label: string;
  detail?: string;
}

export interface AdminAnalyticsStore {
  firstRecordedAt: string;
  lastUpdatedAt: string;

  // Sessions & Retention
  totalSessions: number;
  returningVisits: number;
  totalActiveSeconds: number;
  longestSessionSeconds: number;
  currentSessionSeconds: number;

  // Color Scheme (Full-Coloured / Vibrant vs Toned-Down) & Theme (Dark vs Light)
  colorSchemeUsage: {
    vibrantSwitches: number;
    tonedSwitches: number;
    vibrantActiveSeconds: number;
    tonedActiveSeconds: number;
    currentPreference: ColorTone;
  };
  themeModeUsage: {
    darkSwitches: number;
    lightSwitches: number;
    darkActiveSeconds: number;
    lightActiveSeconds: number;
    currentPreference: ThemeMode;
  };

  // Search Telemetry
  totalSearches: number;
  searchQueries: Record<string, SearchQueryMetric>;

  // Page & Modal Views
  pageViews: Record<string, PageViewMetric>;

  // Buttons, Links & Interactive Elements Ranking
  elementClicks: Record<string, ClickedElementMetric>;

  // Engagement Counters
  engagement: {
    votesYes: number;
    votesNo: number;
    inlineReplies: number;
    voiceNotesRecorded: number;
    issuesCreated: number;
    issuesDeleted: number;
    likesGiven: number;
    favoritesSaved: number;
    sharesInitiated: number;
    categoryFilterClicks: Record<string, number>;
  };

  // Daily Growth Timeline (YYYY-MM-DD -> metrics)
  dailyTimeline: Record<string, DailyActivityBucket>;

  // Live Event Stream (last 60 events)
  recentEvents: RecentTelemetryEvent[];
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialAnalyticsStore(): AdminAnalyticsStore {
  const now = new Date().toISOString();
  const today = getTodayKey();
  return {
    firstRecordedAt: now,
    lastUpdatedAt: now,
    totalSessions: 1,
    returningVisits: 0,
    totalActiveSeconds: 0,
    longestSessionSeconds: 0,
    currentSessionSeconds: 0,
    colorSchemeUsage: {
      vibrantSwitches: 1,
      tonedSwitches: 0,
      vibrantActiveSeconds: 0,
      tonedActiveSeconds: 0,
      currentPreference: 'vibrant',
    },
    themeModeUsage: {
      darkSwitches: 1,
      lightSwitches: 0,
      darkActiveSeconds: 0,
      lightActiveSeconds: 0,
      currentPreference: 'dark',
    },
    totalSearches: 0,
    searchQueries: {},
    pageViews: {
      app: { view: 'app', label: 'Issues Feed (Dashboard)', views: 1, totalSecondsSpent: 0, lastViewedAt: now },
      discovery: { view: 'discovery', label: 'Discovery & Trending Hub', views: 0, totalSecondsSpent: 0, lastViewedAt: now },
      landing: { view: 'landing', label: 'Landing Page', views: 0, totalSecondsSpent: 0, lastViewedAt: now },
      auth: { view: 'auth', label: 'Sign In / Auth Page', views: 0, totalSecondsSpent: 0, lastViewedAt: now },
      analytics: { view: 'analytics', label: 'Admin Analytics Dashboard', views: 0, totalSecondsSpent: 0, lastViewedAt: now },
    },
    elementClicks: {},
    engagement: {
      votesYes: 0,
      votesNo: 0,
      inlineReplies: 0,
      voiceNotesRecorded: 0,
      issuesCreated: 0,
      issuesDeleted: 0,
      likesGiven: 0,
      favoritesSaved: 0,
      sharesInitiated: 0,
      categoryFilterClicks: {},
    },
    dailyTimeline: {
      [today]: {
        date: today,
        sessions: 1,
        pageViews: 1,
        clicks: 0,
        votesCast: 0,
        issuesCreated: 0,
        searches: 0,
        activeSeconds: 0,
      },
    },
    recentEvents: [],
  };
}

export function loadAnalyticsStore(): AdminAnalyticsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANALYTICS);
    if (!raw) {
      const initial = createInitialAnalyticsStore();
      saveAnalyticsStore(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<AdminAnalyticsStore>;
    const defaults = createInitialAnalyticsStore();
    return {
      ...defaults,
      ...parsed,
      colorSchemeUsage: { ...defaults.colorSchemeUsage, ...(parsed.colorSchemeUsage || {}) },
      themeModeUsage: { ...defaults.themeModeUsage, ...(parsed.themeModeUsage || {}) },
      pageViews: { ...defaults.pageViews, ...(parsed.pageViews || {}) },
      elementClicks: { ...(parsed.elementClicks || {}) },
      searchQueries: { ...(parsed.searchQueries || {}) },
      engagement: {
        ...defaults.engagement,
        ...(parsed.engagement || {}),
        categoryFilterClicks: { ...(parsed.engagement?.categoryFilterClicks || {}) },
      },
      dailyTimeline: { ...defaults.dailyTimeline, ...(parsed.dailyTimeline || {}) },
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents.slice(0, 60) : [],
    };
  } catch {
    return createInitialAnalyticsStore();
  }
}

export function saveAnalyticsStore(store: AdminAnalyticsStore): void {
  try {
    store.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_ANALYTICS, JSON.stringify(store));
    window.dispatchEvent(new Event('yesorno-analytics-updated'));
  } catch (err) {
    console.warn('Analytics storage save skipped:', err);
  }
}

function ensureDailyBucket(store: AdminAnalyticsStore): DailyActivityBucket {
  const today = getTodayKey();
  if (!store.dailyTimeline[today]) {
    store.dailyTimeline[today] = {
      date: today,
      sessions: 0,
      pageViews: 0,
      clicks: 0,
      votesCast: 0,
      issuesCreated: 0,
      searches: 0,
      activeSeconds: 0,
    };
  }
  return store.dailyTimeline[today];
}

function pushEvent(
  store: AdminAnalyticsStore,
  type: RecentTelemetryEvent['type'],
  label: string,
  detail?: string
) {
  const evt: RecentTelemetryEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    label,
    detail,
  };
  store.recentEvents = [evt, ...store.recentEvents].slice(0, 60);
}

/**
 * Records a session start / return visit once per browser tab session
 */
export function recordSessionStart(initialColorTone: ColorTone, initialTheme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    const store = loadAnalyticsStore();
    store.colorSchemeUsage.currentPreference = initialColorTone;
    store.themeModeUsage.currentPreference = initialTheme;

    const alreadyActiveInTab = sessionStorage.getItem(SESSION_FLAG_KEY);
    if (!alreadyActiveInTab) {
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
      const isReturning = Boolean(localStorage.getItem('yesorno_has_visited_before_v1'));
      localStorage.setItem('yesorno_has_visited_before_v1', '1');

      if (isReturning) {
        store.totalSessions += 1;
        store.returningVisits += 1;
        const bucket = ensureDailyBucket(store);
        bucket.sessions += 1;
      }
      store.currentSessionSeconds = 0;
    }
    saveAnalyticsStore(store);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Records active time spent on the app (called every second while tab is visible)
 */
export function recordActiveTimeTick(
  seconds: number,
  currentView: AppView,
  colorTone: ColorTone,
  themeMode: ThemeMode
): void {
  if (seconds <= 0) return;
  const store = loadAnalyticsStore();
  store.totalActiveSeconds += seconds;
  store.currentSessionSeconds += seconds;
  if (store.currentSessionSeconds > store.longestSessionSeconds) {
    store.longestSessionSeconds = store.currentSessionSeconds;
  }

  // Attribute active time to Full-Coloured (vibrant) vs Toned-Down (toned)
  store.colorSchemeUsage.currentPreference = colorTone;
  if (colorTone === 'vibrant') {
    store.colorSchemeUsage.vibrantActiveSeconds += seconds;
  } else {
    store.colorSchemeUsage.tonedActiveSeconds += seconds;
  }

  // Attribute active time to Dark vs Light theme
  store.themeModeUsage.currentPreference = themeMode;
  if (themeMode === 'dark') {
    store.themeModeUsage.darkActiveSeconds += seconds;
  } else {
    store.themeModeUsage.lightActiveSeconds += seconds;
  }

  // Attribute active time to current page view
  if (store.pageViews[currentView]) {
    store.pageViews[currentView].totalSecondsSpent += seconds;
  }

  const bucket = ensureDailyBucket(store);
  bucket.activeSeconds += seconds;

  saveAnalyticsStore(store);
}

/**
 * Records a page or modal view
 */
export function recordPageView(viewKey: string, label?: string): void {
  const store = loadAnalyticsStore();
  const now = new Date().toISOString();
  const viewLabels: Record<string, string> = {
    app: 'Issues Feed (Dashboard)',
    discovery: 'Discovery & Trending Hub',
    landing: 'Landing Page',
    auth: 'Sign In / Auth Page',
    analytics: 'Admin Analytics Dashboard',
    'modal:issue-detail': 'Issue Detail & Replies Modal',
    'modal:create-issue': 'Post New Issue Modal',
    'modal:vote-studio': 'Full Vote Studio Modal',
    'modal:profile-settings': 'Profile & Settings Modal',
    'modal:share-issue': 'Share Issue Modal',
    'modal:guidelines': 'Community Guidelines Modal',
    'modal:legal': 'Terms & Privacy Policy Modal',
    'modal:onboarding': 'Onboarding Preferences Modal',
  };

  const resolvedLabel = label || viewLabels[viewKey] || viewKey;
  const existing = store.pageViews[viewKey];
  if (existing) {
    existing.views += 1;
    existing.lastViewedAt = now;
  } else {
    store.pageViews[viewKey] = {
      view: viewKey,
      label: resolvedLabel,
      views: 1,
      totalSecondsSpent: 0,
      lastViewedAt: now,
    };
  }

  const bucket = ensureDailyBucket(store);
  bucket.pageViews += 1;
  pushEvent(store, 'page_view', `Viewed ${resolvedLabel}`);
  saveAnalyticsStore(store);
}

/**
 * Records a button, link, or UI control click for the ranked leaderboard
 */
export function recordElementClick(
  id: string,
  label: string,
  elementType: ClickedElementMetric['elementType'] = 'button',
  location = 'App'
): void {
  const store = loadAnalyticsStore();
  const now = new Date().toISOString();
  const key = `${elementType}:${id}`;

  const existing = store.elementClicks[key];
  if (existing) {
    existing.clicks += 1;
    existing.label = label || existing.label;
    existing.lastClickedAt = now;
  } else {
    store.elementClicks[key] = {
      id: key,
      label,
      elementType,
      location,
      clicks: 1,
      lastClickedAt: now,
    };
  }

  const bucket = ensureDailyBucket(store);
  bucket.clicks += 1;
  pushEvent(store, 'click', label, `${elementType.toUpperCase()} in ${location}`);
  saveAnalyticsStore(store);
}

/**
 * Records a user search query (debounced in caller)
 */
export function recordSearchQuery(rawQuery: string): void {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return;
  const store = loadAnalyticsStore();
  const now = new Date().toISOString();

  store.totalSearches += 1;
  if (store.searchQueries[q]) {
    store.searchQueries[q].count += 1;
    store.searchQueries[q].lastSearchedAt = now;
  } else {
    store.searchQueries[q] = {
      query: q,
      count: 1,
      lastSearchedAt: now,
    };
  }

  const bucket = ensureDailyBucket(store);
  bucket.searches += 1;
  pushEvent(store, 'search', `Searched "${rawQuery.trim()}"`);
  saveAnalyticsStore(store);
}

/**
 * Records switching between Full-Coloured (vibrant) and Toned-Down (toned)
 */
export function recordColorToneSwitch(newTone: ColorTone): void {
  const store = loadAnalyticsStore();
  store.colorSchemeUsage.currentPreference = newTone;
  if (newTone === 'vibrant') {
    store.colorSchemeUsage.vibrantSwitches += 1;
  } else {
    store.colorSchemeUsage.tonedSwitches += 1;
  }
  pushEvent(
    store,
    'color_switch',
    `Switched Color Palette to ${newTone === 'vibrant' ? 'Full-Coloured (Vibrant)' : 'Toned-Down (Muted)'}`
  );
  saveAnalyticsStore(store);
}

/**
 * Records switching between Dark and Light mode
 */
export function recordThemeModeSwitch(newTheme: ThemeMode): void {
  const store = loadAnalyticsStore();
  store.themeModeUsage.currentPreference = newTheme;
  if (newTheme === 'dark') {
    store.themeModeUsage.darkSwitches += 1;
  } else {
    store.themeModeUsage.lightSwitches += 1;
  }
  pushEvent(store, 'theme_switch', `Switched Appearance to ${newTheme.toUpperCase()} mode`);
  saveAnalyticsStore(store);
}

/**
 * Records domain-specific engagement events (votes, replies, likes, favourites, new issues, shares, category selections)
 */
export function recordEngagementAction(
  action:
    | 'vote_yes'
    | 'vote_no'
    | 'inline_reply'
    | 'voice_note'
    | 'issue_created'
    | 'issue_deleted'
    | 'like'
    | 'favorite'
    | 'share'
    | 'card_download'
    | 'card_copy'
    | 'category_select',
  detail?: string
): void {
  const store = loadAnalyticsStore();
  const bucket = ensureDailyBucket(store);

  switch (action) {
    case 'vote_yes':
      store.engagement.votesYes += 1;
      bucket.votesCast += 1;
      pushEvent(store, 'vote', 'Voted YES on Issue', detail);
      break;
    case 'vote_no':
      store.engagement.votesNo += 1;
      bucket.votesCast += 1;
      pushEvent(store, 'vote', 'Voted NO on Issue', detail);
      break;
    case 'inline_reply':
      store.engagement.inlineReplies += 1;
      pushEvent(store, 'vote', 'Posted Written Reply', detail);
      break;
    case 'voice_note':
      store.engagement.voiceNotesRecorded += 1;
      pushEvent(store, 'vote', 'Attached 60s Voice Note', detail);
      break;
    case 'issue_created':
      store.engagement.issuesCreated += 1;
      bucket.issuesCreated += 1;
      pushEvent(store, 'issue_created', 'Published New Issue', detail);
      break;
    case 'issue_deleted':
      store.engagement.issuesDeleted += 1;
      pushEvent(store, 'click', 'Deleted Issue Topic by Author', detail);
      break;
    case 'like':
      store.engagement.likesGiven += 1;
      break;
    case 'favorite':
      store.engagement.favoritesSaved += 1;
      break;
    case 'share':
      store.engagement.sharesInitiated += 1;
      pushEvent(store, 'share', 'Opened Share Issue Dialog', detail);
      break;
    case 'card_download':
      store.engagement.sharesInitiated += 1;
      pushEvent(store, 'share', 'Downloaded High-Res Social Image Card', detail);
      break;
    case 'card_copy':
      store.engagement.sharesInitiated += 1;
      pushEvent(store, 'share', 'Copied Image Card to Clipboard', detail);
      break;
    case 'category_select':
      if (detail) {
        store.engagement.categoryFilterClicks[detail as IssueCategory] =
          (store.engagement.categoryFilterClicks[detail as IssueCategory] || 0) + 1;
      }
      break;
  }

  saveAnalyticsStore(store);
}

/**
 * Formats seconds into human-readable duration (e.g., "14m 32s" or "2h 15m")
 */
export function formatDurationSeconds(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

/**
 * Resets analytics telemetry to a clean slate
 */
export function resetAnalyticsStore(): AdminAnalyticsStore {
  const fresh = createInitialAnalyticsStore();
  saveAnalyticsStore(fresh);
  return fresh;
}

