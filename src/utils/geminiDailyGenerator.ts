import { Issue, IssueCategory, IssueRegion } from '../types';
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
 * Curated simple, polarizing everyday fallback questions by category
 */
const CURATED_POLARIZING_QUESTIONS: Record<string, { title: string; description: string; tags: string[] }[]> = {
  'Business': [
    {
      title: 'Should stores and restaurants be required to accept cash payments?',
      description: 'Supporters say rejecting cash excludes the elderly, unbanked, and privacy-conscious. Business owners argue cashless checkout is faster, cleaner, and safer from theft.',
      tags: ['Business', 'Money', 'Shopping']
    },
    {
      title: 'Should tip prompts be banned at self-service takeout counters?',
      description: 'Customers feel pressured by digital tip screens for simple grab-and-go orders. Workers argue tip pooling supplements their hourly base wage in high-cost cities.',
      tags: ['Business', 'Tipping', 'Dining']
    },
    {
      title: 'Should companies be banned from sending work messages after hours?',
      description: 'Advocates say workers deserve protected rest to prevent burnout. Employers contend flexible hours require asynchronous communication across time zones.',
      tags: ['Business', 'WorkLife', 'Productivity']
    }
  ],
  'Gender': [
    {
      title: 'Should men and women always split the bill 50/50 on a first date?',
      description: 'Many argue that splitting evenly establishes mutual respect and modern equality right away. Traditionalists maintain that whoever asks for the date should gladly treat.',
      tags: ['Gender', 'Dating', 'Relationships']
    },
    {
      title: 'Should paternity leave for new fathers be mandatory rather than optional?',
      description: 'Proponents say mandatory leave supports mothers, reduces career penalties, and bonds dads with infants. Critics say families should be free to decide what works best for them.',
      tags: ['Gender', 'Parenting', 'Family']
    },
    {
      title: 'Should professional sports offer identical prize money for men and women?',
      description: 'Supporters believe equal athletic dedication deserves equal financial prize money. Detractors argue tournament purses must reflect broadcast audience and ticket revenue.',
      tags: ['Gender', 'Sports', 'EqualPay']
    }
  ],
  'Entertainment': [
    {
      title: 'Should concert and comedy venues lock smartphones in pouches during shows?',
      description: 'Fans and artists say phone bans restore full immersion without bright screens blocking views. Opponents believe paying attendees should be free to capture their own memories.',
      tags: ['Entertainment', 'LiveMusic', 'Smartphones']
    },
    {
      title: 'Is movie theater culture dying because of home streaming platforms?',
      description: 'Cinema lovers insist nothing matches the collective magic of a giant screen and auditorium audio. Others prefer the convenience, comfort, and affordability of streaming on the couch.',
      tags: ['Entertainment', 'Movies', 'Streaming']
    },
    {
      title: 'Should video games ban paid loot boxes and random cosmetic microtransactions?',
      description: 'Parents and consumer advocates argue loot boxes mimic gambling and exploit younger players. Game studios argue microtransactions keep big-budget online games free to play.',
      tags: ['Entertainment', 'Gaming', 'ConsumerProtection']
    }
  ],
  'Workplace & Career': [
    {
      title: 'Should remote workers be paid less if they relocate to a cheaper city?',
      description: 'Companies argue compensation packages should match local living costs. Workers argue salary should reward the exact same output and value regardless of address.',
      tags: ['Workplace', 'RemoteWork', 'Salary']
    },
    {
      title: 'Should a 4-day work week (32 hours) with no pay cut become standard?',
      description: 'Global trials show a four-day week improves worker wellness and boosts productivity. Employers worry about coverage in emergency services, healthcare, and hospitality.',
      tags: ['Workplace', '4DayWeek', 'Careers']
    },
    {
      title: 'Should companies allow employees to talk openly about their salaries?',
      description: 'Pay openness protects workers from unfair bias and hidden underpayment. Skeptics worry that seeing coworker pay causes jealousy and team tension.',
      tags: ['Workplace', 'Transparency', 'Compensation']
    }
  ],
  'Politics & Policy': [
    {
      title: 'Should voting in national elections be legally mandatory for all adult citizens?',
      description: 'Countries with mandatory voting enjoy over 90% civic participation and broader representation. Opponents argue the right to abstain is a fundamental democratic freedom.',
      tags: ['Policy', 'Elections', 'Democracy']
    },
    {
      title: 'Should public city transit be completely free for all local residents?',
      description: 'Supporters argue zero-fare buses and trains cut traffic congestion, pollution, and poverty. Critics worry transit systems would face severe funding shortages and quality drops.',
      tags: ['Policy', 'Transit', 'CityLife']
    }
  ],
  'Community & Neighborhood': [
    {
      title: 'Should residential neighborhoods ban short-term Airbnb rentals year-round?',
      description: 'Local residents argue vacation rentals inflate neighborhood rents and bring noise. Homeowners contend they should have full freedom to earn income from their own property.',
      tags: ['Community', 'Housing', 'Neighborhood']
    },
    {
      title: 'Should residential street parking remain free for all car owners?',
      description: 'Drivers argue public roads are paid for by taxes and parking should be free. Urban planners believe free parking encourages car dependency and wastes public space.',
      tags: ['Community', 'Parking', 'UrbanLiving']
    }
  ],
  'Education & Campus': [
    {
      title: 'Should smartphones be completely banned in schools from bell to bell?',
      description: 'Educators report dramatic improvements in classroom focus, student mental health, and test scores. Parents and students argue phones are necessary for safety and coordination.',
      tags: ['Education', 'Schools', 'Smartphones']
    },
    {
      title: 'Should universities replace traditional letter grades with pass or fail ratings?',
      description: 'Advocates say pass/fail systems lower anxiety and foster a deeper love of learning. Opponents say grades motivate effort and give employers a clear measure of academic skill.',
      tags: ['Education', 'College', 'Grading']
    }
  ],
  'Environment & Climate': [
    {
      title: 'Should cities ban single-use plastic water bottles in public parks and events?',
      description: 'Environmental advocates say plastic bans cut microplastic pollution and landfill waste. Opponents argue plastic bottles provide convenient and safe hydration on hot days.',
      tags: ['Environment', 'Plastics', 'CleanEnergy']
    }
  ],
  'Family & Home': [
    {
      title: 'Should parents monitor their teenagers’ private text messages and social media?',
      description: 'Proponents say digital monitoring shields children from cyberbullying and predators. Opponents argue invading privacy damages family trust and stunts emotional maturity.',
      tags: ['Family', 'Parenting', 'Privacy']
    }
  ]
};

/**
 * Calls Gemini to generate a fresh, simple, and polarizing YES/NO question
 */
async function fetchGeminiQuestion(category: IssueCategory, region?: IssueRegion): Promise<{ title: string; description: string; tags: string[] }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  const regionPromptContext = region && region !== 'Global / Remote'
    ? `Ground the topic in everyday cultural, civic, or lifestyle realities relevant to people living in "${region}".`
    : `Focus on globally relatable modern lifestyle and everyday civic dilemmas.`;

  const prompt = `You are an engaging community poll writer for the YesOrNo app.
Generate 1 simple, relatable, and polarizing YES/NO question for the category "${category}".
${regionPromptContext}

Rules:
1. Simplicity: Use plain, conversational, everyday language (around 7th grade reading level). Avoid dense, academic, legalistic, or complex corporate jargon.
2. Question Format: A short, punchy question (under 14 words) starting with "Should...?" or "Is it time to...?" ending with "?".
3. Polarization: Both YES and NO must be natural, defensible opinions that everyday people argue about.
4. Description: Exactly 2 brief, simple sentences (Sentence 1: What supporters say. Sentence 2: What critics say).
5. Return strict JSON matching:
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
 * Generates an issue for a specific slot, category, and user region
 */
export async function generateQuestionForSlot(
  slotKey: string, 
  preferredCategory?: IssueCategory,
  userRegion?: IssueRegion
): Promise<Issue> {
  const category = preferredCategory || POLARIZING_CATEGORIES[Math.floor(Math.random() * POLARIZING_CATEGORIES.length)];
  const region = userRegion || 'Global / Remote';

  let questionData: { title: string; description: string; tags: string[] };

  try {
    questionData = await fetchGeminiQuestion(category, region);
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
    region,
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
  onNewIssuesCreated: (newIssues: Issue[]) => void,
  userRegion?: IssueRegion
): Promise<number> {
  const eligibleSlots = getEligibleSlotsForNow();
  const completedSlots = getCompletedSlots();

  const toGenerate = eligibleSlots.filter(s => !completedSlots.has(s.slotKey));
  if (toGenerate.length === 0) return 0;

  const created: Issue[] = [];

  for (const { slotKey, slot } of toGenerate) {
    try {
      const cat = POLARIZING_CATEGORIES[Math.floor(Math.random() * POLARIZING_CATEGORIES.length)];
      const issue = await generateQuestionForSlot(slotKey, cat, userRegion);
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
 * On-demand generator trigger
 */
export async function generatePolarizingQuestionNow(
  category?: IssueCategory,
  userRegion?: IssueRegion
): Promise<Issue> {
  const customSlotKey = `manual-${Date.now()}`;
  return generateQuestionForSlot(customSlotKey, category, userRegion);
}
