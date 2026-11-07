import React, { useState } from 'react';
import { 
  X, ThumbsUp, ThumbsDown, MessageSquare, Mic, ShieldCheck, 
  Flag, Heart, CheckCircle, Tag, User, Lock, Globe, Clock,
  UserPlus, Sparkles, FileText, Share2
} from 'lucide-react';
import { Issue, VoteSubmission, UserProfile, VoteChoice } from '../types';
import { VoicePlayer } from './VoicePlayer';
import { IssueSummaryView } from './IssueSummaryView';
import { computeIssueMetrics } from '../utils/summary';
import { canUserAccessIssue } from '../utils/auth';

interface Props {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVoteModal: (initialChoice?: VoteChoice) => void;
  onShareIssue: (issue: Issue) => void;
  currentUser: UserProfile | null;
  hasUserVoted?: boolean;
  userVoteChoice?: 'YES' | 'NO';
  onLikeResponse?: (responseId: string) => void;
  onReportResponse?: (responseId: string) => void;
  onAddInvite?: (issueId: string, email: string) => void;
  onAddGroupInvite?: (issueId: string, group: string) => void;
}

export const IssueDetailModal: React.FC<Props> = ({
  issue,
  isOpen,
  onClose,
  onOpenVoteModal,
  onShareIssue,
  currentUser,
  hasUserVoted,
  userVoteChoice,
  onLikeResponse,
  onReportResponse,
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

  if (!isOpen || !issue) return null;

  const metrics = computeIssueMetrics(issue);
  const access = canUserAccessIssue(issue, currentUser);
  const isCreator = access.reason === 'creator';
  const hasImages = issue.images && issue.images.length > 0;

  const filteredResponses = issue.responses.filter((r) => {
    if (filter === 'YES') return r.choice === 'YES';
    if (filter === 'NO') return r.choice === 'NO';
    if (filter === 'VOICE') return !!r.voiceNote;
    return true;
  });

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
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-detail-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-ink-900 sm:rounded-3xl shadow-lift border border-black/[0.08] dark:border-white/10 overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-slide-up">
        {/* Dark Executive Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
                {issue.category}
              </span>
              {issue.visibility === 'private' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <Lock className="w-3 h-3" /> Private Circle
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-zinc-300">
                  <Globe className="w-3 h-3 text-emerald-400" /> Public
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/25">
                <Clock className="w-3 h-3" /> {metrics.timeRemaining.text}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onShareIssue(issue)}
                title="Share issue to social media"
                className="px-3 py-1.5 text-white rounded-full bg-brand-600 hover:bg-brand-500 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-glow"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 text-zinc-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <h2 id="issue-detail-title" className="text-lg sm:text-xl font-extrabold text-white leading-snug tracking-tight">
            {issue.title}
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

          {/* Segmented Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 bg-white/[0.07] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('perspectives')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'perspectives'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Perspectives ({issue.responses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('digest')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'digest'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Digest &amp; Stats</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'brief'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Brief &amp; Media</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/70 dark:bg-ink-950/80">
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
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-slate-200 leading-relaxed">
                  {issue.description}
                </p>
                {issue.creatorVoiceNote && (
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
                <p className="text-sm text-zinc-700 dark:text-slate-200 leading-relaxed">{issue.description}</p>

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

        {/* Sticky Bottom Action Bar */}
        <div className="p-4 bg-white dark:bg-ink-900 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-3">
          {!access.canAccess ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-full py-2.5 bg-zinc-100 dark:bg-ink-800 rounded-2xl">
              <Lock className="w-4 h-4" />
              <span>Voting restricted to invited circle members</span>
            </div>
          ) : metrics.isClosed ? (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-ink-950 dark:text-white w-full py-2.5 bg-zinc-100 dark:bg-ink-800 rounded-2xl">
              <Clock className="w-4 h-4" />
              <span>Voting period concluded • Final digest archived</span>
            </div>
          ) : hasUserVoted ? (
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-400/30 w-full">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>You voted <strong className="uppercase">{userVoteChoice}</strong></span>
              </span>
              <button
                onClick={() => onOpenVoteModal(userVoteChoice)}
                className="text-brand-600 dark:text-brand-300 hover:underline font-bold cursor-pointer"
              >
                Add / Update Note
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => onOpenVoteModal('YES')}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-glow-emerald flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Vote YES</span>
              </button>
              <button
                onClick={() => onOpenVoteModal('NO')}
                className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm shadow-glow-rose flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Vote NO</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
