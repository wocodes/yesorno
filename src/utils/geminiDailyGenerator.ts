import { Issue, IssueCategory } from '../types';
import { saveIssues } from './storage';

export const GEMINI_AUTHOR_EMAIL = 'william.odiomonafe@gmail.com';
export const GEMINI_AUTHOR_NAME = 'William Odiomonafe';
export const GEMINI_AUTHOR_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

const STORAGE_KEY_SLOTS = 'yesorno_gemini_daily_slots_v1';

export const POLARIZING_CATEGORIES: IssueCategory[] = [
  'Business',
  'Gender',
  'Entertainment',
  'Workplace & Career',
  'Politics & Policy',
  'Economy & Finance',
  'Family & Home',
  'Community & Neighborhood',
  'Environment & Climate',
  'Education & Campus',
  'Religious & Faith'
];

export type DaySlot = 'morning' | 'afternoon' | 'evening';

export function getEligibleSlotsForNow(): { slot: DaySlot; slotKey: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const hour = now.getHours();

  const eligible: { slot: DaySlot; slotKey: string }[] = [];

  // Morning: 06:00 onwards
  if (hour >= 6) {
    eligible.push({ slot: 'morning', slotKey: `${dateStr}-morning` });
  }
  // Afternoon: 12:00 onwards
  if (hour >= 12) {
    eligible.push({ slot: 'afternoon', slotKey: `${dateStr}-afternoon` });
  }
  // Evening: 17:00 onwards
  if (hour >= 17) {
    eligible.push({ slot: 'evening', slotKey: `${dateStr}-evening` });
  }

  return eligible;
}

export function getCompletedSlots(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markSlotCompleted(slotKey: string): void {
  try {
    const set = getCompletedSlots();
    set.add(slotKey);
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore
  }
}

/**
 * Curated polarizing fallback questions by category if Gemini API key is unset or network fails
 */
const CURATED_POLARIZING_QUESTIONS: Record<string, { title: string; description: string; tags: string[] }[]> = {
  'Business': [
    {
      title: 'Should startup founders be legally barred from taking executive bonuses before reaching profitability?',
      description: 'Supporters argue this aligns leadership pay with real fiscal responsibility and worker security. Opponents contend that high compensation is necessary to attract top venture talent.',
      tags: ['Business', 'Startups', 'ExecutivePay']
    },
    {
      title: 'Should private companies with over 50 employees be required to disclose all employee salaries internally?',
      description: 'Pay transparency advocates argue it eliminates unfair wage gaps and nepotism. Critics argue it causes unnecessary workplace friction and reduces competitive hiring flexibility.',
      tags: ['Business', 'SalaryTransparency', 'Management']
    },
    {
      title: 'Should venture capitalists face liability if their portfolio companies engage in anti-competitive acquisitions?',
      description: 'Proponents argue unchecked startup rollups destroy market innovation. Investors counter that holding financiers liable would choke seed funding for early-stage enterprise.',
      tags: ['Business', 'VentureCapital', 'Monopoly']
    }
  ],
  'Gender': [
    {
      title: 'Should corporate boards be required by law to maintain at least 40% gender parity?',
      description: 'Proponents point to accelerated diversity and proven governance improvements across international markets. Critics maintain appointments should remain strictly merit-based without state quotas.',
      tags: ['Gender', 'Governance', 'Boardrooms']
    },
    {
      title: 'Should companies offer equal paid parental leave to fathers and mothers regardless of who is the primary caregiver?',
      description: 'Advocates say equal leave breaks the motherhood career penalty and encourages shared parenting. Skeptics argue small businesses cannot bear the cost of extended dual leaves.',
      tags: ['Gender', 'ParentalLeave', 'WorkplaceEquity']
    },
    {
      title: 'Should professional sports leagues eliminate gender-separated prize money for identical tournament lengths?',
      description: 'Supporters insist equal athletic dedication deserves equal financial reward. Opponents argue prize purses must reflect viewer ratings, ticket sales, and broadcast market revenue.',
      tags: ['Gender', 'Sports', 'EqualPay']
    }
  ],
  'Entertainment': [
    {
      title: 'Should AI-generated music and digital actor likenesses require explicit consent and ongoing royalty shares for life?',
      description: 'Artists argue digital cloning destroys human creative livelihood. Tech studios claim synthetic media is a natural artistic evolution that democratizes film and sound production.',
      tags: ['Entertainment', 'AI', 'Copyright']
    },
    {
      title: 'Should streaming platforms be prohibited from permanently deleting original films and series from their libraries?',
      description: 'Advocates for cultural preservation say corporate write-offs erase modern cinema history. Streaming executives argue maintaining inactive titles incurs untenable server and residual costs.',
      tags: ['Entertainment', 'Streaming', 'FilmPreservation']
    },
    {
      title: 'Should live ticket sales implement legally capped resale markups to stop scalping bots?',
      description: 'Concertgoers argue ticket gouging prices real fans out of live events. Free-market defenders say secondary pricing reflects genuine consumer demand.',
      tags: ['Entertainment', 'Concerts', 'TicketScalping']
    }
  ],
  'Workplace & Career': [
    {
      title: 'Should companies have the right to monitor employee keystrokes and screen activity during remote work hours?',
      description: 'Employers claim surveillance protects proprietary data and ensures fair output. Workers argue it violates personal dignity and breeds burnout.',
      tags: ['Workplace', 'RemoteWork', 'Privacy']
    },
    {
      title: 'Should a 4-day work week (32 hours) with zero reduction in pay become the national standard?',
      description: 'Studies indicate higher worker productivity and morale with lower absenteeism. Opponents worry about service industry scheduling and inflation.',
      tags: ['Workplace', '4DayWeek', 'Labor']
    }
  ],
  'Politics & Policy': [
    {
      title: 'Should age limits be established for all elected public officials and federal judges?',
      description: 'Advocates argue governance needs generational agility and cognitive resilience. Detractors argue age caps discriminate against experienced statespeople and restrict voter choice.',
      tags: ['Policy', 'Elections', 'TermLimits']
    },
    {
      title: 'Should public voting day be declared a national paid civic holiday?',
      description: 'Proponents say removing work obligations drastically increases democratic participation. Opponents argue mail-in and early voting already provide sufficient voting access.',
      tags: ['Policy', 'Democracy', 'Civics']
    }
  ]
};

/**
 * Calls Gemini to generate a fresh, polarizing YES/NO question for a given category
 */
async function fetchGeminiQuestion(category: IssueCategory): Promise<{ title: string; description: string; tags: string[] }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  const prompt = `You are an elite civic deliberation moderator.
Generate 1 sharply polarizing, thought-provoking, and balanced YES/NO civic question for the category "${category}".
Criteria:
1. Title must be a concise, direct yes/no question starting with "Should...?" or "Is it time to...?".
2. Both YES and NO must have deep, compelling, passionate rationale supported by real-world principles.
3. Description must be exactly 2 clear sentences providing neutral context and framing both sides without taking a side.
4. Return strict JSON matching:
{
  "title": "string",
  "description": "string",
  "tags": ["string", "string"]
}`;

  const res = await fetch(
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

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.statusText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('No content from Gemini');

  const parsed = JSON.parse(rawText);
  if (!parsed.title || !parsed.description) throw new Error('Incomplete JSON from Gemini');

  return {
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : [category, 'Debate']
  };
}

/**
 * Generates an issue for a specific slot and category
 */
export async function generateQuestionForSlot(slotKey: string, preferredCategory?: IssueCategory): Promise<Issue> {
  const category = preferredCategory || POLARIZING_CATEGORIES[Math.floor(Math.random() * POLARIZING_CATEGORIES.length)];

  let questionData: { title: string; description: string; tags: string[] };

  try {
    questionData = await fetchGeminiQuestion(category);
  } catch {
    // Graceful fallback to curated bank
    const categoryBank = CURATED_POLARIZING_QUESTIONS[category] || CURATED_POLARIZING_QUESTIONS['Business'];
    questionData = categoryBank[Math.floor(Math.random() * categoryBank.length)];
  }

  const now = new Date();
  const closingDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const newIssue: Issue = {
    id: `issue-daily-${slotKey}-${Math.random().toString(36).substring(2, 6)}`,
    title: questionData.title,
    description: questionData.description,
    category,
    region: 'Global / Remote',
    tags: questionData.tags,
    author: GEMINI_AUTHOR_NAME,
    creatorEmail: GEMINI_AUTHOR_EMAIL,
    creatorAvatar: GEMINI_AUTHOR_AVATAR,
    createdAt: now.toISOString(),
    closingDate,
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 0,
    noCount: 0,
    likesCount: 0,
    favoritesCount: 0,
    responses: [],
    featured: true
  };

  return newIssue;
}

/**
 * Checks eligible daily slots for today and creates missing ones
 */
export async function checkAndTriggerDailyGeminiPosts(
  existingIssues: Issue[],
  onNewIssuesCreated: (newIssues: Issue[]) => void
): Promise<number> {
  const eligibleSlots = getEligibleSlotsForNow();
  const completedSlots = getCompletedSlots();

  const toGenerate = eligibleSlots.filter(s => !completedSlots.has(s.slotKey));
  if (toGenerate.length === 0) return 0;

  const created: Issue[] = [];

  for (const { slotKey, slot } of toGenerate) {
    try {
      // Pick random category ensuring diversity across the day
      const cat = POLARIZING_CATEGORIES[Math.floor(Math.random() * POLARIZING_CATEGORIES.length)];
      const issue = await generateQuestionForSlot(slotKey, cat);
      created.push(issue);
      markSlotCompleted(slotKey);
    } catch (err) {
      console.warn(`Failed to generate daily question for ${slot}:`, err);
    }
  }

  if (created.length > 0) {
    const updated = [...created, ...existingIssues];
    saveIssues(updated);
    onNewIssuesCreated(created);
  }

  return created.length;
}

/**
 * On-demand generator trigger (useful for testing or admin manual trigger)
 */
export async function generatePolarizingQuestionNow(
  category?: IssueCategory
): Promise<Issue> {
  const customSlotKey = `manual-${Date.now()}`;
  return generateQuestionForSlot(customSlotKey, category);
}
