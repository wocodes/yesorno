import { ModerationResult } from '../types';

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
