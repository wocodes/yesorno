import React, { useState, useRef } from 'react';
import { 
  X, ThumbsUp, ThumbsDown, MessageSquare, Mic, ShieldCheck, 
  Flag, Heart, Tag, User, Lock, Globe, Clock,
  UserPlus, Sparkles, FileText, Share2, Trash2, Send, Square, Bookmark
} from 'lucide-react';
import { Issue, VoteSubmission, UserProfile, VoteChoice, CommentReply } from '../types';
import { VoicePlayer } from './VoicePlayer';
import { IssueSummaryView } from './IssueSummaryView';
import { computeIssueMetrics } from '../utils/summary';
import { canUserAccessIssue, isIssueCreator } from '../utils/auth';
import { moderateText, generateCivicAlias } from '../utils/moderation';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';
import { transformAudioVoice, blobToDataUrl, formatAudioDuration } from '../utils/audio';

interface Props {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVoteModal: (initialChoice?: VoteChoice) => void;
  onInlineSubmitVote: (submission: VoteSubmission) => void;
  onDeleteIssue?: (issueId: string) => void;
  onToggleLikeIssue?: (issueId: string) => void;
  onToggleFavoriteIssue?: (issueId: string) => void;
  onShareIssue: (issue: Issue) => void;
  currentUser: UserProfile | null;
  hasUserVoted?: boolean;
  userVoteChoice?: 'YES' | 'NO';
  isLiked?: boolean;
  isFavorited?: boolean;
  onLikeResponse?: (responseId: string) => void;
  onReportResponse?: (responseId: string) => void;
  onAddCommentReply?: (issueId: string, submissionId: string, reply: CommentReply) => void;
  onLikeCommentReply?: (issueId: string, submissionId: string, replyId: string) => void;
  onAddInvite?: (issueId: string, email: string) => void;
  onAddGroupInvite?: (issueId: string, group: string) => void;
}

export const IssueDetailModal: React.FC<Props> = ({
  issue,
  isOpen,
  onClose,
  onOpenVoteModal,
  onInlineSubmitVote,
  onDeleteIssue,
  onToggleLikeIssue,
  onToggleFavoriteIssue,
  onShareIssue,
  currentUser,
  hasUserVoted,
  userVoteChoice,
  isLiked = false,
  isFavorited = false,
  onLikeResponse,
  onReportResponse,
  onAddCommentReply,
  onLikeCommentReply,
  onAddInvite,
  onAddGroupInvite
}) => {
  const [activeTab, setActiveTab] = useState<'perspectives' | 'digest' | 'brief'>('perspectives');
  const [filter, setFilter] = useState<'ALL' | 'YES' | 'NO' | 'VOICE'>('ALL');
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteGroup, setInviteGroup] = useState('');
  const [showManageInvites, setShowManageInvites] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // X / Instagram / Facebook Style Inline Reply State
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

  // Direct Threaded Comment Reply State
  const [activeReplySubmissionId, setActiveReplySubmissionId] = useState<string | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyAnonMap, setReplyAnonMap] = useState<Record<string, boolean>>({});

  if (!isOpen || !issue) return null;

  const metrics = computeIssueMetrics(issue);
  const access = canUserAccessIssue(issue, currentUser);
  const isCreator = isIssueCreator(issue, currentUser);
  const isDeleted = Boolean(issue.isDeletedByAuthor);
  const hasImages = !isDeleted && issue.images && issue.images.length > 0;

  const startQuickMic = async () => {
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
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(250);
      setIsRec(true);
      setRecSec(0);
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setRecSec(elapsed);
        if (elapsed >= 60) stopQuickMic();
      }, 500);
    } catch {
      onOpenVoteModal(replyChoice);
    }
  };

  const stopQuickMic = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    setIsRec(false);
  };

  const handleQuickSocialSubmit = (e: React.FormEvent, explicitChoice?: VoteChoice) => {
    e.preventDefault();
    if (!currentUser || isDeleted || metrics.isClosed || !access.canAccess) return;

    const finalChoice = explicitChoice || replyChoice;
    const mod = moderateText(replyNote);
    if (replyNote.trim() && !mod.isAppropriate && mod.severity === 'rejected') return;

    playHapticChime(finalChoice === 'YES' ? 'yes' : 'no');
    triggerVoteConfetti(finalChoice === 'YES');

    const submission: VoteSubmission = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      issueId: issue.id,
      choice: finalChoice,
      isAnonymous: replyAnon,
      authorName: replyAnon ? 'Anonymous Neighbor' : currentUser.name,
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
            voiceFilter: replyAnon ? (currentUser.defaultVoiceFilter || 'deep') : 'none',
            isVoiceMasked: replyAnon,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };

    onInlineSubmitVote(submission);
    setReplyNote('');
    setVoiceUrl(null);
  };

  const filteredResponses = issue.responses.filter((r) => {
    if (filter === 'YES') return r.choice === 'YES';
    if (filter === 'NO') return r.choice === 'NO';
    if (filter === 'VOICE') return !!r.voiceNote;
    return true;
  });

  const totalConversationCount = issue.responses.reduce(
    (sum, r) => sum + 1 + (r.replies?.length || 0),
    0
  );

  const handleSendDirectReply = (parentSubmission: VoteSubmission) => {
    if (!issue) return;
    if (!currentUser) {
      onOpenVoteModal();
      return;
    }
    const text = (replyTextMap[parentSubmission.id] || '').trim();
    if (!text) return;

    const mod = moderateText(text);
    if (!mod.isAppropriate && mod.severity === 'rejected') return;

    const isAnon = replyAnonMap[parentSubmission.id] ?? false;
    const parentAuthor = parentSubmission.isAnonymous
      ? (parentSubmission.authorAlias || 'Anonymous')
      : parentSubmission.authorName;

    const newReply: CommentReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submissionId: parentSubmission.id,
      authorName: isAnon ? 'Anonymous Neighbor' : currentUser.name,
      authorEmail: !isAnon ? currentUser.email : undefined,
      authorAlias: isAnon ? alias : undefined,
      authorRole: !isAnon ? currentUser.role : undefined,
      isAnonymous: isAnon,
      content: text,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      replyToName: parentAuthor,
    };

    if (onAddCommentReply) {
      onAddCommentReply(issue.id, parentSubmission.id, newReply);
    }

    setReplyTextMap(prev => ({ ...prev, [parentSubmission.id]: '' }));
    setActiveReplySubmissionId(null);
    playHapticChime('yes');
  };

  const handleReport = (id: string) => {
    setReportedIds(prev => new Set(prev).add(id));
    if (onReportResponse) onReportResponse(id);
  };

  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !onAddInvite) return;
    onAddInvite(issue.id, inviteEmail.trim().toLowerCase());
    setInviteEmail('');
  };

  const handleSendGroupInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteGroup.trim() || !onAddGroupInvite) return;
    onAddGroupInvite(issue.id, inviteGroup.trim());
    setInviteGroup('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-hidden overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-detail-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-ink-900 sm:rounded-3xl shadow-lift border border-black/[0.08] dark:border-white/10 overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-slide-up overscroll-contain">
        {/* Dark Executive Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 whitespace-nowrap shrink-0">
                {issue.category}
              </span>
              {issue.visibility === 'private' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 whitespace-nowrap shrink-0">
                  <Lock className="w-3 h-3 shrink-0" /> Private
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-zinc-300 whitespace-nowrap shrink-0">
                  <Globe className="w-3 h-3 text-emerald-400 shrink-0" /> Public
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3 shrink-0" /> {metrics.timeRemaining.text}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Like / Heart Issue Button */}
              {onToggleLikeIssue && (
                <button
                  type="button"
                  onClick={() => onToggleLikeIssue(issue.id)}
                  title={isLiked ? 'Unlike issue' : 'Like issue'}
                  className={`px-2 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                    isLiked
                      ? 'text-rose-400'
                      : 'text-zinc-300 hover:text-rose-400'
                  }`}
                >
                  <Heart className={`w-4 h-4 shrink-0 ${isLiked ? 'fill-current text-rose-500' : ''}`} />
                  <span>{issue.likesCount || 0}</span>
                </button>
              )}

              {/* Favourite / Bookmark Issue Button */}
              {onToggleFavoriteIssue && (
                <button
                  type="button"
                  onClick={() => onToggleFavoriteIssue(issue.id)}
                  title={isFavorited ? 'Remove from Favourites' : 'Save to Favourites'}
                  className={`px-2 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                    isFavorited
                      ? 'text-amber-400'
                      : 'text-zinc-300 hover:text-amber-400'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 shrink-0 ${isFavorited ? 'fill-current text-amber-400' : ''}`} />
                  <span>{issue.favoritesCount || 0}</span>
                </button>
              )}

              {isCreator && !isDeleted && onDeleteIssue && (
                <button
                  onClick={() => onDeleteIssue(issue.id)}
                  title="Delete issue topic & description (keeps community responses)"
                  className="px-2.5 py-1.5 text-rose-200 hover:text-white rounded-full bg-rose-500/20 hover:bg-rose-600 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Delete Topic</span>
                </button>
              )}
              {!isDeleted && (
                <button
                  onClick={() => onShareIssue(issue)}
                  title="Share issue to social media"
                  className="px-2.5 py-1.5 text-white rounded-full bg-brand-600 hover:bg-brand-500 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 shadow-glow whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 text-zinc-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h2
            id="issue-detail-title"
            className={`text-lg sm:text-xl font-extrabold leading-snug tracking-tight ${
              isDeleted ? 'italic text-zinc-400' : 'text-white'
            }`}
          >
            {isDeleted ? 'Deleted by Author' : issue.title}
          </h2>

          {/* Live Consensus Split Bar inside Header */}
          <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>YES {metrics.yesPercent}% ({issue.yesCount})</span>
              </span>
              <span className="text-zinc-400 font-mono text-[11px]">{metrics.totalVotes} total votes</span>
              <span className="text-rose-400 flex items-center gap-1.5">
                <span>({issue.noCount}) NO {metrics.noPercent}%</span>
                <ThumbsDown className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex p-0.5">
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

          {/* Segmented Navigation Tabs — guaranteed single line */}
          <div className="flex items-center gap-1 mt-4 bg-white/[0.07] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('perspectives')}
              className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'perspectives'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Replies ({totalConversationCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('digest')}
              className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'digest'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>AI Digest</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={`flex-1 py-1.5 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'brief'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Brief &amp; Media</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-5 flex-1 bg-slate-50/70 dark:bg-ink-950/80">
          {/* RESTRICTED ACCESS NOTICE */}
          {!access.canAccess && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/30 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-300">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Restricted Private Circle</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Only invited members can participate. Signed in as <strong>{currentUser?.email || 'Guest'}</strong>.
                Authorized groups: <strong>{(issue.invitedGroups || []).join(', ') || 'Direct email invite'}</strong>.
              </p>
            </div>
          )}

          {/* TAB 1: PERSPECTIVES FEED */}
          {activeTab === 'perspectives' && (
            <div className="space-y-4">
              {/* Compact Context Preview + Audio Briefing if available */}
              <div className="bg-white dark:bg-ink-900 p-4 rounded-2xl border border-black/[0.06] dark:border-white/10 space-y-3 shadow-2xs">
                <p className={`text-xs sm:text-sm leading-relaxed ${
                  isDeleted ? 'italic text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-slate-200'
                }`}>
                  {isDeleted ? 'Deleted by Author' : issue.description}
                </p>
                {!isDeleted && issue.creatorVoiceNote && (
                  <div className="pt-2 border-t border-slate-100 dark:border-white/10 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Spoken Briefing by {issue.author}
                    </span>
                    <VoicePlayer attachment={issue.creatorVoiceNote} compact />
                  </div>
                )}
              </div>

              {/* Filter Bar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-ink-900 p-1 rounded-xl text-xs overflow-x-auto border dark:border-white/10">
                  <button
                    onClick={() => setFilter('ALL')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filter === 'ALL' ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                    }`}
                  >
                    All ({issue.responses.length})
                  </button>
                  <button
                    onClick={() => setFilter('YES')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filter === 'YES' ? 'bg-white dark:bg-ink-800 text-emerald-700 dark:text-emerald-400 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                    }`}
                  >
                    Yes ({issue.responses.filter(r => r.choice === 'YES').length})
                  </button>
                  <button
                    onClick={() => setFilter('NO')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      filter === 'NO' ? 'bg-white dark:bg-ink-800 text-rose-700 dark:text-rose-400 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                    }`}
                  >
                    No ({issue.responses.filter(r => r.choice === 'NO').length})
                  </button>
                  <button
                    onClick={() => setFilter('VOICE')}
                    className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      filter === 'VOICE' ? 'bg-white dark:bg-ink-800 text-brand-600 dark:text-brand-400 shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                    }`}
                  >
                    <Mic className="w-3 h-3" /> Audio ({metrics.voiceNotesCount})
                  </button>
                </div>
              </div>

              {/* Responses List */}
              {filteredResponses.length === 0 ? (
                <div className="card text-center py-10 p-6 border-dashed border-zinc-200 dark:border-white/10">
                  <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No perspectives in this view yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResponses.map((resp: VoteSubmission) => {
                    const isReported = reportedIds.has(resp.id);

                    return (
                      <div
                        key={resp.id}
                        className="card p-4 space-y-2.5 hover:border-black/[0.12] dark:hover:border-white/20 transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-ink-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                              {resp.isAnonymous ? (
                                <ShieldCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-zinc-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-ink-950 dark:text-white">
                                  {resp.isAnonymous ? (resp.authorAlias || 'Anonymous') : resp.authorName}
                                </span>
                                {resp.authorRole && (
                                  <span className="text-[11px] text-zinc-400">• {resp.authorRole}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            resp.choice === 'YES'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-400/30'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-400/30'
                          }`}>
                            {resp.choice === 'YES' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                            {resp.choice}
                          </span>
                        </div>

                        {resp.note && (
                          <p className="text-xs sm:text-sm text-zinc-700 dark:text-slate-200 leading-relaxed">
                            {resp.note}
                          </p>
                        )}

                        {resp.voiceNote && (
                          <VoicePlayer attachment={resp.voiceNote} compact />
                        )}

                        <div className="flex items-center justify-between pt-1.5 text-[11px] text-zinc-400">
                          <span>{new Date(resp.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReplySubmissionId(prev => prev === resp.id ? null : resp.id);
                              }}
                              className={`flex items-center gap-1 transition-colors cursor-pointer font-medium ${
                                activeReplySubmissionId === resp.id
                                  ? 'text-brand-600 dark:text-brand-400 font-bold'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400'
                              }`}
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Reply{resp.replies && resp.replies.length > 0 ? ` (${resp.replies.length})` : ''}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onLikeResponse && onLikeResponse(resp.id)}
                              className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer font-medium"
                            >
                              <Heart className="w-3 h-3" />
                              <span>{resp.likesCount || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReport(resp.id)}
                              disabled={isReported}
                              className={`flex items-center gap-1 transition-colors cursor-pointer ${
                                isReported ? 'text-amber-600' : 'text-zinc-400 hover:text-rose-600'
                              }`}
                            >
                              <Flag className="w-3 h-3" />
                              <span>{isReported ? 'Flagged' : 'Report'}</span>
                            </button>
                          </div>
                        </div>

                        {/* THREADED DIRECT REPLIES */}
                        {resp.replies && resp.replies.length > 0 && (
                          <div className="mt-3 pt-2.5 border-l-2 border-brand-200/90 dark:border-brand-500/30 ml-2.5 pl-3 sm:pl-4 space-y-2.5">
                            {resp.replies.map((reply: CommentReply) => {
                              const replyAuthor = reply.isAnonymous ? (reply.authorAlias || 'Anonymous') : reply.authorName;
                              return (
                                <div
                                  key={reply.id}
                                  className="bg-slate-50/90 dark:bg-ink-900/70 p-3 rounded-xl border border-black/[0.04] dark:border-white/5 space-y-1.5 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-ink-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                                        {reply.isAnonymous ? (
                                          <ShieldCheck className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                                        ) : (
                                          <User className="w-3 h-3 text-zinc-500" />
                                        )}
                                      </div>
                                      <span className="font-bold text-ink-950 dark:text-white text-[11px]">
                                        {replyAuthor}
                                      </span>
                                      {reply.authorRole && (
                                        <span className="text-[10px] text-zinc-400">• {reply.authorRole}</span>
                                      )}
                                      {reply.replyToName && (
                                        <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded">
                                          @{reply.replyToName}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-zinc-400 shrink-0">
                                      {new Date(reply.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>

                                  <p className="text-zinc-700 dark:text-slate-200 text-xs leading-relaxed pl-1">
                                    {reply.content}
                                  </p>

                                  <div className="flex items-center justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => onLikeCommentReply && onLikeCommentReply(issue.id, resp.id, reply.id)}
                                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer font-medium"
                                    >
                                      <Heart className="w-2.5 h-2.5" />
                                      <span>{reply.likesCount || 0}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* INLINE DIRECT REPLY COMPOSER */}
                        {activeReplySubmissionId === resp.id && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                              <span className="font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                Replying directly to @{resp.isAnonymous ? (resp.authorAlias || 'Anonymous') : resp.authorName}
                              </span>
                              <div className="flex items-center gap-2.5">
                                {currentUser && (
                                  <label className="flex items-center gap-1 text-[10px] cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white">
                                    <input
                                      type="checkbox"
                                      checked={replyAnonMap[resp.id] ?? false}
                                      onChange={(e) => setReplyAnonMap(prev => ({ ...prev, [resp.id]: e.target.checked }))}
                                      className="w-3 h-3 rounded accent-brand-600 cursor-pointer"
                                    />
                                    <span>Post anonymously</span>
                                  </label>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveReplySubmissionId(null)}
                                  className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={replyTextMap[resp.id] || ''}
                                onChange={(e) => setReplyTextMap(prev => ({ ...prev, [resp.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendDirectReply(resp);
                                  }
                                }}
                                placeholder={currentUser ? `Write a direct reply to ${resp.isAnonymous ? (resp.authorAlias || 'author') : resp.authorName}...` : 'Sign in to write a direct reply...'}
                                className="flex-1 text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-ink-950 text-ink-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSendDirectReply(resp)}
                                disabled={!replyTextMap[resp.id]?.trim()}
                                className="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-soft shrink-0"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Reply</span>
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

          {/* TAB 2: AI DIGEST & STATS */}
          {activeTab === 'digest' && (
            <IssueSummaryView issue={issue} />
          )}

          {/* TAB 3: FULL BRIEF, PHOTOS & CIRCLE ACCESS */}
          {activeTab === 'brief' && (
            <div className="space-y-4">
              {hasImages && (
                <div className="space-y-2 card p-3">
                  <div className="h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-zinc-100 dark:bg-ink-950 relative">
                    <img 
                      src={issue.images![activeImageIndex]} 
                      alt={issue.title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  {issue.images!.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pt-1">
                      {issue.images!.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-14 h-10 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                            activeImageIndex === idx ? 'border-brand-600' : 'border-transparent opacity-70'
                          }`}
                        >
                          <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {issue.creatorVoiceNote && (
                <div className="card p-4 space-y-2">
                  <span className="text-xs font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Spoken Audio Briefing by {issue.author}
                  </span>
                  <VoicePlayer attachment={issue.creatorVoiceNote} />
                </div>
              )}

              <div className="card p-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Proposed by <strong className="text-ink-950 dark:text-white">{issue.author}</strong></span>
                  <span>Duration: <strong className="text-ink-950 dark:text-white">{issue.durationLabel}</strong></span>
                </div>
                <p className={`text-sm leading-relaxed ${
                  isDeleted ? 'italic text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-slate-200'
                }`}>
                  {isDeleted ? 'Deleted by Author' : issue.description}
                </p>

                {issue.tags && issue.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    {issue.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-zinc-100 dark:bg-ink-800 text-zinc-600 dark:text-zinc-300 font-medium px-2.5 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* IF PRIVATE AND CREATOR: INVITE MANAGEMENT */}
              {issue.visibility === 'private' && isCreator && (
                <div className="card p-4 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                      Manage Private Circle Invites
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManageInvites(!showManageInvites)}
                      className="text-xs text-purple-700 dark:text-purple-300 font-semibold hover:underline cursor-pointer"
                    >
                      {showManageInvites ? 'Hide' : 'Edit Access'}
                    </button>
                  </div>

                  {showManageInvites && (
                    <div className="space-y-2.5 pt-1 text-xs">
                      <form onSubmit={handleSendEmailInvite} className="flex gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Invite email address..."
                          className="flex-1 text-xs px-3 py-2 border border-purple-200 dark:border-purple-500/30 rounded-xl bg-white dark:bg-ink-900 dark:text-white"
                        />
                        <button type="submit" className="btn-primary text-xs py-2 px-3.5 cursor-pointer">
                          Add Email
                        </button>
                      </form>

                      <form onSubmit={handleSendGroupInvite} className="flex gap-2">
                        <input
                          type="text"
                          value={inviteGroup}
                          onChange={(e) => setInviteGroup(e.target.value)}
                          placeholder="Add group (e.g. Planning Commission)..."
                          className="flex-1 text-xs px-3 py-2 border border-purple-200 dark:border-purple-500/30 rounded-xl bg-white dark:bg-ink-900 dark:text-white"
                        />
                        <button type="submit" className="btn-primary text-xs py-2 px-3.5 cursor-pointer">
                          Add Group
                        </button>
                      </form>

                      <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
                        {issue.invitedEmails.map(em => (
                          <span key={em} className="bg-white dark:bg-ink-900 border border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-lg font-mono">
                            {em}
                          </span>
                        ))}
                        {issue.invitedGroups.map(grp => (
                          <span key={grp} className="bg-purple-200 dark:bg-purple-500/30 text-purple-900 dark:text-purple-200 font-bold px-2 py-0.5 rounded-lg">
                            {grp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom X / Instagram / Facebook Style Social Reply & Vote Bar */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-ink-900 border-t border-black/[0.06] dark:border-white/10">
          {!access.canAccess ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-full py-2.5 bg-zinc-100 dark:bg-ink-800 rounded-2xl">
              <Lock className="w-4 h-4" />
              <span>Voting restricted to invited circle members</span>
            </div>
          ) : isDeleted ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-full py-2.5 bg-zinc-100 dark:bg-ink-800 rounded-2xl">
              <Trash2 className="w-4 h-4" />
              <span>Topic deleted by author • Community responses &amp; votes preserved</span>
            </div>
          ) : metrics.isClosed ? (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-ink-950 dark:text-white w-full py-2.5 bg-zinc-100 dark:bg-ink-800 rounded-2xl">
              <Clock className="w-4 h-4" />
              <span>Voting period concluded • Final digest archived</span>
            </div>
          ) : (
            <form onSubmit={(e) => handleQuickSocialSubmit(e)} className="space-y-2">
              {/* Top Mini Bar: YES / NO Stance Selector + Anonymous Alias Pill */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      setReplyChoice('YES');
                      if (!hasUserVoted && !replyNote.trim() && !voiceUrl) {
                        handleQuickSocialSubmit(e, 'YES');
                      }
                    }}
                    className={`px-3 py-1 rounded-full font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                      (replyChoice === 'YES' || userVoteChoice === 'YES')
                        ? 'bg-emerald-600 text-white shadow-glow-emerald'
                        : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30'
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>YES</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      setReplyChoice('NO');
                      if (!hasUserVoted && !replyNote.trim() && !voiceUrl) {
                        handleQuickSocialSubmit(e, 'NO');
                      }
                    }}
                    className={`px-3 py-1 rounded-full font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                      (replyChoice === 'NO' || userVoteChoice === 'NO') && replyChoice !== 'YES'
                        ? 'bg-rose-600 text-white shadow-glow-rose'
                        : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-400/30'
                    }`}
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>NO</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyAnon(!replyAnon)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      replyAnon
                        ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-400/30'
                        : 'bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-zinc-300'
                    }`}
                    title="Toggle Anonymous vs Public Identity"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>{replyAnon ? `Anon (${alias})` : currentUser?.name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenVoteModal(replyChoice)}
                    className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer hidden sm:inline"
                  >
                    Full Studio
                  </button>
                </div>
              </div>

              {voiceUrl && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-400/30 text-xs">
                  <span className="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Voice note attached ({formatAudioDuration(voiceDur)}) {replyAnon ? '• 🛡️ Masked' : ''}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setVoiceUrl(null)}
                    className="text-rose-500 hover:underline text-[11px] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Comment / Reply Input Row (Like X / Instagram / Facebook) */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyNote}
                  onChange={(e) => setReplyNote(e.target.value)}
                  placeholder={`Post your ${replyChoice} reply (or tap mic for a 60s voice note)...`}
                  className="flex-1 text-xs sm:text-sm px-4 py-2.5 bg-slate-100 dark:bg-ink-950 border border-slate-200/80 dark:border-white/10 rounded-full focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                />

                {isRec ? (
                  <button
                    type="button"
                    onClick={stopQuickMic}
                    className="px-3.5 py-2.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse cursor-pointer shrink-0"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{formatAudioDuration(recSec)}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startQuickMic}
                    className="p-2.5 rounded-full bg-slate-100 dark:bg-ink-800 hover:bg-brand-50 dark:hover:bg-brand-500/20 text-slate-600 dark:text-zinc-300 hover:text-brand-600 transition-colors cursor-pointer shrink-0"
                    title="Record 60s voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-glow transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <span>{hasUserVoted ? 'Reply' : `Vote ${replyChoice}`}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
