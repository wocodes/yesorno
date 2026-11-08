export type VoteChoice = 'YES' | 'NO';
export type DisplayPreference = 'username' | 'firstname' | 'name';

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
  defaultAnonymous?: boolean;
  defaultVoiceFilter?: VoiceFilterType;
  onboardingCompleted?: boolean;
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
  authorEmail?: string;
  authorAlias?: string;
  authorRole?: string;
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
  isAnonymous: boolean;
  authorName: string;
  authorUsername?: string;
  authorEmail?: string;
  authorAlias?: string; // e.g. "Neighbor #319"
  authorRole?: string; // e.g. "Resident (5 yrs)", "Small Business Owner"
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
  | 'Clubs & Groups'; // legacy backwards-compatible alias

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
  isAnonymousAuthor?: boolean;
  createdAt: string;
  closingDate: string; // ISO string representing exact deadline set by user
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

export type AppView = 'landing' | 'app' | 'discovery' | 'auth' | 'analytics' | 'issue' | 'contact';
