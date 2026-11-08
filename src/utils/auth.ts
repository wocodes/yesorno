import { UserProfile, Issue } from '../types';

/**
 * Checks whether the app is running on a local development environment
 * AND not built for production.
 * In production builds (`npm run build`), `import.meta.env.DEV` is statically `false`,
 * allowing Vite/Rollup to dead-code-eliminate all demo data from the production bundle.
 */
export function isLocalEnvironment(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return Boolean(
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local')
  );
}

export const DEMO_USERS: UserProfile[] = import.meta.env.DEV
  ? [
      {
        id: 'user-elena',
        name: 'Elena Rostova',
        email: 'elena@yesorno.chillon.top',
        role: 'District 4 Council Rep',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        groups: ['District 4 Council', 'Downtown Taskforce', 'Planning Commission']
      },
      {
        id: 'user-marcus',
        name: 'Marcus Chen',
        email: 'marcus@chenbakery.com',
        role: 'Market St Café Owner',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        groups: ['Downtown Merchants', 'Market St Association']
      },
      {
        id: 'user-sarah',
        name: 'Dr. Sarah Al-Mansoor',
        email: 'sarah.almansoor@health.org',
        role: 'Health Advocate & Resident',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        groups: ['Park Safety Alliance', 'District 4 Council']
      }
    ]
  : [];

export const GOOGLE_SAMPLE_ACCOUNTS: UserProfile[] = import.meta.env.DEV
  ? [
      {
        id: 'google-alex',
        name: 'Alex Rivera',
        email: 'alex.rivera@gmail.com',
        role: 'Verified Google Account',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        groups: ['District 4 Council', 'Community Member']
      },
      {
        id: 'google-david',
        name: 'David Okonkwo',
        email: 'david.okonkwo@workspace.org',
        role: 'Product Lead • Google Workspace',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        groups: ['Workplace & Teams', 'Downtown Taskforce']
      }
    ]
  : [];

export interface TopCreatorProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  region: string;
  specialty: string;
  avatar: string;
  issuesCount: number;
  votesCast: number;
}

export const TOP_CREATORS_AND_VOTERS: TopCreatorProfile[] = import.meta.env.DEV
  ? [
      {
        id: 'creator-elena',
        name: 'Elena Rostova',
        handle: '@elena.civic',
        role: 'District 4 Council Rep',
        region: 'Local District',
        specialty: 'Community & Family',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        issuesCount: 14,
        votesCast: 182
      },
      {
        id: 'creator-people-ops',
        name: 'Internal People Operations Team',
        handle: '@people.ops',
        role: 'Future of Work Lab',
        region: 'Global / Remote',
        specialty: 'Workplace & Career',
        avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
        issuesCount: 9,
        votesCast: 310
      },
      {
        id: 'creator-marcus',
        name: 'Marcus Chen',
        handle: '@marcus.chen',
        role: 'Engineering & Local Merchant',
        region: 'North America',
        specialty: 'Economy & Workplace',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        issuesCount: 11,
        votesCast: 245
      },
      {
        id: 'creator-sarah',
        name: 'Dr. Sarah Al-Mansoor',
        handle: '@dr.sarah',
        role: 'Public Health & Climate Lead',
        region: 'Europe & UK',
        specialty: 'Environment & Policy',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        issuesCount: 19,
        votesCast: 412
      },
      {
        id: 'creator-deacon',
        name: 'Stewardship & Outreach Committee',
        handle: '@stewardship',
        role: 'Faith & Community Circle',
        region: 'Africa & Middle East',
        specialty: 'Religious & Faith',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        issuesCount: 8,
        votesCast: 164
      },
      {
        id: 'creator-william',
        name: 'William Odiomonafe',
        handle: '@william.civic',
        role: 'Civic Lead & Founder',
        region: 'Global / Remote',
        specialty: 'Business & Policy',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        issuesCount: 32,
        votesCast: 420
      },
      {
        id: 'creator-dean',
        name: 'University Academic Senate',
        handle: '@academic.senate',
        role: 'Higher Ed Innovation Board',
        region: 'Europe & UK',
        specialty: 'Education & Campus',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        issuesCount: 12,
        votesCast: 290
      }
    ]
  : [];

const STORAGE_KEY_AUTH = 'yesorno_current_user_v2';
const STORAGE_KEY_PROFILES_BY_EMAIL = 'yesorno_profiles_by_email_v1';

/**
 * Decodes a Google Identity Services JWT credential payload
 */
export function decodeGoogleJwt(credential: string): {
  sub: string;
  name: string;
  email: string;
  picture?: string;
} | null {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getStoredUser(): UserProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string' && Array.isArray(parsed.groups)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSavedProfileByEmail(email: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES_BY_EMAIL);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const key = email.trim().toLowerCase();
    return map && map[key] ? map[key] : null;
  } catch {
    return null;
  }
}

/**
 * Asynchronously fetch a user's saved profile from the server database (enables cross-device sync)
 */
export async function fetchServerProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email || !email.trim()) return null;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const res = await fetch(`/api-issues.php?action=get_profile&email=${encodeURIComponent(cleanEmail)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.profile && typeof data.profile === 'object') {
      const serverProfile = data.profile as UserProfile;
      // Cache to local storage so subsequent offline lookups are fast
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PROFILES_BY_EMAIL);
        const map = raw ? JSON.parse(raw) : {};
        map[cleanEmail] = serverProfile;
        localStorage.setItem(STORAGE_KEY_PROFILES_BY_EMAIL, JSON.stringify(map));
      } catch {}
      return serverProfile;
    }
  } catch (err) {
    console.warn('Failed to fetch user profile from server:', err);
  }
  return null;
}

/**
 * Asynchronously sync a user profile to the server database
 */
export async function saveServerProfile(profile: UserProfile): Promise<boolean> {
  if (!profile || !profile.email) return false;
  try {
    await fetch('/api-issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_profile',
        profile
      })
    });
    return true;
  } catch (err) {
    console.warn('Failed to sync user profile to server:', err);
    return false;
  }
}

export function saveStoredUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
      // Also persist by email so preferences stick even across sign-out / sign-in
      if (user.email) {
        const raw = localStorage.getItem(STORAGE_KEY_PROFILES_BY_EMAIL);
        const map = raw ? JSON.parse(raw) : {};
        map[user.email.trim().toLowerCase()] = user;
        localStorage.setItem(STORAGE_KEY_PROFILES_BY_EMAIL, JSON.stringify(map));
        // And asynchronously sync to server database so all devices stay in sync
        saveServerProfile(user).catch(() => {});
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  } catch (err) {
    console.error('Failed to save auth state:', err);
  }
}

/**
 * Checks whether the current user is the creator/author of an issue
 */
export function isIssueCreator(issue: Issue, user: UserProfile | null): boolean {
  if (!user) return false;
  if (issue.creatorId && issue.creatorId === user.id) return true;
  if (issue.creatorEmail && issue.creatorEmail.toLowerCase() === user.email.toLowerCase()) return true;
  if (!issue.isAnonymousAuthor && issue.author.toLowerCase() === user.name.toLowerCase()) return true;
  return false;
}

/**
 * Checks if a user has permission to view and vote on an issue
 */
export function canUserAccessIssue(issue: Issue, user: UserProfile | null): { 
  canAccess: boolean; 
  reason: 'public' | 'creator' | 'invited_email' | 'invited_group' | 'restricted';
} {
  if (!user) {
    return { canAccess: false, reason: 'restricted' };
  }

  // Creator always has full access
  if (isIssueCreator(issue, user)) {
    return { canAccess: true, reason: 'creator' };
  }

  if (issue.visibility === 'public') {
    return { canAccess: true, reason: 'public' };
  }

  // Check email invite
  const userEmailLower = user.email.toLowerCase();
  const isEmailInvited = (issue.invitedEmails || []).some(
    e => e.trim().toLowerCase() === userEmailLower
  );
  if (isEmailInvited) {
    return { canAccess: true, reason: 'invited_email' };
  }

  // Check group invite
  const isGroupInvited = (issue.invitedGroups || []).some(
    g => user.groups.includes(g)
  );
  if (isGroupInvited) {
    return { canAccess: true, reason: 'invited_group' };
  }

  return { canAccess: false, reason: 'restricted' };
}

/**
 * Authorized Admin Emails allowed to view the Admin Analytics & Growth Telemetry page (#analytics)
 */
export const ADMIN_EMAILS: string[] = [
  'william.odiomonafe@gmail.com',
  'odiomonafe@gmail.com',
  'admin@yesorno.chillon.top',
  'admin@chillon.top',
];

/**
 * Checks whether the current user is an authorized platform administrator.
 * In local dev (`npm run dev`), also allows the local dev sample accounts for testing.
 */
export function isAdminUser(user: UserProfile | null): boolean {
  if (!user || !user.email) return false;
  const emailLower = user.email.trim().toLowerCase();
  if (ADMIN_EMAILS.includes(emailLower)) return true;
  if (emailLower.endsWith('@chillon.top')) return true;
  if (isLocalEnvironment()) return true;
  return false;
}
