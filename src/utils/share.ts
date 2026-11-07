import { Issue } from '../types';

export interface SharePayload {
  title: string;
  description: string;
  url: string;
  fullText: string;
}

/**
 * Builds a rich social share payload containing the issue title, description, consensus stats, and deep-link URL
 */
export function buildIssueSharePayload(issue: Issue): SharePayload {
  const total = issue.yesCount + issue.noCount;
  const yesPct = total > 0 ? Math.round((issue.yesCount / total) * 100) : 50;
  const noPct = 100 - yesPct;

  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://yesorno.chillon.top/';

  const url = `${baseUrl}?issue=${encodeURIComponent(issue.id)}#app`;
  const cleanDesc = issue.description.length > 160
    ? `${issue.description.slice(0, 157)}...`
    : issue.description;

  const fullText = `🗳️ ${issue.title}\n\n${cleanDesc}\n\nCurrent Standings: YES ${yesPct}% vs NO ${noPct}% (${total} votes) — Make your voice heard in under 1 min:`;

  return {
    title: issue.title,
    description: cleanDesc,
    url,
    fullText
  };
}

/**
 * Dynamically updates document title and OpenGraph/Twitter meta tags when an issue is active
 */
export function updateDocumentMetaForIssue(issue: Issue | null): void {
  if (typeof document === 'undefined') return;

  const defaultTitle = 'YesOrNo | Vote YES or NO on Issues That Matter to You';
  const defaultDesc = 'It takes less than 1 min to make your voice heard and make an impact. Vote YES or NO on family, workplace, communal, religious, group, and policy decisions.';

  const title = issue ? `${issue.title} | YesOrNo` : defaultTitle;
  const desc = issue ? issue.description : defaultDesc;

  document.title = title;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', content);
  };

  setMeta('meta[name="title"]', title);
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', desc);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', desc);
}

