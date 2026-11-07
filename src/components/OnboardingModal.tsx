import React, { useState } from 'react';
import { 
  Sparkles, Globe2, UserPlus, Check, ArrowRight, ArrowLeft, Vote 
} from 'lucide-react';
import { UserProfile, IssueCategory, IssueRegion, Issue } from '../types';
import { TOP_CREATORS_AND_VOTERS, TopCreatorProfile } from '../utils/auth';

interface Props {
  isOpen: boolean;
  user: UserProfile;
  issues?: Issue[];
  onComplete: (updatedUser: UserProfile) => void;
}

const INTEREST_OPTIONS: { category: IssueCategory; label: string; emoji: string; desc: string }[] = [
  { category: 'Workplace & Career', label: 'Workplace & Teams', emoji: '💼', desc: 'Remote work, sprints & policies' },
  { category: 'Family & Home', label: 'Family & Home', emoji: '👨‍👩‍👧', desc: 'Household rules & routines' },
  { category: 'Community & Neighborhood', label: 'Community & HOA', emoji: '🏡', desc: 'Streets, parks & local safety' },
  { category: 'Religious & Faith', label: 'Faith & Outreach', emoji: '🕊️', desc: 'Congregation & charity funds' },
  { category: 'Clubs & Groups', label: 'Clubs & Groups', emoji: '👥', desc: 'Sports, hobbies & member events' },
  { category: 'Politics & Policy', label: 'Civic & Policy', emoji: '🏛️', desc: 'Budgets, zoning & bylaws' },
  { category: 'Environment & Climate', label: 'Climate & Energy', emoji: '🌱', desc: 'Solar, transit & sustainability' },
  { category: 'Economy & Finance', label: 'Economy & Co-ops', emoji: '📈', desc: 'Treasury, grants & dividends' },
  { category: 'Education & Campus', label: 'Education & Campus', emoji: '🎓', desc: 'Curriculum, exams & student life' },
];

const REGION_OPTIONS: { region: IssueRegion; emoji: string; desc: string }[] = [
  { region: 'North America', emoji: '🇺🇸', desc: 'Prioritize North America + Worldwide issues' },
  { region: 'Europe & UK', emoji: '🇪🇺', desc: 'Prioritize Europe & UK + Worldwide issues' },
  { region: 'Africa & Middle East', emoji: '🌍', desc: 'Prioritize Africa & Middle East + Worldwide issues' },
  { region: 'Asia-Pacific', emoji: '🌏', desc: 'Prioritize Asia-Pacific + Worldwide issues' },
  { region: 'Global / Remote', emoji: '🌐', desc: 'Worldwide / Distributed organizations everywhere' },
];

export const OnboardingModal: React.FC<Props> = ({ isOpen, user, issues = [], onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedInterests, setSelectedInterests] = useState<IssueCategory[]>(
    user.interests && user.interests.length > 0
      ? user.interests
      : ['Workplace & Career', 'Community & Neighborhood', 'Education & Campus']
  );
  const [selectedRegion, setSelectedRegion] = useState<IssueRegion>(
    user.region || 'North America'
  );
  const [following, setFollowing] = useState<string[]>(
    user.followingCreators && user.followingCreators.length > 0
      ? user.followingCreators
      : []
  );
  const [customCreatorHandle, setCustomCreatorHandle] = useState('');

  // Derive active creators dynamically from real issues + any dev seed creators
  const availableCreators: TopCreatorProfile[] = React.useMemo(() => {
    const map = new Map<string, TopCreatorProfile>();
    TOP_CREATORS_AND_VOTERS.forEach(c => map.set(c.name.toLowerCase(), c));

    issues.forEach(iss => {
      if (!iss.author || iss.isAnonymousAuthor) return;
      const key = iss.author.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.issuesCount += 1;
      } else {
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

  if (!isOpen) return null;

  const toggleInterest = (cat: IssueCategory) => {
    setSelectedInterests(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleFollow = (creatorName: string) => {
    setFollowing(prev =>
      prev.includes(creatorName) ? prev.filter(n => n !== creatorName) : [...prev, creatorName]
    );
  };

  const handleFinish = () => {
    onComplete({
      ...user,
      interests: selectedInterests,
      region: selectedRegion,
      followingCreators: following,
      onboardingCompleted: true
    });
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-lg animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-ink-900 rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col max-h-[92vh] animate-slide-up">
        {/* Top Progress Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-brand-300">
                <Vote className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Welcome, {user.name.split(' ')[0]} • Step {step} of 3
              </span>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="text-xs text-zinc-400 hover:text-white font-semibold cursor-pointer"
            >
              Skip for now →
            </button>
          </div>

          {/* 3-Step Progress Bar */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-gradient-to-r from-brand-400 to-emerald-400' : 'bg-white/15'
                }`}
              />
            ))}
          </div>

          <div>
            {step === 1 && (
              <>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  1. Pick the spheres that matter to you
                </h2>
                <p className="text-xs text-zinc-300 mt-0.5">
                  You can change these anytime in Settings.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  2. Select your primary region
                </h2>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  3. Follow top issue creators &amp; voters
                </h2>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Issues proposed by creators you follow get highlighted and boosted in your personalized feed.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: INTERESTS */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {INTEREST_OPTIONS.map((item) => {
                const isSelected = selectedInterests.includes(item.category);
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => toggleInterest(item.category)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-500/20 dark:border-brand-400 shadow-2xs'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-brand-300 bg-white dark:bg-ink-950/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none mt-0.5">{item.emoji}</span>
                      <div>
                        <div className="text-xs font-bold text-ink-950 dark:text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">{item.desc}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'bg-brand-600 text-white' : 'border border-slate-300 dark:border-white/20'
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: REGION */}
          {step === 2 && (
            <div className="space-y-2.5">
              {REGION_OPTIONS.map((item) => {
                const isSelected = selectedRegion === item.region;
                return (
                  <button
                    key={item.region}
                    type="button"
                    onClick={() => setSelectedRegion(item.region)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-500/15 dark:border-emerald-400 shadow-2xs'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-emerald-400 bg-white dark:bg-ink-950/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.emoji}</span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white flex items-center gap-1.5">
                          <span>{item.region}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">{item.desc}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-white/20'
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3: FOLLOW TOP ISSUE CREATORS & VOTERS */}
          {step === 3 && (
            <div className="space-y-3">
              {/* Follow by Name or Handle input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCreatorHandle}
                  onChange={(e) => setCustomCreatorHandle(e.target.value)}
                  placeholder="Follow creator or voter by name (e.g. Jordan Miller)..."
                  className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customCreatorHandle.trim()) {
                      e.preventDefault();
                      if (!following.includes(customCreatorHandle.trim())) {
                        setFollowing([...following, customCreatorHandle.trim()]);
                      }
                      setCustomCreatorHandle('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customCreatorHandle.trim() && !following.includes(customCreatorHandle.trim())) {
                      setFollowing([...following, customCreatorHandle.trim()]);
                      setCustomCreatorHandle('');
                    }
                  }}
                  className="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
                >
                  + Follow
                </button>
              </div>

              {following.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {following.map(name => (
                    <span
                      key={name}
                      className="text-[11px] bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-400/30 flex items-center gap-1.5 font-semibold"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => toggleFollow(name)}
                        className="text-brand-400 hover:text-rose-500 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {availableCreators.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center space-y-1.5">
                  <UserPlus className="w-6 h-6 text-brand-500 mx-auto" />
                  <p className="text-xs font-bold text-ink-950 dark:text-white">
                    No community creators listed yet
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    As community members publish issues, top creators and voters will appear here automatically. You can also follow anyone by name above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {availableCreators.map((creator) => {
                    const isFollowing = following.includes(creator.name);
                    return (
                      <div
                        key={creator.id}
                        onClick={() => toggleFollow(creator.name)}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isFollowing
                            ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-500/15 dark:border-brand-400'
                            : 'border-slate-200/80 dark:border-white/10 hover:border-brand-300 bg-white dark:bg-ink-950/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {creator.avatar ? (
                            <img src={creator.avatar} alt={creator.name} className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-black/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 font-bold text-sm flex items-center justify-center shrink-0">
                              {creator.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-ink-950 dark:text-white truncate">{creator.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">{creator.handle}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                              {creator.role} • <span className="text-brand-600 dark:text-brand-400 font-semibold">{creator.region}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              {creator.issuesCount} issues created • {creator.votesCast} votes cast
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                            isFollowing
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
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
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-ink-950 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              className="btn-ghost text-xs py-2.5 px-4 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span>{selectedInterests.length} interests selected</span>
            </div>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              className="btn-brand text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-glow"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="btn-brand text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-glow"
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>Save Preferences &amp; Launch Ballot</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
