import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  loadIssues, saveIssues, getUserVotesMap, recordUserVote, resetToDefaults,
  getUserLikesMap, saveUserLikesMap, getUserFavoritesMap, saveUserFavoritesMap,
  fetchServerIssues, recordDeletedIssueId, getDeletedIssueIds, LEGACY_MOCK_ISSUE_IDS,
  apiRecordVote, apiRecordReply, apiRecordReaction, apiRecordDeleteIssue
} from './utils/storage';
import { getStoredUser, saveStoredUser, TOP_CREATORS_AND_VOTERS, isAdminUser, getSavedProfileByEmail, fetchServerProfileByEmail } from './utils/auth';
import { 
  getInitialTheme, applyTheme, ThemeMode, 
  getInitialColorTone, applyColorTone, ColorTone 
} from './utils/theme';
import { updateDocumentMetaForIssue, findIssueFromUrl, buildIssueSlug } from './utils/share';
import {
  recordSessionStart,
  recordActiveTimeTick,
  recordPageView,
  recordElementClick,
  recordSearchQuery,
  recordColorToneSwitch,
  recordThemeModeSwitch,
  recordEngagementAction,
} from './utils/analytics';
import {
  notifyAdminUserRegistered,
  notifyAdminIssueCreated,
  notifyAdminIssueShared,
} from './utils/emailNotifier';
import { Issue, IssueCategory, VoteSubmission, AppView, UserProfile, PublicUserProfile, VoteChoice, CommentReply, IssueDraft } from './types';
import { applyAnimationsClass, areAnimationsEnabled } from './utils/sound';
import { Navbar, FeedSortOption } from './components/Navbar';
import { IssueCard } from './components/IssueCard';
import { VoteModal } from './components/VoteModal';
import { IssueDetailPage } from './components/IssueDetailPage';
import { UserProfilePage } from './components/UserProfilePage';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CreateIssueModal } from './components/CreateIssueModal';
import { CommunityGuidelinesModal } from './components/CommunityGuidelinesModal';
import { LegalModal, LegalDocTab } from './components/LegalModal';
import { ShareIssueModal } from './components/ShareIssueModal';
import { DiscoveryHub, inferIssueRegion } from './components/DiscoveryHub';
import { AdminAnalyticsPage } from './components/AdminAnalyticsPage';
import { OnboardingModal } from './components/OnboardingModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { ContactPage } from './components/ContactPage';
import { ToastContainer, ToastMessage } from './components/Toast';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { checkAndTriggerDailyGeminiPosts } from './utils/geminiDailyGenerator';
import { resolveUserProfile } from './utils/userProfile';
import { 
  Filter, Home, User, Vote, Clock, Plus, Bookmark, Compass, Search, Sparkles, ArrowUp
} from 'lucide-react';

function getInitialView(user: UserProfile | null): AppView {
  const hash = window.location.hash.replace('#', '');
  const params = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const hasSharedIssue = params.has('issue') || Boolean(rawPath && rawPath !== 'index.html');

  if (hash === 'landing') {
    return 'landing';
  }
  if (hash === 'contact') {
    return 'contact';
  }
  if (hash.startsWith('profile/') || hash.startsWith('user/')) {
    return 'profile';
  }
  if (user) {
    if (hash === 'discovery') return 'discovery';
    if (hash === 'analytics' && isAdminUser(user)) return 'analytics';
    return 'app';
  }
  if (hash === 'app' || hash === 'discovery' || hash === 'analytics' || hasSharedIssue || hash === 'auth') {
    return 'auth';
  }
  return 'landing';
}

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const [currentView, setCurrentView] = useState<AppView>(() => getInitialView(getStoredUser()));
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [colorTone, setColorTone] = useState<ColorTone>(() => getInitialColorTone());
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  const [issues, setIssues] = useState<Issue[]>(() => loadIssues());
  const [isInitialLoadingIssues, setIsInitialLoadingIssues] = useState(true);
  const isInitialMountRef = useRef(true);
  const [pendingNewIssues, setPendingNewIssues] = useState<Issue[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, { choice: 'YES' | 'NO'; responseId?: string }>>(() => getUserVotesMap());
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>(() => getUserLikesMap());
  const [userFavorites, setUserFavorites] = useState<Record<string, boolean>>(() => getUserFavoritesMap());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchMobile, setShowSearchMobile] = useState(false);
  const [sortBy, setSortBy] = useState<FeedSortOption>('for-you');
  const [regionScope, setRegionScope] = useState<'my-region-worldwide' | 'all-regions'>('my-region-worldwide');
  const [interestScope, setInterestScope] = useState<'my-interests-mixed' | 'all-categories'>('my-interests-mixed');
  const [visibleCount, setVisibleCount] = useState(6);
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);

  // Modals state
  const [activeVoteIssue, setActiveVoteIssue] = useState<Issue | null>(null);
  const [initialVoteChoice, setInitialVoteChoice] = useState<VoteChoice | null>(null);
  const [activeDetailIssue, setActiveDetailIssue] = useState<Issue | null>(null);
  const [activeShareIssue, setActiveShareIssue] = useState<Issue | null>(null);
  const [activeProfileUser, setActiveProfileUser] = useState<PublicUserProfile | null>(null);
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalDocTab | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);

  // Automated Gemini Daily Polarizing Questions: 3 times a day (morning, afternoon, evening)
  const issuesRef = useRef(issues);
  issuesRef.current = issues;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    checkAndTriggerDailyGeminiPosts(issuesRef.current, (newlyCreated) => {
      setIssues(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const unique = newlyCreated.filter(i => !existingIds.has(i.id));
        if (unique.length === 0) return prev;
        return [...unique, ...prev];
      });
    }, currentUser?.region);

    const interval = setInterval(() => {
      checkAndTriggerDailyGeminiPosts(issuesRef.current, (newlyCreated) => {
        setIssues(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const unique = newlyCreated.filter(i => !existingIds.has(i.id));
          if (unique.length === 0) return prev;
          return [...unique, ...prev];
        });
      }, currentUser?.region);
    }, 300000); // Poll once every 5 minutes

    return () => clearInterval(interval);
  }, [currentUser?.region]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply theme class to <html>
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply color tone class (Full-Coloured vs Toned-Down) to <html>
  useEffect(() => {
    applyColorTone(colorTone);
  }, [colorTone]);

  // Apply animations class to <html> based on user preference or local storage
  useEffect(() => {
    const enabled = currentUser?.animationsEnabled ?? areAnimationsEnabled();
    applyAnimationsClass(enabled);
  }, [currentUser?.animationsEnabled]);

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      recordThemeModeSwitch(next);
      if (currentUser) {
        const updated: UserProfile = { ...currentUser, theme: next };
        setCurrentUser(updated);
        saveStoredUser(updated);
      }
      return next;
    });
  };

  const handleToggleColorTone = () => {
    setColorTone(prev => {
      const next = prev === 'vibrant' ? 'toned' : 'vibrant';
      recordColorToneSwitch(next);
      if (currentUser) {
        const updated: UserProfile = { ...currentUser, colorTone: next };
        setCurrentUser(updated);
        saveStoredUser(updated);
      }
      return next;
    });
  };

  // Analytics: Record session start (and return visit detection) once on mount
  useEffect(() => {
    recordSessionStart(colorTone, theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Analytics: 1-second active dwell-time ticker (only while tab is visible)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        recordActiveTimeTick(1, currentView, colorTone, theme);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentView, colorTone, theme]);

  // Analytics: Track page views whenever currentView changes
  useEffect(() => {
    recordPageView(currentView);
  }, [currentView]);

  // Analytics: Track modal opens as views
  useEffect(() => {
    if (activeDetailIssue) recordPageView('modal:detail');
  }, [activeDetailIssue]);
  useEffect(() => {
    if (activeVoteIssue) recordPageView('modal:vote');
  }, [activeVoteIssue]);
  useEffect(() => {
    if (isCreateModalOpen) recordPageView('modal:create');
  }, [isCreateModalOpen]);
  useEffect(() => {
    if (isProfileSettingsOpen) recordPageView('modal:profile');
  }, [isProfileSettingsOpen]);
  useEffect(() => {
    if (activeShareIssue) recordPageView('modal:share');
  }, [activeShareIssue]);
  useEffect(() => {
    if (isGuidelinesOpen) recordPageView('modal:guidelines');
  }, [isGuidelinesOpen]);
  useEffect(() => {
    if (legalModalTab) recordPageView('modal:legal');
  }, [legalModalTab]);
  useEffect(() => {
    if (isOnboardingOpen) recordPageView('modal:onboarding');
  }, [isOnboardingOpen]);

  // Multi-Device Profile Sync: ensure latest interests/region/votes from another device update seamlessly
  useEffect(() => {
    if (currentUser?.email) {
      fetchServerProfileByEmail(currentUser.email).then(serverProf => {
        if (serverProf) {
          setCurrentUser(prev => {
            if (!prev) return null;
            const updated = {
              ...prev,
              ...serverProf,
              username: serverProf.username || prev.username,
              interests: (serverProf.interests && serverProf.interests.length > 0) ? serverProf.interests : prev.interests,
              region: serverProf.region || prev.region,
              followingCreators: (serverProf.followingCreators && serverProf.followingCreators.length > 0) ? serverProf.followingCreators : prev.followingCreators,
              issueDraft: serverProf.issueDraft !== undefined ? serverProf.issueDraft : prev.issueDraft,
              defaultAnonymous: serverProf.defaultAnonymous !== undefined ? serverProf.defaultAnonymous : prev.defaultAnonymous,
              defaultVoiceFilter: serverProf.defaultVoiceFilter || prev.defaultVoiceFilter,
              soundEnabled: serverProf.soundEnabled !== undefined ? serverProf.soundEnabled : prev.soundEnabled,
              animationsEnabled: serverProf.animationsEnabled !== undefined ? serverProf.animationsEnabled : prev.animationsEnabled,
              theme: serverProf.theme || prev.theme,
              colorTone: serverProf.colorTone || prev.colorTone,
              onboardingCompleted: serverProf.onboardingCompleted ?? prev.onboardingCompleted,
            };
            return updated;
          });

          if (serverProf.theme) {
            setTheme(serverProf.theme);
          }
          if (serverProf.colorTone) {
            setColorTone(serverProf.colorTone);
          }

          if (serverProf.votedIssues && Object.keys(serverProf.votedIssues).length > 0) {
            setUserVotes(prev => {
              const m = { ...serverProf.votedIssues, ...prev };
              try { localStorage.setItem('yesorno_user_votes_v1', JSON.stringify(m)); } catch {}
              return m;
            });
          }
          if (serverProf.likedIssueIds && serverProf.likedIssueIds.length > 0) {
            setUserLikes(prev => {
              const m = { ...prev };
              serverProf.likedIssueIds?.forEach(id => { m[id] = true; });
              saveUserLikesMap(m);
              return m;
            });
          }
          if (serverProf.favoriteIssueIds && serverProf.favoriteIssueIds.length > 0) {
            setUserFavorites(prev => {
              const m = { ...prev };
              serverProf.favoriteIssueIds?.forEach(id => { m[id] = true; });
              saveUserFavoritesMap(m);
              return m;
            });
          }
        }
      }).catch(() => {});
    }
  }, []);

  // Analytics: Debounced search query telemetry
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      recordSearchQuery(trimmed);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Analytics: Global delegated click tracker for all buttons and links
  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const clickable = target.closest('button, a, [role="button"]') as HTMLElement | null;
      if (!clickable) return;

      const tag = clickable.tagName.toLowerCase();
      const kind: 'button' | 'link' = tag === 'a' ? 'link' : 'button';

      const rawLabel =
        clickable.getAttribute('data-analytics-label') ||
        clickable.getAttribute('aria-label') ||
        clickable.getAttribute('title') ||
        clickable.textContent ||
        '';

      const cleanLabel = rawLabel.replace(/\s+/g, ' ').trim().slice(0, 56);
      if (!cleanLabel) return;

      let location = 'Main Workspace';
      if (clickable.closest('header')) location = 'Header Navbar';
      else if (clickable.closest('footer')) location = 'Footer';
      else if (clickable.closest('[role="dialog"], .fixed.inset-0')) location = 'Modal Dialog';
      else if (clickable.closest('article')) location = 'Issue Card';

      const slugId = `${kind}:${location.toLowerCase().replace(/\s+/g, '-')}:${cleanLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36)}`;

      recordElementClick(slugId, cleanLabel, kind, location);
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, []);

  // Derive live issue for detail view to ensure instant reactivity with issues state
  const liveDetailIssue = useMemo(() => {
    if (!activeDetailIssue) return null;
    return issues.find(i => i.id === activeDetailIssue.id) || activeDetailIssue;
  }, [activeDetailIssue, issues]);

  // Lock background page scroll whenever any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      activeVoteIssue ||
      activeShareIssue ||
      isGuidelinesOpen ||
      legalModalTab !== null ||
      isCreateModalOpen ||
      isProfileSettingsOpen ||
      isOnboardingOpen
    );

    if (isAnyModalOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [
    activeVoteIssue,
    activeShareIssue,
    isGuidelinesOpen,
    legalModalTab,
    isCreateModalOpen,
    isProfileSettingsOpen,
    isOnboardingOpen,
  ]);

  // Sync OpenGraph / document meta tags and clean slug URL when an issue is opened or shared
  useEffect(() => {
    const targetIssue = liveDetailIssue || activeShareIssue || null;
    updateDocumentMetaForIssue(targetIssue);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      if (targetIssue) {
        const slugPath = `/${buildIssueSlug(targetIssue)}`;
        if (window.location.pathname !== slugPath) {
          window.history.replaceState(null, '', `${slugPath}${window.location.hash}`);
        }
      } else if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.history.replaceState(null, '', `/${window.location.hash || '#app'}`);
      }
    }
  }, [liveDetailIssue, activeShareIssue]);

  // If URL has /{slug-of-the-issue-question}-{id} or ?issue=<id> and user is authenticated, auto-open that issue
  useEffect(() => {
    if (!currentUser) return;
    const found = findIssueFromUrl(issues);
    if (found) {
      setActiveDetailIssue(found);
      setCurrentView('issue');
    }
  }, [currentUser, issues]);

  const addToast = (type: 'success' | 'info' | 'warning', title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Strict Auth-Protected Navigation
  const handleNavigate = (view: AppView) => {
    if ((view === 'app' || view === 'discovery' || view === 'analytics') && !currentUser) {
      setAuthPromptMessage('Please sign in to view, create, and vote on issues.');
      setCurrentView('auth');
      window.location.hash = 'auth';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (view === 'analytics' && !isAdminUser(currentUser)) {
      setCurrentView('app');
      window.location.hash = 'app';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAuthPromptMessage(null);
    setCurrentView(view);
    window.location.hash = view === 'landing' ? '' : view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('issue/')) {
        const issueId = hash.replace('issue/', '');
        const found = issues.find(i => i.id === issueId);
        if (found) {
          setActiveDetailIssue(found);
          setCurrentView('issue');
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      } else if (hash === 'app' || hash === 'discovery' || hash === 'analytics') {
        if (!currentUser) {
          setAuthPromptMessage('Please sign in to view, create, and vote on issues.');
          setCurrentView('auth');
          window.location.hash = 'auth';
        } else if (hash === 'analytics' && !isAdminUser(currentUser)) {
          setCurrentView('app');
          window.location.hash = 'app';
        } else {
          setActiveDetailIssue(null);
          setCurrentView(hash as AppView);
        }
      } else if (hash.startsWith('profile/') || hash.startsWith('user/')) {
        const userHandle = hash.replace(/^(profile|user)\//, '');
        const resolved = resolveUserProfile({ username: userHandle }, issues, currentUser);
        setActiveProfileUser(resolved);
        setActiveDetailIssue(null);
        setCurrentView('profile');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } else if (hash === 'contact') {
        setActiveDetailIssue(null);
        setCurrentView('contact');
      } else if (hash === 'auth') {
        setCurrentView('auth');
      } else if (hash === '' || hash === 'landing') {
        setActiveDetailIssue(null);
        setCurrentView(currentUser ? 'app' : 'landing');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentUser, issues]);

  // Handle direct navigation to profile on initial page load if hash present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('profile/') || hash.startsWith('user/')) {
      const userHandle = hash.replace(/^(profile|user)\//, '');
      const resolved = resolveUserProfile({ username: userHandle }, issues, currentUser);
      setActiveProfileUser(resolved);
      setActiveDetailIssue(null);
      setCurrentView('profile');
    }
  }, []);

  // Open user profile page
  const handleOpenProfile = (target: { username?: string; name: string; avatar?: string; email?: string; role?: string }) => {
    const resolved = resolveUserProfile(target, issues, currentUser);
    setActiveProfileUser(resolved);
    setActiveDetailIssue(null);
    setCurrentView('profile');
    window.location.hash = `profile/${encodeURIComponent(resolved.username)}`;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  // Toggle follow user profile
  const handleToggleFollowProfile = (targetProfile: PublicUserProfile) => {
    if (!currentUser) {
      setAuthPromptMessage('Please sign in to follow community members.');
      handleNavigate('auth');
      return;
    }
    const currentFollowing = currentUser.followingCreators || [];
    const targetHandle = targetProfile.username;
    const targetName = targetProfile.name;
    const targetId = targetProfile.id || targetHandle;

    const isFollowing = currentFollowing.some(f => {
      const fClean = f.replace(/^@/, '').toLowerCase();
      return fClean === targetHandle.toLowerCase() || f.toLowerCase() === targetName.toLowerCase() || f === targetId;
    });

    let updatedFollowing: string[];
    if (isFollowing) {
      updatedFollowing = currentFollowing.filter(f => {
        const fClean = f.replace(/^@/, '').toLowerCase();
        return !(fClean === targetHandle.toLowerCase() || f.toLowerCase() === targetName.toLowerCase() || f === targetId);
      });
      addToast('info', 'Unfollowed', `You unfollowed @${targetProfile.username}.`);
    } else {
      updatedFollowing = [...currentFollowing, `@${targetProfile.username}`];
      addToast('success', 'Following!', `You are now following @${targetProfile.username}. Their issues will be prioritized in your feed.`);
    }

    const updatedUser: UserProfile = {
      ...currentUser,
      followingCreators: updatedFollowing,
    };
    setCurrentUser(updatedUser);
    saveStoredUser(updatedUser);
  };

  // Sync issues to localStorage and cloud server
  useEffect(() => {
    saveIssues(issues);
  }, [issues]);

  // Cloud Sync: On mount and window focus, fetch shared issues from SQLite API and merge with local issues
  useEffect(() => {
    const syncFromCloud = () => {
      fetchServerIssues().then((serverIssues) => {
        setIsInitialLoadingIssues(false);
        if (serverIssues && serverIssues.length > 0) {
          const deletedIds = getDeletedIssueIds();
          const validServerIssues = serverIssues.filter(
            (i) => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id)
          );

          setIssues((prev) => {
            const currentIds = new Set(prev.map((i) => i.id));
            const brandNewIssues = validServerIssues.filter((i) => !currentIds.has(i.id));

            // If not initial mount and brand new issues arrived from server:
            // Buffer them into pendingNewIssues so we don't trigger jarring scroll jumps!
            if (!isInitialMountRef.current && brandNewIssues.length > 0) {
              setPendingNewIssues((prevPending) => {
                const pendingMap = new Map<string, Issue>();
                prevPending.forEach((i) => pendingMap.set(i.id, i));
                brandNewIssues.forEach((i) => pendingMap.set(i.id, i));
                return Array.from(pendingMap.values());
              });

              // Still update any existing issues with latest vote counts / replies in-place:
              const serverMap = new Map<string, Issue>();
              validServerIssues.forEach((i) => serverMap.set(i.id, i));
              const updatedExisting = prev.map((p) => {
                const s = serverMap.get(p.id);
                if (!s) return p;
                return {
                  ...p,
                  yesCount: s.yesCount,
                  noCount: s.noCount,
                  likesCount: s.likesCount,
                  favoritesCount: s.favoritesCount,
                  responses: s.responses
                };
              });
              saveIssues(updatedExisting);
              return updatedExisting;
            }

            // Initial mount or initial hydration:
            isInitialMountRef.current = false;
            const map = new Map<string, Issue>();
            validServerIssues.forEach((i) => map.set(i.id, i));

            // Only preserve locally created issues that were created within the last 60s (in-flight network sync)
            const now = Date.now();
            prev
              .filter((i) => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id))
              .forEach((i) => {
                if (!map.has(i.id)) {
                  const createdTime = new Date(i.createdAt).getTime();
                  if (!isNaN(createdTime) && now - createdTime < 60000) {
                    map.set(i.id, i);
                  }
                }
              });
            const merged = Array.from(map.values());
            saveIssues(merged);
            return merged;
          });
        }
      }).catch(() => {
        setIsInitialLoadingIssues(false);
      });

      // Also sync user profile, votes, likes, and settings across devices in real-time
      const activeEmail = currentUserRef.current?.email;
      if (activeEmail) {
        fetchServerProfileByEmail(activeEmail).then((serverProf) => {
          if (serverProf) {
            setCurrentUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...serverProf,
                username: serverProf.username || prev.username,
                interests: (serverProf.interests && serverProf.interests.length > 0) ? serverProf.interests : prev.interests,
                region: serverProf.region || prev.region,
                followingCreators: (serverProf.followingCreators && serverProf.followingCreators.length > 0) ? serverProf.followingCreators : prev.followingCreators,
                issueDraft: serverProf.issueDraft !== undefined ? serverProf.issueDraft : prev.issueDraft,
                defaultAnonymous: serverProf.defaultAnonymous !== undefined ? serverProf.defaultAnonymous : prev.defaultAnonymous,
                defaultVoiceFilter: serverProf.defaultVoiceFilter || prev.defaultVoiceFilter,
                soundEnabled: serverProf.soundEnabled !== undefined ? serverProf.soundEnabled : prev.soundEnabled,
                animationsEnabled: serverProf.animationsEnabled !== undefined ? serverProf.animationsEnabled : prev.animationsEnabled,
                theme: serverProf.theme || prev.theme,
                colorTone: serverProf.colorTone || prev.colorTone,
                onboardingCompleted: serverProf.onboardingCompleted ?? prev.onboardingCompleted,
              };
            });

            if (serverProf.theme) {
              setTheme(serverProf.theme);
            }
            if (serverProf.colorTone) {
              setColorTone(serverProf.colorTone);
            }

            if (serverProf.votedIssues && Object.keys(serverProf.votedIssues).length > 0) {
              setUserVotes((prev) => {
                const m = { ...serverProf.votedIssues, ...prev };
                try { localStorage.setItem('yesorno_user_votes_v1', JSON.stringify(m)); } catch {}
                return m;
              });
            }
            if (serverProf.likedIssueIds && serverProf.likedIssueIds.length > 0) {
              setUserLikes((prev) => {
                const m = { ...prev };
                serverProf.likedIssueIds?.forEach((id) => { m[id] = true; });
                saveUserLikesMap(m);
                return m;
              });
            }
            if (serverProf.favoriteIssueIds && serverProf.favoriteIssueIds.length > 0) {
              setUserFavorites((prev) => {
                const m = { ...prev };
                serverProf.favoriteIssueIds?.forEach((id) => { m[id] = true; });
                saveUserFavoritesMap(m);
                return m;
              });
            }
          }
        }).catch(() => {});
      }
    };

    syncFromCloud();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud();
      }
    };

    window.addEventListener('focus', syncFromCloud);
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Background polling for real-time new questions every 20 seconds
    const pollInterval = window.setInterval(syncFromCloud, 20000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('focus', syncFromCloud);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Handle clicking the X/Instagram style floating pill
  const handleRefreshToTop = () => {
    if (pendingNewIssues.length > 0) {
      setIssues((prev) => {
        const deletedIds = getDeletedIssueIds();
        const map = new Map<string, Issue>();
        // Put pending new issues at the top of the feed!
        pendingNewIssues
          .filter((i) => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id))
          .forEach((i) => map.set(i.id, i));
        // Followed by previous issues
        prev
          .filter((i) => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id))
          .forEach((i) => {
            if (!map.has(i.id)) {
              map.set(i.id, i);
            }
          });
        const updated = Array.from(map.values());
        saveIssues(updated);
        return updated;
      });
      setPendingNewIssues([]);
    }
    // Smoothly scroll to the very top of the feed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync currentUser to localStorage and navigate straight to the dashboard upon sign-in
  const handleSelectUser = (user: UserProfile | null) => {
    setCurrentUser(user);
    saveStoredUser(user);
    if (user) {
      setAuthPromptMessage(null);
      setCurrentView('app');
      window.location.hash = 'app';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Hydrate user votes, likes, favorites across devices
      if (user.votedIssues && Object.keys(user.votedIssues).length > 0) {
        setUserVotes(prev => {
          const merged = { ...user.votedIssues, ...prev };
          try {
            localStorage.setItem('yesorno_user_votes_v1', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (user.likedIssueIds && user.likedIssueIds.length > 0) {
        setUserLikes(prev => {
          const merged = { ...prev };
          user.likedIssueIds?.forEach(id => { merged[id] = true; });
          saveUserLikesMap(merged);
          return merged;
        });
      }
      if (user.favoriteIssueIds && user.favoriteIssueIds.length > 0) {
        setUserFavorites(prev => {
          const merged = { ...prev };
          user.favoriteIssueIds?.forEach(id => { merged[id] = true; });
          saveUserFavoritesMap(merged);
          return merged;
        });
      }

      // Notify admin email on registration (login notifications suppressed per admin preference)
      const isNewUser = !user.onboardingCompleted || !getSavedProfileByEmail(user.email);
      if (isNewUser) {
        notifyAdminUserRegistered(user, 'Account Registration');
      }

      if (!user.onboardingCompleted) {
        // Double-check server in case onboarding was already completed on another device
        fetchServerProfileByEmail(user.email).then(serverProf => {
          if (serverProf && (serverProf.onboardingCompleted || (serverProf.interests && serverProf.interests.length > 0))) {
            const merged: UserProfile = { ...user, ...serverProf, onboardingCompleted: true };
            setCurrentUser(merged);
            saveStoredUser(merged);
            setIsOnboardingOpen(false);
            addToast('success', `Welcome back, ${merged.name}`);
            if (serverProf.votedIssues) {
              setUserVotes(prev => {
                const m = { ...serverProf.votedIssues, ...prev };
                try { localStorage.setItem('yesorno_user_votes_v1', JSON.stringify(m)); } catch {}
                return m;
              });
            }
            if (serverProf.likedIssueIds) {
              setUserLikes(prev => {
                const m = { ...prev };
                serverProf.likedIssueIds?.forEach(id => { m[id] = true; });
                saveUserLikesMap(m);
                return m;
              });
            }
            if (serverProf.favoriteIssueIds) {
              setUserFavorites(prev => {
                const m = { ...prev };
                serverProf.favoriteIssueIds?.forEach(id => { m[id] = true; });
                saveUserFavoritesMap(m);
                return m;
              });
            }
          } else {
            setIsOnboardingOpen(true);
          }
        }).catch(() => {
          setIsOnboardingOpen(true);
        });
      } else {
        addToast('success', `Signed in as ${user.name}`);
      }
    } else {
      setActiveDetailIssue(null);
      setActiveVoteIssue(null);
      setIsCreateModalOpen(false);
      setIsProfileSettingsOpen(false);
      setIsOnboardingOpen(false);
      setCurrentView('auth');
      window.location.hash = 'auth';
      addToast('info', 'Signed out');
    }
  };

  // Handle completing the 3-step onboarding flow
  const handleCompleteOnboarding = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    saveStoredUser(updatedUser);
    setIsOnboardingOpen(false);
    setCurrentView('app');
    window.location.hash = 'app';
    setSortBy('for-you');
    setRegionScope('my-region-worldwide');
    setInterestScope('my-interests-mixed');
    notifyAdminUserRegistered(updatedUser, 'Completed Onboarding & Profile Setup');
    addToast(
      'success',
      'Personalized Feed Ready!',
      `Prioritizing ${updatedUser.region || 'Worldwide'} + Worldwide and ${(updatedUser.interests || []).length} interests.`
    );
  };

  // Handle updating user profile & settings from ProfileSettingsModal
  const handleUpdateUserProfile = (updated: UserProfile) => {
    setCurrentUser(updated);
    saveStoredUser(updated);
    addToast('success', 'Preferences Saved', 'Your feed priority & profile settings are updated.');
  };

  // Autosave issue draft to user profile & cloud server for cross-device resume
  const handleSaveIssueDraft = (draft: IssueDraft | null) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      issueDraft: draft,
    };
    setCurrentUser(updatedUser);
    saveStoredUser(updatedUser);
  };

  // Automatically build user's interest profile as they interact with issues
  const recordUserInterestFromIssue = (issue: Issue | undefined | null) => {
    if (!currentUser || !issue) return;
    if (issue.category === 'All' || issue.category === 'Private & Internal') return;
    const currentInterests = currentUser.interests || [];
    if (!currentInterests.includes(issue.category)) {
      const updatedUser: UserProfile = {
        ...currentUser,
        interests: [...currentInterests, issue.category],
      };
      setCurrentUser(updatedUser);
      saveStoredUser(updatedUser);
    }
  };

  // Open Vote Modal with auth check
  const handleOpenQuickVote = (issue: Issue, choice?: VoteChoice) => {
    if (!currentUser) {
      setAuthPromptMessage('Please sign in to cast your vote.');
      handleNavigate('auth');
      return;
    }
    recordUserInterestFromIssue(issue);
    setInitialVoteChoice(choice || null);
    setActiveVoteIssue(issue);
  };

  // Handle vote submission (supports both 1-tap instant votes and follow-up inline replies; votes cannot be changed once cast)
  const handleVoteSubmit = (submission: VoteSubmission) => {
    const targetIssue = issues.find(i => i.id === submission.issueId);
    recordUserInterestFromIssue(targetIssue);
    const existingVote = userVotes[submission.issueId];
    const hasExistingVote = Boolean(existingVote);
    const hasContent = Boolean(submission.note || submission.voiceNote);

    // If user has already voted, switching vote/stance is strictly forbidden!
    if (hasExistingVote) {
      if (existingVote.choice !== submission.choice) {
        addToast(
          'warning',
          'Vote is permanent',
          `You already voted ${existingVote.choice} on this issue. Votes cannot be changed once cast.`
        );
        return;
      }
      if (!hasContent) {
        addToast(
          'info',
          'Already voted',
          `You already voted ${existingVote.choice} on this issue.`
        );
        return;
      }
    }

    setIssues(prevIssues => {
      const nextIssues = prevIssues.map(issue => {
        if (issue.id === submission.issueId) {
          const isYes = submission.choice === 'YES';
          const nextYes = !hasExistingVote ? (isYes ? issue.yesCount + 1 : issue.yesCount) : issue.yesCount;
          const nextNo = !hasExistingVote ? (!isYes ? issue.noCount + 1 : issue.noCount) : issue.noCount;

          return {
            ...issue,
            yesCount: nextYes,
            noCount: nextNo,
            responses: hasContent ? [submission, ...issue.responses] : issue.responses
          };
        }
        return issue;
      });
      saveIssues(nextIssues);
      return nextIssues;
    });

    const savedResponseId = hasContent ? submission.id : existingVote?.responseId;
    recordUserVote(submission.issueId, submission.choice, savedResponseId);
    setUserVotes(prev => {
      const nextVotes = {
        ...prev,
        [submission.issueId]: { choice: submission.choice, responseId: savedResponseId }
      };
      if (currentUser) {
        const updatedUser: UserProfile = { ...currentUser, votedIssues: nextVotes };
        setCurrentUser(updatedUser);
        saveStoredUser(updatedUser);
      }
      return nextVotes;
    });
    apiRecordVote(submission);

    // Record telemetry for vote / reply / voice note
    if (!hasExistingVote) {
      recordEngagementAction(submission.choice === 'YES' ? 'vote_yes' : 'vote_no', targetIssue?.title);
    }
    if (submission.note) {
      recordEngagementAction('inline_reply', targetIssue?.title);
    }
    if (submission.voiceNote) {
      recordEngagementAction('voice_note', targetIssue?.title);
    }

    // Update activeDetailIssue if open
    if (activeDetailIssue && activeDetailIssue.id === submission.issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        const isYes = submission.choice === 'YES';
        const nextYes = !hasExistingVote ? (isYes ? prev.yesCount + 1 : prev.yesCount) : prev.yesCount;
        const nextNo = !hasExistingVote ? (!isYes ? prev.noCount + 1 : prev.noCount) : prev.noCount;

        return {
          ...prev,
          yesCount: nextYes,
          noCount: nextNo,
          responses: hasContent ? [submission, ...prev.responses] : prev.responses
        };
      });
    }

    // Show toast for new votes or added perspectives
    if (!hasExistingVote) {
      addToast(
        'success',
        `Your ${submission.choice} vote was recorded`,
        submission.voiceNote 
          ? 'Voice note attached.'
          : submission.note
          ? 'Perspective posted to the thread.'
          : 'Tap Reply below the card if you want to add a quick note or voice clip.'
      );
    } else if (hasContent) {
      addToast(
        'success',
        'Perspective posted',
        submission.voiceNote
          ? 'Voice note attached to your perspective.'
          : 'Your perspective has been posted to the thread.'
      );
    }
  };

  // Handle creator deleting an issue topic & description: opens sleek confirmation modal instead of browser alert
  const handleDeleteIssueByAuthor = (issueId: string) => {
    setDeletingIssueId(issueId);
  };

  const handleConfirmDeleteIssue = () => {
    if (!deletingIssueId) return;
    const issueId = deletingIssueId;

    // Permanently record deleted ID so it never returns in feed or cloud sync
    recordDeletedIssueId(issueId);

    const nextIssues = issues.filter(issue => issue.id !== issueId);
    setIssues(nextIssues);
    saveIssues(nextIssues);

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(null);
      setCurrentView('app');
      window.location.hash = '';
    }

    apiRecordDeleteIssue(issueId);
    setDeletingIssueId(null);

    addToast(
      'info',
      'Issue Deleted',
      'The issue has been completely removed from the feed.'
    );
    recordEngagementAction('issue_deleted');
  };

  // Handle new issue creation
  const handleCreateIssue = (newIssue: Issue) => {
    setIssues(prev => [newIssue, ...prev]);
    recordEngagementAction('issue_created', newIssue.title);
    notifyAdminIssueCreated(newIssue, currentUser);
    addToast(
      'success', 
      'Issue Published', 
      newIssue.visibility === 'private'
        ? `Restricted to invited circle members.`
        : `Open for voting (${newIssue.durationLabel}).`
    );
  };

  const handleEditIssue = (issue: Issue) => {
    setEditingIssue(issue);
    setIsCreateModalOpen(true);
  };

  const handleUpdateIssue = (updatedIssue: Issue) => {
    setIssues(prev => {
      const nextIssues = prev.map(i => i.id === updatedIssue.id ? updatedIssue : i);
      saveIssues(nextIssues);
      return nextIssues;
    });
    if (activeDetailIssue && activeDetailIssue.id === updatedIssue.id) {
      setActiveDetailIssue(updatedIssue);
    }
    setEditingIssue(null);
    addToast('success', 'Issue Updated', 'Your changes have been saved.');
  };

  // Handle add email invite to private issue
  const handleAddInvite = (issueId: string, email: string) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId && !issue.invitedEmails.includes(email)) {
        return { ...issue, invitedEmails: [...issue.invitedEmails, email] };
      }
      return issue;
    }));

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => prev ? { ...prev, invitedEmails: [...prev.invitedEmails, email] } : null);
    }
    addToast('success', 'Invite Added', `${email} can now vote on this issue.`);
  };

  // Handle add group invite to private issue
  const handleAddGroupInvite = (issueId: string, group: string) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId && !issue.invitedGroups.includes(group)) {
        return { ...issue, invitedGroups: [...issue.invitedGroups, group] };
      }
      return issue;
    }));

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => prev ? { ...prev, invitedGroups: [...prev.invitedGroups, group] } : null);
    }
    addToast('success', 'Group Added', `Members of "${group}" can now participate.`);
  };

  // Handle like on response
  const handleLikeResponse = (responseId: string) => {
    setIssues(prev => {
      const nextIssues = prev.map(issue => ({
        ...issue,
        responses: issue.responses.map(resp => {
          if (resp.id === responseId) {
            return { ...resp, likesCount: (resp.likesCount || 0) + 1 };
          }
          return resp;
        })
      }));
      saveIssues(nextIssues);
      return nextIssues;
    });

    if (activeDetailIssue) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responses: prev.responses.map(resp => {
            if (resp.id === responseId) {
              return { ...resp, likesCount: (resp.likesCount || 0) + 1 };
            }
            return resp;
          })
        };
      });
    }
  };

  // Handle adding a direct threaded reply to a comment
  const handleAddCommentReply = (issueId: string, submissionId: string, reply: CommentReply) => {
    const targetIssue = issues.find(i => i.id === issueId);

    setIssues(prev => {
      const nextIssues = prev.map(issue => {
        if (issue.id !== issueId) return issue;
        const updatedResponses = issue.responses.map(resp => {
          if (resp.id !== submissionId) return resp;
          return {
            ...resp,
            replies: [...(resp.replies || []), reply]
          };
        });
        return { ...issue, responses: updatedResponses };
      });
      saveIssues(nextIssues);
      return nextIssues;
    });

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responses: prev.responses.map(resp => {
            if (resp.id !== submissionId) return resp;
            return {
              ...resp,
              replies: [...(resp.replies || []), reply]
            };
          })
        };
      });
    }

    addToast('success', 'Reply Posted', 'Your direct reply was posted.');
    recordEngagementAction('inline_reply', targetIssue?.title || 'Issue comment reply');
    apiRecordReply(issueId, submissionId, reply);

  };

  // Handle like on a comment reply
  const handleLikeCommentReply = (issueId: string, submissionId: string, replyId: string) => {
    setIssues(prev => {
      const nextIssues = prev.map(issue => {
        if (issue.id !== issueId) return issue;
        return {
          ...issue,
          responses: issue.responses.map(resp => {
            if (resp.id !== submissionId) return resp;
            return {
              ...resp,
              replies: (resp.replies || []).map(rep => {
                if (rep.id !== replyId) return rep;
                return { ...rep, likesCount: (rep.likesCount || 0) + 1 };
              })
            };
          })
        };
      });
      saveIssues(nextIssues);
      return nextIssues;
    });

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responses: prev.responses.map(resp => {
            if (resp.id !== submissionId) return resp;
            return {
              ...resp,
              replies: (resp.replies || []).map(rep => {
                if (rep.id !== replyId) return rep;
                return { ...rep, likesCount: (rep.likesCount || 0) + 1 };
              })
            };
          })
        };
      });
    }
  };

  // Handle reaction on a top-level comment
  const handleToggleCommentReaction = (issueId: string, submissionId: string, emoji: string) => {
    if (!currentUser) {
      setAuthPromptMessage('Please sign in to react to comments.');
      handleNavigate('auth');
      return;
    }

    const userKey = currentUser.email || currentUser.id;

    setIssues(prev => {
      const nextIssues = prev.map(issue => {
        if (issue.id !== issueId) return issue;
        return {
          ...issue,
          responses: issue.responses.map(resp => {
            if (resp.id !== submissionId) return resp;

            const existingUsers = resp.userReactions?.[emoji] || [];
            const hasReacted = existingUsers.includes(userKey);
            const nextUsers = hasReacted
              ? existingUsers.filter(u => u !== userKey)
              : [...existingUsers, userKey];

            const nextReactions = { ...(resp.reactions || {}) };
            if (nextUsers.length > 0) {
              nextReactions[emoji] = nextUsers.length;
            } else {
              delete nextReactions[emoji];
            }

            const nextUserReactions = {
              ...(resp.userReactions || {}),
              [emoji]: nextUsers,
            };

            const nextLikesCount = emoji === '❤️'
              ? nextUsers.length
              : (resp.likesCount || 0);

            return {
              ...resp,
              reactions: nextReactions,
              userReactions: nextUserReactions,
              likesCount: nextLikesCount,
            };
          }),
        };
      });
      saveIssues(nextIssues);
      return nextIssues;
    });

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responses: prev.responses.map(resp => {
            if (resp.id !== submissionId) return resp;

            const existingUsers = resp.userReactions?.[emoji] || [];
            const hasReacted = existingUsers.includes(userKey);
            const nextUsers = hasReacted
              ? existingUsers.filter(u => u !== userKey)
              : [...existingUsers, userKey];

            const nextReactions = { ...(resp.reactions || {}) };
            if (nextUsers.length > 0) {
              nextReactions[emoji] = nextUsers.length;
            } else {
              delete nextReactions[emoji];
            }

            const nextUserReactions = {
              ...(resp.userReactions || {}),
              [emoji]: nextUsers,
            };

            const nextLikesCount = emoji === '❤️'
              ? nextUsers.length
              : (resp.likesCount || 0);

            return {
              ...resp,
              reactions: nextReactions,
              userReactions: nextUserReactions,
              likesCount: nextLikesCount,
            };
          }),
        };
      });
    }

    recordEngagementAction('inline_reply', `Reaction ${emoji} on comment`);
    apiRecordReaction('comment', submissionId, userKey, emoji);
  };

  // Handle reaction on a nested direct reply
  const handleToggleReplyReaction = (issueId: string, submissionId: string, replyId: string, emoji: string) => {
    if (!currentUser) {
      setAuthPromptMessage('Please sign in to react to replies.');
      handleNavigate('auth');
      return;
    }

    const userKey = currentUser.email || currentUser.id;

    setIssues(prev => {
      const nextIssues = prev.map(issue => {
        if (issue.id !== issueId) return issue;
        return {
          ...issue,
          responses: issue.responses.map(resp => {
            if (resp.id !== submissionId) return resp;
            return {
              ...resp,
              replies: (resp.replies || []).map(rep => {
                if (rep.id !== replyId) return rep;

                const existingUsers = rep.userReactions?.[emoji] || [];
                const hasReacted = existingUsers.includes(userKey);
                const nextUsers = hasReacted
                  ? existingUsers.filter(u => u !== userKey)
                  : [...existingUsers, userKey];

                const nextReactions = { ...(rep.reactions || {}) };
                if (nextUsers.length > 0) {
                  nextReactions[emoji] = nextUsers.length;
                } else {
                  delete nextReactions[emoji];
                }

                const nextUserReactions = {
                  ...(rep.userReactions || {}),
                  [emoji]: nextUsers,
                };

                const nextLikesCount = emoji === '❤️'
                  ? nextUsers.length
                  : (rep.likesCount || 0);

                return {
                  ...rep,
                  reactions: nextReactions,
                  userReactions: nextUserReactions,
                  likesCount: nextLikesCount,
                };
              }),
            };
          }),
        };
      });
      saveIssues(nextIssues);
      return nextIssues;
    });

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responses: prev.responses.map(resp => {
            if (resp.id !== submissionId) return resp;
            return {
              ...resp,
              replies: (resp.replies || []).map(rep => {
                if (rep.id !== replyId) return rep;

                const existingUsers = rep.userReactions?.[emoji] || [];
                const hasReacted = existingUsers.includes(userKey);
                const nextUsers = hasReacted
                  ? existingUsers.filter(u => u !== userKey)
                  : [...existingUsers, userKey];

                const nextReactions = { ...(rep.reactions || {}) };
                if (nextUsers.length > 0) {
                  nextReactions[emoji] = nextUsers.length;
                } else {
                  delete nextReactions[emoji];
                }

                const nextUserReactions = {
                  ...(rep.userReactions || {}),
                  [emoji]: nextUsers,
                };

                const nextLikesCount = emoji === '❤️'
                  ? nextUsers.length
                  : (rep.likesCount || 0);

                return {
                  ...rep,
                  reactions: nextReactions,
                  userReactions: nextUserReactions,
                  likesCount: nextLikesCount,
                };
              }),
            };
          }),
        };
      });
    }

    recordEngagementAction('inline_reply', `Reaction ${emoji} on reply`);
    apiRecordReaction('reply', replyId, userKey, emoji);
  };

  // Handle sharing a comment quote
  const handleShareComment = (issue: Issue, author: string, _text: string, _commentId: string) => {
    addToast('success', 'Link Copied', `Quote by ${author} copied to clipboard.`);
    recordEngagementAction('share', `Comment quote by ${author} on "${issue.title}"`);
    notifyAdminIssueShared(issue, `Comment Quote (${author})`, currentUser);
  };

  // Toggle Like / Heart on an issue
  const handleToggleLikeIssue = (issueId: string) => {
    const currentlyLiked = Boolean(userLikes[issueId]);
    if (!currentlyLiked) {
      const targetIssue = issues.find(i => i.id === issueId);
      recordUserInterestFromIssue(targetIssue);
      recordEngagementAction('like', targetIssue?.title);
    }
    const nextLikes = { ...userLikes };
    if (currentlyLiked) {
      delete nextLikes[issueId];
    } else {
      nextLikes[issueId] = true;
    }
    setUserLikes(nextLikes);
    saveUserLikesMap(nextLikes);
    if (currentUser) {
      const likedArr = Object.keys(nextLikes).filter(k => nextLikes[k]);
      const updatedUser: UserProfile = { ...currentUser, likedIssueIds: likedArr };
      setCurrentUser(updatedUser);
      saveStoredUser(updatedUser);
    }

    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        const currentCount = issue.likesCount || 0;
        return {
          ...issue,
          likesCount: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
      }
      return issue;
    }));

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        const currentCount = prev.likesCount || 0;
        return {
          ...prev,
          likesCount: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
      });
    }
  };

  // Toggle Favourite / Bookmark on an issue
  const handleToggleFavoriteIssue = (issueId: string) => {
    const currentlyFav = Boolean(userFavorites[issueId]);
    if (!currentlyFav) {
      const targetIssue = issues.find(i => i.id === issueId);
      recordUserInterestFromIssue(targetIssue);
      recordEngagementAction('favorite', targetIssue?.title);
    }
    const nextFavs = { ...userFavorites };
    if (currentlyFav) {
      delete nextFavs[issueId];
    } else {
      nextFavs[issueId] = true;
    }
    setUserFavorites(nextFavs);
    saveUserFavoritesMap(nextFavs);
    if (currentUser) {
      const favArr = Object.keys(nextFavs).filter(k => nextFavs[k]);
      const updatedUser: UserProfile = { ...currentUser, favoriteIssueIds: favArr };
      setCurrentUser(updatedUser);
      saveStoredUser(updatedUser);
    }

    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        const currentCount = issue.favoritesCount || 0;
        return {
          ...issue,
          favoritesCount: currentlyFav ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
      }
      return issue;
    }));

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        const currentCount = prev.favoritesCount || 0;
        return {
          ...prev,
          favoritesCount: currentlyFav ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
      });
    }

    addToast(
      'info',
      currentlyFav ? 'Removed from Favourites' : 'Saved to Favourites',
      currentlyFav ? undefined : 'You can filter by your saved Favourites anytime.'
    );
  };

  // Handle report on response
  const handleReportResponse = (_responseId: string) => {
    addToast('info', 'Report Received', 'Flagged for community guidelines review.');
  };

  // Reset demo data
  const handleResetData = () => {
    if (window.confirm('Reset all issues and votes back to default sample data?')) {
      const reset = resetToDefaults();
      setIssues(reset);
      setUserVotes({});
      setUserLikes({});
      setUserFavorites({});
      setActiveDetailIssue(null);
      setActiveVoteIssue(null);
      addToast('info', 'Sample Issues Restored');
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: issues.length };
    issues.forEach(issue => {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    });
    return counts;
  }, [issues]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalVotes = 0;
    let totalVoiceNotes = 0;

    issues.forEach(i => {
      totalVotes += i.yesCount + i.noCount;
      totalVoiceNotes += i.responses.filter(r => !!r.voiceNote).length;
    });

    return { totalVotes, totalVoiceNotes, totalIssues: issues.length };
  }, [issues]);

  // Filtered & Sorted Issues: Default ('for-you') blends Trending momentum + Newest issues,
  // prioritized by user interests & region (without hiding posts if user hasn't selected any)
  const filteredIssues = useMemo(() => {
    const userRegion = currentUser?.region;
    const userInterests = currentUser?.interests || [];
    const followedCreatorIds = currentUser?.followingCreators || [];

    // Helper: compute ranking score for the default feed ('for-you'):
    // Blends Trending momentum + Newest freshness, boosted by user interests & region.
    // If user has not selected/saved interests or region, all posts rank purely by trending + freshness.
    const computeFeedScore = (issue: Issue): number => {
      const now = Date.now();
      const issueCreatedTime = new Date(issue.createdAt || '').getTime() || (now - 86400000 * 3);
      const ageHours = Math.max(0, (now - issueCreatedTime) / (1000 * 60 * 60));

      // 1. Trending Momentum:
      // High weight on votes (5 pts), perspectives (10 pts), voice clips (14 pts), and likes (3 pts)
      const totalVotes = issue.yesCount + issue.noCount;
      const responsesCount = issue.responses?.length || 0;
      const voiceNotesCount = issue.responses?.filter(r => !!r.voiceNote).length || 0;
      const likesCount = issue.likesCount || 0;

      // Close split debate bonus (balanced YES/NO ratios generate intense viral engagement)
      let debateBonus = 0;
      if (totalVotes >= 3) {
        const splitRatio = Math.min(issue.yesCount, issue.noCount) / Math.max(issue.yesCount, issue.noCount);
        debateBonus = splitRatio * 30; // up to +30 points for contentious 50-50 splits
      }

      // Smooth decay on engagement momentum so hot active debates outrank dormant ancient polls
      const engagementRaw = (totalVotes * 5) + (responsesCount * 10) + (voiceNotesCount * 14) + (likesCount * 3) + debateBonus;
      const engagementDecay = Math.max(0.18, Math.exp(-ageHours / 72));
      const trendingScore = engagementRaw * engagementDecay;

      // 2. Newest / Freshness Factor:
      // Gives strong visibility to newly published issues alongside top trending ones
      // An issue under 6h gets up to +140 bonus, under 24h gets +45 bonus
      const freshnessScore = Math.max(0, 140 * Math.exp(-ageHours / 18));

      // 3. Featured Editorial Bonus:
      const featuredScore = issue.featured ? 35 : 0;

      // 4. Personalized Interests Boost (only applied if user selected/saved any):
      let interestScore = 0;
      if (userInterests.length > 0) {
        if (userInterests.includes(issue.category) || issue.category === 'Private & Internal') {
          interestScore = 140;
        }
      }

      // 5. Personalized Region Boost (only applied if user selected/saved any):
      let regionScore = 0;
      if (userRegion && userRegion !== 'Global / Remote') {
        const issueReg = inferIssueRegion(issue);
        if (issueReg === userRegion) {
          regionScore = 140;
        } else if (issueReg === 'Global / Remote') {
          regionScore = 45;
        }
      } else if (userRegion === 'Global / Remote') {
        const issueReg = inferIssueRegion(issue);
        if (issueReg === 'Global / Remote') {
          regionScore = 55;
        }
      }

      // 6. Followed Creators Boost:
      let followedScore = 0;
      if (followedCreatorIds.length > 0) {
        const authorLower = issue.author.toLowerCase();
        const matchesFollowed = followedCreatorIds.some(followed => {
          const fLower = followed.toLowerCase();
          if (authorLower.includes(fLower) || fLower.includes(authorLower)) return true;
          const creator = TOP_CREATORS_AND_VOTERS.find(c => c.id === followed || c.name.toLowerCase() === fLower);
          return Boolean(
            creator && (
              authorLower.includes(creator.name.toLowerCase()) ||
              creator.name.toLowerCase().includes(authorLower)
            )
          );
        });
        if (matchesFollowed) {
          followedScore = 80;
        }
      }

      return trendingScore + freshnessScore + featuredScore + interestScore + regionScore + followedScore;
    };

    let result = issues.filter(issue => {
      if (issue.isDeletedByAuthor) return false;
      const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.tags.some(t => t.toLowerCase().includes(query));

      if (!matchesCategory || !matchesSearch) return false;
      if (showFavoritesOnly && !userFavorites[issue.id]) return false;

      // Region Scope filter: When 'my-region-worldwide' is explicitly active and user selected a specific region,
      // show issues from that region AND Worldwide ('Global / Remote')
      if (
        regionScope === 'my-region-worldwide' &&
        userRegion &&
        userRegion !== 'Global / Remote'
      ) {
        const issueReg = inferIssueRegion(issue);
        if (issueReg !== userRegion && issueReg !== 'Global / Remote') {
          return false;
        }
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      const totalA = a.yesCount + a.noCount;
      const totalB = b.yesCount + b.noCount;

      if (sortBy === 'for-you') {
        const scoreDiff = computeFeedScore(b) - computeFeedScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
      if (sortBy === 'active') return totalB - totalA;
      if (sortBy === 'perspectives') return b.responses.length - a.responses.length;
      if (sortBy === 'yes') {
        const pctA = totalA > 0 ? a.yesCount / totalA : 0;
        const pctB = totalB > 0 ? b.yesCount / totalB : 0;
        return pctB - pctA;
      }
      if (sortBy === 'closing') {
        return new Date(a.closingDate || '').getTime() - new Date(b.closingDate || '').getTime();
      }
      return 0;
    });

    return result;
  }, [issues, selectedCategory, searchQuery, sortBy, currentUser, regionScope, interestScope, showFavoritesOnly, userFavorites]);

  // Reset visible batch size when filters/search change
  useEffect(() => {
    setVisibleCount(6);
  }, [selectedCategory, searchQuery, sortBy, regionScope, interestScope, showFavoritesOnly]);

  // Pre-Bottom Infinite Scroll Auto-Loader (IntersectionObserver with 600px lookahead + passive scroll listener)
  useEffect(() => {
    if (visibleCount >= filteredIssues.length) return;

    const loadMore = () => {
      setVisibleCount((prev) => Math.min(prev + 6, filteredIssues.length));
    };

    const sentinel = feedSentinelRef.current;
    let observer: IntersectionObserver | null = null;
    if (sentinel) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadMore();
          }
        },
        { rootMargin: '600px 0px' }
      );
      observer.observe(sentinel);
    }

    const onWindowScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom <= 600) {
        loadMore();
      }
    };

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', onWindowScroll);
    };
  }, [filteredIssues.length, visibleCount]);

  const visibleIssues = useMemo(
    () => filteredIssues.slice(0, visibleCount),
    [filteredIssues, visibleCount]
  );

  // Landing view
  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onNavigate={handleNavigate}
          onOpenGuidelines={() => setIsGuidelinesOpen(true)}
          onOpenLegal={(tab) => setLegalModalTab(tab)}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          currentUser={currentUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          colorTone={colorTone}
          onToggleColorTone={handleToggleColorTone}
        />
        <CommunityGuidelinesModal
          isOpen={isGuidelinesOpen}
          onClose={() => setIsGuidelinesOpen(false)}
        />
        <LegalModal
          isOpen={legalModalTab !== null}
          initialTab={legalModalTab || 'terms'}
          onClose={() => setLegalModalTab(null)}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <PWAInstallPrompt />
      </>
    );
  }

  // Contact view (available to both authenticated and guest visitors)
  if (currentView === 'contact') {
    return (
      <>
        <ContactPage
          onNavigate={handleNavigate}
          currentUser={currentUser}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          colorTone={colorTone}
          onToggleColorTone={handleToggleColorTone}
          onOpenGuidelines={() => setIsGuidelinesOpen(true)}
          onOpenLegal={(tab) => setLegalModalTab(tab)}
        />
        <CommunityGuidelinesModal
          isOpen={isGuidelinesOpen}
          onClose={() => setIsGuidelinesOpen(false)}
        />
        <LegalModal
          isOpen={legalModalTab !== null}
          initialTab={legalModalTab || 'terms'}
          onClose={() => setLegalModalTab(null)}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <PWAInstallPrompt />
      </>
    );
  }

  // Enforce Auth Protection: If user is not logged in, always render AuthPage
  if (currentView === 'auth' || !currentUser) {
    return (
      <>
        <AuthPage
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          onNavigate={handleNavigate}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          colorTone={colorTone}
          onToggleColorTone={handleToggleColorTone}
          authPromptMessage={authPromptMessage || (!currentUser ? 'Sign in required to view, create, and vote on issues.' : null)}
          onOpenLegal={(tab) => setLegalModalTab(tab)}
          onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        />
        <CommunityGuidelinesModal
          isOpen={isGuidelinesOpen}
          onClose={() => setIsGuidelinesOpen(false)}
        />
        <LegalModal
          isOpen={legalModalTab !== null}
          initialTab={legalModalTab || 'terms'}
          onClose={() => setLegalModalTab(null)}
        />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <PWAInstallPrompt />
      </>
    );
  }

  // Main Authenticated Issue Workspace
  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-ink-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors"
      style={{
        paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Navigation */}
      <Navbar
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          recordEngagementAction('category_select', cat);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
        onOpenProfile={handleOpenProfile}
        onResetData={handleResetData}
        categoryCounts={categoryCounts}
        currentView={currentView}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        showSearchMobile={showSearchMobile}
        colorTone={colorTone}
        onToggleColorTone={handleToggleColorTone}
      />

      {/* X / Instagram Style Floating New Updates Pill */}
      {pendingNewIssues.length > 0 && currentView === 'app' && (
        <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 animate-slide-up pointer-events-auto">
          <button
            type="button"
            onClick={handleRefreshToTop}
            className="group flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-xl shadow-brand-600/35 border border-white/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
            title="Click to view new updates and scroll to top"
          >
            <ArrowUp className="w-4 h-4 text-white group-hover:-translate-y-0.5 transition-transform shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold tracking-tight">
              {pendingNewIssues.length === 1 ? '1 new question' : `${pendingNewIssues.length} new questions`}
            </span>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8 w-full flex-1 space-y-5">
        {currentView === 'profile' && activeProfileUser ? (
          <UserProfilePage
            profile={activeProfileUser}
            currentUser={currentUser}
            issues={issues}
            onBack={() => {
              setActiveProfileUser(null);
              handleNavigate('app');
            }}
            onOpenIssue={(iss) => {
              recordUserInterestFromIssue(iss);
              setActiveDetailIssue(iss);
              setCurrentView('issue');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              window.location.hash = `issue/${iss.id}`;
            }}
            onQuickVote={handleOpenQuickVote}
            onInlineSubmitVote={handleVoteSubmit}
            onToggleFollow={handleToggleFollowProfile}
            onOpenSettings={() => setIsProfileSettingsOpen(true)}
            onOpenProfile={handleOpenProfile}
            userVotes={userVotes}
            userLikes={userLikes}
            userFavorites={userFavorites}
            onToggleLikeIssue={handleToggleLikeIssue}
            onToggleFavoriteIssue={handleToggleFavoriteIssue}
            onShareIssue={(iss) => setActiveShareIssue(iss)}
            onDeleteIssue={handleDeleteIssueByAuthor}
            onEditIssue={handleEditIssue}
          />
        ) : currentView === 'issue' && liveDetailIssue ? (
          <IssueDetailPage
            issue={liveDetailIssue}
            currentUser={currentUser}
            onClose={() => {
              setActiveDetailIssue(null);
              handleNavigate('app');
            }}
            onOpenVoteModal={(choice) => {
              if (liveDetailIssue) {
                handleOpenQuickVote(liveDetailIssue, choice);
              }
            }}
            onInlineSubmitVote={handleVoteSubmit}
            onDeleteIssue={handleDeleteIssueByAuthor}
            onEditIssue={handleEditIssue}
            onToggleLikeIssue={handleToggleLikeIssue}
            onToggleFavoriteIssue={handleToggleFavoriteIssue}
            onShareIssue={(iss) => setActiveShareIssue(iss)}
            hasUserVoted={liveDetailIssue ? !!userVotes[liveDetailIssue.id] : false}
            userVoteChoice={liveDetailIssue ? userVotes[liveDetailIssue.id]?.choice : undefined}
            isLiked={liveDetailIssue ? !!userLikes[liveDetailIssue.id] : false}
            isFavorited={liveDetailIssue ? !!userFavorites[liveDetailIssue.id] : false}
            onAddCommentReply={handleAddCommentReply}
            onToggleCommentReaction={handleToggleCommentReaction}
            onLikeResponse={handleLikeResponse}
            onReportResponse={handleReportResponse}
            onLikeCommentReply={handleLikeCommentReply}
            onToggleReplyReaction={handleToggleReplyReaction}
            onShareComment={handleShareComment}
            onAddInvite={handleAddInvite}
            onAddGroupInvite={handleAddGroupInvite}
            onOpenProfile={handleOpenProfile}
          />
        ) : currentView === 'analytics' && isAdminUser(currentUser) ? (
          <AdminAnalyticsPage
            issues={issues}
            currentUser={currentUser}
            colorTone={colorTone}
            theme={theme}
            onNavigate={handleNavigate}
            onOpenIssue={(iss) => {
              recordUserInterestFromIssue(iss);
              setActiveDetailIssue(iss);
              setCurrentView('issue');
              window.location.hash = `issue/${iss.id}`;
            }}
          />
        ) : currentView === 'discovery' ? (
          <DiscoveryHub
            issues={issues}
            onOpenDetails={(iss) => {
              recordUserInterestFromIssue(iss);
              setActiveDetailIssue(iss);
              setCurrentView('issue');
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              window.location.hash = `issue/${iss.id}`;
            }}
            onQuickVote={handleOpenQuickVote}
            onFilterByCategory={(cat) => {
              setSelectedCategory(cat);
              handleNavigate('app');
            }}
            fullPage
            userVotes={userVotes}
          />
        ) : (
          <>
            {/* Sleek, Compact Command Banner */}
            <section className="relative overflow-hidden rounded-3xl bg-aurora-dark p-4 sm:p-6 text-white shadow-soft">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
              <div className="absolute inset-0 bg-grid-dark opacity-30 pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold whitespace-nowrap max-w-full">
                    <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="sm:hidden">Make your voice heard in under 1 min</span>
                    <span className="hidden sm:inline">It takes less than 1 min to make your voice heard and make an impact</span>
                  </div>
                  <h1 className="text-[12.5px] xs:text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis">
                    Vote Yes or No on Issues That <span className="font-serif italic font-normal text-brand-300">Matter to You.</span>
                  </h1>
                </div>

                {/* Compact Telemetry Strip + Action — single-line horizontal fit on mobile */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-4 bg-white/[0.08] rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-md text-[11px] sm:text-xs whitespace-nowrap">
                    <div>
                      <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">{stats.totalVotes}</span>
                      <span className="text-zinc-400 ml-1">votes</span>
                    </div>
                    <span className="text-white/15">|</span>
                    <div>
                      <span className="font-mono font-bold text-brand-300 text-xs sm:text-sm">{stats.totalVoiceNotes}</span>
                      <span className="text-zinc-400 ml-1">audio</span>
                    </div>
                    <span className="text-white/15">|</span>
                    <div>
                      <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">{stats.totalIssues}</span>
                      <span className="text-zinc-400 ml-1">issues</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-brand text-xs py-2 sm:py-2.5 px-3.5 sm:px-4 shadow-glow cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>New Issue</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Section Header */}
            <div className="flex items-center justify-between pt-1 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedCategory === 'All' ? 'Issues' : selectedCategory}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    showFavoritesOnly
                      ? 'bg-amber-500 text-ink-950 shadow-2xs'
                      : 'bg-white dark:bg-ink-900 text-slate-600 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-amber-500/15 shadow-2xs'
                  }`}
                >
                  <Bookmark className={`w-3 h-3 shrink-0 ${showFavoritesOnly ? 'fill-current' : 'text-amber-500'}`} />
                  <span>Favourites</span>
                </button>

                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                  >
                    Clear &quot;{searchQuery}&quot;
                  </button>
                )}
              </div>
            </div>

            {/* Issues Grid */}
            {isInitialLoadingIssues && issues.length === 0 ? (
              <div className="card p-10 sm:p-12 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-500 dark:text-zinc-400">Loading community issues from database...</p>
              </div>
            ) : issues.length === 0 ? (
              <div className="card p-10 sm:p-12 text-center space-y-3 border-dashed">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto border border-brand-100 dark:border-brand-400/30">
                  <Vote className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No active issues published yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  Launch the first time-bound YES/NO issue for your workplace, family, community, or private circle.
                </p>
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-brand text-xs py-2.5 px-5 shadow-glow cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Issue</span>
                  </button>
                </div>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="card p-10 text-center space-y-3 border-dashed">
                <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto border border-brand-100 dark:border-brand-400/30">
                  <Filter className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No matching issues found</h3>
                <div className="pt-1 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => handleNavigate('discovery')}
                    className="btn-ghost text-xs"
                  >
                    Explore Discovery
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-brand text-xs"
                  >
                    Create Issue
                  </button>
                </div>
              </div>
            ) : (
              <>
                {currentUser && (!currentUser.interests || currentUser.interests.length === 0) && selectedCategory === 'All' && !searchQuery.trim() && !showFavoritesOnly && (
                  <div className="mb-3 p-3 rounded-2xl bg-brand-50/70 dark:bg-brand-500/10 border border-brand-200/60 dark:border-brand-500/20 flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                      <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                      <span>Showing all trending &amp; new issues. Personalize your feed anytime by picking interests.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsProfileSettingsOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shrink-0 cursor-pointer text-[11px]"
                    >
                      Pick Interests
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:gap-5 max-w-2xl mx-auto w-full">
                  {visibleIssues.map((issue) => {
                    const voteRecord = userVotes[issue.id];
                    return (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        currentUser={currentUser}
                        onOpenDetails={(iss) => {
                          recordUserInterestFromIssue(iss);
                          setActiveDetailIssue(iss);
                          setCurrentView('issue');
                          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                          window.location.hash = `issue/${iss.id}`;
                        }}
                        onQuickVote={handleOpenQuickVote}
                        onInlineSubmitVote={handleVoteSubmit}
                        onDeleteIssue={handleDeleteIssueByAuthor}
                        onEditIssue={handleEditIssue}
                        onToggleLikeIssue={handleToggleLikeIssue}
                        onToggleFavoriteIssue={handleToggleFavoriteIssue}
                        onShareIssue={(iss) => setActiveShareIssue(iss)}
                        hasUserVoted={!!voteRecord}
                        userVoteChoice={voteRecord?.choice}
                        isLiked={!!userLikes[issue.id]}
                        isFavorited={!!userFavorites[issue.id]}
                        onOpenProfile={handleOpenProfile}
                      />
                    );
                  })}
                </div>

                {/* Infinite Scroll Auto-Load Sentinel */}
                {visibleCount < filteredIssues.length ? (
                  <div ref={feedSentinelRef} className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                    <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    <span>Loading more issues...</span>
                  </div>
                ) : filteredIssues.length > 6 ? (
                  <div className="py-4 text-center text-xs text-slate-400 dark:text-zinc-500">
                    You&apos;ve reached the end of the feed
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
        {/* Spacer for bottom navigation spacing */}
        <div 
          className="sm:h-8" 
          style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} 
        />
      </main>

      {/* Mobile Sticky Bottom Bar */}
      <div 
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-ink-950/95 backdrop-blur-xl pt-2.5 px-4 z-40 flex items-center justify-around text-[11px] font-semibold text-slate-400 shadow-lift border-t border-white/5 mobile-bottom-nav"
        style={{
          paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button
          onClick={() => handleNavigate('app')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            currentView === 'app' && !showSearchMobile ? 'text-brand-400 font-bold' : 'hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => handleNavigate('discovery')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            currentView === 'discovery' ? 'text-amber-400 font-bold' : 'hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Discovery</span>
        </button>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex flex-col items-center gap-1 text-brand-300 font-bold"
        >
          <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center -mt-5 shadow-glow border-2 border-ink-950">
            +
          </div>
          <span>New</span>
        </button>

        <button
          onClick={() => setIsProfileSettingsOpen(true)}
          className="flex flex-col items-center gap-1 hover:text-white transition-colors"
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => {
            if (currentView !== 'app') {
              handleNavigate('app');
              setShowSearchMobile(true);
            } else {
              setShowSearchMobile(prev => !prev);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            showSearchMobile ? 'text-brand-400 font-bold' : 'hover:text-white'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>
      </div>

      {/* Modals */}
      <VoteModal
        issue={activeVoteIssue}
        initialChoice={initialVoteChoice}
        existingVoteChoice={activeVoteIssue ? userVotes[activeVoteIssue.id]?.choice : undefined}
        isOpen={!!activeVoteIssue}
        onClose={() => {
          setActiveVoteIssue(null);
          setInitialVoteChoice(null);
        }}
        onSubmitVote={handleVoteSubmit}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        currentUser={currentUser}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingIssueId)}
        issueTitle={issues.find(i => i.id === deletingIssueId)?.title}
        onClose={() => setDeletingIssueId(null)}
        onConfirm={handleConfirmDeleteIssue}
      />

      <ShareIssueModal
        issue={activeShareIssue}
        isOpen={!!activeShareIssue}
        onClose={() => setActiveShareIssue(null)}
        colorTone={colorTone}
        currentUser={currentUser}
      />

      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingIssue(null);
        }}
        onCreateIssue={handleCreateIssue}
        onUpdateIssue={handleUpdateIssue}
        editingIssue={editingIssue}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        currentUser={currentUser}
        onSaveDraft={handleSaveIssueDraft}
      />

      <CommunityGuidelinesModal
        isOpen={isGuidelinesOpen}
        onClose={() => setIsGuidelinesOpen(false)}
      />

      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab || 'terms'}
        onClose={() => setLegalModalTab(null)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        user={currentUser}
        issues={issues}
        onComplete={handleCompleteOnboarding}
      />

      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
        user={currentUser}
        onUpdateUser={handleUpdateUserProfile}
        onSignOut={() => handleSelectUser(null)}
        issues={issues}
        userVotes={userVotes}
        userLikes={userLikes}
        userFavorites={userFavorites}
        regionScope={regionScope}
        onChangeRegionScope={setRegionScope}
        interestScope={interestScope}
        onChangeInterestScope={setInterestScope}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenIssue={(iss) => setActiveDetailIssue(iss)}
      />

      {/* Notifications & PWA Install */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <PWAInstallPrompt />
    </div>
  );
}

export default App;
