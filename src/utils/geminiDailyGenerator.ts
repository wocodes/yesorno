import { Issue, IssueCategory, IssueRegion } from '../types';
import { saveIssues } from './storage';

export const GEMINI_AUTHOR_EMAIL = 'william.odiomonafe@gmail.com';
export const GEMINI_AUTHOR_NAME = 'William Odiomonafe';
export const GEMINI_AUTHOR_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

const STORAGE_KEY_SLOTS = 'yesorno_gemini_daily_slots_v1';
const STORAGE_KEY_LAST_POST_TIME = 'yesorno_gemini_daily_last_post_time_v1';
const MIN_HOURS_BETWEEN_POSTS = 3;

// In-flight mutex to prevent concurrent double-executions across async ticks
const inProgressSlots = new Set<string>();

export const POLARIZING_CATEGORIES: IssueCategory[] = [
  'Counselling',
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

/**
 * Returns the single currently active time window slot:
 * - Morning: 06:00 to 11:59 (6:00 AM - 11:59 AM)
 * - Afternoon: 12:00 to 16:59 (12:00 PM - 4:59 PM)
 * - Evening: 17:00 to 23:59 (5:00 PM - 11:59 PM)
 * - Late Night (00:00 - 05:59): Returns null (no automatic posts scheduled)
 */
export function getCurrentActiveSlot(): { slot: DaySlot; slotKey: string } | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const hour = now.getHours();

  if (hour >= 6 && hour < 12) {
    return { slot: 'morning', slotKey: `${dateStr}-morning` };
  }
  if (hour >= 12 && hour < 17) {
    return { slot: 'afternoon', slotKey: `${dateStr}-afternoon` };
  }
  if (hour >= 17 && hour < 24) {
    return { slot: 'evening', slotKey: `${dateStr}-evening` };
  }
  return null;
}

/**
 * Returns an array with at most ONE currently active slot (never dumps multiple past slots)
 */
export function getEligibleSlotsForNow(): { slot: DaySlot; slotKey: string }[] {
  const active = getCurrentActiveSlot();
  return active ? [active] : [];
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
 * Curated authentic, rage-baiting Nigerian debate fallback questions by category.
 * Crafted specifically as a Nigerian for Nigerians, strictly requiring a YES or NO answer
 * with a balanced, punchy explanation of the heated debate on both sides.
 */
const CURATED_POLARIZING_QUESTIONS: Record<string, { title: string; description: string; tags: string[] }[]> = {
  'Counselling': [
    {
      title: 'Should you cancel a wedding if you discover you and your partner are both AS genotype weeks before the date?',
      description: 'Medical realists insist that subjecting an innocent child to the lifelong agony of sickle cell disease is an avoidable tragedy. Faith-driven romantics argue that modern medicine, prenatal testing, and divine miracles will prevail over biology.',
      tags: ['Counselling', 'Genotype', 'MarriageDilemma', 'Nigeria']
    },
    {
      title: 'Should you cut off your parents financially if their endless demands are draining your life savings?',
      description: 'Advocates of boundaries say generational poverty will continue unless young people protect their personal financial stability. Traditionalists insist that parents sacrificed everything to raise you and cutting them off brings generational bad luck.',
      tags: ['Counselling', 'BlackTax', 'FamilyBoundaries', 'LifeAdvice']
    },
    {
      title: 'Should a woman lend her personal emergency savings to her husband if he refuses to disclose his full business finances?',
      description: 'Supporters believe marital devotion requires standing by your spouse during financial crisis without demanding a balance sheet. Skeptics argue that blind financial rescue in the face of secrecy and poor accountability leads straight to marital regret.',
      tags: ['Counselling', 'Marriage', 'Finances', 'Trust']
    }
  ],
  'Gender': [
    {
      title: 'If a lady invites three of her female friends to a first date, should the man refuse to pay for her friends?',
      description: 'Men argue a first date is strictly an intimate get-to-know-you meeting, not a free banquet for an uninvited entourage. Defenders claim an intentional, generous gentleman should comfortably settle the entire bill without making a petty scene.',
      tags: ['Gender', 'Dating', 'FirstDateBills', 'Entitlement']
    },
    {
      title: 'Should a married woman contribute 50/50 to house rent and family upkeep if she earns more than her husband?',
      description: 'Modernists maintain that genuine equality means sharing household financial burdens in proportion to earnings. Cultural and religious traditionalists insist that providing shelter remains strictly the husband’s non-negotiable obligation.',
      tags: ['Gender', '5050Rent', 'MarriageUpkeep', 'Relationships']
    },
    {
      title: 'Should a man demand a full refund of bride price and wedding expenses if his wife cheats within the first year of marriage?',
      description: 'Aggrieved husbands argue that brazen unfaithfulness breaches the sacred marital compact and demands financial restitution. Critics counter that bride price is an ancestral family covenant of honour, not a commercial insurance policy.',
      tags: ['Gender', 'BridePrice', 'Infidelity', 'Tradition']
    }
  ],
  'Business': [
    {
      title: 'Should landlords and businesses in Nigeria be arrested if they demand rent or payment in US Dollars?',
      description: 'Economic patriots insist dollarization undermines the Naira, spikes inflation, and exploits citizens earning local salaries. Property investors argue that severe currency devaluations make Naira pricing a guaranteed capital loss.',
      tags: ['Business', 'DollarRent', 'NairaCrisis', 'RealEstate']
    },
    {
      title: 'Should young professionals leave a stable ₦2.5M monthly salary in Nigeria to take a minimum-wage care assistant job abroad?',
      description: 'Japa enthusiasts point to 24/7 electricity, physical safety, sound healthcare, and a strong foreign passport. Critics argue that swapping high executive comfort, domestic help, and dignity for grueling shift work in harsh winters is a downgrade.',
      tags: ['Business', 'JapaDilemma', 'Careers', 'Immigration']
    },
    {
      title: 'Is it ethical for POS operators to charge ₦400 fee on a ₦5,000 cash withdrawal when banking ATMs are deliberately kept dry?',
      description: 'Frustrated citizens view exorbitant POS surcharges as extortionate exploitation of everyday survival. Operators argue they queue for hours and pay hefty off-the-record fees to bank staff to procure physical cash.',
      tags: ['Business', 'POSCharges', 'BankingCrisis', 'CashEconomy']
    }
  ],
  'Workplace & Career': [
    {
      title: 'Should employees completely ignore work-related WhatsApp messages and phone calls received after 7:00 PM?',
      description: 'Mental health advocates insist that unchecked after-hours work demands induce severe depression and workplace burnout. Employers argue that in a volatile Nigerian business climate, agility and round-the-clock responsiveness keep the company alive.',
      tags: ['Workplace', 'WorkLifeBalance', 'ToxicBosses', 'Careers']
    },
    {
      title: 'Is it dishonest to work a remote US or UK tech job during the official office hours of your Nigerian employer?',
      description: 'Resourceful workers argue multiple hustles are justified survival tactics against inflation as long as core performance metrics are met. Corporate leaders contend taking two concurrent salaries on company time is contract breach and theft.',
      tags: ['Workplace', 'Overemployment', 'RemoteWork', 'TechHustle']
    },
    {
      title: 'Should Nigerian companies be prohibited by law from mandating employees to work on weekends without double pay?',
      description: 'Labour defenders say unpaid weekend labour exploits workers and destroys family life. Business owners argue project deadlines and irregular power supplies make weekend work essential for operational survival.',
      tags: ['Workplace', 'LabourRights', 'Overtime', 'CorporateNigeria']
    }
  ],
  'Family & Home': [
    {
      title: 'Should you reveal the exact amount of your monthly salary and bonuses to your extended family?',
      description: 'Traditionalists argue transparency builds trust and strengthens communal solidarity in times of need. Seasoned earners warn that publicizing your pay triggers entitlement, jealousy, and endless requests for urgent 2k.',
      tags: ['Family', 'SalarySecrecy', 'BlackTax', 'Kinship']
    },
    {
      title: 'Should parents have the right to veto their child’s choice of spouse based purely on tribe or ethnic background?',
      description: 'Elders maintain that shared cultural lineage, language, and ancestral customs protect marriage durability. The younger generation insists character, mutual love, and shared life goals supersede tribal prejudice.',
      tags: ['Family', 'Tribalism', 'MarriageBlessing', 'Tradition']
    },
    {
      title: 'Should a newly married couple allow in-laws to live with them indefinitely in their first year of marriage?',
      description: 'Family traditionalists argue accommodating parents and siblings shows African hospitality and deep respect. Relationship experts argue in-law interference in the foundational first year creates resentment and ruins marital intimacy.',
      tags: ['Family', 'InLaws', 'MaritalPrivacy', 'HomeLife']
    }
  ],
  'Religious & Faith': [
    {
      title: 'Should a Christian prioritize paying 10% monthly tithe over paying the urgent hospital bill of a critically ill parent?',
      description: 'Strict believers insist God’s covenant comes first and guarantees divine protection and supernatural provision. Critics argue scriptures condemn abandoning family welfare and that God desires mercy above religious sacrifice.',
      tags: ['Faith', 'Tithing', 'ParentCare', 'Religion']
    },
    {
      title: 'Should popular religious organizations in Nigeria be taxed like corporate business enterprises?',
      description: 'Fiscal reformers argue modern megachurches operate massive commercial universities, hotels, and fleets that should fund public infrastructure. Religious bodies contend donations are sacred charitable trusts and taxing them infringes on religious freedom.',
      tags: ['Faith', 'ChurchTax', 'PublicRevenue', 'ReligiousInstitutions']
    },
    {
      title: 'Is it wrong to stop attending your family’s traditional church because you disagree with the pastor’s political endorsements?',
      description: 'Independent worshipers believe faith is personal and spiritual spaces should never be turned into political campaign rallies. Loyalists believe leaving your home church over politics shows spiritual immaturity and disrespect for leadership.',
      tags: ['Faith', 'PulpitPolitics', 'ChurchBelonging', 'SpiritualFreedom']
    }
  ],
  'Entertainment': [
    {
      title: 'Is spraying crisp Naira notes at Owambe parties an irresponsible display of vanity in a struggling economy?',
      description: 'Critics argue public cash spraying is ostentatious, fuels currency mutilation, and mocks millions battling severe hardship. Celebrants maintain it is an indispensable, joyful cultural art form that celebrates life and honours hosts.',
      tags: ['Entertainment', 'Owambe', 'NairaSpraying', 'Culture']
    },
    {
      title: 'Should Nigerian celebrities and influencers face criminal charges for promoting unlicensed sports betting and loan apps?',
      description: 'Public welfare advocates argue influencers use their trust to trap vulnerable youth in debt, ruin, and gambling addiction. Influencers argue they are hired promoters and adult consumers must take personal responsibility for their choices.',
      tags: ['Entertainment', 'Influencers', 'BettingApps', 'Accountability']
    },
    {
      title: 'Is Afrobeats losing its authentic African essence and soul in an effort to appeal to American pop audiences?',
      description: 'Purists lament that international label formulas are watering down native rhythms, street slang, and raw social commentary. Commercial realists argue global evolution, sold-out arena tours, and Grammy recognition validate the current sound.',
      tags: ['Entertainment', 'Afrobeats', 'MusicCulture', 'NigerianMusic']
    }
  ],
  'Economy & Finance': [
    {
      title: 'Should the Federal Government completely eliminate fuel subsidies and electricity tariffs without providing immediate cash palliatives?',
      description: 'Free-market economists argue subsidies bankrupt the national treasury and subsidize smugglers instead of the truly poor. Everyday citizens argue overnight tariff hikes push millions into extreme poverty and shutter small businesses.',
      tags: ['Economy', 'FuelSubsidy', 'ElectricityTariff', 'CostOfLiving']
    },
    {
      title: 'Should cryptocurrency trading be fully recognized and integrated into Nigeria’s official banking financial system?',
      description: 'Young investors argue crypto provides a vital hedge against currency depreciation and connects tech youth to global wealth. Financial regulators worry decentralized tokens enable money laundering, capital flight, and volatile financial speculation.',
      tags: ['Economy', 'CryptoNigeria', 'CBN', 'Fintech']
    }
  ],
  'Politics & Policy': [
    {
      title: 'Should lawmakers and top political office holders in Nigeria be placed on the national minimum wage?',
      description: 'Citizens insist capping politician remuneration would end greed-driven governance and attract genuine servant-leaders. Political analysts argue elite leaders need competitive packages to deter bribery and maintain administrative capacity.',
      tags: ['Policy', 'PoliticianSalaries', 'GoodGovernance', 'CivicReform']
    },
    {
      title: 'Should Nigerians who fail to vote on election day be banned from renewing international passports and driver’s licenses?',
      description: 'Proponents argue civic apathy allows corrupt godfathers to rule and mandatory voter turnout would transform election outcomes. Civil libertarians argue the freedom to abstain is a democratic right that must not be penalized with state sanctions.',
      tags: ['Policy', 'Elections', 'VoterApathy', 'CivicDuty']
    }
  ],
  'Community & Neighborhood': [
    {
      title: 'Should estate residents be fined if their domestic dogs bark incessantly through the night and disturb neighbors?',
      description: 'Sleep-deprived neighbors argue residential peace is a fundamental right that negligent pet owners must respect. Dog owners insist guard dogs are critical security deterrents against armed robbers in residential neighborhoods.',
      tags: ['Community', 'EstateLiving', 'NeighborEtiquette', 'NoisePollution']
    },
    {
      title: 'Should street landlords lock community gates at 10:00 PM and bar late-returning tenants from driving inside?',
      description: 'Security committees argue strict gate curfews prevent armed robberies and protect vulnerable families. Late-shift workers and emergency commuters argue locking out fee-paying residents on public streets is tyrannical.',
      tags: ['Community', 'GatedEstates', 'SecurityCurfew', 'LagosLiving']
    }
  ],
  'Education & Campus': [
    {
      title: 'Is a Nigerian university degree still worth the 4 to 6 years of investment given current graduate unemployment rates?',
      description: 'Skeptics argue university curricula are hopelessly outdated and self-taught digital skills generate far higher financial returns. Traditionalists insist formal degrees open elite institutional doors and provide structured social development.',
      tags: ['Education', 'DegreeVsSkills', 'ASUU', 'YouthEmployment']
    },
    {
      title: 'Should lecturers who force university students to buy overpriced course handouts be dismissed immediately without benefits?',
      description: 'Victimized students argue mandatory handout extortion turns academics into petty traders and victimizes poor scholars. Defending lecturers claim inadequate university funding and poor lecturer salaries leave them with no alternative to cover printing.',
      tags: ['Education', 'CampusHandouts', 'UniversityReform', 'AcademicGreed']
    }
  ],
  'Environment & Climate': [
    {
      title: 'Should governments ban small portable power generators (I better pass my neighbor) in crowded residential compounds?',
      description: 'Health advocates say noxious generator fumes kill families in their sleep and cause chronic respiratory disease. Struggling families ask how they are supposed to preserve perishable food and study without national grid electricity.',
      tags: ['Environment', 'GeneratorFumes', 'PowerSector', 'PublicHealth']
    }
  ]
};

/**
 * Calls Gemini to generate a fresh, unique, and rage-baiting YES/NO question as a Nigerian for Nigerians
 */
async function fetchGeminiQuestion(category: IssueCategory, _region?: IssueRegion): Promise<{ title: string; description: string; tags: string[] }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  const prompt = `You are an expert Nigerian social commentator and viral community poll creator for the YesOrNo app.
Your task is to generate 1 unique, authentic, and rage-baiting YES/NO debate question specifically crafted as a Nigerian for Nigerians in the category "${category}".

Cultural Inspiration for Nigerian Realities:
- Dating & Marriage: 50/50 rent splitting, first date food bills, bride price refund, genotype incompatibility (AS & AS), in-laws living in the house, wedding list demands.
- Family & Survival: Black tax vs personal savings, feeding struggling parents vs sending urgent 2k to cousins, parental career pressure.
- Career & Hustle: Japa dilemmas (leaving high Lagos salary for minimum wage abroad), remote foreign tech job during Nigerian company office hours, toxic WhatsApp boss messages after 7pm.
- Faith & Society: Paying church tithes vs paying parent hospital bills, taxing megachurches, pulpit politics.
- Everyday Realities: Landlords charging rent in US Dollars, POS charges during cash scarcity, generator smoke/noise, spraying Naira at Owambe parties.

Rules:
1. Tone: Highly provocative, relatable, culturally authentic, and rage-inducing — the exact kind of question that sparks a 5,000-comment viral debate on Nigerian Twitter/X.
2. Question Format: A short, punchy question (under 16 words) starting with "Should...", "Is it wrong to...", "Would you...", or "Must a..." ending with a single "?".
3. Strict Yes/No: It must require a definitive YES or NO choice.
4. Description: Exactly 2 to 3 concise, punchy sentences explaining both sides:
   - Sentence 1: Why the YES camp passionately defends their choice.
   - Sentence 2: Why the NO camp strongly opposes or calls it absurd.
   - Sentence 3: The real-world dilemma behind the debate.
5. Language: Natural Nigerian English with universally understood cultural terms (e.g. "Japa", "black tax", "urgent 2k", "bride price", "genotype", "POS", "Owambe", "in-laws"). Clean grammar, no vulgarity.
6. Return strict JSON matching:
{
  "title": "string",
  "description": "string",
  "tags": ["string", "string", "string"]
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
  const region: IssueRegion = userRegion || 'Africa & Middle East';

  let questionData: { title: string; description: string; tags: string[] };

  try {
    questionData = await fetchGeminiQuestion(category, region);
  } catch {
    // Graceful fallback to curated bank
    const categoryBank = CURATED_POLARIZING_QUESTIONS[category] || CURATED_POLARIZING_QUESTIONS['Business'];
    questionData = categoryBank[Math.floor(Math.random() * categoryBank.length)];
  }

  const now = new Date();
  const closingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const newIssue: Issue = {
    id: `issue-daily-${slotKey}`,
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
    durationLabel: '30 Days',
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
 * Checks the single eligible daily slot for the current time of day and creates it if not already posted.
 * Strictly guarantees:
 * - At most 1 question per window (morning, afternoon, evening)
 * - Zero catch-up dump of past slots
 * - Multi-tab and multi-device in-memory & database mutex
 * - Minimum 3 hours spacing between consecutive automated posts
 */
export async function checkAndTriggerDailyGeminiPosts(
  existingIssues: Issue[],
  onNewIssuesCreated: (newIssues: Issue[]) => void,
  userRegion?: IssueRegion
): Promise<number> {
  const active = getCurrentActiveSlot();
  if (!active) {
    // Outside scheduled posting windows (e.g. night 00:00 - 05:59)
    return 0;
  }

  const { slotKey, slot } = active;

  // 1. In-flight lock: Prevent concurrent executions within the same runtime
  if (inProgressSlots.has(slotKey)) {
    return 0;
  }

  // 2. Client-side tracking: Already posted in this browser
  const completedSlots = getCompletedSlots();
  if (completedSlots.has(slotKey)) {
    return 0;
  }

  // 3. Global Feed Check: Prevent cross-device / incognito / multi-visitor duplicate posts
  const deterministicId = `issue-daily-${slotKey}`;
  const alreadyInFeed = existingIssues.some(
    issue => issue.id === deterministicId || issue.id.startsWith(`issue-daily-${slotKey}`)
  );
  if (alreadyInFeed) {
    markSlotCompleted(slotKey);
    return 0;
  }

  // 4. Rate-Limiting: Minimum 3 hours between automated posts
  try {
    const lastPostTimeStr = localStorage.getItem(STORAGE_KEY_LAST_POST_TIME);
    if (lastPostTimeStr) {
      const lastPostTime = parseInt(lastPostTimeStr, 10);
      const hoursSinceLast = (Date.now() - lastPostTime) / (1000 * 60 * 60);
      if (hoursSinceLast < MIN_HOURS_BETWEEN_POSTS) {
        return 0;
      }
    }
  } catch {
    // ignore storage errors
  }

  // Acquire in-memory lock
  inProgressSlots.add(slotKey);

  try {
    const cat = POLARIZING_CATEGORIES[Math.floor(Math.random() * POLARIZING_CATEGORIES.length)];
    const issue = await generateQuestionForSlot(slotKey, cat, userRegion);

    markSlotCompleted(slotKey);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_POST_TIME, String(Date.now()));
    } catch {
      // ignore
    }

    const updated = [issue, ...existingIssues];
    saveIssues(updated);
    onNewIssuesCreated([issue]);

    return 1;
  } catch (err) {
    console.warn(`Failed to generate daily question for ${slot}:`, err);
    return 0;
  } finally {
    inProgressSlots.delete(slotKey);
  }
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
