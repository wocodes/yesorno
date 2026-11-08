import { Issue } from '../types';

export interface SharePayload {
  title: string;
  description: string;
  url: string;
  fullText: string;
}

/**
 * Generates a URL-friendly slug from an issue question and appends its unique ID:
 * e.g. "should-our-team-adopt-a-4-day-work-week-issue-1731000000"
 */
export function buildIssueSlug(issue: Issue): string {
  const questionSlug = issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');

  return questionSlug ? `${questionSlug}-${issue.id}` : issue.id;
}

/**
 * Extracts an issue ID or matches an issue from the current URL pathname or ?issue= query parameter
 */
export function findIssueFromUrl(issues: Issue[]): Issue | null {
  if (typeof window === 'undefined' || issues.length === 0) return null;

  // 1. Check legacy ?issue= query parameter first
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('issue');
  if (queryId) {
    const byQuery = issues.find((i) => i.id === queryId);
    if (byQuery) return byQuery;
  }

  // 2. Check clean path format: /{slug-of-the-issue-question}-{id-of-the-issue}
  const rawPath = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '');
  if (!rawPath || rawPath === 'index.html') return null;

  // Match exact slug-id or trailing issue.id
  const matched = issues.find(
    (issue) =>
      rawPath === buildIssueSlug(issue) ||
      rawPath === issue.id ||
      rawPath.endsWith(`-${issue.id}`)
  );

  return matched || null;
}

/**
 * Builds a rich social share payload containing the issue title, description, consensus stats, and deep-link URL
 */
export function buildIssueSharePayload(issue: Issue): SharePayload {
  const total = issue.yesCount + issue.noCount;
  const yesPct = total > 0 ? Math.round((issue.yesCount / total) * 100) : 50;
  const noPct = 100 - yesPct;

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://yesorno.chillon.top';

  const slugWithId = buildIssueSlug(issue);
  const url = `${origin}/${slugWithId}`;

  const rawDesc =
    issue.description && issue.description.trim().length > 0
      ? issue.description.trim()
      : `Vote YES (${yesPct}%) or NO (${noPct}%) on this issue on YesOrNo.`;

  const cleanDesc =
    rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;

  const fullText = issue.description && issue.description.trim().length > 0
    ? `*${issue.title}*\n${cleanDesc}\n\nCurrent Standings: YES ${yesPct}% vs NO ${noPct}% (${total} votes) — Cast your vote:`
    : `*${issue.title}*\nCurrent Standings: YES ${yesPct}% vs NO ${noPct}% (${total} votes) — Cast your vote:`;

  return {
    title: issue.title,
    description: cleanDesc,
    url,
    fullText,
  };
}

/**
 * Dynamically updates document title, browser URL path, and OpenGraph/Twitter meta tags when an issue is active
 */
export function updateDocumentMetaForIssue(issue: Issue | null): void {
  if (typeof document === 'undefined') return;

  const defaultTitle = 'YesOrNo | Vote YES or NO on Issues That Matter to You';
  const defaultDesc =
    'It takes less than 1 min to make your voice heard and make an impact. Vote YES or NO on family, workplace, communal, religious, group, and policy decisions.';
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://yesorno.chillon.top';

  const title = issue ? issue.title : defaultTitle;
  const desc = issue
    ? issue.description && issue.description.trim().length > 0
      ? issue.description.trim()
      : `Vote YES or NO on "${issue.title}" on YesOrNo.`
    : defaultDesc;
  const canonicalUrl = issue ? `${origin}/${buildIssueSlug(issue)}` : `${origin}/`;

  document.title = issue ? `${issue.title} | YesOrNo` : defaultTitle;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  setMeta('meta[name="title"]', title);
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', desc);
  setMeta('meta[property="og:url"]', canonicalUrl);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', desc);

  const imageUrl = issue && issue.images && issue.images.length > 0
    ? (issue.images[0].startsWith('http') ? issue.images[0] : `${origin}${issue.images[0]}`)
    : `${origin}/og-image.png`;

  setMeta('meta[property="og:image"]', imageUrl);
  setMeta('meta[property="og:image:secure_url"]', imageUrl);
  setMeta('meta[name="twitter:image"]', imageUrl);
}
