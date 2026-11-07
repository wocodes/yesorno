import React, { useState, useEffect } from 'react';
import { 
  X, Share2, Copy, Check, ExternalLink, Download, 
  Sparkles, Image as ImageIcon, Smartphone, Monitor, Loader2 
} from 'lucide-react';
import { Issue } from '../types';
import { ColorTone } from '../utils/theme';
import { buildIssueSharePayload } from '../utils/share';
import { 
  CardFormat, 
  generateIssueCardDataUrl, 
  downloadIssueCard, 
  copyIssueCardToClipboard, 
  shareIssueCardFile 
} from '../utils/cardGenerator';
import { recordEngagementAction } from '../utils/analytics';

interface Props {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  colorTone?: ColorTone;
}

export const ShareIssueModal: React.FC<Props> = ({ 
  issue, 
  isOpen, 
  onClose, 
  colorTone = 'vibrant' 
}) => {
  const [format, setFormat] = useState<CardFormat>('landscape');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Check if Web Share API with files is supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const dummyFile = new File([''], 'test.png', { type: 'image/png' });
        setCanShareFiles(navigator.canShare({ files: [dummyFile] }));
      } catch {
        setCanShareFiles(false);
      }
    }
  }, []);

  // Generate crisp canvas card preview whenever issue, format, or colorTone changes
  useEffect(() => {
    if (!isOpen || !issue) {
      setPreviewUrl(null);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    generateIssueCardDataUrl(issue, { format, colorTone })
      .then((url) => {
        if (isMounted) {
          setPreviewUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate issue card preview:', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, issue, format, colorTone]);

  if (!isOpen || !issue) return null;

  const payload = buildIssueSharePayload(issue);
  const encodedUrl = encodeURIComponent(payload.url);
  const encodedText = encodeURIComponent(`${payload.fullText}\n${payload.url}`);
  const encodedTweet = encodeURIComponent(`${payload.title}\n\n${payload.description}\n\nVote YES or NO:`);

  // Download high-resolution PNG image card
  const handleDownload = async () => {
    if (!issue || isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadIssueCard(issue, { format, colorTone });
      recordEngagementAction('card_download', issue.title);
    } catch (err) {
      console.error('Failed to download card:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyImage = async () => {
    if (!issue) return;
    try {
      const ok = await copyIssueCardToClipboard(issue, { format, colorTone });
      if (ok) {
        setCopiedImage(true);
        recordEngagementAction('card_copy', issue.title);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        // Fallback to text copy if image clipboard write is blocked
        await handleCopyText();
      }
    } catch {
      await handleCopyText();
    }
  };

  // Share Image File directly via Native Web Share sheet
  const handleShareFile = async () => {
    if (!issue) return;
    try {
      const shared = await shareIssueCardFile(issue, { format, colorTone });
      if (shared) {
        recordEngagementAction('share', `${issue.title} (Image File)`);
      }
    } catch {
      // User cancelled
    }
  };

  // Copy plain text + URL
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(`${payload.fullText}\n${payload.url}`);
      setCopiedLink(true);
      recordEngagementAction('share', `${issue.title} (Copied Link)`);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: `${payload.fullText}\n${payload.url}`,
          url: payload.url,
        });
        recordEngagementAction('share', `${issue.title} (Native Web Share)`);
      } catch {
        // User cancelled
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-md animate-fade-in overflow-hidden overscroll-contain"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-ink-900 rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden max-h-[92vh] flex flex-col animate-slide-up overscroll-contain">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/20 border border-brand-400/30 text-brand-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>Share &amp; Export Issue Card</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Download a beautiful marketing image card or share link directly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">

          {/* Card Format Selector & Dimension Pill */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-ink-950 p-1 rounded-2xl border border-slate-200/60 dark:border-white/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat('landscape')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  format === 'landscape'
                    ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-soft font-bold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Feed (16:9)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('square')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  format === 'square'
                    ? 'bg-white dark:bg-ink-800 text-ink-950 dark:text-white shadow-soft font-bold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-ink-950 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Square (1:1)</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 hidden sm:inline">
              {format === 'landscape' ? '1200 × 675 px' : '1080 × 1080 px'}
            </span>
          </div>

          {/* Visual Image Card Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-soft group">
            {isGenerating ? (
              <div className="w-full aspect-[16/9] flex flex-col items-center justify-center gap-2 text-zinc-400 bg-ink-950">
                <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                <span className="text-xs">Generating high-res card...</span>
              </div>
            ) : previewUrl ? (
              <div className="relative w-full flex items-center justify-center bg-black/40">
                <img
                  src={previewUrl}
                  alt={`${issue.title} Share Card`}
                  className={`w-full object-contain ${
                    format === 'square' ? 'max-h-[300px]' : 'max-h-[250px]'
                  }`}
                />
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono border border-white/10 pointer-events-none">
                  HD PNG
                </div>
              </div>
            ) : null}
          </div>

          {/* Primary Action Buttons: Download Card & Copy Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="btn-brand py-2.5 px-4 text-xs font-bold shadow-glow flex items-center justify-center gap-2 cursor-pointer w-full"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing PNG...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Image Card (.PNG)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-slate-800 dark:text-zinc-100 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-white/10"
            >
              {copiedImage ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Image Copied! Paste Anywhere</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 text-brand-500" />
                  <span>Copy Image to Clipboard</span>
                </>
              )}
            </button>
          </div>

          {/* Optional Native File Share on mobile */}
          {canShareFiles && (
            <button
              type="button"
              onClick={handleShareFile}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Image via WhatsApp / Instagram / AirDrop</span>
            </button>
          )}

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
              <span className="bg-white dark:bg-ink-900 px-2">Or Share Direct Link</span>
            </div>
          </div>

          {/* Social Network Buttons */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <a
              href={`https://wa.me/?text=${encodedText}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEngagementAction('share', `${issue.title} (WhatsApp)`)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-2xs"
            >
              <span>WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodedTweet}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEngagementAction('share', `${issue.title} (Twitter/X)`)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-ink-950 hover:bg-ink-800 dark:bg-white/10 dark:hover:bg-white/15 text-white transition-all shadow-2xs"
            >
              <span>𝕏 / Twitter</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEngagementAction('share', `${issue.title} (LinkedIn)`)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#0A66C2] hover:bg-[#0958a8] text-white transition-all shadow-2xs"
            >
              <span>LinkedIn</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`${payload.title}\n\n${payload.description}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEngagementAction('share', `${issue.title} (Telegram)`)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec4] text-white transition-all shadow-2xs"
            >
              <span>Telegram</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(`${payload.title} — ${payload.description}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordEngagementAction('share', `${issue.title} (Facebook)`)}
              className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white transition-all shadow-2xs"
            >
              <span>Share on Facebook</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>

          {/* Copy Link & Description */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-ink-950 hover:bg-slate-100 dark:hover:bg-ink-800 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied Question, Details &amp; Link!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Question &amp; Direct Link</span>
                </>
              )}
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer border border-slate-200/60 dark:border-white/10"
                title="More device share options"
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
