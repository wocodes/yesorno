import { UserProfile, Issue, VoteSubmission, CommentReply } from '../types';
import { buildIssueSlug } from './share';

export type NotificationEvent =
  | 'register'
  | 'login'
  | 'create_issue'
  | 'comment'
  | 'share'
  | 'contact_message';

interface NotifyPayload {
  event: NotificationEvent;
  user?: {
    name?: string;
    email?: string;
    role?: string;
  };
  data?: Record<string, unknown>;
}

// Memory cache to debounce duplicate triggers within short timeframes
const lastDispatchedEvents: Record<string, number> = {};

function shouldThrottle(key: string, cooldownMs = 4000): boolean {
  const now = Date.now();
  const lastTime = lastDispatchedEvents[key] || 0;
  if (now - lastTime < cooldownMs) {
    return true;
  }
  lastDispatchedEvents[key] = now;
  return false;
}

/**
 * Dispatches an event payload to the backend notification endpoint (/notify.php)
 * which instantly forwards an HTML email alert to william.odiomonafe@gmail.com
 */
export async function sendAdminNotification(payload: NotifyPayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // On localhost, we can target the live production endpoint or local relative endpoint
  const endpoint =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/notify.php'
      : '/notify.php';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!res.ok) {
      // In local dev without PHP server running, also attempt direct fallback to live server if desired
      if (window.location.hostname === 'localhost') {
        try {
          await fetch('https://yesorno.chillon.top/notify.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'cors',
            keepalive: true,
          });
          return true;
        } catch {
          // Silent local fallback
        }
      }
      return false;
    }

    return true;
  } catch (err) {
    // If local fetch fails (e.g. Vite dev server doesn't execute PHP files), try live server endpoint
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        await fetch('https://yesorno.chillon.top/notify.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'cors',
          keepalive: true,
        });
        return true;
      } catch {
        // Ignore local network error
      }
    }
    console.warn('Failed to send admin notification:', err);
    return false;
  }
}

/**
 * Triggered whenever a new user registers on YesOrNo
 */
export function notifyAdminUserRegistered(
  user: UserProfile,
  method = 'Standard Sign-Up'
): void {
  const throttleKey = `register:${user.email || user.id}`;
  if (shouldThrottle(throttleKey, 10000)) return;

  sendAdminNotification({
    event: 'register',
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    data: {
      method,
      region: user.region || 'Not selected',
      interests: (user.interests || []).join(', '),
    },
  });
}

/**
 * Triggered whenever a user logs in (Silenced per admin preference)
 */
export function notifyAdminUserLoggedIn(
  _user: UserProfile,
  _method = 'Standard Sign-In'
): void {
  // Silenced: login email alerts disabled to prevent admin inbox clutter
}

/**
 * Triggered whenever a user posts/publishes a new issue
 */
export function notifyAdminIssueCreated(
  issue: Issue,
  user?: UserProfile | null
): void {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://yesorno.chillon.top';
  const issueUrl = `${origin}/${buildIssueSlug(issue)}`;

  sendAdminNotification({
    event: 'create_issue',
    user: {
      name: user?.name || issue.author,
      email: user?.email || issue.creatorEmail,
      role: user?.role,
    },
    data: {
      title: issue.title,
      description: issue.description,
      category: issue.category,
      duration: issue.durationLabel,
      visibility: issue.visibility,
      url: issueUrl,
    },
  });
}

/**
 * Triggered whenever a user comments or attaches a perspective/voice note to an issue (Silenced per admin preference)
 */
export function notifyAdminCommentAdded(
  _submission: VoteSubmission,
  _issueTitle: string,
  _user?: UserProfile | null
): void {
  // Silenced: issue comment alerts disabled per admin preference
}

/**
 * Triggered whenever a user posts a direct reply to another user's comment (Silenced per admin preference)
 */
export function notifyAdminReplyAdded(
  _reply: CommentReply,
  _parentSubmission: VoteSubmission,
  _issueTitle: string,
  _user?: UserProfile | null
): void {
  // Silenced: reply alerts disabled per admin preference
}

/**
 * Triggered whenever an issue is shared to social media or downloaded
 */
export function notifyAdminIssueShared(
  issue: Issue,
  platform: string,
  user?: UserProfile | null
): void {
  const throttleKey = `share:${issue.id}:${platform}`;
  if (shouldThrottle(throttleKey, 5000)) return;

  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://yesorno.chillon.top';
  const issueUrl = `${origin}/${buildIssueSlug(issue)}`;

  sendAdminNotification({
    event: 'share',
    user: {
      name: user?.name || 'Community Member',
      email: user?.email,
      role: user?.role,
    },
    data: {
      issueTitle: issue.title,
      platform,
      url: issueUrl,
    },
  });
}

/**
 * Dispatches a user contact form submission to the admin via backend notification
 */
export async function sendContactMessage(params: {
  name: string;
  email: string;
  category: string;
  subject?: string;
  message: string;
}): Promise<boolean> {
  return sendAdminNotification({
    event: 'contact_message',
    user: {
      name: params.name,
      email: params.email,
    },
    data: {
      category: params.category,
      subject: params.subject || `Inquiry regarding ${params.category}`,
      message: params.message,
      submittedAt: new Date().toISOString(),
    },
  });
}

