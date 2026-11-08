import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  issueTitle?: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmModal: React.FC<Props> = ({
  isOpen,
  issueTitle,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div 
        className="relative w-full max-w-md bg-white dark:bg-ink-900 rounded-3xl shadow-lift border border-slate-200 dark:border-white/10 p-6 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-base font-extrabold text-ink-950 dark:text-white">
              Delete Issue Topic?
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              This action cannot be undone
            </p>
          </div>
        </div>

        {issueTitle && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/5">
            <p className="text-xs font-semibold text-ink-900 dark:text-zinc-200 line-clamp-2">
              &ldquo;{issueTitle}&rdquo;
            </p>
          </div>
        )}

        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-400/20 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <span>
            Your question and description will be replaced with <strong>&ldquo;Deleted by Author&rdquo;</strong>. In accordance with community integrity, all recorded votes and perspectives will remain preserved.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Topic'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
