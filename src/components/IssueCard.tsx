import React, { useState, useRef } from 'react';
import { 
  ThumbsUp, ThumbsDown, MessageSquare, Mic, CheckCircle2, 
  Lock, Globe, Clock, Image as ImageIcon, ArrowUpRight, Share2,
  MapPin, Sparkles, UserCheck, Trash2, Send, ShieldCheck, Square, X,
  Heart, Bookmark
} from 'lucide-react';
import { Issue, UserProfile, VoteChoice, VoteSubmission } from '../types';
import { computeIssueMetrics } from '../utils/summary';
import { canUserAccessIssue, isIssueCreator, TOP_CREATORS_AND_VOTERS } from '../utils/auth';
import { inferIssueRegion } from './DiscoveryHub';
import { moderateText, generateCivicAlias } from '../utils/moderation';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';
import { transformAudioVoice, blobToDataUrl, formatAudioDuration } from '../utils/audio';

interface Props {
  issue: Issue;
  currentUser: UserProfile | null;
  onOpenDetails: (issue: Issue) => void;
  onQuickVote: (issue: Issue, initialChoice?: VoteChoice) => void;
  onInlineSubmitVote: (submission: VoteSubmission) => void;
  onDeleteIssue?: (issueId: string) => void;
  onToggleLikeIssue?: (issueId: string) => void;
  onToggleFavoriteIssue?: (issueId: string) => void;
  onShareIssue: (issue: Issue) => void;
  hasUserVoted?: boolean;
  userVoteChoice?: 'YES' | 'NO';
  isLiked?: boolean;
  isFavorited?: boolean;
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
  onInlineSubmitVote,
  onDeleteIssue,
  onToggleLikeIssue,
  onToggleFavoriteIssue,
  onShareIssue,
  hasUserVoted,
  userVoteChoice,
  isLiked = false,
  isFavorited = false,
}) => {
  const metrics = computeIssueMetrics(issue);
  const access = canUserAccessIssue(issue, currentUser);
  const isCreator = isIssueCreator(issue, currentUser);
  const isDeleted = Boolean(issue.isDeletedByAuthor);
  const hasImages = !isDeleted && issue.images && issue.images.length > 0;
  const catEmoji = CATEGORY_ICONS[issue.category] || '🗳️';
  const shortCat = SHORT_CATEGORIES[issue.category] || issue.category;
  const issueRegion = inferIssueRegion(issue);

  // Inline Social Reply Drawer State (X / Instagram / Facebook style instant reply)
  const [showInlineComposer, setShowInlineComposer] = useState(false);
  const [inlineChoice, setInlineChoice] = useState<VoteChoice>(userVoteChoice || 'YES');
  const [inlineNote, setInlineNote] = useState('');
  const [inlineAnon, setInlineAnon] = useState<boolean>(currentUser?.defaultAnonymous ?? true);
  const [alias] = useState(() => generateCivicAlias());

  // Inline Quick Voice Recording State
  const [isRecordingInline, setIsRecordingInline] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [inlineVoiceDataUrl, setInlineVoiceDataUrl] = useState<string | null>(null);
  const [inlineVoiceDuration, setInlineVoiceDuration] = useState<number>(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleInstantTapVote = (choice: VoteChoice) => {
    if (!currentUser || !access.canAccess || metrics.isClosed || isDeleted) {
      onQuickVote(issue, choice);
      return;
    }

    // If user hasn't voted yet, cast their vote immediately in 1 tap (like X/Instagram like + reply)
    // and open the inline reply composer so they can optionally type a quick reply or attach audio!
    if (!hasUserVoted) {
      playHapticChime(choice === 'YES' ? 'yes' : 'no');
      triggerVoteConfetti(choice === 'YES');
      const submission: VoteSubmission = {
        id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        issueId: issue.id,
        choice,
        isAnonymous: inlineAnon,
        authorName: inlineAnon ? 'Anonymous Neighbor' : currentUser.name,
        authorEmail: !inlineAnon ? currentUser.email : undefined,
        authorAlias: inlineAnon ? alias : undefined,
        authorRole: !inlineAnon ? currentUser.role : undefined,
        createdAt: new Date().toISOString(),
        likesCount: 0,
      };
      onInlineSubmitVote(submission);
    }

    setInlineChoice(choice);
    setShowInlineComposer(true);
  };

  const startInlineMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const dur = recSeconds || 2;
        setInlineVoiceDuration(dur);
        try {
          if (inlineAnon) {
            const masked = await transformAudioVoice(blob, currentUser?.defaultVoiceFilter || 'deep');
            setInlineVoiceDataUrl(masked.dataUrl);
          } else {
            const url = await blobToDataUrl(blob);
            setInlineVoiceDataUrl(url);
          }
        } catch {
          const url = await blobToDataUrl(blob);
          setInlineVoiceDataUrl(url);
        }
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(250);
      setIsRecordingInline(true);
      setRecSeconds(0);
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setRecSeconds(elapsed);
        if (elapsed >= 60) stopInlineMic();
      }, 500);
    } catch {
      // Fallback to full VoteModal if mic permission requires attention
      onQuickVote(issue, inlineChoice);
    }
  };

  const stopInlineMic = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    setIsRecordingInline(false);
  };

  const handleInlineReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!inlineNote.trim() && !inlineVoiceDataUrl) {
      setShowInlineComposer(false);
      return;
    }
    const mod = moderateText(inlineNote);
    if (!mod.isAppropriate && mod.severity === 'rejected') return;

    const submission: VoteSubmission = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      issueId: issue.id,
      choice: inlineChoice,
      isAnonymous: inlineAnon,
      authorName: inlineAnon ? 'Anonymous Neighbor' : currentUser.name,
      authorEmail: !inlineAnon ? currentUser.email : undefined,
      authorAlias: inlineAnon ? alias : undefined,
      authorRole: !inlineAnon ? currentUser.role : undefined,
      note: inlineNote.trim() || undefined,
      voiceNote: inlineVoiceDataUrl
        ? {
            audioUrl: inlineVoiceDataUrl,
            durationSeconds: inlineVoiceDuration || 3,
            mimeType: 'audio/wav',
            createdAt: new Date().toISOString(),
            voiceFilter: inlineAnon ? (currentUser.defaultVoiceFilter || 'deep') : 'none',
            isVoiceMasked: inlineAnon,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };

    onInlineSubmitVote(submission);
    setInlineNote('');
    setInlineVoiceDataUrl(null);
    setShowInlineComposer(false);
  };

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
    <article className="card overflow-hidden hover:shadow-lift hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group relative">
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300">
                  <span>{catEmoji}</span>
                  <span>{shortCat}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300">
                  <MapPin className="w-2.5 h-2.5 text-brand-500" />
                  <span>{issueRegion === 'Global / Remote' ? 'Worldwide' : issueRegion}</span>
                </span>

                {issue.visibility === 'private' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                ) : null}

                {issue.creatorVoiceNote && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300">
                    <Mic className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> Audio
                  </span>
                )}
              </div>

              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${metrics.timeRemaining.badgeColor}`}>
                <Clock className="w-3 h-3" />
                {metrics.timeRemaining.text}
              </span>
            </div>
          )}

          {/* Personalized Match Indicator Strip (when matched by Region, Interest, or Followed Creator) */}
          {(isRegionPriority || isWorldwideMix || isInterestPriority || isFollowedCreator) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {isRegionPriority && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <MapPin className="w-2.5 h-2.5" /> Your Region Priority ({issueRegion})
                </span>
              )}
              {isWorldwideMix && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300">
                  <Globe className="w-2.5 h-2.5" /> Worldwide Feed
                </span>
              )}
              {isInterestPriority && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300">
                  <Sparkles className="w-2.5 h-2.5" /> Matches Your Interest
                </span>
              )}
              {isFollowedCreator && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  <UserCheck className="w-2.5 h-2.5" /> Following {issue.author}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h3 
            onClick={() => onOpenDetails(issue)}
            className={`text-base sm:text-lg font-extrabold cursor-pointer transition-colors leading-snug line-clamp-2 tracking-tight ${
              isDeleted
                ? 'italic text-slate-400 dark:text-zinc-500'
                : 'text-ink-950 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400'
            }`}
          >
            {isDeleted ? 'Deleted by Author' : issue.title}
          </h3>

          {/* Concise Description snippet */}
          <p 
            onClick={() => onOpenDetails(issue)}
            className={`text-xs leading-relaxed line-clamp-2 cursor-pointer ${
              isDeleted
                ? 'italic text-slate-400 dark:text-zinc-500'
                : 'text-slate-500 dark:text-zinc-400'
            }`}
          >
            {isDeleted ? 'Deleted by Author' : issue.description}
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
          
          <div className="h-2.5 w-full bg-slate-100 dark:bg-ink-950 rounded-full overflow-hidden flex p-0.5">
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

      {/* Card Footer with Replies, Like/Heart, Favourite/Bookmark, Share, Delete & 1-Tap Voting */}
      <div className="px-5 py-3 bg-slate-50/70 dark:bg-ink-950/50 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            type="button"
            onClick={() => onOpenDetails(issue)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/50 dark:hover:bg-ink-800 cursor-pointer transition-colors font-semibold"
            title="View perspectives & audio notes"
          >
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>{issue.responses.length}</span>
            </span>
            {metrics.voiceNotesCount > 0 && (
              <span className="flex items-center gap-1 text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15 px-1.5 py-0.5 rounded-full border border-brand-200/60 dark:border-brand-400/30 font-bold text-[10px]">
                <Mic className="w-2.5 h-2.5" />
                <span>{metrics.voiceNotesCount}</span>
              </span>
            )}
          </button>

          {/* Like / Heart Button + Count */}
          {onToggleLikeIssue && (
            <button
              type="button"
              onClick={() => onToggleLikeIssue(issue.id)}
              title={isLiked ? 'Unlike issue' : 'Like issue'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer active:scale-95 ${
                isLiked
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/50 dark:hover:bg-ink-800'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current text-rose-500' : ''}`} />
              <span>{issue.likesCount || 0}</span>
            </button>
          )}

          {/* Favourite / Bookmark Button + Count */}
          {onToggleFavoriteIssue && (
            <button
              type="button"
              onClick={() => onToggleFavoriteIssue(issue.id)}
              title={isFavorited ? 'Remove from Favourites' : 'Save to Favourites'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer active:scale-95 ${
                isFavorited
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/50 dark:hover:bg-ink-800'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current text-amber-500' : ''}`} />
              <span>{issue.favoritesCount || 0}</span>
            </button>
          )}

          {/* Social Share Button */}
          {!isDeleted && (
            <button
              type="button"
              onClick={() => onShareIssue(issue)}
              title="Share issue title & description to social media"
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-ink-800 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Creator Delete Issue Button (Preserves responses, replaces topic & description with 'Deleted by Author') */}
          {isCreator && !isDeleted && onDeleteIssue && (
            <button
              type="button"
              onClick={() => onDeleteIssue(issue.id)}
              title="Delete issue topic & description (keeps community responses)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
          ) : isDeleted ? (
            <button
              onClick={() => onOpenDetails(issue)}
              className="flex items-center gap-1 py-1.5 px-3 bg-slate-200 dark:bg-ink-800 hover:bg-slate-300 dark:hover:bg-ink-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              <span>View {issue.responses.length} Responses</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setInlineChoice(userVoteChoice || 'YES');
                  setShowInlineComposer(!showInlineComposer);
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 font-bold rounded-xl text-xs transition-colors cursor-pointer ${
                  userVoteChoice === 'YES'
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Voted {userVoteChoice} • Reply</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleInstantTapVote('YES')}
                className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white font-extrabold text-xs transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-3 h-3" />
                <span>YES</span>
              </button>
              <button
                type="button"
                onClick={() => handleInstantTapVote('NO')}
                className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 dark:hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white font-extrabold text-xs transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-3 h-3" />
                <span>NO</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* X / Instagram / Facebook Style Inline Quick-Reply Composer */}
      {showInlineComposer && !isDeleted && !metrics.isClosed && access.canAccess && (
        <form
          onSubmit={handleInlineReplySubmit}
          className="px-4 py-3 bg-white dark:bg-ink-900 border-t border-brand-200/70 dark:border-brand-500/30 space-y-2.5 animate-fade-in"
        >
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-500 dark:text-zinc-400">Your Stance:</span>
              <button
                type="button"
                onClick={() => setInlineChoice('YES')}
                className={`px-2 py-0.5 rounded-md font-extrabold cursor-pointer ${
                  inlineChoice === 'YES'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                👍 YES
              </button>
              <button
                type="button"
                onClick={() => setInlineChoice('NO')}
                className={`px-2 py-0.5 rounded-md font-extrabold cursor-pointer ${
                  inlineChoice === 'NO'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                👎 NO
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInlineAnon(!inlineAnon)}
                className={`px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 cursor-pointer ${
                  inlineAnon
                    ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-400/30'
                    : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300'
                }`}
                title="Toggle Anonymous vs Public Name"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{inlineAnon ? alias : currentUser?.name.split(' ')[0]}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInlineComposer(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                title="Close reply bar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Recorded voice badge if attached */}
          {inlineVoiceDataUrl && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-400/30 text-xs">
              <span className="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                <span>Voice note ready ({formatAudioDuration(inlineVoiceDuration)}) {inlineAnon ? '• 🛡️ Masked' : ''}</span>
              </span>
              <button
                type="button"
                onClick={() => setInlineVoiceDataUrl(null)}
                className="text-rose-500 hover:underline text-[11px] font-semibold cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          {/* Single-line Social Reply Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inlineNote}
              onChange={(e) => setInlineNote(e.target.value)}
              placeholder={`Add a quick reply to your ${inlineChoice} vote (like X / Instagram)...`}
              className="flex-1 text-xs px-3.5 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-full focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
            />

            {/* 1-Tap Inline Voice Note Mic Button */}
            {isRecordingInline ? (
              <button
                type="button"
                onClick={stopInlineMic}
                className="px-3 py-2 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-1 animate-pulse cursor-pointer shrink-0"
                title="Stop recording"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>{formatAudioDuration(recSeconds)}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startInlineMic}
                className="p-2 rounded-full bg-slate-100 dark:bg-ink-800 hover:bg-brand-50 dark:hover:bg-brand-500/20 text-slate-600 dark:text-zinc-300 hover:text-brand-600 transition-colors cursor-pointer shrink-0"
                title="Record quick 60s voice note"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="submit"
              disabled={!inlineNote.trim() && !inlineVoiceDataUrl}
              className={`p-2 rounded-full transition-all shrink-0 ${
                inlineNote.trim() || inlineVoiceDataUrl
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow cursor-pointer'
                  : 'bg-slate-200 dark:bg-ink-800 text-slate-400 cursor-not-allowed'
              }`}
              title="Post Reply"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </article>
  );
};
