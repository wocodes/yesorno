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
 * Crafted specifically as a Nigerian for Nigerians, strictly requiring a YES or NO answer.
 * Includes short sharp direct questions, statement preambles + questions, and direct binary hot-takes
 * with punchy, high-voltage perspectives explaining both sides of the heated Nigerian reality.
 */
const CURATED_POLARIZING_QUESTIONS: Record<string, { title: string; description: string; tags: string[] }[]> = {
  'Counselling': [
    {
      title: 'Genotype AS marrying another AS: pure wickedness or personal faith?',
      description: 'Medical realists insist that subjecting an innocent child to the lifelong agony of sickle cell disease is an avoidable tragedy. Faith-driven romantics argue that modern prenatal medicine and divine miracles supersede biology.',
      tags: ['Counselling', 'Genotype', 'MarriageDilemma', 'Nigeria']
    },
    {
      title: 'Cut off toxic parents who drain your finances with endless black tax: Yes or No?',
      description: 'Advocates of boundaries say generational poverty will continue unless young people protect their personal financial stability. Traditionalists insist that parents sacrificed everything to raise you and cutting them off brings generational bad luck.',
      tags: ['Counselling', 'BlackTax', 'FamilyBoundaries', 'LifeAdvice']
    },
    {
      title: 'Should you cancel a wedding if your partner refuses full financial disclosure weeks before the date?',
      description: 'Financial realists argue that entering marriage in the dark about heavy personal debts or secret loans is guaranteed divorce. Traditionalists argue trust is built over time and interrogation before the altar ruins romance.',
      tags: ['Counselling', 'Marriage', 'Finances', 'Trust']
    },
    {
      title: 'Checking your partner’s WhatsApp chats without permission: justified?',
      description: 'Realists argue that privacy should never cover deceit and secret infidelity destroys families from the inside. Defenders of personal space insist snooping reveals crippling insecurity and is toxic behavior.',
      tags: ['Counselling', 'Privacy', 'Infidelity', 'Relationships']
    }
  ],
  'Gender': [
    {
      title: 'First date with 3 uninvited friends: refuse to pay the bill?',
      description: 'Men argue a first date is strictly an intimate get-to-know-you meeting, not a free buffet for an uninvited entourage. Defenders claim an intentional, generous gentleman should comfortably settle the entire bill without making a petty scene.',
      tags: ['Gender', 'Dating', 'FirstDateBills', 'Entitlement']
    },
    {
      title: '50/50 rent in marriage: Yes or No?',
      description: 'Modernists maintain that genuine equality means sharing household financial burdens in proportion to earnings. Cultural and religious traditionalists insist that providing shelter remains strictly the husband’s non-negotiable obligation.',
      tags: ['Gender', '5050Rent', 'MarriageUpkeep', 'Relationships']
    },
    {
      title: 'A man earning ₦150,000 has no business dating in Lagos: agree?',
      description: 'Pragmatists argue that with surging transport, food, and social outing costs, dating on a ₦150k wage leads straight into debt. Romantic humanists counter that affection, loyalty, and companionship are human rights not reserved for high earners.',
      tags: ['Gender', 'DatingInLagos', 'CostOfLiving', 'Relationships']
    },
    {
      title: 'Should a man demand a full refund of bride price and wedding expenses if his wife cheats within the first year of marriage?',
      description: 'Aggrieved husbands argue that brazen unfaithfulness breaches the sacred marital compact and demands financial restitution. Critics counter that bride price is an ancestral family covenant of honour, not a commercial insurance policy.',
      tags: ['Gender', 'BridePrice', 'Infidelity', 'Tradition']
    }
  ],
  'Business': [
    {
      title: 'POS operators charging ₦500 per withdrawal: pure extortion?',
      description: 'Frustrated citizens view exorbitant POS surcharges as extortionate exploitation of everyday survival during cash scarcity. Operators argue they queue for hours and pay heavy off-the-record fees to bank staff to procure physical cash.',
      tags: ['Business', 'POSCharges', 'BankingCrisis', 'CashEconomy']
    },
    {
      title: 'Market women arbitrarily hiking food prices: should government enforce emergency price caps?',
      description: 'Consumers argue that greedy cartels in open markets inflate tomato and yam prices overnight without justifiable economic cause. Traders argue that skyrocketing diesel costs, multiple highway police extortion checkpoints, and post-harvest losses dictate prices.',
      tags: ['Business', 'FoodInflation', 'PriceControl', 'MarketRealities']
    },
    {
      title: 'Landlords demanding 2 years rent upfront: should it be criminalized?',
      description: 'Tenants argue that forcing workers earning monthly salaries to cough up 24 months of rent in one lump sum fuels corruption and eviction crises. Property developers argue tenant default rates and zero tenancy insurance make multi-year deposits essential.',
      tags: ['Business', 'LagosRent', 'TenantRights', 'RealEstate']
    },
    {
      title: 'Should landlords and businesses in Nigeria be arrested if they demand payment in US Dollars?',
      description: 'Economic patriots insist dollarization undermines the Naira, spikes inflation, and exploits citizens earning local salaries. Property investors argue that severe currency devaluations make Naira pricing a guaranteed capital loss.',
      tags: ['Business', 'DollarRent', 'NairaCrisis', 'RealEstate']
    }
  ],
  'Workplace & Career': [
    {
      title: 'Weekend WhatsApp messages from your boss: ignore them completely?',
      description: 'Mental health advocates insist that unchecked after-hours work demands induce severe depression and workplace burnout. Employers argue that in a volatile Nigerian business climate, agility and round-the-clock responsiveness keep the company alive.',
      tags: ['Workplace', 'WorkLifeBalance', 'ToxicBosses', 'Careers']
    },
    {
      title: 'Working a remote USD job during Nigerian employer office hours: theft or hustle?',
      description: 'Resourceful workers argue multiple hustles are justified survival tactics against inflation as long as core performance metrics are met. Corporate leaders contend taking two concurrent salaries on company time is contract breach and theft.',
      tags: ['Workplace', 'Overemployment', 'RemoteWork', 'TechHustle']
    },
    {
      title: 'Japa debate: leave a stable ₦2.5M Lagos executive salary for a UK minimum-wage care shift?',
      description: 'Japa enthusiasts point to 24/7 electricity, physical safety, sound healthcare, and a strong foreign passport. Critics argue that swapping high executive comfort, domestic help, and dignity for grueling shift work in harsh winters is a downgrade.',
      tags: ['Workplace', 'JapaDilemma', 'Careers', 'Immigration']
    },
    {
      title: 'Tech companies mandating 5-day office returns: is remote work truly dead?',
      description: 'Executives argue that in-person collaboration, apprentice mentoring, and operational discipline are lost in Zoom calls. Tech professionals counter that grueling 4-hour daily third-mainland-bridge commutes destroy productivity and mental health.',
      tags: ['Workplace', 'ReturnToOffice', 'RemoteWork', 'LagosTraffic']
    }
  ],
  'Family & Home': [
    {
      title: 'Reveal the exact amount of your monthly salary to your extended family: Yes or No?',
      description: 'Traditionalists argue transparency builds trust and strengthens communal solidarity in times of need. Seasoned earners warn that publicizing your pay triggers entitlement, jealousy, and endless requests for urgent 2k.',
      tags: ['Family', 'SalarySecrecy', 'BlackTax', 'Kinship']
    },
    {
      title: 'In-laws moving into a couple’s home during the first year of marriage: allow it?',
      description: 'Family traditionalists argue accommodating parents and siblings shows African hospitality and deep respect. Relationship experts argue in-law interference in the foundational first year creates resentment and ruins marital intimacy.',
      tags: ['Family', 'InLaws', 'MaritalPrivacy', 'HomeLife']
    },
    {
      title: 'Parents vetoing a child’s choice of spouse based purely on tribe: acceptable?',
      description: 'Elders maintain that shared cultural lineage, language, and ancestral customs protect marriage durability. The younger generation insists character, mutual love, and shared life goals supersede tribal prejudice.',
      tags: ['Family', 'Tribalism', 'MarriageBlessing', 'Tradition']
    }
  ],
  'Religious & Faith': [
    {
      title: 'Pay church tithe before paying the urgent hospital bill of a sick parent: Yes or No?',
      description: 'Strict believers insist God’s covenant comes first and guarantees divine protection and supernatural provision. Critics argue scriptures condemn abandoning family welfare and that God desires mercy above religious sacrifice.',
      tags: ['Faith', 'Tithing', 'ParentCare', 'Religion']
    },
    {
      title: 'Megachurches and commercial religious institutions: tax them like businesses?',
      description: 'Fiscal reformers argue modern megachurches operate massive commercial universities, hotels, and fleets that should fund public infrastructure. Religious bodies contend donations are sacred charitable trusts and taxing them infringes on religious freedom.',
      tags: ['Faith', 'ChurchTax', 'PublicRevenue', 'ReligiousInstitutions']
    },
    {
      title: 'Stop attending family church because the pastor endorses corrupt politicians: justified?',
      description: 'Independent worshipers believe faith is personal and spiritual spaces should never be turned into political campaign rallies. Loyalists believe leaving your home church over politics shows spiritual immaturity and disrespect for leadership.',
      tags: ['Faith', 'PulpitPolitics', 'ChurchBelonging', 'SpiritualFreedom']
    }
  ],
  'Entertainment': [
    {
      title: 'Spraying crisp Naira notes at Owambe parties: arrest celebrants on the spot?',
      description: 'Critics argue public cash spraying is ostentatious, fuels currency mutilation, and mocks millions battling severe hardship. Celebrants maintain it is an indispensable, joyful cultural art form that celebrates life and honours hosts.',
      tags: ['Entertainment', 'Owambe', 'NairaSpraying', 'Culture']
    },
    {
      title: 'Influencers promoting unlicensed sports betting apps to vulnerable youth: jail time?',
      description: 'Public welfare advocates argue influencers use their trust to trap vulnerable youth in debt, ruin, and gambling addiction. Influencers argue they are hired promoters and adult consumers must take personal responsibility for their choices.',
      tags: ['Entertainment', 'Influencers', 'BettingApps', 'Accountability']
    },
    {
      title: 'Afrobeats going global: has it lost its authentic Nigerian street soul?',
      description: 'Purists lament that international label formulas are watering down native rhythms, street slang, and raw social commentary. Commercial realists argue global evolution, sold-out arena tours, and Grammy recognition validate the current sound.',
      tags: ['Entertainment', 'Afrobeats', 'MusicCulture', 'NigerianMusic']
    }
  ],
  'Economy & Finance': [
    {
      title: 'Floating the Naira: the single worst economic policy in 20 years?',
      description: 'Critics argue unpegging the local currency destroyed purchasing power, ignited 30%+ inflation, and wiped out the middle class. Free-market economists maintain that artificial currency subsidies drained foreign reserves and enriched corrupt arbitrage cartels.',
      tags: ['Economy', 'FloatingNaira', 'Forex', 'CostOfLiving']
    },
    {
      title: 'Fuel subsidy removed and transport costs tripled: should government bring it back?',
      description: 'Everyday citizens argue overnight subsidy removal impoverished millions and crippled small businesses. Fiscal experts contend that retaining the subsidy would have driven Nigeria into national bankruptcy and debt default.',
      tags: ['Economy', 'FuelSubsidy', 'TransportCost', 'Inflation']
    },
    {
      title: 'Earning in USD while living in Nigeria makes you completely detached from reality: agree?',
      description: 'Critics argue foreign-currency remote earners flaunt champagne lifestyle privilege while insulated from the crushing local inflation regular salary earners face. Dollar earners counter that their remittances and local spending inject vital liquidity directly into community businesses.',
      tags: ['Economy', 'DollarEarners', 'ClassDivide', 'RemoteTech']
    },
    {
      title: 'Scrap the ₦70,000 national minimum wage and let market forces decide salaries: Yes or No?',
      description: 'Free-market employers claim statutory minimum wages force struggling small enterprises to lay off staff or close down. Trade unions argue ₦70,000 cannot even buy a single bag of rice and workers need legal income protection.',
      tags: ['Economy', 'MinimumWage', 'LabourRights', 'Inflation']
    }
  ],
  'Politics & Policy': [
    {
      title: 'Civil servants: mandatory retirement at 50 to create youth employment?',
      description: 'Youth reformers argue entrenched older bureaucrats hold hostage leadership positions while 60% of graduates remain unemployed. Senior administrators argue that early forced retirement throws away irreplaceable institutional memory and governance competence.',
      tags: ['Policy', 'CivilService', 'YouthJobs', 'Governance']
    },
    {
      title: 'Politicians seeking medical treatment abroad: should they be stripped of office immediately?',
      description: 'Civic activists insist leaders would fix state hospitals within months if their own lives depended on them. Defenders argue everyone possesses a fundamental human right to seek specialized healthcare wherever available.',
      tags: ['Policy', 'MedicalTourism', 'HealthcareReform', 'Accountability']
    },
    {
      title: 'End the NYSC scheme now?',
      description: 'Critics argue the mandatory 1-year posting exposes graduates to insecurity on highways and underpays them for low-grade labor. Supporters insist NYSC remains the only surviving national institution forging inter-tribal understanding and unity.',
      tags: ['Policy', 'NYSC', 'YouthService', 'NationalUnity']
    },
    {
      title: 'Can a 70-year-old effectively lead modern Nigeria: Yes or No?',
      description: 'Critics maintain modern digital economies and rapid technological shifts demand energetic, tech-literate young leadership. Traditionalists argue elderly statesmen bring seasoned wisdom, national diplomatic networks, and calm judgment that youth lack.',
      tags: ['Policy', 'YouthInPolitics', 'PresidentialAge', 'Leadership']
    }
  ],
  'Community & Neighborhood': [
    {
      title: 'Ban commercial motorcycles and tricycles on expressways?',
      description: 'Safety advocates argue high-speed expressway collisions between motorbikes and heavy trucks cause gruesome fatalities every week. Commuters argue that without affordable rapid transit buses, sudden bans leave millions of workers stranded.',
      tags: ['Community', 'OkadaBan', 'HighwaySafety', 'CommuterRights']
    },
    {
      title: 'Locking estate gates at 10:00 PM: tyrannical or necessary security?',
      description: 'Late-shift workers, doctors, and emergency drivers argue locking fee-paying residents outside public residential streets is harassment. Security committees insist midnight curfews are the only proven deterrent against armed robbery gangs in unpoliced neighborhoods.',
      tags: ['Community', 'EstateSecurity', 'GatedEstates', 'LagosLiving']
    }
  ],
  'Education & Campus': [
    {
      title: 'Is a Nigerian university degree still worth 4 to 6 years of investment?',
      description: 'Skeptics argue university curricula are hopelessly outdated and self-taught digital skills generate far higher financial returns. Traditionalists insist formal degrees open elite institutional doors and provide structured social development.',
      tags: ['Education', 'DegreeVsSkills', 'ASUU', 'YouthEmployment']
    },
    {
      title: 'Lecturers selling mandatory overpriced course handouts: immediate dismissal without pension?',
      description: 'Victimized students argue mandatory handout extortion turns academics into petty traders and victimizes poor scholars. Defending lecturers claim inadequate university funding and poor lecturer salaries leave them with no alternative to cover printing.',
      tags: ['Education', 'CampusHandouts', 'UniversityReform', 'AcademicGreed']
    }
  ],
  'Environment & Climate': [
    {
      title: 'Ban small petrol generators (I better pass my neighbor) in crowded compounds?',
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

  const prompt = `You are an expert Nigerian social commentator, viral poll creator, and digital debate provocateur for the YesOrNo app.
Your task is to generate 1 unique, authentic, and rage-baiting YES/NO debate question specifically crafted as a Nigerian for Nigerians in the category "${category}".

Cultural & Thematic Domains to Pull From:
- Politics & Policy: Mandatory civil service retirement at 50 for youth jobs, stripping politicians seeking foreign healthcare of office, state police weaponization, scrapping the minimum wage, direct local government funding.
- Economy & Finance: Floating the Naira (worst policy or necessary medicine?), fuel subsidy reinstatement, emergency food price caps on market traders, landlords demanding 2 years rent upfront, crypto banking integration.
- Dating & Relationships: 50/50 rent splitting in marriage, first date food bills with an uninvited entourage, checking partner's phone without permission, dating broke men/women in Lagos, ₦5M wedding budgets vs court weddings.
- Culture & Society: Abolishing bride price completely, spraying crisp Naira at Owambe parties, calling older relatives by first names, genotype AS marrying AS (wickedness or faith?), cutting off toxic family black tax.
- Work, Career & Hustle: Japa vs ₦2.5M local salary, toxic weekend WhatsApp messages from bosses, remote USD tech jobs on local company time, unpaid weekend overtime, corporate entitlement.
- Business & Commerce: POS ₦500 withdrawal extortion, dollarized rent, market traders hiking prices arbitrarily.

QUESTION FORMAT VARIETY (VARY YOUR STYLE NATURALLY!):
Do NOT always start with "Should...". Randomly pick from these punchy styles:
1. Short & Sharp Direct Question (3 to 8 words):
   Examples: "End NYSC now?", "Abolish bride price completely?", "Checking partner's phone: justified?", "Ban commercial bikes on expressways?"
2. Statement Preamble + Question:
   Examples: "Fuel subsidy is gone and transport costs tripled: should it be brought back?", "Lagos rent is now payable quarterly: is this fair to landlords?", "Tech firms are mandating 5-day office returns: is remote work truly over?"
3. Direct Binary Polarity Hot-Take:
   Examples: "A man earning ₦150k has no business dating in Lagos: agree?", "50/50 rent in marriage: Yes or No?", "Earning in Dollars makes you completely detached from Nigerian reality: true or false?"
4. Classic Provocative Question:
   Examples: "Should civil servants retire at 50 to create youth employment?", "Should politicians seeking healthcare abroad be barred from public office?"

RULES:
1. Strict Yes/No: Must elicit a definitive YES or NO choice. Every question MUST end with a single "?".
2. Tone: Raw, authentic Nigerian Twitter/X energy, semi-formal to street-smart, highly opinionated, unapologetically rage-inducing. Make users itch to tap YES or NO.
3. Description: Exactly 2 to 3 concise, punchy sentences explaining the two contrasting takes/perspectives:
   - Sentence 1: The bold, provocative YES perspective (why supporters boldly justify it).
   - Sentence 2: The fiery, street-smart NO counter-argument (why critics call it absurd, unfair, or wicked).
   - Sentence 3: The high-stakes everyday dilemma for regular Nigerians.
4. Language: Natural Nigerian English with universally understood cultural terms (e.g. "Japa", "black tax", "urgent 2k", "bride price", "genotype AS", "POS charges", "Owambe", "in-laws"). Clean grammar, no vulgarity or slurs.

Return strict JSON matching:
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
    durationLabel: 'Indefinite (No Expiry)',
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

export interface QuestionSuggestion {
  title: string;
  description: string;
  category: IssueCategory;
  tags: string[];
  trendContext?: string;
  trendScore?: number; // 0-100 combined weight score from Google Trends + X
  xRank?: number; // X (Twitter) trending rank position in Nigeria
  platforms?: ('x' | 'google_news' | 'trends')[];
}

export interface TrendSuggestionResult {
  success: boolean;
  suggestions: QuestionSuggestion[];
  source: string;
  grounded: boolean;
  context?: string;
}

/**
 * Direct client-side Gemini generation for live trends with Google Search grounding
 */
async function fetchClientGeminiTrendSuggestions(params: {
  context?: string;
  category?: string;
  region?: IssueRegion;
  apiKey: string;
  excludeTitles?: string[];
  cycle?: number;
}): Promise<TrendSuggestionResult | null> {
  const { context = '', category, region = 'Africa & Middle East', apiKey, excludeTitles = [], cycle = 1 } = params;

  const excludePrompt = excludeTitles.length > 0
    ? `\nIMPORTANT DIVERSITY: DO NOT repeat or rephrase these previous questions:\n${excludeTitles.map(t => `- "${t}"`).join('\n')}\n`
    : '';

  const prompt = `You are an elite investigative journalist, viral poll designer, and civic debate moderator for the YesOrNo app.
Current Generation Cycle: #${cycle}

Task:
${context ? `Research and ground your questions in current real-time news stories and burning debates regarding: "${context}".` : 'Research the top breaking news stories, viral civic discussions, economic controversies, and cultural dilemmas in Nigeria and Africa today.'}
${category && category !== 'auto' ? `Target Category: ${category}` : ''}
Target Region: ${region}
${excludePrompt}

Identify the core point of controversy, tension, or policy dilemma where citizens are divided roughly 50/50.
Generate 2 to 3 distinct polarizing YES/NO debate question suggestions based on these current trends and facts as a Nigerian for Nigerians.

Rules:
1. Format: Vary the title format naturally across these styles:
   - Captivating True-Life Story / Dilemma Hook (DO NOT use prefix labels like "CONFESSION:" or "TRUE LIFE:". Jump straight into the raw first-person situation, e.g. "I found out my fiancé has a secret 4-year-old child 2 weeks before our wedding: should I cancel?", "I earn ₦2.8M in Lagos and refuse to fund my 30-year-old brother's lifestyle: am I being selfish?", "I secretly took a DNA test on our 2-year-old son behind my wife's back: was I wrong to doubt her?")
   - Short & sharp direct question (e.g. "End NYSC now?", "Ban plastic bags?")
   - Statement preamble + question (e.g. "Dangote refinery cuts petrol price: will filling stations drop pump prices?")
   - Direct binary polarity hot-take (e.g. "50/50 rent in marriage: Yes or No?")
   Every title must strictly end with a single "?" and require a YES or NO.
2. Description: 2-3 punchy, emotional sentences. CRITICAL SOCIAL MEDIA RULE:
   - Because social media link previews (X, WhatsApp, Facebook, LinkedIn) only highlight the first 8-15 words, FRONT-LOAD AN IRRESISTIBLE HOOK in the very first sentence (e.g. "I was cleaning my husband's car when a secret birth certificate fell out...", "My mother-in-law moved into our flat for 'two weeks' and it has now been 14 months with zero plans to leave...").
   - Then outline the emotional dilemma: why the YES camp passionately insists one choice is necessary, and why the NO camp strongly objects.
3. Category: Best fitting category from: ['Politics & Policy', 'Economy & Finance', 'Workplace & Career', 'Business', 'Environment & Climate', 'Education & Campus', 'Community & Neighborhood', 'Family & Home', 'Entertainment', 'Counselling', 'Gender', 'Religious & Faith'].
4. TrendContext: 1-2 sentence summary of the specific current news or real-time trend that sparked this debate.
5. Tags: 3 to 5 relevant hashtags or keywords.
6. Weight & Platform Virality: Cross-reference trends on X (Twitter) Nigeria with Google News. Include:
   - "trendScore": Integer from 72 to 98 (viral weight combining X trending volume + Google News coverage).
   - "xRank": Integer from 1 to 20 if matching an active X Nigeria trend topic, or null.
   - "platforms": Array of strings, e.g. ["x", "google_news"].

Return strict JSON array matching:
[
  {
    "title": "string",
    "description": "string",
    "category": "string",
    "tags": ["string", "string"],
    "trendContext": "string",
    "trendScore": 95,
    "xRank": 2,
    "platforms": ["x", "google_news"]
  }
]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const list = Array.isArray(parsed) ? parsed : (parsed.suggestions || [parsed]);
        if (list.length > 0 && list[0].title) {
          return {
            success: true,
            suggestions: list,
            source: 'gemini_client_live',
            grounded: true,
            context
          };
        }
      }
    }
  } catch (err) {
    console.warn('Client Gemini trend generation error:', err);
  }

  return null;
}

/**
 * Searches current trends, news, and stories (with optional user context like
 * "Dangote refinery petrol pricing") and returns structured question suggestions for review.
 */
export async function fetchTrendingQuestionSuggestions(params: {
  context?: string;
  category?: string;
  region?: IssueRegion;
  apiKey?: string;
  excludeTitles?: string[];
  cycle?: number;
}): Promise<TrendSuggestionResult> {
  const effectiveApiKey = params.apiKey ||
    (typeof window !== 'undefined' ? localStorage.getItem('yesorno_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '' : '');

  // 1. If client has an API key, try live Gemini generation directly
  if (effectiveApiKey) {
    const directRes = await fetchClientGeminiTrendSuggestions({
      ...params,
      apiKey: effectiveApiKey
    });
    if (directRes && directRes.suggestions.length > 0) {
      return directRes;
    }
  }

  // 2. Query backend curator endpoint
  const endpoint = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'https://yesorno.chillon.top/ai-curator.php?action=suggest_trends'
      : '/ai-curator.php?action=suggest_trends';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey: effectiveApiKey || undefined
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.suggestions) && json.suggestions.length > 0) {
        return json as TrendSuggestionResult;
      }
    }
  } catch (err) {
    console.warn('Backend suggest_trends unreachable, checking local fallback:', err);
  }

  // 3. Fallback: High-voltage, current Nigerian trend pool (Late-2026 realities)
  const contextLower = (params.context || '').toLowerCase();
  const excludeSet = new Set((params.excludeTitles || []).map((t) => t.toLowerCase().trim()));

  const currentPool: QuestionSuggestion[] = [
    {
      title: 'I found out my fiancé has a secret 4-year-old child 2 weeks before our wedding: should I cancel?',
      description: 'I was cleaning my fiancé\'s car when I discovered court child support documents and a birth certificate with his name. He wept on his knees saying he was terrified of losing me, while his parents are begging me to swallow it and proceed to the altar. Advocates say building a marriage on deliberate deception is emotional suicide, while elders argue past baggage shouldn\'t destroy genuine love.',
      category: 'Family & Home',
      tags: ['RelationshipConfessions', 'PreMaritalLies', 'WeddingDilemma', 'TrustAndBetrayal', 'FamilySecrets'],
      trendContext: 'Sparked by viral anonymous confession threads on social media regarding relationship deal-breakers and pre-wedding disclosures.',
      trendScore: 98,
      xRank: 1,
      platforms: ['x', 'google_news']
    },
    {
      title: 'I earn ₦2.8M in Lagos and refuse to pay my 30-year-old brother ₦400k monthly: am I being selfish?',
      description: 'My parents called a family meeting to accuse me of witchcraft and pride after I stopped funding my elder brother\'s lounge lifestyle. He refuses entry-level jobs while expecting me to bankroll his rent and fuel. Young professionals insist endless black tax destroys generational wealth, but cultural traditionalists argue that abandoning your own flesh and blood is taboo.',
      category: 'Counselling',
      tags: ['BlackTax', 'FamilyEntitlement', 'FinancialBoundaries', 'LagosLiving', 'ToxicRelatives'],
      trendContext: 'Debated heavily across Nigerian youth financial independence forums and social media black-tax discourse.',
      trendScore: 96,
      xRank: 2,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Dangote refinery selling petrol directly to marketers: will national pump prices drop below ₦1,000?',
      description: 'Consumers and transport unions expect direct domestic supply to dismantle import cartels and bring down transportation fares. Marketers caution that financing costs, distribution margins, and crude exchange rates will keep pump prices elevated.',
      category: 'Economy & Finance',
      tags: ['DangoteRefinery', 'PetrolPrices', 'EnergyCrisis', 'NigeriaEconomy', 'CostOfLiving'],
      trendContext: 'Grounded in breaking developments as domestic refiners commence direct supply to major fuel marketers.',
      trendScore: 97,
      xRank: 1,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Floating the Naira: was unpegging the currency the single worst economic blunder in 20 years?',
      description: 'Critics point to a collapsed middle class, hyperinflation, and widespread factory shutdowns across manufacturing hubs. Free-market economists maintain that artificial official exchange rates were bankrupting foreign reserves and enriching currency round-trippers.',
      category: 'Economy & Finance',
      tags: ['NairaFloating', 'ForexMarket', 'CBN', 'EconomicPolicy', 'Inflation'],
      trendContext: 'Debated across central bank monetary policy updates and public cost of living town halls.',
      trendScore: 94,
      xRank: 3,
      platforms: ['x', 'google_news']
    },
    {
      title: 'State governments that cannot afford the ₦70,000 minimum wage: should they retrench civil servants?',
      description: 'Fiscal analysts insist states cannot deploy 85% of monthly revenue to pay civil servants while neglecting hospitals and roads. Trade unions declare any state worker retrenchment an act of economic warfare.',
      category: 'Workplace & Career',
      tags: ['MinimumWage', 'CivilService', 'LabourUnion', 'StateBudgets', 'Governance'],
      trendContext: 'Following disputes between state governors and organized labour over minimum wage implementation deadlines.',
      trendScore: 92,
      xRank: 5,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Should state governments completely disconnect from the national grid and commission independent regional power plants?',
      description: 'Manufacturers declare repeated national grid collapses are strangling industrial production. Federal energy officials argue decentralized state grids undermine collective energy security and leave poor states in total darkness.',
      category: 'Environment & Climate',
      tags: ['ElectricityAct', 'NationalGrid', 'PowerGeneration', 'IndustrialCrisis', 'RenewableEnergy'],
      trendContext: 'Sparked by repeated national grid collapses and state electricity regulatory commissions granting private power generation licenses.',
      trendScore: 91,
      xRank: 6,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Tech companies ending hybrid work and mandating 5-day office attendance: is remote work dead in Lagos?',
      description: 'Corporate bosses argue that in-person collaboration, apprentice mentorship, and speed are impossible over Zoom. Tech workers argue that 4-hour daily traffic on third mainland bridge destroys productivity and mental health.',
      category: 'Workplace & Career',
      tags: ['RemoteWork', 'ReturnToOffice', 'TechEcosystem', 'LagosTraffic', 'WorkplaceCulture'],
      trendContext: 'Prompted by corporate directives from banks and technology firms enforcing full in-office work weeks.',
      trendScore: 89,
      xRank: 8,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Should Value Added Tax (VAT) revenues be shared strictly by where goods are consumed rather than corporate headquarters?',
      description: 'Consuming states demand fiscal federalism, arguing corporate headquarters in commercial hubs siphon taxes paid by citizens nationwide. Hub states respond that their state-funded infrastructure sustains those corporations and deserves the revenue.',
      category: 'Politics & Policy',
      tags: ['TaxReform', 'VATSharing', 'FiscalFederalism', 'NationalAssembly', 'RevenueMobilization'],
      trendContext: 'Debated in heated legislative hearings over national tax reform bills and state derivation allocations.',
      trendScore: 88,
      xRank: 9,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Politicians and sponsors implicated in political rally violence: lifetime ban from public office?',
      description: 'Civic activists argue only permanent disqualification and jail time will prevent godfathers from unleashing armed thugs. Defenders argue ruling parties will weaponize violence accusations to disqualify strong opposition contenders.',
      category: 'Politics & Policy',
      tags: ['2027Elections', 'ElectoralViolence', 'CivicAccountability', 'Democracy', 'PoliceReform'],
      trendContext: 'Prompted by warnings from security agencies and civil society ahead of upcoming electoral mobilization.',
      trendScore: 93,
      xRank: 4,
      platforms: ['x', 'google_news']
    },
    {
      title: 'Should landlords demanding 2 years rent upfront from monthly salary earners be jailed?',
      description: 'Tenants argue forcing salary earners to cough up multi-million Naira lump sums fuels bribery and drives families into homelessness. Property developers respond that tenant default rates and zero tenancy insurance make multi-year deposits essential.',
      category: 'Business',
      tags: ['LagosRent', 'TenantRights', 'RealEstate', 'HousingDeficit', 'CostOfLiving'],
      trendContext: 'In response to nationwide controversies on residential rent affordability and quarterly rent proposals.',
      trendScore: 95,
      xRank: 2,
      platforms: ['x', 'google_news']
    }
  ];

  let pool = currentPool;

  if (contextLower) {
    const matches = currentPool.filter((item) => {
      const str = `${item.title} ${item.description} ${item.tags.join(' ')} ${item.trendContext || ''}`.toLowerCase();
      return str.includes(contextLower);
    });
    if (matches.length >= 2) {
      pool = matches;
    }
  }

  // Deduplicate against excludeSet
  const available = pool.filter((item) => !excludeSet.has(item.title.toLowerCase().trim()));
  const finalPool = available.length >= 3 ? available : pool;

  // Shuffle
  const shuffled = [...finalPool].sort(() => 0.5 - Math.random());

  return {
    success: true,
    source: 'current_trends_engine',
    grounded: false,
    context: params.context,
    suggestions: shuffled.slice(0, 3),
  };
}
