import React from 'react';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Mic, CheckCircle2, 
  Lock, Globe, Clock, Image as ImageIcon, ArrowUpRight, Share2,
  MapPin, Sparkles, UserCheck
} from 'lucide-react';
import { Issue, UserProfile, VoteChoice } from '../types';
import { computeIssueMetrics } from '../utils/summary';
import { canUserAccessIssue, TOP_CREATORS_AND_VOTERS } from '../utils/auth';
import { inferIssueRegion } from './DiscoveryHub';

interface Props {
  issue: Issue;
  currentUser: UserProfile | null;
  onOpenDetails: (issue: Issue) => void;
  onQuickVote: (issue: Issue, initialChoice?: VoteChoice) => void;
  onShareIssue: (issue: Issue) => void;
  hasUserVoted?: boolean;
  userVoteChoice?: 'YES' | 'NO';
}

const CATEGORY_ICONS: Record<string, string> = {
  'Family & Home': '👨‍👩‍👧',
  'Workplace & Career': '💼',
  'Community & Neighborhood': '🏡',
  'Religious & Faith': '🕊️',
  'Clubs & Groups': '👥',
  'Politics & Policy': '🏛️',
  'Environment & Climate': '🌱',
  'Economy & Finance': '📈',
  'Education & Campus': '🎓',
  'Private & Internal': '🔒',
};

const SHORT_CATEGORIES: Record<string, string> = {
  'Family & Home': 'Family',
  'Workplace & Career': 'Workplace',
  'Community & Neighborhood': 'Community',
  'Religious & Faith': 'Faith',
  'Clubs & Groups': 'Clubs',
  'Politics & Policy': 'Policy',
  'Environment & Climate': 'Climate',
  'Economy & Finance': 'Economy',
  'Education & Campus': 'Education',
  'Private & Internal': 'Private Circle',
};

export const IssueCard: React.FC<Props> = ({
  issue,
  currentUser,
  onOpenDetails,
  onQuickVote,
  onShareIssue,
  hasUserVoted,
  userVoteChoice,
}) => {
  const metrics = computeIssueMetrics(issue);
  const access = canUserAccessIssue(issue, currentUser);
  const hasImages = issue.images && issue.images.length > 0;
  const catEmoji = CATEGORY_ICONS[issue.category] || '🗳️';
  const shortCat = SHORT_CATEGORIES[issue.category] || issue.category;
  const issueRegion = inferIssueRegion(issue);

  const isRegionPriority = Boolean(
    currentUser?.region &&
    currentUser.region !== 'Global / Remote' &&
    issueRegion === currentUser.region
  );
  const isWorldwideMix = Boolean(
    currentUser?.region &&
    currentUser.region !== 'Global / Remote' &&
    issueRegion === 'Global / Remote'
  );
  const isInterestPriority = Boolean(
    currentUser?.interests && currentUser.interests.includes(issue.category)
  );
  const isFollowedCreator = Boolean(
    currentUser?.followingCreators &&
    currentUser.followingCreators.some(followed => {
      const fLower = followed.toLowerCase();
      const authorLower = issue.author.toLowerCase();
      if (authorLower.includes(fLower) || fLower.includes(authorLower)) return true;
      const creator = TOP_CREATORS_AND_VOTERS.find(c => c.id === followed || c.name.toLowerCase() === fLower);
      return Boolean(
        creator && (
          authorLower.includes(creator.name.toLowerCase()) ||
          creator.name.toLowerCase().includes(authorLower)
        )
      );
    })
  );

  return (
    <article className="card overflow-hidden hover:shadow-lift hover:-translate-y-0.5 hover:border-brand-300/70 dark:hover:border-brand-500/50 transition-all duration-300 flex flex-col justify-between group relative">
      {/* Top Accent Line when no image is present */}
      {!hasImages && (
        <div className="h-1 w-full bg-gradient-to-r from-brand-500 via-purple-500 to-emerald-400" />
      )}

      {/* Optional Creator Image Banner */}
      {hasImages && (
        <div 
          onClick={() => onOpenDetails(issue)}
          className="relative h-44 w-full overflow-hidden cursor-pointer bg-ink-900"
        >
          <img 
            src={issue.images![0]} 
            alt={issue.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-95" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent pointer-events-none" />

          {/* Floating Top-Left Category Pill on Image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-ink-950/80 text-white backdrop-blur-md border border-white/15 flex items-center gap-1.5">
              <span>{catEmoji}</span>
              <span>{shortCat}</span>
            </span>
            {issue.visibility === 'private' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-purple-600/90 text-white backdrop-blur-md">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
          </div>

          {/* Floating Top-Right Time Pill on Image */}
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-ink-950/80 text-amber-300 backdrop-blur-md border border-white/15">
              <Clock className="w-3 h-3 text-amber-400" />
              {metrics.timeRemaining.text}
            </span>
          </div>

          {/* Bottom-Left & Right Overlays on Image */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {issue.creatorVoiceNote && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-ink-950 backdrop-blur-md">
                  <Mic className="w-3 h-3" /> Audio Brief
                </span>
              )}
            </div>

            {issue.images!.length > 1 && (
              <span className="px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-md">
                <ImageIcon className="w-3 h-3" />
                <span>+{issue.images!.length - 1}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Top Badges when NO image is present */}
          {!hasImages && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-400/30">
                  <span>{catEmoji}</span>
                  <span>{shortCat}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300 border border-slate-200/70 dark:border-white/10">
                  <MapPin className="w-2.5 h-2.5 text-brand-500" />
                  <span>{issueRegion === 'Global / Remote' ? 'Worldwide' : issueRegion}</span>
                </span>

                {issue.visibility === 'private' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-400/30">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                ) : null}

                {issue.creatorVoiceNote && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30">
                    <Mic className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> Audio
                  </span>
                )}
              </div>

              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${metrics.timeRemaining.badgeColor}`}>
                <Clock className="w-3 h-3" />
                {metrics.timeRemaining.text}
              </span>
            </div>
          )}

          {/* Personalized Match Indicator Strip (when matched by Region, Interest, or Followed Creator) */}
          {(isRegionPriority || isWorldwideMix || isInterestPriority || isFollowedCreator) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {isRegionPriority && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-400/30">
                  <MapPin className="w-2.5 h-2.5" /> Your Region Priority ({issueRegion})
                </span>
              )}
              {isWorldwideMix && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-400/30">
                  <Globe className="w-2.5 h-2.5" /> Worldwide Feed
                </span>
              )}
              {isInterestPriority && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/80 dark:border-brand-400/30">
                  <Sparkles className="w-2.5 h-2.5" /> Matches Your Interest
                </span>
              )}
              {isFollowedCreator && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-400/30">
                  <UserCheck className="w-2.5 h-2.5" /> Following {issue.author}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h3 
            onClick={() => onOpenDetails(issue)}
            className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 cursor-pointer transition-colors leading-snug line-clamp-2 tracking-tight"
          >
            {issue.title}
          </h3>

          {/* Concise Description snippet */}
          <p 
            onClick={() => onOpenDetails(issue)}
            className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-2 cursor-pointer"
          >
            {issue.description}
          </p>
        </div>

        {/* Consensus Split Meter */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>YES {metrics.yesPercent}%</span>
              <span className="text-[11px] font-mono font-normal text-slate-400 dark:text-zinc-500">({issue.yesCount})</span>
            </span>

            <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <span className="text-[11px] font-mono font-normal text-slate-400 dark:text-zinc-500">({issue.noCount})</span>
              <span>NO {metrics.noPercent}%</span>
              <ThumbsDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </span>
          </div>
          
          <div className="h-2.5 w-full bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden flex p-0.5 border border-slate-200/70 dark:border-white/10">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full" 
              style={{ width: `${metrics.totalVotes === 0 ? 50 : metrics.yesPercent}%` }} 
            />
            <div 
              className="bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 rounded-full ml-0.5" 
              style={{ width: `${metrics.totalVotes === 0 ? 50 : metrics.noPercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Card Footer with Share & Direct YES / NO Action */}
      <div className="px-5 py-3 bg-slate-50/80 dark:bg-ink-950/60 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onOpenDetails(issue)}
            className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition-colors font-semibold"
          >
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>{issue.responses.length}</span>
            </span>
            {metrics.voiceNotesCount > 0 && (
              <span className="flex items-center gap-1 text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15 px-2 py-0.5 rounded-full border border-brand-200/60 dark:border-brand-400/30 font-bold text-[11px]">
                <Mic className="w-3 h-3" />
                <span>{metrics.voiceNotesCount}</span>
              </span>
            )}
          </button>

          {/* Social Share Button */}
          <button
            type="button"
            onClick={() => onShareIssue(issue)}
            title="Share issue title & description to social media"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-ink-800 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {!access.canAccess ? (
            <button
              onClick={() => onOpenDetails(issue)}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-200 dark:bg-ink-800 hover:bg-slate-300 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Private Circle</span>
            </button>
          ) : metrics.isClosed ? (
            <button
              onClick={() => onOpenDetails(issue)}
              className="flex items-center gap-1 py-1.5 px-3 bg-ink-950 dark:bg-brand-600 hover:bg-ink-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              <span>Final Digest</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          ) : hasUserVoted ? (
            <button
              onClick={() => onOpenDetails(issue)}
              className={`flex items-center gap-1.5 py-1.5 px-3 font-bold rounded-xl text-xs transition-colors border cursor-pointer ${
                userVoteChoice === 'YES'
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/30'
                  : 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-400/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Voted {userVoteChoice}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onQuickVote(issue, 'YES')}
                className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-600 font-extrabold text-xs transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-3 h-3" />
                <span>YES</span>
              </button>
              <button
                type="button"
                onClick={() => onQuickVote(issue, 'NO')}
                className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 dark:hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-200 dark:border-rose-500/30 hover:border-rose-600 font-extrabold text-xs transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-3 h-3" />
                <span>NO</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
