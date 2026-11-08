import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, CheckCircle2, UserPlus, UserCheck, Share2, 
  ThumbsUp, ThumbsDown, MessageSquare, Layers, MapPin, 
  ShieldCheck, Sparkles, Award, ArrowUpRight,
  Settings, Heart, Check
} from 'lucide-react';
import { Issue, PublicUserProfile, UserProfile, VoteChoice, VoteSubmission } from '../types';
import { IssueCard } from './IssueCard';
import { getUserCreatedIssues, getUserPerspectives, isFollowingUser } from '../utils/userProfile';
import { formatRelativeTime } from '../utils/summary';
import { VoicePlayer } from './VoicePlayer';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';

interface Props {
  profile: PublicUserProfile;
  currentUser: UserProfile | null;
  issues: Issue[];
  onBack: () => void;
  onOpenIssue: (issue: Issue) => void;
  onQuickVote: (issue: Issue, choice?: VoteChoice) => void;
  onInlineSubmitVote: (submission: VoteSubmission) => void;
  onToggleFollow: (profile: PublicUserProfile) => void;
  onOpenSettings?: () => void;
  onOpenProfile?: (user: { username?: string; name: string; avatar?: string; email?: string; role?: string }) => void;
  userVotes?: Record<string, { choice: 'YES' | 'NO'; responseId?: string }>;
  userLikes?: Record<string, boolean>;
  userFavorites?: Record<string, boolean>;
  onToggleLikeIssue?: (issueId: string) => void;
  onToggleFavoriteIssue?: (issueId: string) => void;
  onShareIssue?: (issue: Issue) => void;
  onDeleteIssue?: (issueId: string) => void;
  onEditIssue?: (issue: Issue) => void;
}

export const UserProfilePage: React.FC<Props> = ({
  profile,
  currentUser,
  issues,
  onBack,
  onOpenIssue,
  onQuickVote,
  onInlineSubmitVote,
  onToggleFollow,
  onOpenSettings,
  onOpenProfile,
  userVotes = {},
  userLikes = {},
  userFavorites = {},
  onToggleLikeIssue,
  onToggleFavoriteIssue,
  onShareIssue,
  onDeleteIssue,
  onEditIssue,
}) => {
  const [activeTab, setActiveTab] = useState<'issues' | 'perspectives' | 'about'>('issues');
  const [copiedLink, setCopiedLink] = useState(false);

  // Derived user content
  const createdIssues = useMemo(() => getUserCreatedIssues(profile, issues), [profile, issues]);
  const userPerspectives = useMemo(() => getUserPerspectives(profile, issues), [profile, issues]);

  const totalVotesReceived = useMemo(() => {
    return createdIssues.reduce((sum, issue) => sum + (issue.yesCount || 0) + (issue.noCount || 0), 0);
  }, [createdIssues]);

  const isOwnProfile = Boolean(
    currentUser && (
      (profile.email && currentUser.email && profile.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (profile.username && currentUser.username && profile.username.toLowerCase() === currentUser.username.replace(/^@/, '').toLowerCase()) ||
      (profile.name && currentUser.name && profile.name.toLowerCase() === currentUser.name.toLowerCase())
    )
  );

  const isFollowing = useMemo(() => isFollowingUser(profile, currentUser), [profile, currentUser]);

  const handleCopyProfileLink = () => {
    playHapticChime('tap');
    const url = `${window.location.origin}/#profile/${encodeURIComponent(profile.username)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleFollowClick = () => {
    playHapticChime('tap');
    if (!isFollowing) {
      triggerVoteConfetti(true);
    }
    onToggleFollow(profile);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-200 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-ink-700 transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyProfileLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-200 hover:text-brand-600 hover:border-brand-500/30 transition-all cursor-pointer shadow-2xs"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Share Profile</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="card overflow-hidden border border-slate-200/70 dark:border-white/10 shadow-soft">
        {/* Banner Gradient */}
        <div className="relative h-28 sm:h-36 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 overflow-hidden">
          <div className="absolute inset-0 bg-grid-dark opacity-20 pointer-events-none" />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </div>

        {/* Profile Identity Details */}
        <div className="px-5 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
            {/* Avatar */}
            <div className="relative inline-block">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-ink-900 shadow-lift bg-white dark:bg-ink-800"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.name)}&backgroundColor=4f46e5,0d9488,d97706,e11d48`;
                }}
              />
              {profile.isVerified && (
                <div 
                  className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full ring-2 ring-white dark:ring-ink-900 shadow-xs"
                  title="Verified Community Member"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Profile Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isOwnProfile ? (
                onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-soft hover:shadow-glow transition-all cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Edit Profile & Settings</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleFollowClick}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-soft active:scale-95 ${
                    isFollowing
                      ? 'bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-white/10 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                      : 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* User Name & Handle */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-ink-950 dark:text-white tracking-tight">
                {profile.name}
              </h1>
              <span className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400">
                @{profile.username}
              </span>

              {profile.role && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/30">
                  <Award className="w-3 h-3 text-brand-500" />
                  <span>{profile.role}</span>
                </span>
              )}

              {profile.region && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-zinc-300">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{profile.region}</span>
                </span>
              )}
            </div>

            {/* Bio / Civic Mission */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 max-w-3xl leading-relaxed">
              {profile.bio || 'Active civic contributor shaping public policy and neighborhood consensus.'}
            </p>
          </div>

          {/* Statistics Strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-brand-500" />
                <span>Issues Created</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-ink-950 dark:text-white font-mono">
                {createdIssues.length}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 mb-1">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Votes Received</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-ink-950 dark:text-white font-mono">
                {totalVotesReceived}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                <span>Perspectives</span>
              </div>
              <div className="text-lg sm:text-2xl font-black text-ink-950 dark:text-white font-mono">
                {userPerspectives.length}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 sm:px-8 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'issues'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white'
            }`}
          >
            Issues Created ({createdIssues.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('perspectives')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'perspectives'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white'
            }`}
          >
            Perspectives & Stances ({userPerspectives.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'about'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white'
            }`}
          >
            About & Circles
          </button>
        </div>
      </div>

      {/* Tab Content Areas */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {createdIssues.length === 0 ? (
            <div className="card text-center py-12 px-6 border-dashed border-slate-200 dark:border-white/10 space-y-2">
              <Layers className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                No issues published yet by {profile.name}.
              </p>
              <p className="text-xs text-slate-400">
                When {profile.name} publishes civic questions, they will appear here.
              </p>
            </div>
          ) : (
            createdIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                currentUser={currentUser}
                onOpenDetails={onOpenIssue}
                onQuickVote={onQuickVote}
                onInlineSubmitVote={onInlineSubmitVote}
                onDeleteIssue={onDeleteIssue}
                onEditIssue={onEditIssue}
                onToggleLikeIssue={onToggleLikeIssue}
                onToggleFavoriteIssue={onToggleFavoriteIssue}
                onShareIssue={onShareIssue || (() => {})}
                hasUserVoted={Boolean(userVotes[issue.id])}
                userVoteChoice={userVotes[issue.id]?.choice}
                isLiked={Boolean(userLikes[issue.id])}
                isFavorited={Boolean(userFavorites[issue.id])}
                onOpenProfile={onOpenProfile}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'perspectives' && (
        <div className="space-y-3">
          {userPerspectives.length === 0 ? (
            <div className="card text-center py-12 px-6 border-dashed border-slate-200 dark:border-white/10 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                No public perspectives recorded yet.
              </p>
              <p className="text-xs text-slate-400">
                Perspectives and vote stances contributed by {profile.name} will be displayed here.
              </p>
            </div>
          ) : (
            userPerspectives.map(({ issue, response }) => (
              <div
                key={response.id}
                className="card p-4 sm:p-5 space-y-3 border border-slate-200/70 dark:border-white/10 shadow-2xs hover:border-brand-500/40 transition-colors"
              >
                {/* Linked Issue Question */}
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenIssue(issue)}
                    className="text-left font-bold text-sm sm:text-base text-ink-950 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center gap-1.5 cursor-pointer group"
                  >
                    <span>{issue.title}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                  </button>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold shrink-0 ${
                      response.choice === 'YES'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-400/30'
                        : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-400/30'
                    }`}
                  >
                    {response.choice === 'YES' ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                    <span>Voted {response.choice}</span>
                  </span>
                </div>

                {/* Perspective Note */}
                {response.note && (
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-200 leading-relaxed bg-slate-50/70 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                    &ldquo;{response.note}&rdquo;
                  </p>
                )}

                {/* Voice Attachment */}
                {response.voiceNote && (
                  <div className="pt-1">
                    <VoicePlayer attachment={response.voiceNote} compact />
                  </div>
                )}

                {/* Timestamp & Metadata */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 pt-1">
                  <span>{formatRelativeTime(response.createdAt)}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>{response.likesCount || 0}</span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-brand-600 dark:text-brand-400">{issue.category}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Civic Groups & Circles */}
          <div className="card p-5 space-y-3 border border-slate-200/70 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-950 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              <span>Civic Circles & Groups</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Verified community groups and regional taskforces this user participates in:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(profile.groups && profile.groups.length > 0 ? profile.groups : ['District 4 Council', 'Community Neighbor']).map((group) => (
                <span
                  key={group}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-brand-50 dark:bg-brand-500/10 text-brand-800 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/20"
                >
                  <span>{group}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Profile Overview */}
          <div className="card p-5 space-y-3 border border-slate-200/70 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-950 dark:text-white">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Civic Standing</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <span className="text-slate-500 dark:text-zinc-400">Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified Neighbor
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <span className="text-slate-500 dark:text-zinc-400">Primary Region</span>
                <span className="font-bold text-ink-900 dark:text-zinc-200">{profile.region || 'Local District'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <span className="text-slate-500 dark:text-zinc-400">Debate Stances</span>
                <span className="font-bold text-ink-900 dark:text-zinc-200">{userPerspectives.length} stances recorded</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
