/**
 * YesOrNo - First-Touch Traffic Acquisition & Channel Attribution Engine
 * Tracks where a visitor originated from before they registered on the platform,
 * preserving original referrer, UTM campaign parameters, and initial landing page.
 */

export interface AcquisitionData {
  channel: string;          // e.g. "X (Twitter)", "WhatsApp", "Facebook", "Google Search", "Direct / Organic"
  referrer: string;         // document.referrer or 'direct'
  landingPath: string;      // initial path & hash e.g. "/#issue/issue-5"
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  capturedAt: string;       // ISO timestamp
}

const STORAGE_KEY_ACQUISITION = 'cp_first_touch_acquisition';

/**
 * Classifies raw referrer and UTM parameters into a human-readable channel
 */
function classifyChannel(referrer: string, searchParams: URLSearchParams): string {
  const utmSource = (searchParams.get('utm_source') || searchParams.get('source') || searchParams.get('ref') || '').toLowerCase().trim();
  const utmMedium = (searchParams.get('utm_medium') || '').toLowerCase().trim();

  // 1. Explicit UTM / campaign overrides
  if (utmSource) {
    if (utmSource.includes('twitter') || utmSource === 'x' || utmSource.includes('t.co')) return 'X (Twitter)';
    if (utmSource.includes('whatsapp') || utmSource === 'wa') return 'WhatsApp';
    if (utmSource.includes('facebook') || utmSource === 'fb') return 'Facebook';
    if (utmSource.includes('instagram') || utmSource === 'ig') return 'Instagram';
    if (utmSource.includes('linkedin')) return 'LinkedIn';
    if (utmSource.includes('tiktok')) return 'TikTok';
    if (utmSource.includes('reddit')) return 'Reddit';
    if (utmSource.includes('youtube') || utmSource === 'yt') return 'YouTube';
    if (utmSource.includes('newsletter') || utmMedium.includes('email')) return 'Email Newsletter';
    if (utmSource.includes('google')) return 'Google Campaign';
    // Format custom source
    return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
  }

  // 2. HTTP Document Referrer parsing
  if (!referrer || referrer === 'direct') {
    return 'Direct / Shared Link';
  }

  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();

    // Ignore same-origin navigations as external referrers
    if (typeof window !== 'undefined' && host === window.location.hostname.toLowerCase()) {
      return 'Direct / Internal';
    }

    // Social Media Networks
    if (host.includes('t.co') || host.includes('twitter.com') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('whatsapp.com') || host.includes('whatsapp') || host.includes('api.whatsapp.com')) return 'WhatsApp';
    if (host.includes('facebook.com') || host.includes('fb.me') || host.includes('messenger.com')) return 'Facebook';
    if (host.includes('instagram.com') || host.includes('l.instagram.com')) return 'Instagram';
    if (host.includes('linkedin.com') || host.includes('lnkd.in')) return 'LinkedIn';
    if (host.includes('tiktok.com')) return 'TikTok';
    if (host.includes('reddit.com')) return 'Reddit';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('t.me') || host.includes('telegram.org')) return 'Telegram';
    if (host.includes('threads.net')) return 'Threads';

    // Search Engines
    if (host.includes('google.') || host.includes('googleusercontent.')) return 'Google Search';
    if (host.includes('bing.com')) return 'Bing Search';
    if (host.includes('yahoo.com')) return 'Yahoo Search';
    if (host.includes('duckduckgo.com')) return 'DuckDuckGo';

    // Generic External Referral
    const cleanHost = host.replace(/^www\./, '');
    return `Referral (${cleanHost})`;
  } catch {
    return 'External Referral';
  }
}

/**
 * Captures and stores first-touch acquisition metadata on initial site visit.
 * Never overwrites existing acquisition data once set, preserving true origin.
 */
export function captureFirstTouchAcquisitionSource(): AcquisitionData {
  if (typeof window === 'undefined') {
    return {
      channel: 'Direct / Organic',
      referrer: 'direct',
      landingPath: '/',
      capturedAt: new Date().toISOString(),
    };
  }

  try {
    const existing = localStorage.getItem(STORAGE_KEY_ACQUISITION);
    if (existing) {
      const parsed = JSON.parse(existing) as AcquisitionData;
      if (parsed && parsed.channel) {
        return parsed;
      }
    }
  } catch {
    // Corrupted localStorage, re-capture
  }

  const rawReferrer = document.referrer ? document.referrer.trim() : 'direct';
  const searchParams = new URLSearchParams(window.location.search);
  const landingPath = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
  const channel = classifyChannel(rawReferrer, searchParams);

  const acquisition: AcquisitionData = {
    channel,
    referrer: rawReferrer,
    landingPath,
    utmSource: searchParams.get('utm_source') || searchParams.get('source') || searchParams.get('ref') || undefined,
    utmMedium: searchParams.get('utm_medium') || undefined,
    utmCampaign: searchParams.get('utm_campaign') || undefined,
    capturedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY_ACQUISITION, JSON.stringify(acquisition));
  } catch (err) {
    console.warn('Failed to cache acquisition data:', err);
  }

  return acquisition;
}

/**
 * Returns the stored first-touch acquisition channel for the current visitor
 */
export function getFirstTouchAcquisitionSource(): AcquisitionData {
  if (typeof window === 'undefined') {
    return {
      channel: 'Direct / Organic',
      referrer: 'direct',
      landingPath: '/',
      capturedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACQUISITION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.channel) {
        return parsed;
      }
    }
  } catch {
    // Fall back to capture
  }

  return captureFirstTouchAcquisitionSource();
}
