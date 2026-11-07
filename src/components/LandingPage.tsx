import React, { useState, useRef } from 'react';
import { 
  Vote, ShieldCheck, Mic, Clock, Lock, Globe,
  ArrowRight, ThumbsUp, ThumbsDown, Sparkles,
  Play, Pause, Volume2, Sliders, BarChart3, Zap,
  Sun, Moon
} from 'lucide-react';
import { AppView, IssueCategory, UserProfile } from '../types';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';
import { generateSampleChimeWav } from '../utils/audio';
import { ThemeMode } from '../utils/theme';

interface Props {
  onNavigate: (view: AppView) => void;
  onOpenGuidelines: () => void;
  onOpenLegal?: (tab: 'terms' | 'privacy') => void;
  onSelectCategory?: (category: IssueCategory) => void;
  currentUser: UserProfile | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

interface SphereShowcase {
  id: string;
  icon: string;
  title: string;
  category: IssueCategory;
  visibility: 'Public' | 'Private Circle';
  deadline: string;
  example: string;
  yesCount: number;
  noCount: number;
  sampleQuote: string;
  sampleAuthor: string;
  voiceFilter: string;
}

const SPHERES: SphereShowcase[] = [
  {
    id: 'Workplace',
    icon: '💼',
    title: 'Workplace',
    category: 'Workplace & Career',
    visibility: 'Private Circle',
    deadline: '2d left',
    example: 'Adopt a permanent 4-Day Work Week (32 hrs) at 100% salary?',
    yesCount: 312,
    noCount: 48,
    sampleQuote: 'Summer pilot showed sprint velocity rose 14% without Friday meetings.',
    sampleAuthor: 'Anon-Eng-409',
    voiceFilter: 'Deep Mask'
  },
  {
    id: 'Family',
    icon: '👨‍👩‍👧',
    title: 'Family',
    category: 'Family & Home',
    visibility: 'Private Circle',
    deadline: '18h left',
    example: 'Device-free family dinner & evening hour from 7:00–8:30 PM?',
    yesCount: 7,
    noCount: 2,
    sampleQuote: 'Agreed as long as homework group chats wrap up by 7 PM.',
    sampleAuthor: 'Maya',
    voiceFilter: 'Natural'
  },
  {
    id: 'Communal',
    icon: '🏡',
    title: 'Community',
    category: 'Community & Neighborhood',
    visibility: 'Public',
    deadline: '4d left',
    example: 'Make Market Street pedestrian-only on weekends?',
    yesCount: 642,
    noCount: 198,
    sampleQuote: 'Foot traffic for local cafes triples on car-free Saturdays.',
    sampleAuthor: 'Neighbor-882',
    voiceFilter: 'Radio'
  },
  {
    id: 'Faith',
    icon: '🕊️',
    title: 'Faith',
    category: 'Religious & Faith',
    visibility: 'Private Circle',
    deadline: '5d left',
    example: 'Dedicate 35% of festival funds to launch a 7-day food pantry?',
    yesCount: 418,
    noCount: 52,
    sampleQuote: 'Serving hot meals to families is the truest expression of fellowship.',
    sampleAuthor: 'Deacon Thomas',
    voiceFilter: 'Natural'
  },
  {
    id: 'Clubs',
    icon: '👥',
    title: 'Clubs',
    category: 'Clubs & Groups',
    visibility: 'Private Circle',
    deadline: '1d left',
    example: 'Shift Saturday marathon training to 6:30 AM to beat the heat?',
    yesCount: 134,
    noCount: 39,
    sampleQuote: 'Running before 7 AM keeps heart rates safer and frees up the weekend.',
    sampleAuthor: 'Member-110',
    voiceFilter: 'Helium'
  },
  {
    id: 'Politics',
    icon: '🏛️',
    title: 'Policy',
    category: 'Politics & Policy',
    visibility: 'Public',
    deadline: '6d left',
    example: 'Approve $1.2M participatory budget for protected bike lanes?',
    yesCount: 1840,
    noCount: 610,
    sampleQuote: 'Protected intersections near the elementary school will save lives.',
    sampleAuthor: 'Citizen-309',
    voiceFilter: 'Deep Mask'
  },
  {
    id: 'Environment',
    icon: '🌱',
    title: 'Climate',
    category: 'Environment & Climate',
    visibility: 'Public',
    deadline: '3d left',
    example: 'Require solar micro-grids on all new commercial developments?',
    yesCount: 890,
    noCount: 145,
    sampleQuote: 'Solar canopies over parking lots cut peak grid load by 28%.',
    sampleAuthor: 'EcoVoter-71',
    voiceFilter: 'Robotic'
  },
  {
    id: 'Economy',
    icon: '📈',
    title: 'Economy',
    category: 'Economy & Finance',
    visibility: 'Private Circle',
    deadline: '2d left',
    example: 'Allocate 60% of Q3 co-op surplus to member dividends?',
    yesCount: 215,
    noCount: 164,
    sampleQuote: 'A 60/40 split rewards members now while still funding new equipment.',
    sampleAuthor: 'Member-504',
    voiceFilter: 'Deep Mask'
  },
  {
    id: 'Education',
    icon: '🎓',
    title: 'Education',
    category: 'Education & Campus',
    visibility: 'Public',
    deadline: '4d left',
    example: 'Replace written midterms with real-world capstone defenses?',
    yesCount: 920,
    noCount: 280,
    sampleQuote: 'Oral defenses and practical builds test true mastery in the AI era.',
    sampleAuthor: 'Prof. Elena R.',
    voiceFilter: 'Natural'
  },
  {
    id: 'Internal',
    icon: '🔒',
    title: 'Boards',
    category: 'Private & Internal',
    visibility: 'Private Circle',
    deadline: '36h left',
    example: 'Enforce a 10:00 PM commercial delivery curfew in residential zones?',
    yesCount: 512,
    noCount: 88,
    sampleQuote: 'Shift workers and young families need uninterrupted rest after 10 PM.',
    sampleAuthor: 'Resident-994',
    voiceFilter: 'Deep Mask'
  }
];

export const LandingPage: React.FC<Props> = ({ 
  onNavigate, 
  onOpenGuidelines, 
  onOpenLegal,
  onSelectCategory,
  currentUser,
  theme,
  onToggleTheme
}) => {
  const [mockChoice, setMockChoice] = useState<'YES' | 'NO' | null>('YES');
  const [mockVotes, setMockVotes] = useState({ yes: 312, no: 48 });
  const [activeSphere, setActiveSphere] = useState<string>('Workplace');
  const [heroVoiceFilter, setHeroVoiceFilter] = useState<'deep' | 'robot' | 'none'>('deep');
  const [isPlayingHeroAudio, setIsPlayingHeroAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleMockVote = (choice: 'YES' | 'NO') => {
    setMockChoice(choice);
    playHapticChime(choice === 'YES' ? 'yes' : 'no');
    triggerVoteConfetti(choice === 'YES');

    if (choice === 'YES') {
      setMockVotes(prev => ({ ...prev, yes: prev.yes + 1 }));
    } else {
      setMockVotes(prev => ({ ...prev, no: prev.no + 1 }));
    }
  };

  const toggleHeroAudio = () => {
    if (isPlayingHeroAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingHeroAudio(false);
      return;
    }

    const tone = heroVoiceFilter === 'deep' ? 'disagree' : 'agree';
    const wavUrl = generateSampleChimeWav(4, tone);
    const audio = new Audio(wavUrl);
    audioRef.current = audio;
    setIsPlayingHeroAudio(true);
    audio.play().catch(() => setIsPlayingHeroAudio(false));
    audio.onended = () => setIsPlayingHeroAudio(false);
  };

  const totalMock = mockVotes.yes + mockVotes.no;
  const mockYesPct = Math.round((mockVotes.yes / totalMock) * 100);
  const mockNoPct = 100 - mockYesPct;

  const currentSphere = SPHERES.find(s => s.id === activeSphere) || SPHERES[0];
  const sphereTotal = currentSphere.yesCount + currentSphere.noCount;
  const sphereYesPct = Math.round((currentSphere.yesCount / sphereTotal) * 100);
  const sphereNoPct = 100 - sphereYesPct;

  const handleExploreSphere = (cat: IssueCategory) => {
    if (onSelectCategory) onSelectCategory(cat);
    onNavigate('app');
  };

  return (
    <div className="min-h-screen bg-aurora-dark text-white flex flex-col font-sans selection:bg-brand-500 selection:text-white overflow-x-hidden">
      {/* Glassmorphic Sticky Navigation */}
      <nav className="sticky top-0 z-40 bg-ink-950/85 backdrop-blur-2xl shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div 
            onClick={() => onNavigate(currentUser ? 'app' : 'landing')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-purple-500 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-all">
              <Vote className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
              Yes<span className="text-gradient">Or</span>No
            </span>
          </div>

          {/* Center Quick Links */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.05] rounded-full p-1 backdrop-blur-md">
            <a href="#spheres-showcase" className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all">
              Use Cases
            </a>
            <a href="#bento-architecture" className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all">
              Features
            </a>
            <button
              onClick={onOpenGuidelines}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Community Rules
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] text-zinc-200 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-300" />}
            </button>
            <button
              onClick={() => onNavigate('auth')}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:text-white rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition-all cursor-pointer"
            >
              {currentUser ? currentUser.name.split(' ')[0] : 'Sign In'}
            </button>
            <button
              onClick={() => onNavigate(currentUser ? 'app' : 'auth')}
              className="btn-brand text-xs px-4 py-2 shadow-glow cursor-pointer"
            >
              <span>{currentUser ? 'Open Issues' : 'Sign In to Vote'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION: Clean Editorial + Interactive Live Studio */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid-dark mask-fade pointer-events-none" />
        <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] bg-brand-600/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[380px] h-[380px] bg-emerald-500/12 blur-[140px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Column: Crisp, High-Impact Pitch (7 cols) */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-[11px] sm:text-xs font-semibold text-emerald-300 backdrop-blur-xl whitespace-nowrap max-w-full">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="sm:hidden">Make your voice heard in under 1 min</span>
                <span className="hidden sm:inline">It takes less than 1 min to make your voice heard and make an impact</span>
              </div>

              <h1 className="text-4xl sm:text-6xl xl:text-[64px] font-extrabold tracking-tight leading-[1.05] text-white">
                Vote Yes or No on{' '}
                <span className="font-serif italic font-normal text-gradient pr-1">
                  what matters.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-zinc-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Fast, time-bound decisions for your <strong className="text-white font-semibold">workplace, family, community, club, or board</strong>. Cast your vote in one tap and attach an optional 60-second voice note with built-in voice privacy.
              </p>

              {/* CTA Row */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-1">
                <button
                  onClick={() => onNavigate('app')}
                  className="w-full sm:w-auto px-7 py-4 bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-600 text-white font-bold text-sm rounded-2xl shadow-glow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Start Voting Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('auth')}
                  className="w-full sm:w-auto px-6 py-4 bg-white/[0.07] hover:bg-white/[0.12] text-white font-semibold text-sm rounded-2xl transition-all cursor-pointer backdrop-blur-md flex items-center justify-center gap-2"
                >
                  <span>Sign In / Private Circles</span>
                </button>
              </div>

              {/* Compact Trust Strip */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Anonymous Voice Masking
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-brand-400" /> Public or Invite-Only
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Instant AI Summary
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Live Ballot Demo Card (5 cols) */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -inset-2 bg-gradient-to-tr from-brand-500/25 via-purple-500/15 to-emerald-400/15 rounded-[32px] blur-2xl opacity-80 pointer-events-none" />

              <div className="relative bg-ink-900/90 backdrop-blur-2xl rounded-[28px] p-6 shadow-lift space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-bold bg-brand-500/20 text-brand-300 flex items-center gap-1.5">
                    <span>💼 Workplace</span>
                  </span>
                  <span className="text-amber-300 flex items-center gap-1 font-mono text-[11px] font-semibold bg-amber-500/15 px-2.5 py-1 rounded-full">
                    <Clock className="w-3 h-3" /> 2d 14h left
                  </span>
                </div>

                <h3 className="font-bold text-lg text-white leading-snug">
                  Adopt a permanent 4-Day Work Week (32 Hours) with full salary retention?
                </h3>

                {/* Interactive YES / NO Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleMockVote('YES')}
                    className={`flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all cursor-pointer ${
                      mockChoice === 'YES'
                        ? 'bg-emerald-500/25 ring-2 ring-emerald-400 text-white shadow-glow-emerald scale-[1.02]'
                        : 'bg-white/[0.05] hover:bg-emerald-500/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-base">
                      <ThumbsUp className="w-4 h-4 text-emerald-400" />
                      <span>YES</span>
                      <span className="font-mono text-emerald-300">{mockYesPct}%</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{mockVotes.yes} votes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMockVote('NO')}
                    className={`flex flex-col items-center justify-center py-3 px-4 rounded-2xl transition-all cursor-pointer ${
                      mockChoice === 'NO'
                        ? 'bg-rose-500/25 ring-2 ring-rose-400 text-white shadow-glow-rose scale-[1.02]'
                        : 'bg-white/[0.05] hover:bg-rose-500/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-base">
                      <ThumbsDown className="w-4 h-4 text-rose-400" />
                      <span>NO</span>
                      <span className="font-mono text-rose-300">{mockNoPct}%</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{mockVotes.no} votes</span>
                  </button>
                </div>

                {/* Split Bar */}
                <div className="h-2.5 w-full bg-white/[0.08] rounded-full overflow-hidden flex p-0.5">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full" style={{ width: `${mockYesPct}%` }} />
                  <div className="bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 rounded-full ml-1" style={{ width: `${mockNoPct}%` }} />
                </div>

                {/* Interactive Voice Note Preview */}
                <div className="p-3 rounded-2xl bg-white/[0.05] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                      <span className="font-semibold text-white">Neighbor-4821</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                        YES
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['deep', 'robot', 'none'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setHeroVoiceFilter(mode)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                            heroVoiceFilter === mode
                              ? 'bg-brand-600 text-white'
                              : 'bg-white/[0.06] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {mode === 'deep' ? 'Deep' : mode === 'robot' ? 'Robot' : 'Natural'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Playable Waveform */}
                  <div className="flex items-center gap-3 bg-ink-950/75 p-2 rounded-xl">
                    <button
                      type="button"
                      onClick={toggleHeroAudio}
                      className="w-7 h-7 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shadow-glow shrink-0 cursor-pointer"
                      aria-label="Play sample voice note"
                    >
                      {isPlayingHeroAudio ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                    </button>

                    <div className="flex-1 flex items-center gap-1 h-5">
                      {[45, 75, 95, 55, 85, 100, 65, 45, 90, 70, 50, 80, 95, 60].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-200 ${
                            isPlayingHeroAudio
                              ? 'bg-gradient-to-t from-brand-500 to-emerald-400 animate-pulse'
                              : 'bg-brand-400/40'
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400 shrink-0 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-brand-400" /> 0:18
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* LIVE TRENDING RADAR PREVIEW (By Overall, Region, & Category) */}
      <section className="py-12 sm:py-16 bg-ink-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300">
                🔥 Live Discovery Radar
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Trending issues across <span className="font-serif italic font-normal text-gradient">regions &amp; spheres.</span>
              </h2>
            </div>
            <button
              onClick={() => onNavigate(currentUser ? 'discovery' : 'auth')}
              className="text-xs font-bold text-brand-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <span>Explore Full Discovery Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                rank: '#1 Overall',
                region: '🌐 Global / Remote',
                category: '💼 Workplace',
                title: 'Transition our Company to a 4-Day Work Week (32 Hours) with Full Salary Retention',
                yesPct: 85,
                votes: 280,
                audio: 42
              },
              {
                rank: '#1 Local District',
                region: '📍 Local District',
                category: '🏡 Community',
                title: 'Convert Market Street into a Weekend-Only Pedestrian & Outdoor Dining Plaza',
                yesPct: 76,
                votes: 840,
                audio: 94
              },
              {
                rank: '#1 Europe & UK',
                region: '🇪🇺 Europe & UK',
                category: '🎓 Education',
                title: 'Replace Written University Midterms with Real-World Capstone Defenses',
                yesPct: 77,
                votes: 1200,
                audio: 118
              }
            ].map((item) => (
              <div
                key={item.title}
                onClick={() => onNavigate(currentUser ? 'app' : 'auth')}
                className="p-5 rounded-3xl bg-ink-900/90 hover:bg-ink-900 transition-all cursor-pointer flex flex-col justify-between gap-4 group shadow-soft"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="px-2 py-0.5 rounded-md font-extrabold bg-amber-500/20 text-amber-300">
                      {item.rank}
                    </span>
                    <span className="text-zinc-400 font-medium">{item.region}</span>
                  </div>
                  <div className="text-[11px] font-bold text-brand-300">{item.category}</div>
                  <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-emerald-400">YES {item.yesPct}%</span>
                    <span className="text-zinc-400 font-mono text-[10px]">{item.votes} votes • {item.audio} 🎙️</span>
                    <span className="text-rose-400">NO {100 - item.yesPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${item.yesPct}%` }} />
                    <div className="bg-rose-500 h-full" style={{ width: `${100 - item.yesPct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10 SPHERES OF LIFE INTERACTIVE SHOWCASE */}
      <section id="spheres-showcase" className="py-16 sm:py-20 bg-ink-950/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              One platform for <span className="font-serif italic font-normal text-gradient">every circle.</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Preview how different groups make decisions in under a minute, or jump straight into that issue category.
            </p>
          </div>

          {/* 10 Interactive Domain Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {SPHERES.map((sphere) => {
              const isSelected = activeSphere === sphere.id;
              return (
                <button
                  key={sphere.id}
                  onClick={() => {
                    setActiveSphere(sphere.id);
                    playHapticChime('tap');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.1]'
                  }`}
                >
                  <span>{sphere.icon}</span>
                  <span>{sphere.title}</span>
                </button>
              );
            })}
          </div>

          {/* Clean Preview Card */}
          <div className="max-w-4xl mx-auto bg-ink-900/90 rounded-3xl p-6 sm:p-7 shadow-lift grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full font-bold bg-brand-500/20 text-brand-300">
                  {currentSphere.icon} {currentSphere.category}
                </span>
                <span className="px-2.5 py-1 rounded-full font-semibold bg-white/[0.07] text-zinc-300 flex items-center gap-1">
                  {currentSphere.visibility === 'Private Circle' ? <Lock className="w-3 h-3 text-purple-400" /> : <Globe className="w-3 h-3 text-emerald-400" />}
                  {currentSphere.visibility}
                </span>
                <span className="px-2.5 py-1 rounded-full font-mono text-[11px] bg-amber-500/15 text-amber-300">
                  ⏳ {currentSphere.deadline}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                &ldquo;{currentSphere.example}&rdquo;
              </h3>

              <div className="p-3 rounded-2xl bg-white/[0.05] flex items-start gap-2.5">
                <Mic className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="text-zinc-400">
                    <strong className="text-white">{currentSphere.sampleAuthor}</strong> • <span className="text-brand-300 font-mono text-[10px]">🛡️ {currentSphere.voiceFilter}</span>
                  </div>
                  <p className="text-zinc-200 italic">&ldquo;{currentSphere.sampleQuote}&rdquo;</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 bg-ink-950/85 rounded-2xl p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-emerald-500/15">
                  <div className="text-xl font-extrabold font-mono text-emerald-400">{sphereYesPct}%</div>
                  <div className="text-[11px] text-emerald-200 font-semibold">YES ({currentSphere.yesCount})</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/15">
                  <div className="text-xl font-extrabold font-mono text-rose-400">{sphereNoPct}%</div>
                  <div className="text-[11px] text-rose-200 font-semibold">NO ({currentSphere.noCount})</div>
                </div>
              </div>

              <div className="h-2 w-full bg-white/[0.08] rounded-full overflow-hidden flex p-0.5">
                <div className="bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${sphereYesPct}%` }} />
                <div className="bg-rose-500 rounded-full transition-all duration-500 ml-0.5" style={{ width: `${sphereNoPct}%` }} />
              </div>

              <button
                onClick={() => handleExploreSphere(currentSphere.category)}
                className="w-full btn-brand py-2.5 text-xs font-bold shadow-glow cursor-pointer"
              >
                <span>Open {currentSphere.title} Issues</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CONCISE 4-PILLAR BENTO GRID */}
      <section id="bento-architecture" className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Designed for clarity and <span className="font-serif italic font-normal text-gradient">psychological safety.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pillar 1 */}
          <div className="bg-ink-900/90 p-6 rounded-3xl space-y-3 shadow-soft hover:bg-ink-900 transition-all">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/15 text-brand-300 text-xs font-bold">
              <Sliders className="w-3.5 h-3.5" /> Voice Privacy Filters
            </div>
            <h3 className="text-lg font-bold text-white">
              Speak freely with anonymous voice masking
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Attach a 60-second voice note and disguise your vocal pitch in one tap (Deep, Helium, Robotic, or Radio) so your perspective is judged on merit, not hierarchy.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-ink-900/90 p-6 rounded-3xl space-y-3 shadow-soft hover:bg-ink-900 transition-all">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold">
              <Zap className="w-3.5 h-3.5" /> Time-Bound Velocity
            </div>
            <h3 className="text-lg font-bold text-white">
              Enforced deadlines end decision paralysis
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Every issue runs on a strict countdown (24 hours to 30 days). When time expires, voting locks automatically and the final outcome is archived.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-ink-900/90 p-6 rounded-3xl space-y-3 shadow-soft hover:bg-ink-900 transition-all">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" /> Public or Private Circles
            </div>
            <p className="text-lg font-bold text-white">
              Open town square or invite-only groups
            </p>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Host public community polls or restrict access to verified email addresses and private groups (families, leadership boards, or teams).
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-ink-900/90 p-6 rounded-3xl space-y-3 shadow-soft hover:bg-ink-900 transition-all">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold">
              <BarChart3 className="w-3.5 h-3.5" /> Executive Digest
            </div>
            <h3 className="text-lg font-bold text-white">
              Instant pro/con synthesis &amp; turnout metrics
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              See the consensus headline, top YES and NO arguments, anonymous participation ratio, and audio briefings at a glance.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-ink-950 text-zinc-400 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center text-white font-bold">
              <Vote className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white">YesOrNo</span>
            <span className="text-zinc-500">• Make your voice heard in under 1 minute</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            {onOpenLegal && (
              <>
                <button onClick={() => onOpenLegal('terms')} className="hover:text-white transition-colors cursor-pointer">
                  Terms of Use
                </button>
                <button onClick={() => onOpenLegal('privacy')} className="hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </button>
              </>
            )}
            <button onClick={onOpenGuidelines} className="hover:text-white transition-colors cursor-pointer">
              Community Guidelines
            </button>
            <button onClick={() => onNavigate('auth')} className="hover:text-white transition-colors cursor-pointer">
              Sign In
            </button>
            <button onClick={() => onNavigate('app')} className="hover:text-white transition-colors font-bold text-brand-300 cursor-pointer">
              Open Issues →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
