import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  loadIssues, saveIssues, getUserVotesMap, recordUserVote, resetToDefaults,
  getUserLikesMap, saveUserLikesMap, getUserFavoritesMap, saveUserFavoritesMap,
  fetchServerIssues,
  apiRecordVote, apiRecordReply, apiRecordReaction, apiRecordDeleteIssue
} from './utils/storage';
import { getStoredUser, saveStoredUser, TOP_CREATORS_AND_VOTERS, isAdminUser, getSavedProfileByEmail } from './utils/auth';
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
  notifyAdminUserLoggedIn,
  notifyAdminIssueCreated,
  notifyAdminCommentAdded,
  notifyAdminReplyAdded,
  notifyAdminIssueShared,
} from './utils/emailNotifier';
import { Issue, IssueCategory, VoteSubmission, AppView, UserProfile, VoteChoice, CommentReply } from './types';
import { Navbar, FeedSortOption } from './components/Navbar';
import { IssueCard } from './components/IssueCard';
import { VoteModal } from './components/VoteModal';
import { IssueDetailModal } from './components/IssueDetailModal';
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
import { ToastContainer, ToastMessage } from './components/Toast';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { 
  Filter, Home, User, Vote, Clock, Plus, Bookmark, Compass, Search, Sparkles
} from 'lucide-react';

function getInitialView(user: UserProfile | null): AppView {
  const hash = window.location.hash.replace('#', '');
  const params = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const hasSharedIssue = params.has('issue') || Boolean(rawPath && rawPath !== 'index.html');

  if (hash === 'landing') {
    return 'landing';
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
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalDocTab | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

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

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      recordThemeModeSwitch(next);
      return next;
    });
  };

  const handleToggleColorTone = () => {
    setColorTone(prev => {
      const next = prev === 'vibrant' ? 'toned' : 'vibrant';
      recordColorToneSwitch(next);
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

  // Lock background page scroll whenever any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      activeVoteIssue ||
      activeDetailIssue ||
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
    activeDetailIssue,
    activeShareIssue,
    isGuidelinesOpen,
    legalModalTab,
    isCreateModalOpen,
    isProfileSettingsOpen,
    isOnboardingOpen,
  ]);

  // Sync OpenGraph / document meta tags and clean slug URL when an issue is opened or shared
  useEffect(() => {
    const targetIssue = activeDetailIssue || activeShareIssue || null;
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
  }, [activeDetailIssue, activeShareIssue]);

  // If URL has /{slug-of-the-issue-question}-{id} or ?issue=<id> and user is authenticated, auto-open that issue
  useEffect(() => {
    if (!currentUser) return;
    const found = findIssueFromUrl(issues);
    if (found) {
      setActiveDetailIssue(found);
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
      if (hash === 'app' || hash === 'discovery' || hash === 'analytics') {
        if (!currentUser) {
          setAuthPromptMessage('Please sign in to view, create, and vote on issues.');
          setCurrentView('auth');
          window.location.hash = 'auth';
        } else if (hash === 'analytics' && !isAdminUser(currentUser)) {
          setCurrentView('app');
          window.location.hash = 'app';
        } else {
          setCurrentView(hash as AppView);
        }
      } else if (hash === 'auth') {
        setCurrentView('auth');
      } else if (hash === '' || hash === 'landing') {
        setCurrentView(currentUser ? 'app' : 'landing');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentUser]);

  // Sync issues to localStorage and cloud server
  useEffect(() => {
    saveIssues(issues);
  }, [issues]);

  // Cloud Sync: On mount and window focus, fetch shared issues from SQLite API and merge with local issues
  useEffect(() => {
    const syncFromCloud = () => {
      fetchServerIssues().then((serverIssues) => {
        if (serverIssues && serverIssues.length > 0) {
          setIssues((prev) => {
            const map = new Map<string, Issue>();
            serverIssues.forEach((i) => map.set(i.id, i));
            prev.forEach((i) => {
              if (!map.has(i.id)) map.set(i.id, i);
            });
            const merged = Array.from(map.values());
            saveIssues(merged);
            return merged;
          });
        }
      });
    };

    syncFromCloud();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud();
      }
    };

    window.addEventListener('focus', syncFromCloud);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', syncFromCloud);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Sync currentUser to localStorage and navigate straight to the dashboard upon sign-in
  const handleSelectUser = (user: UserProfile | null) => {
    setCurrentUser(user);
    saveStoredUser(user);
    if (user) {
      setAuthPromptMessage(null);
      setCurrentView('app');
      window.location.hash = 'app';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Notify admin email on registration vs login
      const isNewUser = !user.onboardingCompleted || !getSavedProfileByEmail(user.email);
      if (isNewUser) {
        notifyAdminUserRegistered(user, 'Account Registration');
      }
      notifyAdminUserLoggedIn(user, 'Account Sign-In');

      if (!user.onboardingCompleted) {
        setIsOnboardingOpen(true);
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

  // Handle vote submission (supports both 1-tap instant votes and follow-up inline replies)
  const handleVoteSubmit = (submission: VoteSubmission) => {
    const targetIssue = issues.find(i => i.id === submission.issueId);
    recordUserInterestFromIssue(targetIssue);
    const existingVote = userVotes[submission.issueId];
    const hasExistingVote = Boolean(existingVote);
    const hasContent = Boolean(submission.note || submission.voiceNote);

    setIssues(prevIssues => {
      return prevIssues.map(issue => {
        if (issue.id === submission.issueId) {
          const isYes = submission.choice === 'YES';
          let nextYes = issue.yesCount;
          let nextNo = issue.noCount;

          if (!hasExistingVote) {
            nextYes = isYes ? issue.yesCount + 1 : issue.yesCount;
            nextNo = !isYes ? issue.noCount + 1 : issue.noCount;
          } else if (existingVote.choice !== submission.choice) {
            // User switched stance from YES->NO or NO->YES
            nextYes = isYes ? issue.yesCount + 1 : Math.max(0, issue.yesCount - 1);
            nextNo = !isYes ? issue.noCount + 1 : Math.max(0, issue.noCount - 1);
          }

          return {
            ...issue,
            yesCount: nextYes,
            noCount: nextNo,
            responses: hasContent ? [submission, ...issue.responses] : issue.responses
          };
        }
        return issue;
      });
    });

    recordUserVote(submission.issueId, submission.choice, submission.id);
    setUserVotes(getUserVotesMap());
    apiRecordVote(submission);

    // Record telemetry for vote / reply / voice note
    if (!hasExistingVote || existingVote.choice !== submission.choice) {
      recordEngagementAction(submission.choice === 'YES' ? 'vote_yes' : 'vote_no', targetIssue?.title);
    }
    if (submission.note) {
      recordEngagementAction('inline_reply', targetIssue?.title);
      notifyAdminCommentAdded(submission, targetIssue?.title || 'Issue Topic', currentUser);
    }
    if (submission.voiceNote) {
      recordEngagementAction('voice_note', targetIssue?.title);
      if (!submission.note) {
        notifyAdminCommentAdded(submission, targetIssue?.title || 'Issue Topic', currentUser);
      }
    }

    // Update activeDetailIssue if open
    if (activeDetailIssue && activeDetailIssue.id === submission.issueId) {
      setActiveDetailIssue(prev => {
        if (!prev) return null;
        const isYes = submission.choice === 'YES';
        let nextYes = prev.yesCount;
        let nextNo = prev.noCount;
        if (!hasExistingVote) {
          nextYes = isYes ? prev.yesCount + 1 : prev.yesCount;
          nextNo = !isYes ? prev.noCount + 1 : prev.noCount;
        } else if (existingVote.choice !== submission.choice) {
          nextYes = isYes ? prev.yesCount + 1 : Math.max(0, prev.yesCount - 1);
          nextNo = !isYes ? prev.noCount + 1 : Math.max(0, prev.noCount - 1);
        }
        return {
          ...prev,
          yesCount: nextYes,
          noCount: nextNo,
          responses: hasContent ? [submission, ...prev.responses] : prev.responses
        };
      });
    }

    // Do not show a toast when the user is adding a reply to an existing vote (since the reply appears instantly)
    if (!(hasExistingVote && hasContent)) {
      addToast(
        'success',
        `Your ${submission.choice} vote was recorded`,
        submission.voiceNote 
          ? 'Voice note attached.'
          : submission.note
          ? 'Perspective posted to the thread.'
          : 'Tap Reply below the card if you want to add a quick note or voice clip.'
      );
    }
  };

  // Handle creator deleting an issue topic & description while preserving all responses & votes
  const handleDeleteIssueByAuthor = (issueId: string) => {
    if (!window.confirm('Delete this issue topic and description? Community votes and responses will be preserved, and the topic/description will display as "Deleted by Author".')) {
      return;
    }

    setIssues(prev => prev.map(issue => {
      if (issue.id === issueId) {
        return {
          ...issue,
          title: 'Deleted by Author',
          description: 'Deleted by Author',
          isDeletedByAuthor: true,
          deletedAt: new Date().toISOString(),
          images: undefined,
          creatorVoiceNote: undefined,
        };
      }
      return issue;
    }));

    if (activeDetailIssue && activeDetailIssue.id === issueId) {
      setActiveDetailIssue(prev => prev ? {
        ...prev,
        title: 'Deleted by Author',
        description: 'Deleted by Author',
        isDeletedByAuthor: true,
        deletedAt: new Date().toISOString(),
        images: undefined,
        creatorVoiceNote: undefined,
      } : null);
    }

    apiRecordDeleteIssue(issueId);

    addToast(
      'info',
      'Issue Deleted by Author',
      'Topic and description now show "Deleted by Author" while keeping all responses.'
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
    let parentSubmission: VoteSubmission | undefined;
    const targetIssue = issues.find(i => i.id === issueId);

    setIssues(prev => {
      const nextIssues = prev.map(issue => {
        if (issue.id !== issueId) return issue;
        const updatedResponses = issue.responses.map(resp => {
          if (resp.id !== submissionId) return resp;
          parentSubmission = resp;
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

    // Notify admin
    const foundSubmission = parentSubmission || targetIssue?.responses.find(r => r.id === submissionId);
    if (targetIssue && foundSubmission) {
      notifyAdminReplyAdded(reply, foundSubmission, targetIssue.title, currentUser);
    }
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

  // Filtered & Sorted Issues with Region + Worldwide and Interests Priority
  const filteredIssues = useMemo(() => {
    const userRegion = currentUser?.region;
    const userInterests = currentUser?.interests || [];
    const followedCreatorIds = currentUser?.followingCreators || [];

    // Helper: compute priority score for an issue based on user preferences
    const computePriorityScore = (issue: Issue): number => {
      let score = 0;
      const issueReg = inferIssueRegion(issue);

      // 1. Region Priority:
      // Exact region match gets highest priority (+300), Worldwide ('Global / Remote') gets mixed in (+150)
      if (userRegion && userRegion !== 'Global / Remote') {
        if (issueReg === userRegion) {
          score += 300;
        } else if (issueReg === 'Global / Remote') {
          score += 150;
        }
      } else if (userRegion === 'Global / Remote' && issueReg === 'Global / Remote') {
        score += 200;
      }

      // 2. Interests Priority:
      // Issues matching user's selected categories get boosted (+200), Private/Global issues get mixed in
      if (userInterests.length > 0 && userInterests.includes(issue.category)) {
        score += 200;
      }

      // 3. Followed Creators / Voters Priority:
      if (followedCreatorIds.length > 0) {
        const matchesFollowed = followedCreatorIds.some(followed => {
          const fLower = followed.toLowerCase();
          const authorLower = issue.author.toLowerCase();
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
          score += 120;
        }
      }

      return score;
    };

    let result = issues.filter(issue => {
      const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || 
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.tags.some(t => t.toLowerCase().includes(query));

      if (!matchesCategory || !matchesSearch) return false;
      if (showFavoritesOnly && !userFavorites[issue.id]) return false;

      // If a user hasn't selected any interests yet (and isn't actively searching, filtering by category, or viewing Favourites),
      // show them nothing in the default homepage feed so they are encouraged to use Search or Discovery.
      if (
        userInterests.length === 0 &&
        selectedCategory === 'All' &&
        !query &&
        !showFavoritesOnly
      ) {
        return false;
      }

      // Region Scope filter: When 'my-region-worldwide' is active and user selected a specific region,
      // show issues from that region AND issues from users who selected Worldwide ('Global / Remote')
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

      // Interest Scope filter: When 'my-interests-mixed' is active and selectedCategory === 'All' and user has interests,
      // show issues matching their selected interests (plus Private Circle issues they have access to)
      if (
        interestScope === 'my-interests-mixed' &&
        selectedCategory === 'All' &&
        userInterests.length > 0
      ) {
        const matchesInterest = userInterests.includes(issue.category) || issue.category === 'Private & Internal';
        if (!matchesInterest) {
          return false;
        }
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      const totalA = a.yesCount + a.noCount;
      const totalB = b.yesCount + b.noCount;

      if (sortBy === 'for-you') {
        const scoreDiff = computePriorityScore(b) - computePriorityScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return totalB - totalA;
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
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 pb-20 sm:pb-12 transition-colors">
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
        onResetData={handleResetData}
        categoryCounts={categoryCounts}
        currentView={currentView}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        showSearchMobile={showSearchMobile}
        colorTone={colorTone}
        onToggleColorTone={handleToggleColorTone}
      />

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8 w-full flex-1 space-y-5">
        {currentView === 'analytics' && isAdminUser(currentUser) ? (
          <AdminAnalyticsPage
            issues={issues}
            currentUser={currentUser}
            colorTone={colorTone}
            theme={theme}
            onNavigate={handleNavigate}
            onOpenIssue={(iss) => {
              recordUserInterestFromIssue(iss);
              setActiveDetailIssue(iss);
            }}
          />
        ) : currentView === 'discovery' ? (
          <DiscoveryHub
            issues={issues}
            onOpenDetails={(iss) => {
              recordUserInterestFromIssue(iss);
              setActiveDetailIssue(iss);
            }}
            onQuickVote={handleOpenQuickVote}
            onFilterByCategory={(cat) => {
              setSelectedCategory(cat);
              handleNavigate('app');
            }}
            fullPage
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
            <div className="flex items-center justify-between pt-1">
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
            {(!currentUser.interests || currentUser.interests.length === 0) &&
            selectedCategory === 'All' &&
            !searchQuery.trim() &&
            !showFavoritesOnly ? (
              <div className="card p-8 sm:p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Your personalized feed starts with what matters to you
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  You haven&apos;t selected any interests yet. Use <strong>Search</strong> or explore <strong>Discovery</strong> to find issues — as you vote, like, or interact with issues, we&apos;ll automatically build your interests profile!
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleNavigate('discovery')}
                    className="btn-brand text-xs py-2.5 px-5 shadow-glow cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Explore Discovery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchMobile(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn-ghost text-xs py-2.5 px-4 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Use Search</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProfileSettingsOpen(true)}
                    className="btn-ghost text-xs py-2.5 px-4 cursor-pointer"
                  >
                    <span>Pick Interests</span>
                  </button>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
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
                        }}
                        onQuickVote={handleOpenQuickVote}
                        onInlineSubmitVote={handleVoteSubmit}
                        onDeleteIssue={handleDeleteIssueByAuthor}
                        onToggleLikeIssue={handleToggleLikeIssue}
                        onToggleFavoriteIssue={handleToggleFavoriteIssue}
                        onShareIssue={(iss) => setActiveShareIssue(iss)}
                        hasUserVoted={!!voteRecord}
                        userVoteChoice={voteRecord?.choice}
                        isLiked={!!userLikes[issue.id]}
                        isFavorited={!!userFavorites[issue.id]}
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
        <div className="h-16 sm:h-8" />
      </main>

      {/* Mobile Sticky Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-ink-950/95 backdrop-blur-xl py-2.5 px-4 z-40 flex items-center justify-around text-[11px] font-semibold text-slate-400 shadow-lift">
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
        isOpen={!!activeVoteIssue}
        onClose={() => {
          setActiveVoteIssue(null);
          setInitialVoteChoice(null);
        }}
        onSubmitVote={handleVoteSubmit}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        currentUser={currentUser}
      />

      <IssueDetailModal
        issue={activeDetailIssue}
        isOpen={!!activeDetailIssue}
        onClose={() => setActiveDetailIssue(null)}
        onOpenVoteModal={(choice) => {
          if (activeDetailIssue) {
            handleOpenQuickVote(activeDetailIssue, choice);
          }
        }}
        onInlineSubmitVote={handleVoteSubmit}
        onDeleteIssue={handleDeleteIssueByAuthor}
        onToggleLikeIssue={handleToggleLikeIssue}
        onToggleFavoriteIssue={handleToggleFavoriteIssue}
        onShareIssue={(iss) => setActiveShareIssue(iss)}
        currentUser={currentUser}
        hasUserVoted={activeDetailIssue ? !!userVotes[activeDetailIssue.id] : false}
        userVoteChoice={activeDetailIssue ? userVotes[activeDetailIssue.id]?.choice : undefined}
        isLiked={activeDetailIssue ? !!userLikes[activeDetailIssue.id] : false}
        isFavorited={activeDetailIssue ? !!userFavorites[activeDetailIssue.id] : false}
        onLikeResponse={handleLikeResponse}
        onReportResponse={handleReportResponse}
        onAddCommentReply={handleAddCommentReply}
        onLikeCommentReply={handleLikeCommentReply}
        onToggleCommentReaction={handleToggleCommentReaction}
        onToggleReplyReaction={handleToggleReplyReaction}
        onShareComment={handleShareComment}
        onAddInvite={handleAddInvite}
        onAddGroupInvite={handleAddGroupInvite}
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
        onClose={() => setIsCreateModalOpen(false)}
        onCreateIssue={handleCreateIssue}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
        currentUser={currentUser}
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
