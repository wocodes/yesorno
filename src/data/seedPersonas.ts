import seedPersonasJson from '../../public/data/seed_personas.json';

export interface SeedPersona {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  bio: string;
  region: string;
  archetype: string;
  toneGuidelines: string;
  interests: string[];
  avatar?: string;
  city?: string;
  displayPreference?: 'name' | 'username';
  isVerified?: boolean;
  verificationBadge?: string;
}

export const SEED_PERSONAS: SeedPersona[] = seedPersonasJson as SeedPersona[];

export const SEED_PERSONA_EMAILS = new Set<string>(
  SEED_PERSONAS.map(p => (p.email || '').toLowerCase().trim()).filter(Boolean)
);

export const SEED_PERSONA_USERNAMES = new Set<string>(
  SEED_PERSONAS.map(p => (p.username || '').toLowerCase().replace(/^@/, '').trim()).filter(Boolean)
);

export const SEED_PERSONA_IDS = new Set<string>(
  SEED_PERSONAS.map(p => (p.id || '').toLowerCase().trim()).filter(Boolean)
);

/**
 * Checks whether a user record is a system-created persona
 * (those our AI engine uses to create issues, cast votes, and post replies)
 */
export function isSystemCreatedUser(user?: { 
  id?: string; 
  email?: string; 
  username?: string; 
  userType?: string;
  name?: string;
} | null): boolean {
  if (!user) return false;
  if (user.userType === 'seed') return true;
  if (user.id && (user.id.toLowerCase().startsWith('pers-') || SEED_PERSONA_IDS.has(user.id.toLowerCase()))) return true;
  if (user.email && SEED_PERSONA_EMAILS.has(user.email.toLowerCase().trim())) return true;
  if (user.username && SEED_PERSONA_USERNAMES.has(user.username.toLowerCase().replace(/^@/, '').trim())) return true;
  return false;
}

export function getPersonaById(id: string): SeedPersona | undefined {
  return SEED_PERSONAS.find(p => p.id === id);
}

export function getRandomPersonas(count: number): SeedPersona[] {
  const shuffled = [...SEED_PERSONAS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

