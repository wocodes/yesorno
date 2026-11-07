import React, { useState, useEffect } from 'react';
import { 
  X, User, Settings, Globe2, Sparkles, UserPlus, Check, 
  ShieldCheck, Sliders, Sun, Moon, LogOut, Vote, Users, Bookmark, Heart
} from 'lucide-react';
import { UserProfile, Issue, IssueCategory, IssueRegion, VoiceFilterType } from '../types';
import { TOP_CREATORS_AND_VOTERS, TopCreatorProfile } from '../utils/auth';
import { ThemeMode } from '../utils/theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  issues: Issue[];
  userVotes: Record<string, { choice: 'YES' | 'NO'; responseId?: string }>;
  userLikes?: Record<string, boolean>;
  userFavorites?: Record<string, boolean>;
  onUpdateUser: (updated: UserProfile) => void;
  onSignOut: () => void;
  onOpenIssue: (issue: Issue) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const ALL_INTERESTS: { category: IssueCategory; label: string; emoji: string }[] = [
  { category: 'Workplace & Career', label: 'Workplace', emoji: '💼' },
  { category: 'Family & Home', label: 'Family', emoji: '👨‍👩‍👧' },
  { category: 'Community & Neighborhood', label: 'Community', emoji: '🏡' },
  { category: 'Religious & Faith', label: 'Faith', emoji: '🕊️' },
  { category: 'Clubs & Groups', label: 'Clubs', emoji: '👥' },
  { category: 'Politics & Policy', label: 'Policy', emoji: '🏛️' },
  { category: 'Environment & Climate', label: 'Climate', emoji: '🌱' },
  { category: 'Economy & Finance', label: 'Economy', emoji: '📈' },
  { category: 'Education & Campus', label: 'Education', emoji: '🎓' },
];

const REGIONS: IssueRegion[] = [
  'North America',
  'Europe & UK',
  'Africa & Middle East',
  'Asia-Pacific',
  'Local District',
  'Global / Remote'
];

export const ProfileSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  user,
  issues,
  userVotes,
  userLikes = {},
  userFavorites = {},
  onUpdateUser,
  onSignOut,
  onOpenIssue,
  theme,
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'following' | 'settings'>('preferences');
  
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [bio, setBio] = useState(user.bio || '');
  const [groupInput, setGroupInput] = useState('');
  const [groups, setGroups] = useState<string[]>(user.groups || []);

  const [region, setRegion] = useState<IssueRegion>(user.region || 'North America');
  const [interests, setInterests] = useState<IssueCategory[]>(user.interests || []);
  const [following, setFollowing] = useState<string[]>(user.followingCreators || []);
  const [customFollowInput, setCustomFollowInput] = useState('');

  // Derive creators from live issues + dev seed creators
  const availableCreators: TopCreatorProfile[] = React.useMemo(() => {
    const map = new Map<string, TopCreatorProfile>();
    TOP_CREATORS_AND_VOTERS.forEach(c => map.set(c.name.toLowerCase(), c));
    issues.forEach(iss => {
      if (!iss.author || iss.isAnonymousAuthor) return;
      const key = iss.author.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `creator-${iss.id}`,
          name: iss.author,
          handle: `@${iss.author.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          role: 'Community Issue Creator',
          region: iss.region || 'Global / Remote',
          specialty: iss.category,
          avatar: '',
          issuesCount: 1,
          votesCast: iss.yesCount + iss.noCount
        });
      }
    });
    return Array.from(map.values());
  }, [issues]);

  const [defaultAnonymous, setDefaultAnonymous] = useState<boolean>(user.defaultAnonymous ?? true);
  const [defaultVoiceFilter, setDefaultVoiceFilter] = useState<VoiceFilterType>(user.defaultVoiceFilter || 'deep');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setRole(user.role);
      setBio(user.bio || '');
      setGroups(user.groups || []);
      setRegion(user.region || 'North America');
      setInterests(user.interests || []);
      setFollowing(user.followingCreators || []);
      setDefaultAnonymous(user.defaultAnonymous ?? true);
      setDefaultVoiceFilter(user.defaultVoiceFilter || 'deep');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const createdIssues = issues.filter(
    i => i.creatorId === user.id || i.creatorEmail === user.email || i.author === user.name
  );
  const votedIssues = issues.filter(i => !!userVotes[i.id]);
  const favoritedIssues = issues.filter(i => !!userFavorites[i.id]);
  const likedIssues = issues.filter(i => !!userLikes[i.id]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: UserProfile = {
      ...user,
      name: name.trim() || user.name,
      role: role.trim() || user.role,
      bio: bio.trim(),
      groups,
      region,
      interests,
      followingCreators: following,
      defaultAnonymous,
      defaultVoiceFilter,
      onboardingCompleted: true
    };
    onUpdateUser(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const toggleInterest = (cat: IssueCategory) => {
    setInterests(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleFollow = (creatorName: string) => {
    setFollowing(prev =>
      prev.includes(creatorName) ? prev.filter(n => n !== creatorName) : [...prev, creatorName]
    );
  };

  const handleAddGroup = () => {
    if (groupInput.trim() && !groups.includes(groupInput.trim())) {
      setGroups([...groups, groupInput.trim()]);
      setGroupInput('');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-ink-900 sm:rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col animate-slide-up">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-white font-extrabold text-xl overflow-hidden shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">{user.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    📍 {region}
                  </span>
                </div>
                <p className="text-xs text-zinc-300">{user.role} • <span className="font-mono text-zinc-400">{user.email}</span></p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400 font-mono">
                  <span><strong className="text-white">{votedIssues.length}</strong> votes cast</span>
                  <span>•</span>
                  <span><strong className="text-white">{createdIssues.length}</strong> issues created</span>
                  <span>•</span>
                  <span><strong className="text-white">{following.length}</strong> following</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 mt-5 bg-white/[0.07] p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preferences' ? 'bg-white text-ink-950 shadow-soft' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span className="truncate">Region &amp; Interests</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('following')}
              className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'following' ? 'bg-white text-ink-950 shadow-soft' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="truncate">Following ({following.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'profile' ? 'bg-white text-ink-950 shadow-soft' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="truncate">Profile &amp; Activity</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-white text-ink-950 shadow-soft' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="truncate">Settings</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/60 dark:bg-ink-950/60">
          {/* TAB 1: REGION & INTERESTS */}
          {activeTab === 'preferences' && (
            <div className="space-y-5">
              {/* Region Selector */}
              <div className="card p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4 text-emerald-500" />
                      <span>Your Primary Region</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Issues created in <strong className="text-ink-950 dark:text-white">{region}</strong> appear first in your feed, blended with <strong className="text-ink-950 dark:text-white">Worldwide (Global / Remote)</strong> issues.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {REGIONS.map((reg) => {
                    const active = region === reg;
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => setRegion(reg)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                          active
                            ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 text-slate-700 dark:text-zinc-300 hover:border-emerald-400'
                        }`}
                      >
                        <span className="truncate">{reg}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interests Selector */}
              <div className="card p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-brand-500" />
                    <span>Your Spheres of Interest ({interests.length} selected)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Issues in these categories are prioritized in your personalized ballot feed.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_INTERESTS.map((item) => {
                    const active = interests.includes(item.category);
                    return (
                      <button
                        key={item.category}
                        type="button"
                        onClick={() => toggleInterest(item.category)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          active
                            ? 'border-brand-600 bg-brand-50/80 dark:bg-brand-500/20 text-brand-900 dark:text-brand-200'
                            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 text-slate-700 dark:text-zinc-300 hover:border-brand-400'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{item.emoji}</span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOLLOWING TOP CREATORS & VOTERS */}
          {activeTab === 'following' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Follow issue creators and community voters to prioritize their proposals in your ballot feed.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customFollowInput}
                  onChange={(e) => setCustomFollowInput(e.target.value)}
                  placeholder="Follow creator by name..."
                  className="flex-1 text-xs px-3.5 py-2 bg-white dark:bg-ink-900 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customFollowInput.trim()) {
                      e.preventDefault();
                      if (!following.includes(customFollowInput.trim())) {
                        setFollowing([...following, customFollowInput.trim()]);
                      }
                      setCustomFollowInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customFollowInput.trim() && !following.includes(customFollowInput.trim())) {
                      setFollowing([...following, customFollowInput.trim()]);
                      setCustomFollowInput('');
                    }
                  }}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  + Follow
                </button>
              </div>

              {following.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {following.map(fName => (
                    <span
                      key={fName}
                      className="text-[11px] bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-400/30 flex items-center gap-1.5 font-semibold"
                    >
                      <span>{fName}</span>
                      <button
                        type="button"
                        onClick={() => toggleFollow(fName)}
                        className="text-brand-400 hover:text-rose-500 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {availableCreators.map((creator) => {
                const isFollowing = following.includes(creator.name);
                return (
                  <div
                    key={creator.id}
                    onClick={() => toggleFollow(creator.name)}
                    className={`card p-3.5 flex items-center justify-between gap-3 cursor-pointer ${
                      isFollowing ? 'border-brand-500/60 bg-brand-50/30 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {creator.avatar ? (
                        <img src={creator.avatar} alt={creator.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 font-bold text-sm flex items-center justify-center shrink-0">
                          {creator.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink-950 dark:text-white truncate">{creator.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {creator.role} • <span className="text-brand-600 dark:text-brand-400 font-semibold">{creator.region}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {creator.issuesCount} issues • {creator.votesCast} votes cast
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer ${
                        isFollowing
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: PROFILE & ACTIVITY */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="card p-4 sm:p-5 space-y-3">
                <h3 className="text-sm font-bold text-ink-950 dark:text-white">Edit Public Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role / Headline</label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Short Bio</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Share your community focus or background..."
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white resize-none"
                  />
                </div>

                {/* Circles / Groups */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Authorized Private Circles &amp; Groups
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={groupInput}
                      onChange={(e) => setGroupInput(e.target.value)}
                      placeholder="Join group (e.g. District 4 Council)"
                      className="flex-1 text-xs px-3 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="px-3 py-2 bg-slate-200 dark:bg-ink-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {groups.map((grp) => (
                      <span key={grp} className="text-[11px] bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-400/30 flex items-center gap-1 font-semibold">
                        <Users className="w-3 h-3" />
                        {grp}
                        <button type="button" onClick={() => setGroups(groups.filter(g => g !== grp))} className="text-purple-400 hover:text-rose-600 cursor-pointer">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Saved Favourites & Liked Issues */}
              <div className="card p-4 sm:p-5 space-y-2.5">
                <h3 className="text-sm font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  <span>Your Favourites ({favoritedIssues.length}) &amp; Likes ({likedIssues.length})</span>
                </h3>
                {favoritedIssues.length === 0 && likedIssues.length === 0 ? (
                  <p className="text-xs text-slate-400">You haven&apos;t favourited or liked any issues yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...new Map([...favoritedIssues, ...likedIssues].map(i => [i.id, i])).values()].map((iss) => {
                      const isFav = !!userFavorites[iss.id];
                      const isLkd = !!userLikes[iss.id];
                      return (
                        <div
                          key={iss.id}
                          onClick={() => {
                            onClose();
                            onOpenIssue(iss);
                          }}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2 cursor-pointer hover:border-brand-400"
                        >
                          <span className="text-xs font-semibold text-ink-950 dark:text-white truncate">
                            {iss.isDeletedByAuthor ? 'Deleted by Author' : iss.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isFav && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                <Bookmark className="w-2.5 h-2.5 fill-current" /> Favourite
                              </span>
                            )}
                            {isLkd && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                                <Heart className="w-2.5 h-2.5 fill-current" /> Liked
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Votes History */}
              <div className="card p-4 sm:p-5 space-y-2.5">
                <h3 className="text-sm font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                  <Vote className="w-4 h-4 text-brand-500" />
                  <span>Your Voting History ({votedIssues.length})</span>
                </h3>
                {votedIssues.length === 0 ? (
                  <p className="text-xs text-slate-400">You haven&apos;t voted on any issues yet.</p>
                ) : (
                  <div className="space-y-2">
                    {votedIssues.map((iss) => {
                      const rec = userVotes[iss.id];
                      return (
                        <div
                          key={iss.id}
                          onClick={() => {
                            onClose();
                            onOpenIssue(iss);
                          }}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-ink-950 border border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2 cursor-pointer hover:border-brand-400"
                        >
                          <span className="text-xs font-semibold text-ink-950 dark:text-white truncate">{iss.title}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                            rec?.choice === 'YES'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                          }`}>
                            Voted {rec?.choice}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS (PRIVACY, VOICE MASK, THEME) */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Default Privacy Mode */}
              <div className="card p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white">Default Anonymous Voting</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Automatically enable anonymous alias protection when opening the vote modal.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDefaultAnonymous(!defaultAnonymous)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    defaultAnonymous ? 'bg-brand-600' : 'bg-slate-300 dark:bg-ink-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                      defaultAnonymous ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Default Voice Privacy Mask */}
              <div className="card p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand-500" />
                  <h4 className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white">Default Voice Note Privacy Filter</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { key: 'deep', label: '🛡️ Deep Mask' },
                      { key: 'robot', label: '🤖 Robotic' },
                      { key: 'high', label: '✨ Helium' },
                      { key: 'radio', label: '📻 Radio' },
                      { key: 'none', label: '🎙️ Natural' }
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDefaultVoiceFilter(f.key)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        defaultVoiceFilter === f.key
                          ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300'
                          : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Appearance / Theme */}
              <div className="card p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-brand-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white">Appearance Theme</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Currently using <strong className="uppercase">{theme}</strong> mode
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="btn-ghost text-xs py-2 px-3.5"
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                </button>
              </div>

              {/* Sign Out */}
              <div className="card p-4 sm:p-5 flex items-center justify-between gap-4 border-rose-200/60 dark:border-rose-500/20">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">Sign Out of Account</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Your region, interests, and followed creators remain saved for your next sign-in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Save Footer */}
        <div className="p-4 bg-white dark:bg-ink-900 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
            {savedNotice && (
              <>
                <Check className="w-4 h-4" />
                <span>Preferences saved &amp; applied to your feed!</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs py-2.5 px-4"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="btn-brand text-xs py-2.5 px-5 shadow-glow"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

