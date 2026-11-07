import React, { useState, useEffect } from 'react';
import { 
  Download, X, Share, PlusSquare, CheckCircle2, 
  Smartphone 
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY_DISMISSED = 'yesorno_pwa_dismissed_v1';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const standaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    
    setIsStandalone(standaloneMode);
    if (standaloneMode) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user dismissed recently
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for manual trigger from navbar or footer
    const handleManualShow = () => {
      setIsVisible(true);
    };
    window.addEventListener('show-pwa-install', handleManualShow);

    // If on iOS and not dismissed, show prompt after a short delay
    if (isAppleDevice && !standaloneMode) {
      const dismissed = localStorage.getItem(STORAGE_KEY_DISMISSED);
      if (!dismissed) {
        const timer = setTimeout(() => setIsVisible(true), 2500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('show-pwa-install', handleManualShow);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        // Keep visible to show step-by-step instructions
        return;
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
  };

  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-slide-up">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-indigo-500/30 ring-1 ring-white/10 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center p-2 shadow-md shrink-0">
              <img src="/icons/icon.svg" alt="YesOrNo Icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">Add YesOrNo to Home Screen</h3>
                <span className="text-[10px] font-bold uppercase bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Install for instant 1-tap voting and faster offline access.
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 py-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Full-screen app view</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Instant voice recording</span>
          </div>
        </div>

        {/* Action Button: Android/Chrome vs iOS instructions */}
        {isIOS ? (
          <div className="bg-white/10 rounded-xl p-3 text-xs space-y-1.5 border border-white/10 text-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>How to Install on iPhone / iPad:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 pl-1 leading-snug">
              <li>
                Tap the <strong className="text-white">Share</strong> button <Share className="w-3 h-3 inline mx-0.5" /> in Safari&apos;s bottom bar
              </li>
              <li>
                Scroll down and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3 h-3 inline mx-0.5" />
              </li>
              <li>
                Tap <strong className="text-white">Add</strong> in the top-right corner
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Got It
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Install Web App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2.5 px-3 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
