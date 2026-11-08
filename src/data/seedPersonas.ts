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
}

export const SEED_PERSONAS: SeedPersona[] = seedPersonasJson as SeedPersona[];

export function getPersonaById(id: string): SeedPersona | undefined {
  return SEED_PERSONAS.find(p => p.id === id);
}

export function getRandomPersonas(count: number): SeedPersona[] {
  const shuffled = [...SEED_PERSONAS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
