import React, { useState } from 'react';
import { 
  Vote, Mail, MessageCircle, Phone, ArrowLeft, Copy, Check, 
  ExternalLink, Sun, Moon, Palette,
  Sparkles, HelpCircle, HeartHandshake
} from 'lucide-react';
import { AppView, UserProfile } from '../types';
import { ThemeMode, ColorTone } from '../utils/theme';

interface Props {
  onNavigate: (view: AppView) => void;
  currentUser: UserProfile | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  colorTone: ColorTone;
  onToggleColorTone?: () => void;
  onOpenGuidelines?: () => void;
  onOpenLegal?: (tab: 'terms' | 'privacy') => void;
}

export const ContactPage: React.FC<Props> = ({
  onNavigate,
  currentUser,
  theme,
  onToggleTheme,
  colorTone,
  onToggleColorTone,
  onOpenGuidelines,
  onOpenLegal
}) => {
  const [copiedType, setCopiedType] = useState<'email' | 'phone' | null>(null);

  // Quick message form state
  const [formName, setFormName] = useState(currentUser?.name || '');
  const [formEmail, setFormEmail] = useState(currentUser?.email || '');
  const [formSubject, setFormSubject] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const contactEmail = 'william.odiomonafe@gmail.com';
  const contactPhoneRaw = '+2347068535208';
  const contactPhoneFormatted = '+234 706 853 5208';
  const whatsappUrl = `https://wa.me/2347068535208?text=${encodeURIComponent(
    `Hello William, I'm reaching out from YesOrNo!`
  )}`;

  const handleCopy = async (text: string, type: 'email' | 'phone') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    const text = [
      `*Inquiry from YesOrNo*`,
      formName ? `Name: ${formName}` : null,
      formEmail ? `Email: ${formEmail}` : null,
      formSubject ? `Subject: ${formSubject}` : null,
      formMessage ? `Message:\n${formMessage}` : null,
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/2347068535208?text=${encodeURIComponent(text || 'Hello William, reaching out from YesOrNo!')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(formSubject ? `[YesOrNo] ${formSubject}` : 'Inquiry from YesOrNo');
    const body = encodeURIComponent(
      `Hi William,\n\n${formMessage}\n\nBest regards,\n${formName || 'YesOrNo User'}${formEmail ? ` (${formEmail})` : ''}`
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-ink-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate(currentUser ? 'app' : 'landing')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{currentUser ? 'Feed' : 'Home'}</span>
            </button>

            <div 
              onClick={() => onNavigate(currentUser ? 'app' : 'landing')}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                <Vote className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-ink-950 dark:text-white">
                Yes<span className="text-gradient">Or</span>No
              </span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {onToggleColorTone && (
              <button
                onClick={onToggleColorTone}
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  colorTone === 'toned'
                    ? 'bg-black text-white border border-zinc-700 dark:bg-white dark:text-black'
                    : 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/30'
                }`}
                title={colorTone === 'vibrant' ? 'Switch to Monochrome Palette' : 'Switch to Vibrant Palette'}
                aria-label="Toggle palette"
              >
                <Palette className="w-4 h-4 shrink-0" />
              </button>
            )}

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
            </button>

            {!currentUser ? (
              <button
                onClick={() => onNavigate('auth')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-glow transition-all cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={() => onNavigate('app')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors cursor-pointer"
              >
                Dashboard
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full flex-1 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 border border-brand-500/20">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Direct Support &amp; Contact</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-ink-950 dark:text-white tracking-tight">
            We'd love to hear from you.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 leading-relaxed">
            Have a question, feedback, feature suggestion, or partnership proposal? Reach out directly via WhatsApp or email.
          </p>
        </div>

        {/* Two Primary Direct Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* WhatsApp Card */}
          <div className="relative group p-6 rounded-3xl bg-white dark:bg-ink-900 border border-slate-200/80 dark:border-white/10 shadow-lift hover:border-emerald-500/50 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active on WhatsApp
                </span>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-ink-950 dark:text-white">
                  WhatsApp Support
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                  Instant messaging for rapid assistance, feature questions, and direct creator chat.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-950/80 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white font-mono truncate">
                    {contactPhoneFormatted}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(contactPhoneRaw, 'phone')}
                  title="Copy WhatsApp phone number"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-ink-800 transition-colors cursor-pointer shrink-0"
                >
                  {copiedType === 'phone' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-glow cursor-pointer active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy(contactPhoneRaw, 'phone')}
                className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition-colors cursor-pointer"
              >
                {copiedType === 'phone' ? 'Copied!' : 'Copy Number'}
              </button>
            </div>
          </div>

          {/* Email Card */}
          <div className="relative group p-6 rounded-3xl bg-white dark:bg-ink-900 border border-slate-200/80 dark:border-white/10 shadow-lift hover:border-brand-500/50 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                  Official Inbox
                </span>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-ink-950 dark:text-white">
                  Email Inquiry
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
                  For detailed queries, partnerships, media outreach, account support, and reporting.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-ink-950/80 border border-slate-200/70 dark:border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-brand-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white font-mono truncate">
                    {contactEmail}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(contactEmail, 'email')}
                  title="Copy email address"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/60 dark:hover:bg-ink-800 transition-colors cursor-pointer shrink-0"
                >
                  {copiedType === 'email' ? <Check className="w-4 h-4 text-brand-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <a
                href={`mailto:${contactEmail}?subject=Inquiry%20from%20YesOrNo`}
                className="flex-1 py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-glow cursor-pointer active:scale-95"
              >
                <Mail className="w-4 h-4" />
                <span>Send an Email</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy(contactEmail, 'email')}
                className="py-3 px-4 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition-colors cursor-pointer"
              >
                {copiedType === 'email' ? 'Copied!' : 'Copy Email'}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Quick Contact Message Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-ink-900 border border-slate-200/80 dark:border-white/10 shadow-lift space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-ink-950 dark:text-white">
                Compose a Quick Message
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Write your note below and choose whether to send it straight to WhatsApp or via Email.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-950 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                  Your Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. alex@example.com"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-950 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="What is this regarding? (Feedback, Bug report, Partnership)"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-ink-950 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300 mb-1">
                Message
              </label>
              <textarea
                rows={4}
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                className="w-full text-xs sm:text-sm p-3.5 rounded-xl bg-slate-100 dark:bg-ink-950 border border-slate-200 dark:border-white/10 text-ink-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!formMessage.trim()}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-all ${
                  formMessage.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-glow active:scale-95'
                    : 'bg-slate-200 dark:bg-ink-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Send via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={!formMessage.trim()}
                className={`py-2.5 px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-all ${
                  formMessage.trim()
                    ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer shadow-glow active:scale-95'
                    : 'bg-slate-200 dark:bg-ink-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send via Email</span>
              </button>
            </div>
          </div>
        </div>

        {/* Helpful Info & Community Guidelines Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-100/80 dark:bg-ink-900/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white">
                Looking for Community Standards &amp; Policies?
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
                Learn how YesOrNo protects civil discourse, voting integrity, and participant privacy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenGuidelines && (
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700 text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
              >
                Guidelines
              </button>
            )}
            {onOpenLegal && (
              <button
                type="button"
                onClick={() => onOpenLegal('terms')}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-ink-800 hover:bg-slate-50 dark:hover:bg-ink-700 text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
              >
                Terms
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white dark:bg-ink-950 border-t border-slate-200/80 dark:border-white/10 py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              <Vote className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-ink-950 dark:text-white">YesOrNo</span>
            <span>• Direct Contact &amp; Assistance</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <button onClick={() => onNavigate(currentUser ? 'app' : 'landing')} className="hover:text-ink-950 dark:hover:text-white transition-colors cursor-pointer">
              {currentUser ? 'Feed' : 'Home'}
            </button>
            {onOpenGuidelines && (
              <button onClick={onOpenGuidelines} className="hover:text-ink-950 dark:hover:text-white transition-colors cursor-pointer">
                Community Guidelines
              </button>
            )}
            {onOpenLegal && (
              <>
                <button onClick={() => onOpenLegal('terms')} className="hover:text-ink-950 dark:hover:text-white transition-colors cursor-pointer">
                  Terms of Use
                </button>
                <button onClick={() => onOpenLegal('privacy')} className="hover:text-ink-950 dark:hover:text-white transition-colors cursor-pointer">
                  Privacy Policy
                </button>
              </>
            )}
            <button onClick={() => onNavigate('contact')} className="font-bold text-brand-600 dark:text-brand-400 cursor-pointer">
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
