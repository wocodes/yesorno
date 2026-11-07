import { Issue } from '../types';
import { INITIAL_ISSUES } from '../data/initialIssues';

const STORAGE_KEY_ISSUES = 'yesorno_issues_v1';
const STORAGE_KEY_USER_VOTES = 'yesorno_user_votes_v1';
const STORAGE_KEY_USER_LIKES = 'yesorno_user_likes_v1';
const STORAGE_KEY_USER_FAVORITES = 'yesorno_user_favorites_v1';

/**
 * Returns default seed issues across all platforms and environments.
 * Ensures that any new visitor or device immediately has rich deliberations to vote on.
 */
export function getDefaultIssues(): Issue[] {
  return INITIAL_ISSUES;
}

export function loadIssues(): Issue[] {
  const defaults = getDefaultIssues();
  try {
    const data = localStorage.getItem(STORAGE_KEY_ISSUES);
    if (!data) {
      if (defaults.length > 0) saveIssues(defaults);
      return defaults;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      if (defaults.length > 0) saveIssues(defaults);
      return defaults;
    }
    // Verify each issue has essential structure
    const valid = parsed.every(i => i && typeof i === 'object' && typeof i.id === 'string' && Array.isArray(i.responses));
    if (!valid) {
      if (defaults.length > 0) saveIssues(defaults);
      return defaults;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load issues from storage:', err);
    return defaults;
  }
}

export function saveIssues(issues: Issue[]): void {
  try {
    if (Array.isArray(issues)) {
      localStorage.setItem(STORAGE_KEY_ISSUES, JSON.stringify(issues));
      // Asynchronously sync to cloud server storage for multi-device sync
      pushIssuesToServer(issues);
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
      return data;
    }
    return null;
  } catch {
    return null;
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
