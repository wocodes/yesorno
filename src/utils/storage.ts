import { Issue } from '../types';
import { INITIAL_ISSUES } from '../data/initialIssues';
import { isLocalEnvironment } from './auth';

const STORAGE_KEY_ISSUES = 'civicpulse_issues_v1';
const STORAGE_KEY_USER_VOTES = 'civicpulse_user_votes_v1';
const STORAGE_KEY_USER_LIKES = 'civicpulse_user_likes_v1';
const STORAGE_KEY_USER_FAVORITES = 'civicpulse_user_favorites_v1';

/**
 * Returns default seed issues ONLY in local development (`import.meta.env.DEV`).
 * In production builds, `import.meta.env.DEV` is statically `false` so Rollup/Vite
 * completely tree-shakes `INITIAL_ISSUES` (~28KB of demo data) out of the production bundle.
 */
function getDefaultIssues(): Issue[] {
  if (import.meta.env.DEV && isLocalEnvironment()) {
    return INITIAL_ISSUES;
  }
  return [];
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
    if (!Array.isArray(parsed)) {
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
    }
  } catch (err) {
    console.error('Failed to save issues to storage:', err);
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
