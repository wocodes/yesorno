import React, { useState, useId, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, User, ShieldAlert, Sparkles, Check, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Issue, VoteChoice, VoiceAttachment, VoteSubmission, UserProfile } from '../types';
import { VoiceRecorder } from './VoiceRecorder';
import { moderateText, generateCivicAlias } from '../utils/moderation';
import { isIssueClosed } from '../utils/summary';
import { canUserAccessIssue } from '../utils/auth';
import { triggerVoteConfetti, playHapticChime } from '../utils/sound';

interface Props {
  issue: Issue | null;
  initialChoice?: VoteChoice | null;
  existingVoteChoice?: VoteChoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitVote: (submission: VoteSubmission) => void;
  onOpenGuidelines: () => void;
  currentUser?: UserProfile | null;
}

export const VoteModal: React.FC<Props> = ({
  issue,
  initialChoice = null,
  existingVoteChoice = null,
  isOpen,
  onClose,
  onSubmitVote,
  onOpenGuidelines,
  currentUser
}) => {
  const [choice, setChoice] = useState<VoteChoice | null>(initialChoice || existingVoteChoice || null);
  const [note, setNote] = useState('');
  const [voiceAttachment, setVoiceAttachment] = useState<VoiceAttachment | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [authorName, setAuthorName] = useState(currentUser?.name || '');
  const [authorRole, setAuthorRole] = useState(currentUser?.role || '');
  const [generatedAlias] = useState(() => generateCivicAlias());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setChoice(initialChoice || existingVoteChoice || null);
      setNote('');
      setVoiceAttachment(null);
      setIsAnonymous(currentUser?.defaultAnonymous ?? true);
      setAuthorName(currentUser?.name || '');
      setAuthorRole(currentUser?.role || '');
    }
  }, [isOpen, initialChoice, existingVoteChoice, currentUser]);

  if (!isOpen || !issue) return null;

  const isClosed = isIssueClosed(issue.closingDate);
  const access = canUserAccessIssue(issue, currentUser || null);

  // Real-time moderation check
  const moderation = moderateText(note);
  const isBlockedByModeration = !moderation.isAppropriate && moderation.severity === 'rejected';

  const canSubmit = 
    !isClosed &&
    access.canAccess &&
    choice !== null && 
    !isBlockedByModeration &&
    (!isAnonymous ? (authorName.trim().length > 0) : true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !choice) return;

    setIsSubmitting(true);

    const submission: VoteSubmission = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      issueId: issue.id,
      choice,
      isAnonymous,
      authorName: isAnonymous ? 'Anonymous Neighbor' : authorName.trim(),
      authorEmail: !isAnonymous && currentUser?.email ? currentUser.email : undefined,
      authorAlias: isAnonymous ? generatedAlias : undefined,
      authorRole: !isAnonymous && authorRole.trim() ? authorRole.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      voiceNote: voiceAttachment || undefined,
      createdAt: new Date().toISOString(),
      likesCount: 0
    };

    setTimeout(() => {
      triggerVoteConfetti(choice === 'YES');
      onSubmitVote(submission);
      setIsSubmitting(false);
      onClose();
    }, 220);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-950/70 backdrop-blur-md animate-fade-in overflow-hidden overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-lift border border-slate-200/80 dark:border-white/10 overflow-hidden max-h-[92vh] flex flex-col animate-slide-up overscroll-contain">
        {/* Dark Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pr-8 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
                {issue.category}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Clock className="w-3 h-3" /> Under 1 min
              </span>
            </div>
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-white leading-snug">
              {issue.title}
            </h2>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto overscroll-contain space-y-4 flex-1">
          {isClosed && (
            <div className="p-3 bg-ink-900 text-white rounded-2xl text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Voting has concluded for this issue.</span>
            </div>
          )}

          {!access.canAccess && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Restricted to invited private circle members.</span>
            </div>
          )}

          {existingVoteChoice && (
            <div className="p-3 rounded-2xl bg-brand-50/80 border border-brand-200/80 text-xs flex items-center justify-between text-brand-900">
              <span className="flex items-center gap-1.5 font-semibold">
                <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>You previously voted <strong>{existingVoteChoice}</strong>. You can switch your stance anytime.</span>
              </span>
            </div>
          )}

          {/* YES or NO VOTE */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setChoice('YES');
                playHapticChime('yes');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 font-extrabold text-base transition-all cursor-pointer ${
                choice === 'YES'
                  ? 'border-emerald-600 bg-emerald-50/90 text-emerald-900 shadow-glow-emerald scale-[1.01]'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700 bg-white'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${choice === 'YES' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                <ThumbsUp className="w-4 h-4" />
              </div>
              <span>YES</span>
              {choice === 'YES' && <Check className="w-4 h-4 text-emerald-700 ml-auto" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setChoice('NO');
                playHapticChime('no');
              }}
              className={`flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 font-extrabold text-base transition-all cursor-pointer ${
                choice === 'NO'
                  ? 'border-rose-600 bg-rose-50/90 text-rose-900 shadow-glow-rose scale-[1.01]'
                  : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-slate-700 bg-white'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${choice === 'NO' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
                <ThumbsDown className="w-4 h-4" />
              </div>
              <span>NO</span>
              {choice === 'NO' && <Check className="w-4 h-4 text-rose-700 ml-auto" />}
            </button>
          </div>

          {/* VOICE NOTE ATTACHMENT */}
          <VoiceRecorder
            existingAttachment={voiceAttachment}
            isAnonymous={isAnonymous}
            label={isAnonymous ? '60s Voice Note (With Pitch Masking)' : '60s Voice Note (Optional)'}
            onRecordingComplete={(attachment) => setVoiceAttachment(attachment)}
          />

          {/* WRITTEN NOTE (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="vote-note-input" className="text-xs font-bold text-slate-700">
                Written Note <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {note.length}/500
              </span>
            </div>
            <textarea
              id="vote-note-input"
              rows={2}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Briefly share why you voted YES or NO..."
              className="w-full text-xs sm:text-sm p-3 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400 resize-none"
            />

            {note.trim().length > 0 && (
              <div className="mt-1.5 text-xs">
                {moderation.isAppropriate ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                    <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Constructive tone verified</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{moderation.flags[0]}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ANONYMOUS TOGGLE & IDENTITY */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Vote Anonymously</span>
                  <span className="text-[11px] text-slate-500">
                    {isAnonymous ? `Posting as ${generatedAlias}` : 'Posting with your name'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  isAnonymous ? 'bg-brand-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isAnonymous ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!isAnonymous && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-fade-in">
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Role / Circle (Optional)"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-1 space-y-2">
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-lift transition-all flex items-center justify-center gap-2 ${
                canSubmit && !isSubmitting
                  ? 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white active:scale-[0.99] cursor-pointer shadow-glow'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span>Recording Vote...</span>
              ) : (
                <>
                  <span>
                    {existingVoteChoice && choice && choice !== existingVoteChoice
                      ? `Switch Vote to ${choice}`
                      : existingVoteChoice && choice && choice === existingVoteChoice && (note.trim() || voiceAttachment)
                      ? `Add Perspective to ${choice} Vote`
                      : `Submit ${choice ? `${choice} Vote` : 'Vote'}`}
                  </span>
                  {choice && <span className="text-xs opacity-85 font-normal">• {isAnonymous ? generatedAlias : (authorName || 'Public')}</span>}
                </>
              )}
            </button>

            <div className="text-[11px] text-center text-slate-400">
              Protected by our{' '}
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="text-brand-600 font-semibold hover:underline cursor-pointer"
              >
                Community Guidelines
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
