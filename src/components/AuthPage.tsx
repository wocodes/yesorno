import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Check, ArrowRight, Lock, 
  Sparkles, LogOut, Vote, ChevronDown, ChevronUp,
  Sun, Moon, ShieldCheck, X, Palette
} from 'lucide-react';
import { UserProfile, AppView } from '../types';
import { DEMO_USERS, GOOGLE_SAMPLE_ACCOUNTS, isLocalEnvironment, decodeGoogleJwt, getSavedProfileByEmail, fetchServerProfileByEmail, saveStoredUser } from '../utils/auth';
import { ThemeMode, ColorTone } from '../utils/theme';

interface Props {
  currentUser: UserProfile | null;
  onSelectUser: (user: UserProfile | null) => void;
  onNavigate: (view: AppView) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  colorTone?: ColorTone;
  onToggleColorTone?: () => void;
  authPromptMessage?: string | null;
  onOpenLegal?: (tab: 'terms' | 'privacy') => void;
  onOpenGuidelines?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const AuthPage: React.FC<Props> = ({ 
  currentUser, 
  onSelectUser, 
  onNavigate,
  theme,
  onToggleTheme,
  colorTone = 'toned',
  onToggleColorTone,
  authPromptMessage,
  onOpenLegal,
  onOpenGuidelines
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['Community Member']);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);

  // Preset avatar choices for quick onboarding
  const AVATAR_PRESETS = [
    'https://api.dicebear.com/7.x/micah/svg?seed=jordan',
    'https://api.dicebear.com/7.x/micah/svg?seed=alex',
    'https://api.dicebear.com/7.x/micah/svg?seed=sarah',
    'https://api.dicebear.com/7.x/micah/svg?seed=marcus',
    'https://api.dicebear.com/7.x/micah/svg?seed=riley',
    'https://api.dicebear.com/7.x/micah/svg?seed=william',
  ];

  // Interactive Google Account Chooser Modal (when no VITE_GOOGLE_CLIENT_ID is set or user clicks Continue with Google)
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const isLocal = isLocalEnvironment();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Helper to merge any previously saved profile preferences (region, interests, followingCreators)
  // Cross-device sync: checks localStorage AND server database before deciding if onboarding is needed
  const selectUserWithSavedPrefs = async (baseUser: UserProfile, forceOnboarding = false) => {
    setIsSubmittingAuth(true);
    let saved = getSavedProfileByEmail(baseUser.email);

    // If local storage doesn't have an onboardingCompleted profile, check the server database!
    if (!saved || !saved.onboardingCompleted) {
      try {
        const serverProfile = await fetchServerProfileByEmail(baseUser.email);
        if (serverProfile) {
          saved = serverProfile;
        }
      } catch (err) {
        console.warn('Server profile fetch check error:', err);
      }
    }

    const cleanUsername = (saved && saved.username) || baseUser.username || (baseUser.email ? baseUser.email.split('@')[0].replace(/[^a-z0-9_]/g, '_') : undefined);
    if (saved && !forceOnboarding) {
      const mergedUser: UserProfile = {
        ...baseUser,
        ...saved,
        username: cleanUsername,
        displayPreference: saved.displayPreference || 'username',
        name: saved.name || baseUser.name,
        avatar: saved.avatar || baseUser.avatar,
        interests: (saved.interests && saved.interests.length > 0) ? saved.interests : baseUser.interests,
        region: saved.region || baseUser.region,
        onboardingCompleted: saved.onboardingCompleted ?? Boolean(saved.interests && saved.interests.length > 0),
      };
      saveStoredUser(mergedUser);
      onSelectUser(mergedUser);
    } else {
      const newUser: UserProfile = {
        ...baseUser,
        username: cleanUsername,
        displayPreference: baseUser.displayPreference || 'username',
        onboardingCompleted: forceOnboarding ? false : (baseUser.onboardingCompleted ?? false),
      };
      saveStoredUser(newUser);
      onSelectUser(newUser);
    }
    setIsSubmittingAuth(false);
  };

  // Initialize real Google Identity Services if VITE_GOOGLE_CLIENT_ID is configured
  useEffect(() => {
    if (!googleClientId) return;

    let retryTimer: number | null = null;
    const initGis = () => {
      if (!window.google?.accounts?.id) {
        retryTimer = window.setTimeout(initGis, 250);
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            const payload = decodeGoogleJwt(response.credential);
            if (payload) {
              const derivedUsername = (payload.email || 'user').split('@')[0].replace(/[^a-z0-9_]/g, '_');
              selectUserWithSavedPrefs({
                id: `google-${payload.sub}`,
                name: payload.name || payload.email.split('@')[0],
                username: derivedUsername,
                displayPreference: 'username',
                email: payload.email,
                role: 'Verified Google Account',
                avatar: payload.picture || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(derivedUsername)}`,
                groups: ['District 4 Council', 'Community Member']
              });
            }
          }
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'pill'
          });
        }
      } catch (err) {
        console.warn('GIS init skipped:', err);
      }
    };

    initGis();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [googleClientId, theme]);

  const handleAddGroup = () => {
    if (groupInput.trim() && !selectedGroups.includes(groupInput.trim())) {
      setSelectedGroups([...selectedGroups, groupInput.trim()]);
      setGroupInput('');
    }
  };

  const handleRemoveGroup = (g: string) => {
    setSelectedGroups(selectedGroups.filter(item => item !== g));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const rawUsername = username.trim().replace(/^@/, '') || name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const chosenAvatar = avatarUrl.trim() || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(rawUsername)}`;

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      username: rawUsername,
      avatar: chosenAvatar,
      displayPreference: 'username',
      email: email.trim(),
      role: role.trim() || 'Community Member',
      groups: selectedGroups,
      onboardingCompleted: false
    };

    await selectUserWithSavedPrefs(newUser, true);
    onNavigate('app');
  };

  const handleCustomGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;
    const derivedName = customGoogleName.trim() || customGoogleEmail.split('@')[0];
    const derivedUsername = customGoogleEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_');
    await selectUserWithSavedPrefs({
      id: `google-${Date.now()}`,
      name: derivedName,
      username: derivedUsername,
      displayPreference: 'username',
      email: customGoogleEmail.trim().toLowerCase(),
      avatar: `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(derivedUsername)}`,
      role: 'Verified Google Account',
      groups: ['District 4 Council', 'Community Member']
    });
    setShowGoogleChooser(false);
    onNavigate('app');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl shadow-xs px-4 sm:px-8 py-3 flex items-center justify-between">
        <div 
          onClick={() => onNavigate(currentUser ? 'app' : 'landing')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center text-white shadow-glow">
            <Vote className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-ink-950 dark:text-white">
            Yes<span className="text-gradient">Or</span>No
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleColorTone && (
            <button
              onClick={onToggleColorTone}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                colorTone === 'toned'
                  ? 'bg-slate-200 dark:bg-ink-800 text-slate-700 dark:text-slate-200'
                  : 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300'
              }`}
              title={colorTone === 'vibrant' ? 'Switch to Toned-Down Palette' : 'Switch to Full-Coloured Palette'}
            >
              <Palette className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
          </button>

          {currentUser && (
            <button
              onClick={() => onNavigate('app')}
              className="btn-brand text-xs py-2 px-4 shadow-sm cursor-pointer"
            >
              <span>Open Issues</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 sm:py-12 w-full space-y-5 flex-1 flex flex-col justify-center">
        {/* Protected Gate Notice */}
        {authPromptMessage && !currentUser && (
          <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-500/15 flex items-center gap-2.5 text-xs text-brand-800 dark:text-brand-200 font-semibold">
            <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span>{authPromptMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sign in to <span className="font-serif italic font-normal text-brand-600 dark:text-brand-400">YesOrNo</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Only verified members can view, create, and vote on issues.
          </p>
        </div>

        {/* Active Profile Card if Signed In */}
        {currentUser && (
          <div className="card p-5 space-y-3.5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Signed In
              </span>
              <button
                onClick={() => onSelectUser(null)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-lg overflow-hidden shrink-0">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{currentUser.name}</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono truncate">{currentUser.email}</p>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{currentUser.role}</p>
              </div>
            </div>

            {currentUser.groups.length > 0 && (
              <div className="pt-2.5 border-t border-slate-100 dark:border-white/10">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 block mb-1.5 uppercase tracking-wider">
                  Authorized Circles &amp; Groups:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.groups.map((group) => (
                    <span key={group} className="text-[11px] bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-slate-200 font-semibold px-2.5 py-0.5 rounded-lg">
                      {group}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => onNavigate('app')}
              className="btn-brand w-full py-3 flex items-center justify-center gap-2 shadow-lift cursor-pointer"
            >
              <span>Open Issues Feed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Sign In / Create Account Card */}
        <div className="card p-5 sm:p-6 space-y-4">
          {/* SIGN IN WITH GOOGLE BUTTON */}
          {googleClientId ? (
            <div ref={googleBtnRef} className="w-full flex justify-center" />
          ) : (
            <button
              type="button"
              onClick={() => setShowGoogleChooser(true)}
              className="w-full py-3 px-4 rounded-xl bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700 text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
            >
              {/* Official 4-Color Google G SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
            <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              or with email
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10" />
          </div>

          <div className="grid grid-cols-2 bg-slate-100 dark:bg-ink-950 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'signin'
                  ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                tab === 'signup'
                  ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {tab === 'signin' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email || isSubmittingAuth) return;
                const found = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
                if (found) {
                  await selectUserWithSavedPrefs(found);
                } else {
                  await selectUserWithSavedPrefs({
                    id: `user-${Date.now()}`,
                    name: email.split('@')[0],
                    email,
                    role: 'Verified Member',
                    groups: ['District 4 Council', 'Community Member']
                  });
                }
                onNavigate('app');
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    defaultValue={isLocal ? '••••••••' : ''}
                    className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingAuth}
                className="btn-brand w-full py-3 shadow-lift cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAuth ? 'Signing In & Loading Profile...' : 'Sign In & Open Issues'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setName(newName);
                      if (!usernameManuallyEdited) {
                        const suggested = newName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
                        setUsername(suggested);
                      }
                    }}
                    placeholder="Jordan Miller"
                    className="w-full text-xs pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Username
                  </label>
                  <span className="text-[10px] text-zinc-400">Used publicly by default</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-zinc-400 select-none">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setUsernameManuallyEdited(true);
                      setUsername(e.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase());
                    }}
                    placeholder="jordan_m"
                    className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Profile Picture / Avatar Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3 mb-2.5">
                  <img
                    src={avatarUrl || `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(username || 'civic')}`}
                    alt="Avatar preview"
                    className="w-11 h-11 rounded-full object-cover border-2 border-brand-500/30 bg-slate-100 dark:bg-ink-800 shrink-0"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                          avatarUrl === preset
                            ? 'border-brand-500 scale-110 shadow-sm'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt={`preset-${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Or paste custom image URL..."
                  className="w-full text-[11px] px-3 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@example.com"
                    className="w-full text-xs pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role / Title (Optional)</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Product Designer, Resident"
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl focus:bg-white dark:focus:bg-ink-900 focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Circles / Groups
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    placeholder="Add circle (e.g. District 4 Council)"
                    className="flex-1 text-xs px-3 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="px-3 py-2 bg-slate-200 dark:bg-ink-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedGroups.map((grp) => (
                    <span key={grp} className="text-[11px] bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-2.5 py-0.5 rounded-lg border border-brand-200 dark:border-brand-400/30 flex items-center gap-1 font-semibold">
                      {grp}
                      <button type="button" onClick={() => handleRemoveGroup(grp)} className="text-brand-400 hover:text-rose-600 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-brand w-full py-3 shadow-lift cursor-pointer">
                Create Account &amp; Enter
              </button>
            </form>
          )}
        </div>

        {/* LOCAL-ONLY Quick-Switch Demo Profiles (Automatically hidden in production!) */}
        {isLocal && (
          <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/25 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Local Dev Only: Quick-Switch Demo Accounts</span>
              </span>
              {showDemoProfiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDemoProfiles && (
              <div className="p-3 space-y-2 animate-fade-in bg-white dark:bg-ink-900">
                {DEMO_USERS.map((demo) => {
                  const isSelected = currentUser?.id === demo.id;
                  return (
                    <div
                      key={demo.id}
                      onClick={() => {
                        selectUserWithSavedPrefs(demo);
                        onNavigate('app');
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-500/20 ring-1 ring-brand-500'
                          : 'bg-slate-50 dark:bg-ink-800/70 hover:bg-slate-100 dark:hover:bg-ink-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={demo.avatar} alt={demo.name} className="w-8 h-8 rounded-full object-cover" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{demo.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{demo.role} • {demo.groups[0]}</div>
                        </div>
                      </div>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-brand-600 shrink-0" />
                      ) : (
                        <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 shrink-0">Use →</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legal Links Footer */}
        <div className="pt-2 text-center text-[11px] text-slate-400 dark:text-zinc-500 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <span>By continuing, you agree to YesOrNo&apos;s</span>
          {onOpenLegal && (
            <>
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="font-semibold text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 underline cursor-pointer"
              >
                Terms of Use
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="font-semibold text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 underline cursor-pointer"
              >
                Privacy Policy
              </button>
            </>
          )}
          {onOpenGuidelines && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="font-semibold text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 underline cursor-pointer"
              >
                Community Guidelines
              </button>
            </>
          )}
        </div>
      </div>

      {/* GOOGLE OAUTH ACCOUNT CHOOSER MODAL */}
      {showGoogleChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-ink-900 rounded-3xl shadow-lift overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
                </svg>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sign in with Google</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">to continue to YesOrNo</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleChooser(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            { GOOGLE_SAMPLE_ACCOUNTS.length > 0 && (
              <div className="p-4 pb-0">
                <div className="space-y-1.5">
                  {GOOGLE_SAMPLE_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        selectUserWithSavedPrefs(acc);
                        setShowGoogleChooser(false);
                        onNavigate('app');
                      }}
                      className="w-full p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-ink-800 flex items-center gap-3 text-left transition-all cursor-pointer"
                    >
                      <img src={acc.avatar} alt={acc.name} className="w-9 h-9 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{acc.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{acc.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              <form onSubmit={handleCustomGoogleSignIn} className="space-y-2.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 block">
                  {GOOGLE_SAMPLE_ACCOUNTS.length > 0 ? 'Or use another Google account:' : 'Enter your Google account details:'}
                </span>
                <input
                  type="text"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  placeholder="Your Name (optional)"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                />
                <input
                  type="email"
                  required
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="your.name@gmail.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-ink-950 border border-slate-200 dark:border-white/10 rounded-xl dark:text-white"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Continue as Google User
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
