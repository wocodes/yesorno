import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, ExternalLink, Download, 
  Sparkles, Smartphone, Loader2, Flame, BookOpen, Zap,
  MessageSquare
} from 'lucide-react';
import { Issue, UserProfile } from '../types';
import { ColorTone } from '../utils/theme';
import { buildIssueSlug } from '../utils/share';
import { 
  CardStyle,
  CommentCardData,
  generateCommentCardDataUrl,
  downloadCommentCard,
  copyCommentCardToClipboard,
  shareCommentCardFile
} from '../utils/cardGenerator';
import { recordEngagementAction } from '../utils/analytics';
import { notifyAdminIssueShared } from '../utils/emailNotifier';

interface Props {
  issue: Issue | null;
  comment: CommentCardData | null;
  isOpen: boolean;
  onClose: () => void;
  colorTone?: ColorTone;
  currentUser?: UserProfile | null;
}

export const ShareCommentModal: React.FC<Props> = ({
  issue,
  comment,
  isOpen,
  onClose,
  colorTone = 'toned',
  currentUser
}) => {
  const [style, setStyle] = useState<CardStyle>('bold');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Check Web Share API file support
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

  // Generate crisp canvas card preview whenever issue, comment, or style changes
  useEffect(() => {
    if (!isOpen || !issue || !comment) {
      setPreviewUrl(null);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    generateCommentCardDataUrl(issue, comment, { style, colorTone })
      .then((url) => {
        if (isMounted) {
          setPreviewUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate comment card preview:', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, issue, comment, style, colorTone]);

  if (!isOpen || !issue || !comment) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yesorno.chillon.top';
  const slug = buildIssueSlug(issue);
  const commentShareUrl = `${origin}/${slug}?c=${comment.id}`;
  const tweetText = `"${comment.text}" — ${comment.author} on YesOrNo: ${issue.title}`;

  // Download high-res PNG image
  const handleDownload = async () => {
    if (!issue || !comment || isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadCommentCard(issue, comment, { style, colorTone });
      recordEngagementAction('card_download', `${comment.author}'s comment on ${issue.title} (${style})`);
      notifyAdminIssueShared(issue, `Downloaded Comment Card (${style.toUpperCase()}) - ${comment.author}`, currentUser);
    } catch (err) {
      console.error('Failed to download comment card:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyImage = async () => {
    if (!issue || !comment) return;
    try {
      const ok = await copyCommentCardToClipboard(issue, comment, { style, colorTone });
      if (ok) {
        setCopiedImage(true);
        recordEngagementAction('card_copy', `${comment.author}'s comment on ${issue.title} (${style})`);
        notifyAdminIssueShared(issue, `Copied Comment Card to Clipboard (${style.toUpperCase()})`, currentUser);
        setTimeout(() => setCopiedImage(false), 3000);
      } else {
        await handleCopyLink();
      }
    } catch {
      await handleCopyLink();
    }
  };

  // Share Image File via Native Web Share sheet
  const handleShareFile = async () => {
    if (!issue || !comment) return;
    try {
      const shared = await shareCommentCardFile(issue, comment, { style, colorTone });
      if (shared) {
        recordEngagementAction('share', `${comment.author}'s comment on ${issue.title} (Image File - ${style})`);
        notifyAdminIssueShared(issue, `Native Comment Image Share (${style.toUpperCase()})`, currentUser);
      }
    } catch {
      // User cancelled
    }
  };

  // Copy Direct Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(commentShareUrl);
      setCopiedLink(true);
      recordEngagementAction('share', `${comment.author}'s comment on ${issue.title} (Copied Link)`);
      notifyAdminIssueShared(issue, `Copied Comment Direct Link - ${comment.author}`, currentUser);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Share to X
  const handleShareX = () => {
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(commentShareUrl)}`;
    window.open(xUrl, '_blank', 'noopener,noreferrer');
    recordEngagementAction('share', `${comment.author}'s comment on ${issue.title} (X Share)`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-ink-900 rounded-3xl p-5 sm:p-7 shadow-lift border border-slate-200 dark:border-white/10 space-y-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink-950 dark:text-white flex items-center gap-2">
                <span>Share Perspective Card</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300">
                  Image Card
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Question at the top, reply highlighted in the callout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Selector Tabs */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <span>Card Visual Style</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStyle('bold')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                style === 'bold'
                  ? 'bg-ink-950 text-white dark:bg-brand-500 dark:text-white shadow-soft'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Bold</span>
            </button>

            <button
              type="button"
              onClick={() => setStyle('editorial')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                style === 'editorial'
                  ? 'bg-ink-950 text-white dark:bg-brand-500 dark:text-white shadow-soft'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Editorial</span>
            </button>

            <button
              type="button"
              onClick={() => setStyle('neon')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                style === 'neon'
                  ? 'bg-ink-950 text-white dark:bg-brand-500 dark:text-white shadow-soft'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Neon</span>
            </button>
          </div>
        </div>

        {/* Live Card Preview Box */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center min-h-[300px] sm:min-h-[360px]">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt={`Perspective by ${comment.author}`}
              className="w-full h-auto object-contain max-h-[380px] sm:max-h-[420px] transition-opacity duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              <span className="text-xs font-semibold">Generating high-res card...</span>
            </div>
          )}

          {isGenerating && previewUrl && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Download Image Card */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isGenerating}
              className="py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-glow transition-all cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloading ? 'Rendering PNG...' : 'Download Image Card'}</span>
            </button>

            {/* Copy Image to Clipboard */}
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating}
              className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                copiedImage
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white border-slate-200 dark:border-white/10'
              }`}
            >
              {copiedImage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedImage ? 'Image Copied!' : 'Copy Image to Clipboard'}</span>
            </button>
          </div>

          {/* Mobile Native Share / Web Share API */}
          {canShareFiles && (
            <button
              type="button"
              onClick={handleShareFile}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Share Image via Mobile Sheet</span>
            </button>
          )}

          {/* Social Links Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-brand-500 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700 dark:text-zinc-200 bg-white dark:bg-ink-800 transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareX}
              className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-brand-500 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700 dark:text-zinc-200 bg-white dark:bg-ink-800 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Share to 𝕏 Post</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
