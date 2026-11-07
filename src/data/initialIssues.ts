import { Issue } from '../types';
import { generateSampleChimeWav } from '../utils/audio';

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const INITIAL_ISSUES: Issue[] = [
  {
    id: 'issue-workplace-1',
    title: 'Transition our Company to a 4-Day Work Week (32 Hours) with Full Salary Retention',
    description: 'Proposal for our workplace to pilot a 6-month 4-day (Monday through Thursday, 8 hours/day) work week trial. All teams maintain core responsiveness via staggered support on Fridays. Productivity and output will be measured by sprint deliverables rather than hours logged.',
    category: 'Workplace & Career',
    tags: ['Workplace', 'Productivity', 'Work-Life Balance', 'Trial'],
    author: 'Internal People Operations Team',
    creatorId: 'user-elena',
    creatorEmail: 'elena@civic.board',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    closingDate: new Date(NOW + 5 * DAY + 4 * HOUR).toISOString(), // ~5 days left
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 238,
    noCount: 42,
    featured: true,
    images: [
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1000&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80'
    ],
    creatorVoiceNote: {
      audioUrl: generateSampleChimeWav(6, 'agree'),
      durationSeconds: 6,
      mimeType: 'audio/wav',
      createdAt: new Date(NOW - 2 * DAY).toISOString()
    },
    summary: {
      consensusHeadline: 'Resounding team backing (85% YES) for the 4-day work trial.',
      keyArgumentsYes: [
        'Studies show employee burnout plummets while recruitment retention surges.',
        'Encourages async communication and eliminates unnecessary 1-hour status meetings.'
      ],
      keyArgumentsNo: [
        'Client-facing and emergency technical support may suffer without adequate weekend coverage.',
        'Compacted deadlines might create higher daily stress Monday through Thursday.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: [
      {
        id: 'resp-work-1',
        issueId: 'issue-workplace-1',
        choice: 'YES',
        isAnonymous: false,
        authorName: 'Marcus Chen',
        authorEmail: 'marcus@chenbakery.com',
        authorRole: 'Engineering Manager',
        note: 'Our engineering sprint velocity improved during the summer 4-day trial. Uninterrupted focus time is worth far more than Friday afternoon watercooler chats.',
        voiceNote: {
          audioUrl: generateSampleChimeWav(6, 'agree'),
          durationSeconds: 6,
          mimeType: 'audio/wav',
          createdAt: new Date(NOW - 1 * DAY).toISOString()
        },
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        likesCount: 34
      },
      {
        id: 'resp-work-2',
        issueId: 'issue-workplace-1',
        choice: 'NO',
        isAnonymous: true,
        authorName: 'Anonymous Colleague',
        authorAlias: 'Team Colleague #419',
        note: 'If client inquiries arrive on Friday and we are unresponsive, we risk losing key contracts to faster competitors.',
        voiceNote: {
          audioUrl: generateSampleChimeWav(5, 'disagree'),
          durationSeconds: 5,
          mimeType: 'audio/wav',
          createdAt: new Date(NOW - 18 * HOUR).toISOString(),
          isVoiceMasked: true,
          voiceFilter: 'deep'
        },
        createdAt: new Date(NOW - 18 * HOUR).toISOString(),
        likesCount: 16
      }
    ]
  },
  {
    id: 'issue-family-1',
    title: '[FAMILY CIRCLE] Enforce a Strict "No Screen & No Phone" Policy at Family Dinner Table',
    description: 'Family household vote: During dinner from 7:00 PM to 7:45 PM, all smartphones, tablets, and smartwatches must be left in the charging basket in the hallway. Goal is to promote genuine conversation, daily check-ins, and mindful eating.',
    category: 'Family & Home',
    tags: ['Family', 'Digital Detox', 'Dinner', 'Mental Health'],
    author: 'Elena Rostova',
    creatorId: 'user-elena',
    creatorEmail: 'elena@civic.board',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 1 * DAY).toISOString(),
    closingDate: new Date(NOW + 2 * DAY).toISOString(),
    durationLabel: '3 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: ['Rostova Household'],
    yesCount: 18,
    noCount: 7,
    images: [
      'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=1000&auto=format&fit=crop&q=80'
    ],
    summary: {
      consensusHeadline: 'Household in favor (72% YES) of establishing screen-free family meal times.',
      keyArgumentsYes: [
        'Restores meaningful connection and family storytelling without notification buzzes.',
        'Helps children develop healthier boundaries with algorithmic feeds.'
      ],
      keyArgumentsNo: [
        'High schoolers occasionally need to coordinate group project homework or sports schedules.',
        'On-call work emergencies should have a designated buzzer exemption.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: [
      {
        id: 'resp-fam-1',
        issueId: 'issue-family-1',
        choice: 'YES',
        isAnonymous: true,
        authorName: 'Anonymous Family Member',
        authorAlias: 'Household Member #102',
        note: 'Meals feel rushed and disconnected when everyone is staring at TikTok or emails. 45 minutes of device-free time is healthy for all of us.',
        createdAt: new Date(NOW - 10 * HOUR).toISOString(),
        likesCount: 12
      }
    ]
  },
  {
    id: 'issue-faith-1',
    title: 'Redirect 30% of Annual Temple/Parish Festival Budget into a Free Community Food Pantry',
    description: 'Deliberation for congregation members: Instead of spending \$45,000 on stage rentals and commercial fireworks for the annual carnival, allocate \$15,000 directly to fund a year-round refrigerated food pantry and grocery parcel program for low-income families in our district.',
    category: 'Religious & Faith',
    tags: ['Charity', 'Community Care', 'Food Pantry', 'Faith in Action'],
    author: 'Interfaith Service Council',
    creatorId: 'user-sarah',
    creatorEmail: 'sarah.almansoor@health.org',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    closingDate: new Date(NOW + 4 * DAY).toISOString(),
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 184,
    noCount: 29,
    images: [
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=1000&auto=format&fit=crop&q=80'
    ],
    creatorVoiceNote: {
      audioUrl: generateSampleChimeWav(5, 'agree'),
      durationSeconds: 5,
      mimeType: 'audio/wav',
      createdAt: new Date(NOW - 3 * DAY).toISOString()
    },
    summary: {
      consensusHeadline: 'Overwhelming congregation approval (86% YES) for prioritizing charitable pantry aid.',
      keyArgumentsYes: [
        'True expression of religious mission: feeding the hungry and supporting vulnerable neighbors.',
        'A modest festival can still be joyful without exorbitant pyrotechnic expenditures.'
      ],
      keyArgumentsNo: [
        'The festival is the community’s biggest youth reunion and outreach event of the calendar year.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: [
      {
        id: 'resp-faith-1',
        issueId: 'issue-faith-1',
        choice: 'YES',
        isAnonymous: false,
        authorName: 'Dr. Sarah Al-Mansoor',
        authorEmail: 'sarah.almansoor@health.org',
        authorRole: 'Congregation Volunteer',
        note: 'Our food bank served over 800 hot meals last month. This funding increase will double our capacity for milk, eggs, and fresh produce.',
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        likesCount: 27
      }
    ]
  },
  {
    id: 'issue-groups-1',
    title: '[CLUB VOTE] Establish a \$20/year Shared Gear & Safety Equipment Pool for Cycling Club',
    description: 'Members vote: The TrailBlazers Cycling Club proposes a \$20 annual contribution to purchase 4 high-end torque wrenches, 2 bike repair stands, emergency bleed kits, and high-visibility club vests stored in a communal locker accessible by all members.',
    category: 'Clubs & Groups',
    tags: ['Cycling', 'Club Commons', 'Equipment Sharing', 'Budget'],
    author: 'Marcus Chen (Club Ride Leader)',
    creatorId: 'user-marcus',
    creatorEmail: 'marcus@chenbakery.com',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 18 * HOUR).toISOString(),
    closingDate: new Date(NOW + 30 * HOUR).toISOString(),
    durationLabel: '2 Days',
    visibility: 'private',
    invitedEmails: ['elena@civic.board', 'sarah.almansoor@health.org'],
    invitedGroups: ['TrailBlazers Cycling Club', 'Downtown Merchants'],
    yesCount: 42,
    noCount: 6,
    images: [
      'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=1000&auto=format&fit=crop&q=80'
    ],
    summary: {
      consensusHeadline: 'Club members strongly favor (88% YES) collective tool and gear ownership.',
      keyArgumentsYes: [
        'Saves each individual cyclist from spending \$300+ on niche maintenance tools.',
        'Ensures beginner riders have access to professional road safety gear.'
      ],
      keyArgumentsNo: [
        'Tools in shared lockers might suffer from wear or go missing without strict check-out logging.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: []
  },
  {
    id: 'issue-1',
    title: 'Transform Market Street into a Pedestrian-Only & Cycling Zone on Weekends',
    description: 'Proposal to close Market Street to motorized vehicle traffic between 8:00 AM Saturday and 9:00 PM Sunday. This would allow outdoor dining expansions, weekly farmers markets, safer walking spaces, and local artisan stalls. Delivery trucks would be granted access before 7:30 AM.',
    category: 'Community & Neighborhood',
    tags: ['Pedestrian', 'Local Business', 'Clean Air', 'Weekend'],
    author: 'Elena Rostova (District 4 Community Board)',
    creatorId: 'user-elena',
    creatorEmail: 'elena@civic.board',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    closingDate: new Date(NOW + 4 * DAY + 6 * HOUR).toISOString(),
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 142,
    noCount: 48,
    featured: true,
    images: [
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1000&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=1000&auto=format&fit=crop&q=80'
    ],
    creatorVoiceNote: {
      audioUrl: generateSampleChimeWav(6, 'agree'),
      durationSeconds: 6,
      mimeType: 'audio/wav',
      createdAt: new Date(NOW - 3 * DAY).toISOString()
    },
    summary: {
      consensusHeadline: 'Strong public endorsement (75% YES) for weekend pedestrian zone.',
      keyArgumentsYes: [
        'Commercial foot traffic increases by ~35% for local food and beverage spots.',
        'Eliminates car emissions and creates a safe recreational hub for children and seniors.'
      ],
      keyArgumentsNo: [
        'Side streets could experience vehicle parking spillover and congestion on Saturdays.',
        'Elderly delivery and pickup access requires a dedicated permit exception.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: [
      {
        id: 'resp-1-1',
        issueId: 'issue-1',
        choice: 'YES',
        isAnonymous: false,
        authorName: 'Marcus Chen',
        authorEmail: 'marcus@chenbakery.com',
        authorRole: 'Market St Café Owner',
        note: 'Outdoor seating on weekends during the summer trial boosted foot traffic by nearly 35%. It makes our downtown lively, kid-friendly, and much safer for seniors.',
        voiceNote: {
          audioUrl: generateSampleChimeWav(6, 'agree'),
          durationSeconds: 6,
          mimeType: 'audio/wav',
          createdAt: new Date(NOW - 2 * DAY).toISOString()
        },
        createdAt: new Date(NOW - 2 * DAY).toISOString(),
        likesCount: 29
      },
      {
        id: 'resp-1-2',
        issueId: 'issue-1',
        choice: 'NO',
        isAnonymous: true,
        authorName: 'Anonymous Neighbor',
        authorAlias: 'Civic Neighbor #284',
        authorRole: 'Resident on 3rd Ave',
        note: 'Where will residents living on the adjacent streets park? The side streets already experience heavy gridlock on Saturdays. We need a designated resident parking plan first.',
        voiceNote: {
          audioUrl: generateSampleChimeWav(5, 'disagree'),
          durationSeconds: 5,
          mimeType: 'audio/wav',
          createdAt: new Date(NOW - 1 * DAY).toISOString(),
          isVoiceMasked: true,
          voiceFilter: 'deep'
        },
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        likesCount: 17
      }
    ]
  },
  {
    id: 'issue-econ-1',
    title: 'Distribute 50% of Community Solar Cooperative Savings as Direct Resident Dividend Checks',
    description: 'Economical policy decision: Our local solar energy cooperative generated a surplus of \$120,000 this fiscal quarter. Vote on distributing 50% (\$60,000) directly as household rebate checks of ~\$85 each, versus reinvesting 100% into expanding battery storage infrastructure.',
    category: 'Economy & Finance',
    tags: ['Dividend', 'Energy Economics', 'Cooperative', 'Rebate'],
    author: 'Clean Grid Taskforce',
    creatorId: 'user-elena',
    creatorEmail: 'elena@civic.board',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 4 * DAY).toISOString(),
    closingDate: new Date(NOW + 3 * DAY).toISOString(),
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 198,
    noCount: 88,
    images: [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=1000&auto=format&fit=crop&q=80'
    ],
    summary: {
      consensusHeadline: 'Community leans in favor (69% YES) for direct cash dividend rebates.',
      keyArgumentsYes: [
        'Provides immediate inflation relief directly into working families’ pockets.',
        'Demonstrates tangible economic rewards for investing in clean municipal energy.'
      ],
      keyArgumentsNo: [
        'Battery storage is crucial to prevent brownouts during summer peak demand spikes.'
      ],
      sentimentTrend: 'Leaning Yes',
      lastUpdated: new Date().toISOString()
    },
    responses: []
  },
  {
    id: 'issue-env-1',
    title: 'Mandate Solar Panels or Living Green Roofs on All New Buildings Over 10,000 sq.ft.',
    description: 'This proposal establishes a strict municipal building code requirement for rooftop solar or living green vegetated roofs on upcoming commercial developments to combat urban heat island effects.',
    category: 'Environment & Climate',
    tags: ['Solar', 'Clean Energy', 'Building Code', 'Environment'],
    author: 'EcoCities Alliance',
    creatorId: 'user-elena',
    creatorEmail: 'elena@civic.board',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 16 * DAY).toISOString(),
    closingDate: new Date(NOW - 2 * DAY).toISOString(), // Closed
    durationLabel: '14 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 312,
    noCount: 78,
    summary: {
      consensusHeadline: 'Final Consensus: Passed with 80% approval. Code amendment submitted to council.',
      keyArgumentsYes: [
        'Massive reduction in building HVAC energy load and carbon emissions.',
        'Green roofs reduce stormwater runoff by over 50% during heavy rains.'
      ],
      keyArgumentsNo: [
        'Upfront construction costs could slow down commercial lease developments.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date(NOW - 2 * DAY).toISOString()
    },
    responses: [
      {
        id: 'resp-env-1',
        issueId: 'issue-env-1',
        choice: 'YES',
        isAnonymous: true,
        authorName: 'Anonymous Resident',
        authorAlias: 'District Voter #104',
        note: 'Our city receives over 260 days of sunshine per year. Mandating solar on commercial roofs is common sense.',
        createdAt: new Date(NOW - 10 * DAY).toISOString(),
        likesCount: 34
      }
    ]
  },
  {
    id: 'issue-edu-1',
    title: 'Offer Free 24/7 Municipal & Campus Wi-Fi Hotspots Across All Student Transit Shelters',
    description: 'Deploy solar-powered public Wi-Fi access points at the 35 busiest bus shelters, public libraries, and subway terminals to bridge digital divide gaps for students doing homework on commutes.',
    category: 'Education & Campus',
    tags: ['Digital Equity', 'Students', 'Wi-Fi', 'Campus'],
    author: 'Youth Empowerment Council',
    creatorId: 'user-sarah',
    creatorEmail: 'sarah.almansoor@health.org',
    isAnonymousAuthor: false,
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    closingDate: new Date(NOW + 5 * DAY).toISOString(),
    durationLabel: '7 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 310,
    noCount: 32,
    images: [
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=80'
    ],
    summary: {
      consensusHeadline: 'Universal support (91% YES) for providing student transit digital connectivity.',
      keyArgumentsYes: [
        'Ensures students without home broadband can submit coursework and study safely.',
        'Enhances public transit utility and youth safety at night.'
      ],
      keyArgumentsNo: [
        'Requires ongoing cybersecurity filtering and vandalism maintenance contracts.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: []
  },
  {
    id: 'issue-policy-1',
    title: 'Mandate a 10:00 PM Weeknight Noise Ordinance for Heavy Commercial Construction Sites',
    description: 'Current ordinance permits exterior heavy machinery until 11:30 PM. This initiative seeks to move the curfew to 10:00 PM on Sunday through Thursday to guarantee restful sleep for working residents and children.',
    category: 'Politics & Policy',
    tags: ['Noise Curfew', 'Policy', 'Public Health', 'Sleep'],
    author: 'Civic Member #102',
    isAnonymousAuthor: true,
    createdAt: new Date(NOW - 12 * HOUR).toISOString(),
    closingDate: new Date(NOW + 36 * HOUR).toISOString(),
    durationLabel: '2 Days',
    visibility: 'public',
    invitedEmails: [],
    invitedGroups: [],
    yesCount: 189,
    noCount: 63,
    summary: {
      consensusHeadline: 'Strong support (75% YES) for protecting evening quiet and community sleep health.',
      keyArgumentsYes: [
        '11:30 PM disrupts school schedules and working families.',
        'Helps reduce noise-induced stress in residential neighborhoods.'
      ],
      keyArgumentsNo: [
        'Shorter night shifts will stretch project completion timelines by weeks.'
      ],
      sentimentTrend: 'Strongly Favor',
      lastUpdated: new Date().toISOString()
    },
    responses: []
  }
];
