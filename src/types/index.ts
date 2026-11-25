export type VoteChoice = 'YES' | 'NO';
export type AppZone = 'civic' | 'fanzone';
export type PollType = 'binary' | 'multi';
export type DisplayPreference = 'username' | 'firstname' | 'name';

export interface PollOption {
  id: string;
  label: string;
  votes: number;
  color?: string;
}

export interface FavoriteClub {
  id: string;
  name: string;
  shortName: string;
  league: string;
  color: string;
  logoUrl?: string;
  aliases?: string[];
  isTop20?: boolean;
}

export interface IssueDraft {
  title: string;
  description: string;
  category: IssueCategory;
  tagsInput?: string;
  durationLabel?: string;
  durationHours?: number;
  visibility?: IssueVisibility;
  isAnonymous?: boolean;
  images?: string[];
  pollType?: PollType;
  yesLabel?: string;
  noLabel?: string;
  options?: string[];
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: string;
  bio?: string;
  avatar?: string;
  displayPreference?: DisplayPreference;
  groups: string[];
  region?: IssueRegion;
  interests?: IssueCategory[];
  followingCreators?: string[];
  votedIssues?: Record<string, { choice: 'YES' | 'NO'; responseId?: string; optionId?: string; optionLabel?: string }>;
  likedIssueIds?: string[];
  favoriteIssueIds?: string[];
  issueDraft?: IssueDraft | null;
  followersCount?: number;
  favoriteClub?: FavoriteClub | null;
  nationalTeam?: string;
  defaultAnonymous?: boolean;
  defaultVoiceFilter?: VoiceFilterType;
  soundEnabled?: boolean;
  animationsEnabled?: boolean;
  theme?: 'dark' | 'light';
  colorTone?: 'vibrant' | 'toned';
  notificationsEnabled?: boolean;
  onboardingCompleted?: boolean;
  registeredAt?: string;
  isVerified?: boolean;
  verificationBadge?: 'google' | 'official' | 'resident' | 'none';
  lastLoginAt?: string;
  lastActionAt?: string;
  lastAction?: string;
  votesCount?: number;
  issuesCount?: number;
  commentsCount?: number;
  userType?: 'registered' | 'seed';
  acquisitionSource?: string;
  registrationSource?: Record<string, unknown>;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: string;
  avatar?: string;
  bio?: string;
  region?: string;
  userType: 'registered' | 'seed';
  isVerified: boolean;
  verificationBadge: 'google' | 'official' | 'resident' | 'none';
  registeredAt: string;
  lastLoginAt: string;
  lastActionAt?: string;
  lastAction?: string;
  votesCount: number;
  issuesCount: number;
  commentsCount: number;
  groups?: string[];
  interests?: string[];
  acquisitionSource?: string;
  landingPath?: string;
}

export type VoiceFilterType = 'none' | 'deep' | 'high' | 'robot' | 'radio';

export interface VoiceAttachment {
  audioUrl: string; // Base64 data URL or Object URL
  durationSeconds: number;
  mimeType: string;
  createdAt: string;
  voiceFilter?: VoiceFilterType; // Voice adjustment for anonymous privacy
  isVoiceMasked?: boolean;
}

export interface CommentReply {
  id: string;
  submissionId: string;
  authorName: string;
  authorUsername?: string;
  authorAvatar?: string;
  authorEmail?: string;
  authorAlias?: string;
  authorRole?: string;
  authorClub?: FavoriteClub | null;
  isAnonymous?: boolean;
  content: string;
  createdAt: string;
  likesCount: number;
  replyToName?: string;
  reactions?: Record<string, number>;
  userReactions?: Record<string, string[]>;
}

export interface VoteSubmission {
  id: string;
  issueId: string;
  choice: VoteChoice;
  optionId?: string;
  optionLabel?: string;
  isAnonymous: boolean;
  authorName: string;
  authorUsername?: string;
  authorAvatar?: string;
  authorEmail?: string;
  authorAlias?: string; // e.g. "Neighbor #319"
  authorRole?: string; // e.g. "Resident (5 yrs)", "Small Business Owner"
  authorClub?: FavoriteClub | null;
  displayPreference?: 'username' | 'name' | 'firstname';
  note?: string;
  voiceNote?: VoiceAttachment;
  createdAt: string;
  likesCount: number;
  isReported?: boolean;
  replies?: CommentReply[];
  reactions?: Record<string, number>;
  userReactions?: Record<string, string[]>;
}

export type IssueCategory = 
  | 'All'
  | 'Counselling'
  | 'Business'
  | 'Gender'
  | 'Entertainment'
  | 'Workplace & Career'
  | 'Family & Home'
  | 'Community & Neighborhood'
  | 'Religious & Faith'
  | 'Politics & Policy'
  | 'Environment & Climate'
  | 'Economy & Finance'
  | 'Education & Campus'
  | 'Private & Internal'
  | 'Clubs & Groups' // legacy backwards-compatible alias
  | 'Premier League'
  | 'Champions League'
  | 'La Liga'
  | 'Serie A & Bundesliga'
  | 'International & World Cup'
  | 'Transfers & Rumors'
  | 'VAR & Officiating'
  | 'GOAT & Legacy'
  | 'Matchday Banter';

export type IssueVisibility = 'public' | 'private';

export type IssueRegion = 
  | 'Global / Remote'
  | 'North America'
  | 'Europe & UK'
  | 'Africa & Middle East'
  | 'Asia-Pacific'
  | 'Local District';

export interface IssueSummaryInsights {
  consensusHeadline: string;
  keyArgumentsYes: string[];
  keyArgumentsNo: string[];
  sentimentTrend: 'Strongly Favor' | 'Leaning Yes' | 'Divided' | 'Leaning No' | 'Strongly Oppose';
  lastUpdated: string;
}

export interface Issue {
  id: string;
  zone?: AppZone;
  pollType?: PollType;
  yesLabel?: string;
  noLabel?: string;
  options?: PollOption[];
  title: string;
  description: string;
  category: IssueCategory;
  region?: IssueRegion;
  tags: string[];
  author: string;
  creatorId?: string;
  creatorEmail?: string;
  creatorAvatar?: string;
  creatorUsername?: string;
  creatorDisplayPreference?: 'username' | 'name' | 'firstname';
  isAnonymousAuthor?: boolean;
  createdAt: string;
  closingDate?: string | null; // ISO string or null/undefined if indefinite (no expiry)
  durationLabel: string; // e.g. "24 Hours", "3 Days", "7 Days", "Custom"
  visibility: IssueVisibility;
  invitedEmails: string[]; // Allowed emails if private
  invitedGroups: string[]; // Allowed groups if private
  yesCount: number;
  noCount: number;
  likesCount?: number;
  favoritesCount?: number;
  flagReportsCount?: number;
  isFlagged?: boolean;
  responses: VoteSubmission[];
  images?: string[]; // Attached images/photos by creator
  creatorVoiceNote?: VoiceAttachment; // Voice note briefing attached by the creator
  featured?: boolean;
  summary?: IssueSummaryInsights;
  viewsCount?: number;
  impressionsCount?: number;
  isDeletedByAuthor?: boolean;
  deletedAt?: string;
}

export type IssueFlagReason = 
  | 'not_a_question'
  | 'inappropriate_language'
  | 'harassment_hate'
  | 'spam_promotion'
  | 'privacy_leak';

export interface IssueFlagReport {
  id: string;
  issueId: string;
  reporterEmail?: string;
  reason: IssueFlagReason;
  details?: string;
  createdAt: string;
}

export interface ModerationResult {
  isAppropriate: boolean;
  flags: string[];
  suggestedAction?: string;
  severity: 'clean' | 'warning' | 'rejected';
}

export type AppView = 'landing' | 'app' | 'discovery' | 'auth' | 'analytics' | 'issue' | 'contact' | 'profile';

export interface PublicUserProfile {
  id?: string;
  name: string;
  username: string;
  email?: string;
  role?: string;
  bio?: string;
  avatar?: string;
  region?: IssueRegion;
  groups?: string[];
  interests?: IssueCategory[];
  followingCreators?: string[];
  followersCount?: number;
  favoriteClub?: FavoriteClub | null;
  nationalTeam?: string;
  isVerified?: boolean;
  verificationBadge?: string;
  votedIssues?: Record<string, { choice: 'YES' | 'NO'; responseId?: string; optionId?: string; optionLabel?: string } | 'YES' | 'NO'>;
}
