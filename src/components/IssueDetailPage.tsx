import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Mic, ShieldCheck, 
  Heart, User, Lock, Globe, Clock,
  Sparkles, Share2, Trash2, Send, Square, Bookmark,
  Smile, Check, Copy, ExternalLink, ChevronLeft, ChevronRight, Flag, Pencil
} from 'lucide-react';
import { Issue, VoteSubmission, UserProfile, VoteChoice, CommentReply } from '../types';
import { VoicePlayer } from './VoicePlayer';
import { IssueSummaryView } from './IssueSummaryView';
import { computeIssueMetrics, formatRelativeTime, getAuthorDisplay, getUserDisplayName } from '../utils/summary';
import { canUserAccessIssue, isIssueCreator } from '../utils/auth';
import { moderateText, generateCivicAlias } from '../utils/moderation';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';
import { transformAudioVoice, blobToDataUrl } from '../utils/audio';
import { ReportIssueModal } from './ReportIssueModal';

export const AVAILABLE_REACTIONS = [
  { emoji: '👍', label: 'Agree' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '💡', label: 'Insightful' },
  { emoji: '🔥', label: 'Hot Take' },
  { emoji: '👏', label: 'Applause' },
  { emoji: '🤔', label: 'Thinking' },
];

interface Props {
  issue: Issue;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenVoteModal: (initialChoice?: VoteChoice) => void;
  onInlineSubmitVote: (submission: VoteSubmission) => void;
  onDeleteIssue?: (issueId: string) => void;
  onEditIssue?: (issue: Issue) => void;
  onToggleLikeIssue?: (issueId: string) => void;
  onToggleFavoriteIssue?: (issueId: string) => void;
  onShareIssue: (issue: Issue) => void;
  hasUserVoted?: boolean;
  userVoteChoice?: 'YES' | 'NO';
  isLiked?: boolean;
  isFavorited?: boolean;
  onLikeResponse?: (responseId: string) => void;
  onReportResponse?: (responseId: string) => void;
  onAddCommentReply?: (issueId: string, submissionId: string, reply: CommentReply) => void;
  onLikeCommentReply?: (issueId: string, submissionId: string, replyId: string) => void;
  onToggleCommentReaction?: (issueId: string, submissionId: string, emoji: string) => void;
  onToggleReplyReaction?: (issueId: string, submissionId: string, replyId: string, emoji: string) => void;
  onShareComment?: (issue: Issue, author: string, text: string, commentId: string) => void;
  onAddInvite?: (issueId: string, email: string) => void;
  onAddGroupInvite?: (issueId: string, group: string) => void;
}

export const IssueDetailPage: React.FC<Props> = (props) => {
  const {
    issue,
    currentUser,
    onClose,
    onOpenVoteModal,
    onInlineSubmitVote,
    onDeleteIssue,
    onEditIssue,
    onToggleLikeIssue,
    onToggleFavoriteIssue,
    onShareIssue,
    hasUserVoted,
    userVoteChoice,
    isLiked = false,
    isFavorited = false,
    onAddCommentReply,
    onToggleCommentReaction,
  } = props;
  const [activeTab, setActiveTab] = useState<'perspectives' | 'digest' | 'brief'>('perspectives');
  const [filter, setFilter] = useState<'ALL' | 'YES' | 'NO' | 'VOICE'>('ALL');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Inline Quick Reply State
  const [replyChoice, setReplyChoice] = useState<VoteChoice>(userVoteChoice || 'YES');
  const [replyNote, setReplyNote] = useState('');
  const [replyAnon, setReplyAnon] = useState<boolean>(currentUser?.defaultAnonymous ?? true);
  const [alias] = useState(() => generateCivicAlias());

  // Inline Quick Voice Recording
  const [isRec, setIsRec] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceDur, setVoiceDur] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Comment Replies & Reactions State
  const [activeReplySubmissionId, setActiveReplySubmissionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyIsAnon, setReplyIsAnon] = useState(false);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Social Share Perspective Modal State
  const [sharingComment, setSharingComment] = useState<{
    id: string;
    author: string;
    text: string;
    choice: VoteChoice;
  } | null>(null);
  const [copiedCommentLink, setCopiedCommentLink] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const metrics = computeIssueMetrics(issue);
  const access = canUserAccessIssue(issue, currentUser);
  const isCreator = isIssueCreator(issue, currentUser);
  const isDeleted = Boolean(issue.isDeletedByAuthor);
  const authorInfo = getAuthorDisplay(issue, currentUser);
  const relativeTime = formatRelativeTime(issue.createdAt);

  const totalConversationCount = issue.responses.reduce((acc, resp) => {
    return acc + 1 + (resp.replies?.length || 0);
  }, 0);

  // Scroll to top upon opening an issue so top navigation, question and creator are never cut off
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetCommentId = params.get('c');
      if (targetCommentId) {
        setHighlightedCommentId(targetCommentId);
        setTimeout(() => {
          const el = document.getElementById(`comment-${targetCommentId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    } catch {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [issue.id]);

  const handleInstantVoteTap = (choice: VoteChoice) => {
    if (!currentUser || !access.canAccess || metrics.isClosed || isDeleted) {
      onOpenVoteModal(choice);
      return;
    }

    if (!hasUserVoted) {
      playHapticChime(choice === 'YES' ? 'yes' : 'no');
      triggerVoteConfetti(choice === 'YES');
      const submission: VoteSubmission = {
        id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        issueId: issue.id,
        choice,
        isAnonymous: replyAnon,
        authorName: replyAnon ? 'Anonymous Neighbor' : getUserDisplayName(currentUser),
        authorUsername: !replyAnon ? currentUser.username : undefined,
        authorEmail: !replyAnon ? currentUser.email : undefined,
        authorAlias: replyAnon ? alias : undefined,
        authorRole: !replyAnon ? currentUser.role : undefined,
        createdAt: new Date().toISOString(),
        likesCount: 0,
      };
      onInlineSubmitVote(submission);
    }

    setReplyChoice(choice);
  };

  const startMic = async () => {
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
        const dur = recSec || 2;
        setVoiceDur(dur);
        try {
          if (replyAnon) {
            const masked = await transformAudioVoice(blob, currentUser?.defaultVoiceFilter || 'deep');
            setVoiceUrl(masked.dataUrl);
          } else {
            const url = await blobToDataUrl(blob);
            setVoiceUrl(url);
          }
        } catch {
          const url = await blobToDataUrl(blob);
          setVoiceUrl(url);
        }
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setIsRec(true);
      setRecSec(0);
      playHapticChime('tap');

      timerRef.current = window.setInterval(() => {
        setRecSec((s) => {
          if (s >= 59) {
            stopMic();
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      alert('Microphone access was denied or unavailable.');
    }
  };

  const stopMic = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      mediaRecRef.current.stop();
    }
    setIsRec(false);
  };

  const discardMic = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      mediaRecRef.current.stop();
    }
    setIsRec(false);
    setVoiceUrl(null);
    setVoiceDur(0);
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !access.canAccess || metrics.isClosed || isDeleted) return;

    if (replyNote.trim()) {
      const mod = moderateText(replyNote);
      if (!mod.isAppropriate) {
        alert(`Perspective rejected: flagged for ${mod.flags.join(', ')}`);
        return;
      }
    }

    const submission: VoteSubmission = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      issueId: issue.id,
      choice: replyChoice,
      isAnonymous: replyAnon,
      authorName: replyAnon ? 'Anonymous Neighbor' : getUserDisplayName(currentUser),
      authorUsername: !replyAnon ? currentUser.username : undefined,
      authorEmail: !replyAnon ? currentUser.email : undefined,
      authorAlias: replyAnon ? alias : undefined,
      authorRole: !replyAnon ? currentUser.role : undefined,
      note: replyNote.trim() || undefined,
      voiceNote: voiceUrl
        ? {
            audioUrl: voiceUrl,
            durationSeconds: voiceDur || 3,
            mimeType: 'audio/wav',
            createdAt: new Date().toISOString(),
            voiceFilter: replyAnon ? currentUser?.defaultVoiceFilter || 'deep' : 'none',
            isVoiceMasked: replyAnon,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };

    onInlineSubmitVote(submission);
    playHapticChime('yes');
    triggerVoteConfetti(replyChoice === 'YES');
    setReplyNote('');
    setVoiceUrl(null);
    setVoiceDur(0);
  };

  const handleSubmitCommentReply = (submissionId: string, replyToAuthor: string) => {
    if (!currentUser || !replyText.trim() || !onAddCommentReply) return;

    const mod = moderateText(replyText);
    if (!mod.isAppropriate) {
      alert(`Reply rejected: flagged for ${mod.flags.join(', ')}`);
      return;
    }

    const newReply: CommentReply = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submissionId,
      authorName: replyIsAnon ? 'Anonymous Neighbor' : getUserDisplayName(currentUser),
      authorUsername: !replyIsAnon ? currentUser.username : undefined,
      authorEmail: !replyIsAnon ? currentUser.email : undefined,
      authorAlias: replyIsAnon ? alias : undefined,
      authorRole: !replyIsAnon ? currentUser.role : undefined,
      isAnonymous: replyIsAnon,
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
      likesCount: 0,
      replyToName: replyToAuthor,
    };

    onAddCommentReply(issue.id, submissionId, newReply);
    playHapticChime('yes');
    setReplyText('');
    setActiveReplySubmissionId(null);
  };

  const filteredResponses = issue.responses.filter((r) => {
    if (filter === 'YES') return r.choice === 'YES';
    if (filter === 'NO') return r.choice === 'NO';
    if (filter === 'VOICE') return Boolean(r.voiceNote);
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto w-full space-y-4 pb-16 animate-fade-in">
      {/* Back Navigation Bar & Category Pills */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-white dark:bg-ink-900 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-ink-800 transition-all shadow-2xs cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-brand-500" />
          <span>Back to Issues</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/30">
            {issue.category}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{metrics.timeRemaining.text}</span>
          </span>
        </div>
      </div>

      {/* Main Issue Card Container */}
      <article className="card overflow-hidden border border-slate-200/70 dark:border-white/10 shadow-soft">
        {/* Creator Info Strip */}
        <div className="p-5 sm:p-6 pb-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={authorInfo.avatarUrl}
              alt={authorInfo.fullName}
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authorInfo.fullName)}`;
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base text-ink-950 dark:text-white truncate">
                  {authorInfo.displayName}
                </span>
                <span className="text-slate-300 dark:text-zinc-600">•</span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                  {relativeTime}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500 block truncate">
                {authorInfo.fullName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            {issue.isFlagged || (issue.flagReportsCount && issue.flagReportsCount > 0) ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                ⚠️ Under review
              </span>
            ) : null}

            {issue.visibility === 'private' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-400/20">
                <Lock className="w-3 h-3" /> Private Circle
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-300">
                <Globe className="w-3 h-3 text-emerald-500" /> Public
              </span>
            )}
          </div>
        </div>

        {/* Issue Question, Action Buttons & Context Body */}
        <div className="p-5 sm:p-7 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-black text-ink-950 dark:text-white leading-tight tracking-tight">
            {isDeleted ? 'Deleted by Author' : issue.title}
          </h1>

          {/* ACTION BUTTONS DIRECTLY UNDERNEATH ISSUE QUESTION */}
          <div className="flex items-center flex-wrap gap-2 pt-1 pb-3 border-b border-slate-100 dark:border-white/5">
            {/* Like / Heart Button */}
            {onToggleLikeIssue && (
              <button
                type="button"
                onClick={() => onToggleLikeIssue(issue.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isLiked
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200/60 dark:border-rose-400/30'
                    : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-rose-500' : ''}`} />
                <span>{issue.likesCount || 0} Likes</span>
              </button>
            )}

            {/* Favourite / Bookmark Button */}
            {onToggleFavoriteIssue && (
              <button
                type="button"
                onClick={() => onToggleFavoriteIssue(issue.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isFavorited
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200/60 dark:border-amber-400/30'
                    : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300 hover:text-amber-600 hover:bg-amber-50 border border-transparent'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isFavorited ? 'fill-current text-amber-500' : ''}`} />
                <span>{isFavorited ? 'Saved' : 'Save'}</span>
              </button>
            )}

            {/* Social Share Card Button */}
            {!isDeleted && (
              <button
                type="button"
                onClick={() => onShareIssue(issue)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-glow cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Card</span>
              </button>
            )}

            {/* Flag / Report Issue Button */}
            {!isDeleted && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-ink-800 hover:text-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report</span>
              </button>
            )}

            {/* Creator Edit Issue Button */}
            {isCreator && !isDeleted && onEditIssue && (
              <button
                type="button"
                onClick={() => onEditIssue(issue)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 transition-all cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Issue</span>
              </button>
            )}

            {/* Creator Delete Issue Button */}
            {isCreator && !isDeleted && onDeleteIssue && (
              <button
                type="button"
                onClick={() => onDeleteIssue(issue.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 transition-all cursor-pointer sm:ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Topic</span>
              </button>
            )}
          </div>

          {/* Description & Audio Brief */}
          <div className="space-y-3 pt-1">
            <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed">
              {isDeleted ? 'Deleted by Author' : issue.description}
            </p>

            {/* Audio brief by creator */}
            {!isDeleted && issue.creatorVoiceNote && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Creator Spoken Audio Brief</span>
                </span>
                <VoicePlayer attachment={issue.creatorVoiceNote} compact />
              </div>
            )}

            {/* Attached Image Gallery */}
            {!isDeleted && issue.images && issue.images.length > 0 && (
              <div className="pt-2">
                <div className="relative rounded-2xl overflow-hidden bg-ink-950 aspect-[16/9] max-h-80 flex items-center justify-center">
                  <img
                    src={issue.images[activeImageIndex]}
                    alt={`${issue.title} attachment ${activeImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {issue.images.length > 1 && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((i) => (i > 0 ? i - 1 : issue.images!.length - 1))}
                        className="p-1.5 rounded-full bg-black/60 text-white pointer-events-auto hover:bg-black/80"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-mono">
                        {activeImageIndex + 1} / {issue.images.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveImageIndex((i) => (i < issue.images!.length - 1 ? i + 1 : 0))}
                        className="p-1.5 rounded-full bg-black/60 text-white pointer-events-auto hover:bg-black/80"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CONSENSUS SPLIT RESULTS: ONLY VISIBLE IF USER HAS VOTED */}
          {hasUserVoted ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 space-y-2 mt-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <ThumbsUp className="w-4 h-4" />
                  <span>YES {metrics.yesPercent}% ({issue.yesCount})</span>
                </span>
                <span className="text-slate-400 dark:text-zinc-500 font-mono text-[11px]">
                  {metrics.totalVotes} total votes
                </span>
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <span>({issue.noCount}) NO {metrics.noPercent}%</span>
                  <ThumbsDown className="w-4 h-4" />
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 dark:bg-ink-950 rounded-full overflow-hidden flex p-0.5">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                  style={{ width: `${metrics.totalVotes === 0 ? 50 : metrics.yesPercent}%` }} 
                />
                <div 
                  className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500 ml-0.5" 
                  style={{ width: `${metrics.totalVotes === 0 ? 50 : metrics.noPercent}%` }} 
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-white/[0.02] border border-brand-100 dark:border-white/5 flex items-center justify-between text-xs mt-4">
              <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                <Lock className="w-4 h-4 text-brand-500 shrink-0" />
                <span>Cast your vote (YES or NO) below to reveal the community results.</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 shrink-0">
                {metrics.totalVotes} votes cast
              </span>
            </div>
          )}
        </div>

        {/* Instant Vote / Reply Composer */}
        <div className="p-5 sm:p-7 pt-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.01]">
          <form onSubmit={handleSubmitReply} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink-900 dark:text-zinc-200">
                {hasUserVoted ? 'Add to your perspective / Update stance' : 'Cast your stance & reply'}
              </span>

              {/* Anonymous Toggle */}
              <button
                type="button"
                onClick={() => setReplyAnon(!replyAnon)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  replyAnon
                    ? 'bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30'
                    : 'text-slate-500 hover:text-ink-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{replyAnon ? `Anon (${alias})` : currentUser?.name || 'Identified'}</span>
              </button>
            </div>

            {/* 1-Tap YES / NO Choice Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleInstantVoteTap('YES')}
                className={`py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-soft ${
                  replyChoice === 'YES'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 scale-[1.01]'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>VOTE YES</span>
              </button>

              <button
                type="button"
                onClick={() => handleInstantVoteTap('NO')}
                className={`py-3 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-soft ${
                  replyChoice === 'NO'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-400 scale-[1.01]'
                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>VOTE NO</span>
              </button>
            </div>

            {/* Optional Written Perspective */}
            <div className="relative">
              <textarea
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                placeholder={`Why are you voting ${replyChoice}? Share your rationale (optional)...`}
                rows={2}
                maxLength={500}
                className="w-full p-3 text-xs sm:text-sm rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            {/* Audio Recording Attachment */}
            {voiceUrl && (
              <div className="p-3 rounded-2xl bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                <VoicePlayer attachment={{ audioUrl: voiceUrl, durationSeconds: voiceDur, mimeType: 'audio/wav', createdAt: new Date().toISOString() }} compact />
                <button
                  type="button"
                  onClick={discardMic}
                  className="text-xs text-rose-500 hover:underline px-2"
                >
                  Discard
                </button>
              </div>
            )}

            {/* Submit & Voice Mic Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {!isRec ? (
                  <button
                    type="button"
                    onClick={startMic}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-ink-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-200 hover:text-brand-600 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-amber-500" />
                    <span>Attach Audio (1-Min)</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500 text-white animate-pulse">
                    <Square className="w-3 h-3 fill-current" />
                    <span>Recording ({recSec}s)</span>
                    <button
                      type="button"
                      onClick={stopMic}
                      className="ml-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px]"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={metrics.isClosed || isDeleted}
                className="btn-brand py-2 px-5 text-xs font-bold shadow-glow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Perspective</span>
              </button>
            </div>
          </form>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-100/80 dark:bg-white/[0.02] border-t border-slate-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('perspectives')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'perspectives'
                ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-soft'
                : 'text-slate-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Perspectives ({totalConversationCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('digest')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'digest'
                ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-soft'
                : 'text-slate-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>AI Synthesis</span>
          </button>
        </div>

        {/* Tab 1: Perspectives Feed */}
        {activeTab === 'perspectives' && (
          <div className="p-5 sm:p-7 space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-950 p-1 rounded-xl text-xs border border-slate-200/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'ALL'
                      ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  All ({issue.responses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('YES')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'YES'
                      ? 'bg-white dark:bg-ink-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  Yes ({issue.responses.filter((r) => r.choice === 'YES').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('NO')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'NO'
                      ? 'bg-white dark:bg-ink-800 text-rose-600 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  No ({issue.responses.filter((r) => r.choice === 'NO').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('VOICE')}
                  className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    filter === 'VOICE'
                      ? 'bg-white dark:bg-ink-800 text-amber-600 dark:text-amber-400 shadow-2xs'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span>Audio ({metrics.voiceNotesCount})</span>
                </button>
              </div>
            </div>

            {/* Perspectives List */}
            {filteredResponses.length === 0 ? (
              <div className="card text-center py-12 p-6 border-dashed border-slate-200 dark:border-white/10 space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  No community perspectives recorded in this view yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  Be the first to share your rationale above!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResponses.map((resp: VoteSubmission) => {
                  return (
                    <div
                      key={resp.id}
                      id={`comment-${resp.id}`}
                      className={`card p-4 space-y-2.5 border border-slate-200/60 dark:border-white/10 shadow-2xs transition-all ${
                        highlightedCommentId === resp.id
                          ? 'ring-2 ring-brand-500 bg-brand-50/20 dark:bg-brand-950/20 border-brand-400'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-ink-800 flex items-center justify-center text-slate-600 dark:text-zinc-300">
                            {resp.isAnonymous ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-ink-950 dark:text-white">
                                {resp.isAnonymous 
                                  ? resp.authorAlias || 'Anonymous' 
                                  : (resp.authorUsername ? `@${resp.authorUsername.replace(/^@/, '')}` : (resp.authorName || 'Member'))}
                              </span>
                              {resp.authorRole && (
                                <span className="text-[11px] text-slate-400">• {resp.authorRole}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            resp.choice === 'YES'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-400/30'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-400/30'
                          }`}
                        >
                          {resp.choice === 'YES' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                          <span>{resp.choice}</span>
                        </span>
                      </div>

                      {resp.note && (
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          {resp.note}
                        </p>
                      )}

                      {resp.voiceNote && (
                        <VoicePlayer attachment={resp.voiceNote} compact />
                      )}

                      {/* Comment Reaction Pills Row */}
                      {resp.reactions && Object.keys(resp.reactions).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {Object.entries(resp.reactions).map(([emoji, count]) => {
                            if (!count || count <= 0) return null;
                            const userKey = currentUser?.email || currentUser?.id || '';
                            const hasReacted = userKey && resp.userReactions?.[emoji]?.includes(userKey);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  if (!currentUser) {
                                    onOpenVoteModal();
                                    return;
                                  }
                                  if (onToggleCommentReaction) {
                                    onToggleCommentReaction(issue.id, resp.id, emoji);
                                  }
                                  playHapticChime('yes');
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer ${
                                  hasReacted
                                    ? 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/40 font-bold shadow-2xs scale-105'
                                    : 'bg-slate-100 dark:bg-ink-800/80 text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-white/10 hover:border-slate-300'
                                }`}
                              >
                                <span className="text-sm leading-none">{emoji}</span>
                                <span className="text-[11px] font-bold">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Comment Action Footer: React, Reply, Share */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <span>{new Date(resp.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>

                        <div className="flex items-center gap-2 sm:gap-3 relative">
                          {/* Emoji Reaction Button & Floating Picker */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (!currentUser) {
                                  onOpenVoteModal();
                                  return;
                                }
                                setActiveReactionPickerId((prev) => (prev === resp.id ? null : resp.id));
                              }}
                              className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
                                activeReactionPickerId === resp.id
                                  ? 'text-brand-600 dark:text-brand-400 font-bold'
                                  : 'text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400'
                              }`}
                              title="React with emoji"
                            >
                              <Smile className="w-3.5 h-3.5" />
                              <span>React</span>
                            </button>

                            {activeReactionPickerId === resp.id && (
                              <div className="absolute right-0 sm:left-0 bottom-full mb-2 z-30 flex items-center gap-1 bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/15 rounded-full px-2 py-1 shadow-lift animate-fade-in backdrop-blur-md">
                                {AVAILABLE_REACTIONS.map(({ emoji, label }) => {
                                  const userKey = currentUser?.email || currentUser?.id || '';
                                  const userHas = userKey && resp.userReactions?.[emoji]?.includes(userKey);
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => {
                                        if (onToggleCommentReaction) {
                                          onToggleCommentReaction(issue.id, resp.id, emoji);
                                        }
                                        playHapticChime('yes');
                                        setActiveReactionPickerId(null);
                                      }}
                                      className={`p-1.5 rounded-full hover:scale-125 transition-transform cursor-pointer text-base ${
                                        userHas ? 'bg-brand-50 dark:bg-brand-500/20' : ''
                                      }`}
                                      title={label}
                                    >
                                      {emoji}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Reply Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplySubmissionId((prev) => (prev === resp.id ? null : resp.id));
                            }}
                            className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
                              activeReplySubmissionId === resp.id
                                ? 'text-brand-600 dark:text-brand-400 font-bold'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Reply{resp.replies && resp.replies.length > 0 ? ` (${resp.replies.length})` : ''}</span>
                          </button>

                          {/* Share Perspective Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSharingComment({
                                id: resp.id,
                                author: resp.isAnonymous ? resp.authorAlias || 'Anonymous' : resp.authorName,
                                text: resp.note || (resp.voiceNote ? 'Spoken Voice Briefing' : `Voted ${resp.choice}`),
                                choice: resp.choice,
                              });
                            }}
                            className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer font-medium"
                            title="Share this perspective"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>

                      {/* Nested Replies List */}
                      {resp.replies && resp.replies.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5 pl-3 border-l-2 border-brand-500/30">
                          {resp.replies.map((reply) => {
                            return (
                              <div key={reply.id} className="text-xs space-y-1 bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-ink-950 dark:text-white">
                                    {reply.isAnonymous 
                                      ? reply.authorAlias || 'Anonymous' 
                                      : (reply.authorUsername ? `@${reply.authorUsername.replace(/^@/, '')}` : (reply.authorName || 'Member'))}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(reply.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">
                                  {reply.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Reply Input Box */}
                      {activeReplySubmissionId === resp.id && (
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2 animate-fade-in">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${resp.isAnonymous ? 'Anonymous' : resp.authorName}...`}
                            rows={2}
                            className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                          />
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setReplyIsAnon(!replyIsAnon)}
                              className="text-[11px] text-slate-500 hover:text-ink-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3 text-brand-500" />
                              <span>{replyIsAnon ? 'Replying Anonymously' : 'Replying Publicly'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSubmitCommentReply(resp.id, resp.authorName)}
                              disabled={!replyText.trim()}
                              className="btn-brand py-1.5 px-3 text-xs font-bold shadow-soft flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              <span>Post Reply</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: AI Synthesis */}
        {activeTab === 'digest' && (
          <div className="p-5 sm:p-7">
            <IssueSummaryView issue={issue} />
          </div>
        )}
      </article>

      {/* Social Perspective Share Dialog */}
      {sharingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-ink-900 rounded-3xl p-6 shadow-lift border border-slate-200 dark:border-white/10 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-950 dark:text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-brand-500" />
                <span>Share Perspective</span>
              </h3>
              <button
                type="button"
                onClick={() => setSharingComment(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-950 dark:text-white">{sharingComment.author}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  sharingComment.choice === 'YES' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  Voted {sharingComment.choice}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 italic">
                &ldquo;{sharingComment.text}&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}${window.location.pathname}?c=${sharingComment.id}#issue/${issue.id}`;
                  await navigator.clipboard.writeText(shareUrl);
                  setCopiedCommentLink(true);
                  setTimeout(() => setCopiedCommentLink(false), 2000);
                }}
                className="btn-ghost py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedCommentLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCommentLink ? 'Copied Link!' : 'Copy Direct Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const shareUrl = `${window.location.origin}${window.location.pathname}?c=${sharingComment.id}#issue/${issue.id}`;
                  const tweetText = `"${sharingComment.text}" — ${sharingComment.author} on YesOrNo: ${issue.title}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                }}
                className="btn-brand py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-glow cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Share to X</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Report / Flag Issue Modal */}
      {showReportModal && (
        <ReportIssueModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          issue={issue}
          currentUser={currentUser}
          onReportSubmitted={() => {
            issue.flagReportsCount = (issue.flagReportsCount || 0) + 1;
            if (issue.flagReportsCount >= 2) {
              issue.isFlagged = true;
            }
          }}
        />
      )}
    </div>
  );
};
