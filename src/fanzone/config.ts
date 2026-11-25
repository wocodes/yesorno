import { AppZone, FavoriteClub, Issue, IssueCategory } from '../types';

/**
 * Detects which product zone is currently active from the URL path or query string.
 */
export function detectActiveZone(): AppZone {
  if (typeof window === 'undefined') return 'civic';
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (path === '/fanzone' || path.startsWith('/fanzone/') || params.get('zone') === 'fanzone') {
    return 'fanzone';
  }
  return 'civic';
}

/**
 * Returns the URL path prefix for the given zone ('/fanzone' or '').
 */
export function getZoneBasePath(zone: AppZone): string {
  return zone === 'fanzone' ? '/fanzone' : '';
}

/**
 * Navigates between Civic Pulse and FanZone at the top level so initial HTML/zone state updates cleanly.
 */
export function navigateToZone(zone: AppZone): void {
  if (typeof window === 'undefined') return;
  window.location.href = zone === 'fanzone' ? '/fanzone' : '/';
}

export const FANZONE_CATEGORIES: IssueCategory[] = [
  'All',
  'Premier League',
  'Champions League',
  'La Liga',
  'Serie A & Bundesliga',
  'International & World Cup',
  'Transfers & Rumors',
  'VAR & Officiating',
  'GOAT & Legacy',
  'Matchday Banter',
];

export const FANZONE_CATEGORY_META: Record<string, { shortLabel: string; emoji: string }> = {
  'All': { shortLabel: 'All Takes', emoji: '⚽' },
  'Premier League': { shortLabel: 'Premier League', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Champions League': { shortLabel: 'UCL', emoji: '🏆' },
  'La Liga': { shortLabel: 'La Liga', emoji: '🇪🇸' },
  'Serie A & Bundesliga': { shortLabel: 'Serie A & BuLi', emoji: '⚡' },
  'International & World Cup': { shortLabel: 'International', emoji: '🌍' },
  'Transfers & Rumors': { shortLabel: 'Transfers', emoji: '✍️' },
  'VAR & Officiating': { shortLabel: 'VAR Calls', emoji: '📺' },
  'GOAT & Legacy': { shortLabel: 'GOAT Debates', emoji: '🐐' },
  'Matchday Banter': { shortLabel: 'Banter', emoji: '🔥' },
};

export interface BinaryPreset {
  id: string;
  yesLabel: string;
  noLabel: string;
  description: string;
}

export const BINARY_PRESETS: BinaryPreset[] = [
  { id: 'yes_no', yesLabel: 'YES', noLabel: 'NO', description: 'Classic verdict' },
  { id: 'fact_cap', yesLabel: 'FACT', noLabel: 'CAP', description: 'Hot takes & banter' },
  { id: 'back_sack', yesLabel: 'BACK', noLabel: 'SACK', description: 'Manager or player pressure' },
  { id: 'pen_nopen', yesLabel: 'PENALTY', noLabel: 'NO PEN', description: 'VAR & referee calls' },
  { id: 'goat_over', yesLabel: 'GOAT', noLabel: 'OVERRATED', description: 'Player & legacy debates' },
  { id: 'sign_pass', yesLabel: 'SIGN', noLabel: 'PASS', description: 'Transfer rumors' },
];

export const MULTI_OPTION_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'];

const espnCrest = (teamId: number | string) => `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;

export const GLOBAL_CLUBS: FavoriteClub[] = [
  // Top 20 Global Clubs (featured in horizontal scrollable club strip)
  { id: 'real-madrid', name: 'Real Madrid', shortName: 'RMA', league: 'La Liga', color: '#FEBE10', logoUrl: espnCrest(86), aliases: ['real madrid', 'madrid', 'los blancos', 'bernabeu', 'ancelotti', 'mbappe', 'vini'], isTop20: true },
  { id: 'barcelona', name: 'FC Barcelona', shortName: 'BAR', league: 'La Liga', color: '#A50044', logoUrl: espnCrest(83), aliases: ['barcelona', 'barca', 'barça', 'fc barcelona', 'camp nou', 'lamine', 'yamal', 'flick'], isTop20: true },
  { id: 'man-utd', name: 'Manchester United', shortName: 'MUN', league: 'Premier League', color: '#DA291C', logoUrl: espnCrest(360), aliases: ['manchester united', 'man utd', 'man united', 'united', 'old trafford', 'mufc', 'red devils', 'amorim'], isTop20: true },
  { id: 'liverpool', name: 'Liverpool', shortName: 'LIV', league: 'Premier League', color: '#C8102E', logoUrl: espnCrest(364), aliases: ['liverpool', 'anfield', 'lfc', 'reds', 'salah', 'slot'], isTop20: true },
  { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', league: 'Premier League', color: '#EF0107', logoUrl: espnCrest(359), aliases: ['arsenal', 'gunners', 'emirates', 'arteta', 'saka', 'afc'], isTop20: true },
  { id: 'chelsea', name: 'Chelsea', shortName: 'CHE', league: 'Premier League', color: '#034694', logoUrl: espnCrest(363), aliases: ['chelsea', 'blues', 'stamford bridge', 'palmer', 'cfc', 'maresca'], isTop20: true },
  { id: 'man-city', name: 'Manchester City', shortName: 'MCI', league: 'Premier League', color: '#6CABDD', logoUrl: espnCrest(382), aliases: ['manchester city', 'man city', 'etihad', 'guardiola', 'pep', 'haaland', 'mcfc'], isTop20: true },
  { id: 'bayern', name: 'Bayern Munich', shortName: 'BAY', league: 'Bundesliga', color: '#DC052D', logoUrl: espnCrest(132), aliases: ['bayern', 'bayern munich', 'fc bayern', 'allianz arena', 'kane', 'musiala'], isTop20: true },
  { id: 'psg', name: 'Paris Saint-Germain', shortName: 'PSG', league: 'Ligue 1', color: '#004170', logoUrl: espnCrest(160), aliases: ['psg', 'paris saint-germain', 'paris', 'parc des princes', 'enrique'], isTop20: true },
  { id: 'juventus', name: 'Juventus', shortName: 'JUV', league: 'Serie A', color: '#111111', logoUrl: espnCrest(111), aliases: ['juventus', 'juve', 'turin', 'old lady'], isTop20: true },
  { id: 'ac-milan', name: 'AC Milan', shortName: 'MIL', league: 'Serie A', color: '#FB090B', logoUrl: espnCrest(103), aliases: ['ac milan', 'milan', 'rossoneri', 'san siro'], isTop20: true },
  { id: 'inter', name: 'Inter Milan', shortName: 'INT', league: 'Serie A', color: '#010E80', logoUrl: espnCrest(110), aliases: ['inter milan', 'inter', 'nerazzurri'], isTop20: true },
  { id: 'atletico', name: 'Atlético Madrid', shortName: 'ATM', league: 'La Liga', color: '#CB3524', logoUrl: espnCrest(1068), aliases: ['atletico', 'atletico madrid', 'atlético', 'atleti', 'simeone'], isTop20: true },
  { id: 'dortmund', name: 'Borussia Dortmund', shortName: 'BVB', league: 'Bundesliga', color: '#FDE100', logoUrl: espnCrest(124), aliases: ['dortmund', 'borussia dortmund', 'bvb', 'yellow wall'], isTop20: true },
  { id: 'tottenham', name: 'Tottenham Hotspur', shortName: 'TOT', league: 'Premier League', color: '#132257', logoUrl: espnCrest(367), aliases: ['tottenham', 'spurs', 'tottenham hotspur', 'ange'], isTop20: true },
  { id: 'napoli', name: 'Napoli', shortName: 'NAP', league: 'Serie A', color: '#12A0D7', logoUrl: espnCrest(114), aliases: ['napoli', 'ssc napoli', 'conte'], isTop20: true },
  { id: 'newcastle', name: 'Newcastle United', shortName: 'NEW', league: 'Premier League', color: '#241F20', logoUrl: espnCrest(361), aliases: ['newcastle', 'newcastle united', 'magpies', 'st james', 'isak'], isTop20: true },
  { id: 'inter-miami', name: 'Inter Miami CF', shortName: 'MIA', league: 'MLS', color: '#F7B5CD', logoUrl: espnCrest(20232), aliases: ['inter miami', 'miami', 'messi'], isTop20: true },
  { id: 'al-nassr', name: 'Al-Nassr', shortName: 'NSR', league: 'Saudi Pro League', color: '#FFCD00', logoUrl: espnCrest(817), aliases: ['al-nassr', 'al nassr', 'ronaldo', 'cr7'], isTop20: true },
  { id: 'flamengo', name: 'Flamengo', shortName: 'FLA', league: 'Brasileirão', color: '#C52613', logoUrl: espnCrest(819), aliases: ['flamengo', 'mengao', 'maracana'], isTop20: true },

  // Additional Global Clubs (searchable in ClubFilterBar & ClubPickerModal)
  { id: 'aston-villa', name: 'Aston Villa', shortName: 'AVL', league: 'Premier League', color: '#670E36', logoUrl: espnCrest(362), aliases: ['aston villa', 'villa', 'emery'] },
  { id: 'leverkusen', name: 'Bayer Leverkusen', shortName: 'B04', league: 'Bundesliga', color: '#E32221', logoUrl: espnCrest(131), aliases: ['leverkusen', 'bayer leverkusen', 'alonso'] },
  { id: 'marseille', name: 'Olympique de Marseille', shortName: 'OM', league: 'Ligue 1', color: '#2FAEE0', logoUrl: espnCrest(176), aliases: ['marseille', 'olympique marseille'] },
  { id: 'lafc', name: 'LAFC', shortName: 'LAFC', league: 'MLS', color: '#C39E6D', logoUrl: espnCrest(18966), aliases: ['lafc', 'los angeles fc'] },
  { id: 'al-hilal', name: 'Al-Hilal', shortName: 'HIL', league: 'Saudi Pro League', color: '#0055A5', logoUrl: espnCrest(816), aliases: ['al-hilal', 'al hilal'] },
  { id: 'palmeiras', name: 'Palmeiras', shortName: 'PAL', league: 'Brasileirão', color: '#006437', logoUrl: espnCrest(2029), aliases: ['palmeiras'] },
  { id: 'boca-juniors', name: 'Boca Juniors', shortName: 'BOC', league: 'Primera División', color: '#003B94', logoUrl: espnCrest(5), aliases: ['boca', 'boca juniors', 'bombonera'] },
  { id: 'river-plate', name: 'River Plate', shortName: 'RIV', league: 'Primera División', color: '#D50032', logoUrl: espnCrest(16), aliases: ['river plate', 'river'] },
  { id: 'al-ahly', name: 'Al Ahly SC', shortName: 'AHL', league: 'Egyptian Premier League', color: '#C8102E', logoUrl: espnCrest(3240), aliases: ['al ahly', 'ahly'] },
  { id: 'mamelodi-sundowns', name: 'Mamelodi Sundowns', shortName: 'SUN', league: 'PSL', color: '#FFD100', logoUrl: espnCrest(7741), aliases: ['sundowns', 'mamelodi sundowns'] },
  { id: 'enyimba', name: 'Enyimba FC', shortName: 'ENY', league: 'NPFL', color: '#0057B8', aliases: ['enyimba', 'peoples elephant'] },
  { id: 'kaizer-chiefs', name: 'Kaizer Chiefs', shortName: 'KZC', league: 'PSL', color: '#FDB913', logoUrl: espnCrest(2547), aliases: ['kaizer chiefs', 'amakhosi'] },
  { id: 'ajax', name: 'AFC Ajax', shortName: 'AJX', league: 'Eredivisie', color: '#D2122E', logoUrl: espnCrest(139), aliases: ['ajax', 'afc ajax', 'amsterdam'] },
  { id: 'benfica', name: 'SL Benfica', shortName: 'BEN', league: 'Primeira Liga', color: '#E30613', logoUrl: espnCrest(1929), aliases: ['benfica', 'sl benfica'] },
  { id: 'galatasaray', name: 'Galatasaray', shortName: 'GAL', league: 'Süper Lig', color: '#A90432', logoUrl: espnCrest(432), aliases: ['galatasaray', 'gala', 'osimhen'] },
  { id: 'neutral', name: 'Neutral / Football Fan', shortName: 'FAN', league: 'Global', color: '#10B981', aliases: ['neutral', 'football'] },
];

export const TOP_20_CLUBS: FavoriteClub[] = GLOBAL_CLUBS.filter(c => c.isTop20);

export function getClubById(clubId?: string | null): FavoriteClub | undefined {
  if (!clubId) return undefined;
  return GLOBAL_CLUBS.find(c => c.id === clubId);
}

/**
 * Matches whether an issue belongs to or mentions the selected club.
 */
export function matchesClubFilter(issue: Issue, club: FavoriteClub): boolean {
  if (!club || club.id === 'neutral') return true;

  const haystack = `${issue.title || ''} ${issue.description || ''} ${(issue.options || []).map(o => o.label).join(' ')}`.toLowerCase();
  const normalizedTags = (issue.tags || []).map(t => t.toLowerCase().replace(/^#/, ''));
  const shortLower = club.shortName.toLowerCase();

  // Exact match on tag for short codes or club id/name
  if (
    normalizedTags.includes(shortLower) ||
    normalizedTags.includes(club.id.toLowerCase()) ||
    normalizedTags.includes(club.name.toLowerCase().replace(/\s+/g, ''))
  ) {
    return true;
  }

  const terms = [club.name, ...(club.aliases || [])]
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 3);

  return terms.some(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    return regex.test(haystack) || normalizedTags.some(tag => tag.includes(term.replace(/\s+/g, '')));
  });
}

export const NATIONAL_TEAMS: string[] = [
  'Argentina',
  'Brazil',
  'England',
  'France',
  'Germany',
  'Spain',
  'Portugal',
  'Italy',
  'Netherlands',
  'Nigeria (Super Eagles)',
  'Ghana (Black Stars)',
  'Morocco',
  'Senegal',
  'Egypt',
  'South Africa',
  'United States',
  'Mexico',
  'Colombia',
  'Uruguay',
  'Japan',
  'South Korea',
  'Saudi Arabia',
  'Croatia',
  'Belgium',
  'Australia',
];
