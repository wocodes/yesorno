import React, { useState } from 'react';
import { X, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Issue } from '../types';
import { buildIssueSharePayload } from '../utils/share';

interface Props {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareIssueModal: React.FC<Props> = ({ issue, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !issue) return null;

  const payload = buildIssueSharePayload(issue);
  const encodedUrl = encodeURIComponent(payload.url);
  const encodedText = encodeURIComponent(`${payload.fullText}\n${payload.url}`);
  const encodedTweet = encodeURIComponent(`${payload.title}\n\n${payload.description}\n\nVote YES or NO:`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${payload.fullText}\n${payload.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: `${payload.title} — ${payload.description}`,
          url: payload.url
        });
      } catch {
        // User cancelled
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-ink-900 rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/20 border border-brand-400/30 text-brand-300">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Share Issue to Social Media</h3>
              <p className="text-[11px] text-zinc-400">Includes issue title, description &amp; live vote link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Social Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950 border border-slate-200/80 dark:border-white/10 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {issue.category}
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-ink-950 dark:text-white leading-snug">
              {payload.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              {payload.description}
            </p>
            <div className="pt-1 text-[10px] font-mono text-slate-400 dark:text-zinc-500 truncate">
              {payload.url}
            </div>
          </div>

          {/* Social Network Buttons */}
          <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedTweet}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-ink-950 hover:bg-ink-800 dark:bg-white/10 dark:hover:bg-white/15 text-white transition-all"
            >
              <span>𝕏 / Twitter</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://wa.me/?text=${encodedText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
            >
              <span>WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#0A66C2] hover:bg-[#0958a8] text-white transition-all"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`${payload.title}\n\n${payload.description}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec4] text-white transition-all"
            >
              <span>Telegram</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(`${payload.title} — ${payload.description}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white transition-all"
            >
              <span>Share on Facebook</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>

          {/* Copy Rich Text + Link */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2.5 px-4 rounded-xl bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 dark:hover:bg-brand-500/25 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-400/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Copied Title, Description &amp; Link!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Title, Description &amp; Link</span>
                </>
              )}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                title="More share options"
              >
                More…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

