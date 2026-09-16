import breeds from './pet-breeds.json';
import coats from './pet-coats.json';
export function petStyle(value: unknown): ((typeof breeds)[number] & (typeof coats)[number] & {breedId: string; coatId: string}) | null;
