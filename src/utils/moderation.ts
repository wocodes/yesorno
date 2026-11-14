import { ModerationResult, IssueFlagReport } from '../types';

// Curated list of offensive terms, slurs, abusive phrases, and aggressive personal attack patterns
const HARMFUL_TERMS = [
  'idiot', 'stupid', 'moron', 'dumb', 'clown', 'scum', 'shut up', 'hate you',
  'bastard', 'bitch', 'asshole', 'loser', 'trash', 'filth', 'kill yourself',
  'die', 'pig', 'retard', 'freak', 'liar', 'corrupt scum', 'psycho',
  'bullshit', 'fuck', 'shit', 'crap', 'cunt', 'dick', 'piss off'
];

// Patterns for personal contact info leaks (doxxing protection)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

/**
 * Checks text against community safety guidelines.
 * Returns moderation status with specific guidance if rejected.
 */
export function moderateText(text: string): ModerationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      isAppropriate: true,
      flags: [],
      severity: 'clean',
    };
  }

  const lower = trimmed.toLowerCase();
  const matchedFlags: string[] = [];

  // Check for abusive or derogatory words
  for (const term of HARMFUL_TERMS) {
    // Word boundary match
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lower)) {
      matchedFlags.push(`Disrespectful or offensive term detected: "${term}"`);
    }
  }

  // Check for doxxing/contact sharing
  if (EMAIL_REGEX.test(trimmed)) {
    matchedFlags.push('Personal email address detected (protect community privacy)');
  }
  if (PHONE_REGEX.test(trimmed)) {
    matchedFlags.push('Phone number detected (avoid sharing personal contact details)');
  }

  // Check for excessive caps (aggressive shouting)
  if (trimmed.length > 20) {
    const letters = trimmed.replace(/[^a-zA-Z]/g, '');
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
    if (letters.length > 10 && upperCount / letters.length > 0.75) {
      matchedFlags.push('Excessive capital letters (avoid shouting in community discussions)');
    }
  }

  if (matchedFlags.length > 0) {
    // If it's just excessive caps, treat as warning, else rejection
    const isOnlyCaps = matchedFlags.every(f => f.includes('Excessive capital letters'));
    return {
      isAppropriate: false,
      flags: matchedFlags,
      severity: isOnlyCaps ? 'warning' : 'rejected',
      suggestedAction: isOnlyCaps
        ? 'Please use standard sentence casing to keep discussions calm and friendly.'
        : 'Please rephrase your note constructively without personal attacks or offensive language.'
    };
  }

  return {
    isAppropriate: true,
    flags: [],
    severity: 'clean',
  };
}

/**
 * Validates whether an issue title can serve as a binary YES/NO question or poll proposition.
 * Supports:
 * - Direct questions ending in "?" (e.g. "Should remote work be standard?")
 * - Short sharp propositions (e.g. "Ban plastic bags?", "End NYSC now?")
 * - Statement preambles followed by a question (e.g. "Fuel subsidy removed: should it return?")
 * - Binary choice or tag inquiries (e.g. "50/50 rent in marriage: Yes or No?", "Remote workers are more productive, agree?")
 */
export function validateIssueQuestion(title: string): {
  isQuestion: boolean;
  severity: 'valid' | 'warning' | 'invalid';
  reason?: string;
  suggestion?: string;
} {
  const trimmed = title.trim();
  if (trimmed.length < 5) {
    return {
      isQuestion: false,
      severity: 'invalid',
      reason: 'Question is too short (must be at least 5 characters).',
      suggestion: 'Type a question or binary proposition that voters can answer YES or NO.'
    };
  }

  const hasQuestionMark = trimmed.includes('?');

  // Any title ending with or containing a question mark is treated as a valid debate question
  if (hasQuestionMark) {
    return {
      isQuestion: true,
      severity: 'valid'
    };
  }

  // Check for binary polarity phrases anywhere in the statement (e.g. "Yes or No", "Agree or Disagree")
  const binaryPolarityPattern = /\b(yes\s+or\s+no|agree\s+or\s+disagree|support\s+or\s+oppose|fair\s+or\s+unfair|right\s+or\s+wrong|true\s+or\s+false|good\s+or\s+bad)\b/i;
  const hasBinaryPrompt = binaryPolarityPattern.test(trimmed);

  // Check for question starter words at the start of the title OR right after a clause separator (colon, dash, period, semicolon, newline)
  const clauseQuestionPattern = /(?:^|[:;\-—.\n])\s*(should|is|are|do|does|did|can|could|would|will|shall|has|have|was|were|must|ought|am)\b/i;
  const hasQuestionClause = clauseQuestionPattern.test(trimmed);

  // Check for direct proposition starters (e.g. "Ban commercial bikes", "Legalize cannabis", "Abolish bride price")
  const propositionStarters = ['ban', 'legalize', 'scrap', 'end', 'abolish', 'mandate', 'prohibit', 'tax', 'allow'];
  const firstWord = (trimmed.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  const isProposition = propositionStarters.includes(firstWord);

  // If the user included a question clause, binary tag, or proposition but simply omitted the '?'
  if (hasQuestionClause || hasBinaryPrompt || isProposition) {
    return {
      isQuestion: true,
      severity: 'valid'
    };
  }

  // Pure declarative starters without a question mark or question phrasing
  const declarativeStarters = [
    'i think', 'i believe', 'we must', 'we need to', 'everyone knows',
    'the problem is', 'it sucks', 'never', 'in my opinion'
  ];
  const startsWithDeclarative = declarativeStarters.some(starter => 
    trimmed.toLowerCase().startsWith(starter)
  );

  if (startsWithDeclarative) {
    return {
      isQuestion: false,
      severity: 'warning',
      reason: 'This reads like a personal statement or opinion rather than a binary poll.',
      suggestion: 'Frame it with a question mark "?" or a clear dilemma (e.g. "... should this be allowed?" or "... do you agree?").'
    };
  }

  // General statement fallback
  return {
    isQuestion: false,
    severity: 'warning',
    reason: 'This does not appear to be a question or binary proposition.',
    suggestion: 'YesOrNo works best with questions or topics voters can answer YES or NO to. Tip: End with a question mark "?" or add a clear dilemma.'
  };
}

const STORAGE_KEY_FLAG_REPORTS = 'yesorno_issue_flags_v1';

/**
 * Records a community flag report for an issue
 */
export function recordIssueFlag(report: IssueFlagReport): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLAG_REPORTS);
    const reports: IssueFlagReport[] = raw ? JSON.parse(raw) : [];
    reports.push(report);
    localStorage.setItem(STORAGE_KEY_FLAG_REPORTS, JSON.stringify(reports));
  } catch (err) {
    console.warn('Failed to save issue flag report:', err);
  }
}

/**
 * Retrieves all stored flag reports
 */
export function getStoredFlagReports(): IssueFlagReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLAG_REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Generates an anonymous civic alias for users who vote anonymously
 */
export function generateCivicAlias(): string {
  const titles = [
    'Civic Neighbor', 'Concerned Resident', 'Local Commuter',
    'Community Member', 'Ward Resident', 'Area Homeowner',
    'Local Pedestrian', 'Active Citizen', 'District Voter'
  ];
  const num = Math.floor(100 + Math.random() * 900);
  const title = titles[Math.floor(Math.random() * titles.length)];
  return `${title} #${num}`;
}
