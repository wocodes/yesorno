import { Issue, IssueSummaryInsights, UserProfile } from '../types';

/**
 * Calculates whether an issue is closed based on its time deadline
 */
export function isIssueClosed(closingDate?: string | null): boolean {
  if (!closingDate) return false;
  return new Date().getTime() >= new Date(closingDate).getTime();
}

/**
 * Formats time remaining until closingDate, or notes when it closed
 */
export function getTimeRemainingText(closingDate?: string | null): { text: string; isExpired: boolean; badgeColor: string } {
  if (!closingDate) {
    return { 
      text: 'No Expiry', 
      isExpired: false, 
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' 
    };
  }

  const now = new Date().getTime();
  const deadline = new Date(closingDate).getTime();
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    const elapsedHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const elapsedDays = Math.floor(elapsedHours / 24);
    const text = elapsedDays > 0 ? `Closed ${elapsedDays}d ago` : `Closed ${Math.max(1, elapsedHours)}h ago`;
    return { text: `VOTING CLOSED • ${text}`, isExpired: true, badgeColor: 'bg-slate-800 text-white' };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return { 
      text: `${days}d ${hours}h left`, 
      isExpired: false, 
      badgeColor: days <= 1 
        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30' 
        : 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-400/30' 
    };
  }

  if (hours > 0) {
    return { 
      text: `${hours}h ${minutes}m left`, 
      isExpired: false, 
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/30 font-bold' 
    };
  }

  return { 
    text: `${Math.max(1, minutes)}m remaining!`, 
    isExpired: false, 
    badgeColor: 'bg-rose-600 text-white animate-pulse' 
  };
}

/**
 * Deterministic instant heuristic summary (zero latency, works offline & without API keys)
 */
export function generateIssueSummary(issue: Issue): IssueSummaryInsights {
  const totalVotes = issue.yesCount + issue.noCount;
  const yesPercent = totalVotes > 0 ? Math.round((issue.yesCount / totalVotes) * 100) : 0;

  let sentimentTrend: IssueSummaryInsights['sentimentTrend'] = 'Divided';
  if (totalVotes === 0) {
    sentimentTrend = 'Divided';
  } else if (yesPercent >= 75) {
    sentimentTrend = 'Strongly Favor';
  } else if (yesPercent >= 55) {
    sentimentTrend = 'Leaning Yes';
  } else if (yesPercent <= 25) {
    sentimentTrend = 'Strongly Oppose';
  } else if (yesPercent <= 45) {
    sentimentTrend = 'Leaning No';
  }

  const isClosed = isIssueClosed(issue.closingDate);
  const prefix = isClosed ? 'Final Consensus' : 'Current Sentiment';
  let headline = `${prefix}: Strong approval with ${yesPercent}% voting YES.`;
  if (totalVotes === 0) {
    headline = 'Poll newly opened. Awaiting initial community votes and perspectives.';
  } else if (yesPercent >= 70) {
    headline = `${prefix}: Clear majority in favor (${yesPercent}% YES) across ${totalVotes} votes on "${issue.title}".`;
  } else if (yesPercent <= 30) {
    headline = `${prefix}: Clear opposition (${100 - yesPercent}% NO) across ${totalVotes} votes.`;
  } else if (yesPercent >= 45 && yesPercent <= 55) {
    headline = `${prefix}: Voters are closely divided (${yesPercent}% YES vs ${100 - yesPercent}% NO) with balanced perspectives.`;
  } else if (yesPercent > 50) {
    headline = `${prefix}: Moderate majority in favor (${yesPercent}% YES vs ${100 - yesPercent}% NO).`;
  } else {
    headline = `${prefix}: Majority currently leans against (${100 - yesPercent}% NO).`;
  }

  // Sort responses by likesCount descending to surface top-voted community arguments
  const yesResponses = [...issue.responses]
    .filter(r => r.choice === 'YES' && r.note)
    .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));

  const noResponses = [...issue.responses]
    .filter(r => r.choice === 'NO' && r.note)
    .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));

  const keyArgumentsYes = yesResponses.slice(0, 3).map(r => r.note as string);
  const keyArgumentsNo = noResponses.slice(0, 3).map(r => r.note as string);

  if (keyArgumentsYes.length === 0) {
    keyArgumentsYes.push(`Supports moving forward with "${issue.title}" to improve collective outcomes.`);
    keyArgumentsYes.push('Seen as a high-impact, practical step forward by YES voters.');
  }
  if (keyArgumentsNo.length === 0) {
    keyArgumentsNo.push('Raises questions around implementation timing, trade-offs, or resource allocation.');
    keyArgumentsNo.push('Prefers maintaining the current baseline or exploring alternative approaches.');
  }

  return {
    consensusHeadline: headline,
    keyArgumentsYes,
    keyArgumentsNo,
    sentimentTrend,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Production Live LLM AI Summary Generator (Supports Gemini API via VITE_GEMINI_API_KEY
 * with automatic fallback to the deterministic synthesizer)
 */
export async function generateLiveAISummary(issue: Issue): Promise<IssueSummaryInsights> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    // Simulate brief synthesis calculation and return deterministic analysis
    await new Promise(resolve => setTimeout(resolve, 450));
    return generateIssueSummary(issue);
  }

  try {
    const totalVotes = issue.yesCount + issue.noCount;
    const yesPercent = totalVotes > 0 ? Math.round((issue.yesCount / totalVotes) * 100) : 0;
    const yesNotes = issue.responses.filter(r => r.choice === 'YES' && r.note).map(r => r.note).slice(0, 10);
    const noNotes = issue.responses.filter(r => r.choice === 'NO' && r.note).map(r => r.note).slice(0, 10);

    const prompt = `You are an objective executive deliberation synthesizer. Analyze this YES/NO issue and return strict JSON matching { "consensusHeadline": string, "keyArgumentsYes": string[], "keyArgumentsNo": string[], "sentimentTrend": "Strongly Favor" | "Leaning Yes" | "Divided" | "Leaning No" | "Strongly Oppose" }.
Issue Title: ${issue.title}
Context: ${issue.description}
Votes: YES=${issue.yesCount} (${yesPercent}%), NO=${issue.noCount} (${100 - yesPercent}%)
YES Perspectives: ${JSON.stringify(yesNotes)}
NO Perspectives: ${JSON.stringify(noNotes)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
      return generateIssueSummary(issue);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return generateIssueSummary(issue);

    const parsed = JSON.parse(rawText);
    return {
      consensusHeadline: parsed.consensusHeadline || generateIssueSummary(issue).consensusHeadline,
      keyArgumentsYes: Array.isArray(parsed.keyArgumentsYes) && parsed.keyArgumentsYes.length > 0
        ? parsed.keyArgumentsYes.slice(0, 3)
        : generateIssueSummary(issue).keyArgumentsYes,
      keyArgumentsNo: Array.isArray(parsed.keyArgumentsNo) && parsed.keyArgumentsNo.length > 0
        ? parsed.keyArgumentsNo.slice(0, 3)
        : generateIssueSummary(issue).keyArgumentsNo,
      sentimentTrend: parsed.sentimentTrend || generateIssueSummary(issue).sentimentTrend,
      lastUpdated: new Date().toISOString()
    };
  } catch {
    return generateIssueSummary(issue);
  }
}

export interface IssueActivityMetrics {
  totalVotes: number;
  yesCount: number;
  noCount: number;
  yesPercent: number;
  noPercent: number;
  anonymousVotes: number;
  anonymousPercent: number;
  identifiedVotes: number;
  identifiedPercent: number;
  totalPerspectives: number;
  voiceNotesCount: number;
  voicePercent: number;
  isClosed: boolean;
  timeRemaining: { text: string; isExpired: boolean; badgeColor: string };
}

export function computeIssueMetrics(issue: Issue): IssueActivityMetrics {
  const totalVotes = issue.yesCount + issue.noCount;
  const yesPercent = totalVotes > 0 ? Math.round((issue.yesCount / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? 100 - yesPercent : 0;

  const anonymousVotes = issue.responses.filter(r => r.isAnonymous).length;
  const identifiedVotes = issue.responses.length - anonymousVotes;
  const anonymousPercent = issue.responses.length > 0 
    ? Math.round((anonymousVotes / issue.responses.length) * 100) 
    : 0;
  const identifiedPercent = 100 - anonymousPercent;

  const voiceNotesCount = issue.responses.filter(r => !!r.voiceNote).length;
  const voicePercent = issue.responses.length > 0 
    ? Math.round((voiceNotesCount / issue.responses.length) * 100) 
    : 0;

  const isClosed = isIssueClosed(issue.closingDate);
  const timeRemaining = getTimeRemainingText(issue.closingDate);

  return {
    totalVotes,
    yesCount: issue.yesCount,
    noCount: issue.noCount,
    yesPercent,
    noPercent,
    anonymousVotes,
    anonymousPercent,
    identifiedVotes,
    identifiedPercent,
    totalPerspectives: issue.responses.length,
    voiceNotesCount,
    voicePercent,
    isClosed,
    timeRemaining
  };
}

/**
 * Returns human-friendly relative time (e.g. "just now", "5m ago", "2h ago", "yesterday", "3d ago")
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'recently';
  const time = new Date(dateString).getTime();
  if (isNaN(time)) return 'recently';
  const now = Date.now();
  const diffSec = Math.floor((now - time) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Returns the preferred public display name for a user based on their settings (defaults to @username)
 */
export function getUserDisplayName(user: UserProfile | null | undefined, fallback = 'Member'): string {
  if (!user) return fallback;
  const pref = user.displayPreference || 'username';
  if (pref === 'name') return user.name || fallback;
  if (pref === 'firstname') return user.name ? user.name.trim().split(' ')[0] : fallback;
  if (user.username) {
    const clean = user.username.replace(/^@/, '');
    return `@${clean}`;
  }
  return user.name ? user.name.trim().split(' ')[0] : fallback;
}

/**
 * Derives creator avatar, username, and preferred display name for an issue
 */
export function getAuthorDisplay(issue: Issue, currentUser?: UserProfile | null) {
  if (issue.isAnonymousAuthor) {
    return {
      displayName: 'Anonymous',
      firstName: 'Anonymous',
      fullName: 'Anonymous Neighbor',
      username: 'anonymous',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(issue.id)}`,
    };
  }

  // Current user is author
  if (
    currentUser &&
    currentUser.email &&
    issue.creatorEmail &&
    currentUser.email.toLowerCase() === issue.creatorEmail.toLowerCase()
  ) {
    const rawUsername = currentUser.username ? currentUser.username.replace(/^@/, '') : '';
    const formattedUsername = rawUsername ? `@${rawUsername}` : '';
    const firstName = currentUser.name ? currentUser.name.trim().split(' ')[0] : 'You';
    const fullName = currentUser.name;
    const pref = currentUser.displayPreference || 'username';
    const displayName = pref === 'name' ? fullName : pref === 'firstname' ? firstName : (formattedUsername || firstName);

    return {
      displayName,
      firstName,
      fullName,
      username: rawUsername || firstName.toLowerCase(),
      avatarUrl: currentUser.avatar || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(currentUser.email)}`,
    };
  }

  // Author with explicit username
  const rawCreatorUsername = issue.creatorUsername ? issue.creatorUsername.replace(/^@/, '') : '';
  const firstName = issue.author ? issue.author.trim().split(' ')[0] : 'Member';
  const fullName = issue.author || 'Civic Member';
  const displayName = rawCreatorUsername ? `@${rawCreatorUsername}` : (issue.creatorEmail === 'william.odiomonafe@gmail.com' ? '@william' : firstName);

  let avatarUrl = issue.creatorAvatar;
  if (!avatarUrl) {
    const seed = encodeURIComponent(issue.creatorEmail || issue.author || issue.id);
    avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=4f46e5,0d9488,d97706,e11d48`;
  }

  return {
    displayName,
    firstName,
    fullName,
    username: rawCreatorUsername || firstName.toLowerCase(),
    avatarUrl,
  };
}
