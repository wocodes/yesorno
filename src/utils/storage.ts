import { Issue, VoteSubmission, CommentReply } from '../types';

export const LEGACY_MOCK_ISSUE_IDS = new Set([
  'issue-workplace-1',
  'issue-family-1',
  'issue-faith-1',
  'issue-groups-1',
  'issue-1',
  'issue-econ-1',
  'issue-env-1',
  'issue-edu-1',
  'issue-policy-1',
  'issue-gender-1',
  'issue-entertainment-1',
]);

const STORAGE_KEY_ISSUES = 'yesorno_issues_v1';
const STORAGE_KEY_DELETED_ISSUE_IDS = 'yesorno_deleted_issue_ids_v1';
const STORAGE_KEY_USER_VOTES = 'yesorno_user_votes_v1';
const STORAGE_KEY_USER_LIKES = 'yesorno_user_likes_v1';
const STORAGE_KEY_USER_FAVORITES = 'yesorno_user_favorites_v1';

/**
 * Retrieves set of permanently deleted issue IDs
 */
export function getDeletedIssueIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_ISSUE_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Records an issue ID as deleted so it can never reappear in feeds or cloud sync
 */
export function recordDeletedIssueId(issueId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getDeletedIssueIds();
    set.add(issueId);
    localStorage.setItem(STORAGE_KEY_DELETED_ISSUE_IDS, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Failed to record deleted issue id:', err);
  }
}

/**
 * Default issues return empty array - all platform issues are loaded dynamically from the database
 */
export function getDefaultIssues(): Issue[] {
  return [];
}

export function loadIssues(): Issue[] {
  const deletedIds = getDeletedIssueIds();
  try {
    const data = localStorage.getItem(STORAGE_KEY_ISSUES);
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    // Verify each issue has essential structure, filter out deleted and any old hardcoded mock issues
    const valid = parsed
      .filter(i => i && typeof i === 'object' && typeof i.id === 'string' && Array.isArray(i.responses))
      .filter(i => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id));

    return valid;
  } catch (err) {
    console.error('Failed to load issues from storage:', err);
    return [];
  }
}

export function saveIssues(issues: Issue[]): void {
  try {
    if (Array.isArray(issues)) {
      const deletedIds = getDeletedIssueIds();
      const activeIssues = issues.filter(i => !deletedIds.has(i.id) && !i.isDeletedByAuthor && !LEGACY_MOCK_ISSUE_IDS.has(i.id));
      localStorage.setItem(STORAGE_KEY_ISSUES, JSON.stringify(activeIssues));
      // Asynchronously sync to cloud server storage for multi-device sync
      pushIssuesToServer(activeIssues);
    }
  } catch (err) {
    console.error('Failed to save issues to storage:', err);
  }
}

/**
 * Pushes issues to the server-side persistence API (/api-issues.php)
 */
export async function pushIssuesToServer(issues: Issue[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const endpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/api-issues.php'
      : '/api-issues.php';

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues }),
    });
  } catch {
    // Silent fallback
  }
}

/**
 * Fetches shared issues from the cloud API and merges them with local storage
 */
export async function fetchServerIssues(): Promise<Issue[] | null> {
  if (typeof window === 'undefined') return null;
  try {
    const endpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/api-issues.php'
      : '/api-issues.php';

    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const deletedIds = getDeletedIssueIds();
      return data.filter(i => !deletedIds.has(i.id) && !i.isDeletedByAuthor);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Asynchronously sends an atomic vote to SQLite backend in the background
 */
export async function apiRecordVote(submission: VoteSubmission): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api-issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'vote',
        ...submission,
      }),
    });
  } catch (err) {
    console.warn('Background vote sync queued/deferred:', err);
  }
}

/**
 * Asynchronously sends an atomic direct reply to SQLite backend in the background
 */
export async function apiRecordReply(issueId: string, submissionId: string, reply: CommentReply): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api-issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reply',
        issueId,
        submissionId,
        reply,
      }),
    });
  } catch (err) {
    console.warn('Background reply sync queued/deferred:', err);
  }
}

/**
 * Asynchronously sends an atomic reaction toggle to SQLite backend in the background
 */
export async function apiRecordReaction(
  targetType: 'comment' | 'reply',
  targetId: string,
  userKey: string,
  emoji: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api-issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'react',
        targetType,
        targetId,
        userKey,
        emoji,
      }),
    });
  } catch (err) {
    console.warn('Background reaction sync queued/deferred:', err);
  }
}

/**
 * Asynchronously sends an atomic issue deletion flag to SQLite backend
 */
export async function apiRecordDeleteIssue(issueId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api-issues.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        issueId,
      }),
    });
  } catch (err) {
    console.warn('Background issue deletion sync queued/deferred:', err);
  }
}

export function getUserVotesMap(): Record<string, { choice: 'YES' | 'NO'; responseId?: string }> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER_VOTES);
    if (!data) return {};
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function recordUserVote(issueId: string, choice: 'YES' | 'NO', responseId?: string): void {
  try {
    const current = getUserVotesMap();
    current[issueId] = { choice, responseId };
    localStorage.setItem(STORAGE_KEY_USER_VOTES, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to record user vote:', err);
  }
}

export function getUserLikesMap(): Record<string, boolean> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER_LIKES);
    if (!data) return {};
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserLikesMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER_LIKES, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save user likes:', err);
  }
}

export function getUserFavoritesMap(): Record<string, boolean> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER_FAVORITES);
    if (!data) return {};
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserFavoritesMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER_FAVORITES, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save user favorites:', err);
  }
}

export function resetToDefaults(): Issue[] {
  const defaults = getDefaultIssues();
  localStorage.removeItem(STORAGE_KEY_ISSUES);
  localStorage.removeItem(STORAGE_KEY_USER_VOTES);
  localStorage.removeItem(STORAGE_KEY_USER_LIKES);
  localStorage.removeItem(STORAGE_KEY_USER_FAVORITES);
  saveIssues(defaults);
  return defaults;
}
