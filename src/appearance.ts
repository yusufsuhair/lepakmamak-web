import options from '../shared/appearance.json';
export { options as appearanceOptions };
export type Appearance = { gender: string; hairstyle: string; hair: string; skin: string; shirt: string; trousers: string };
export const defaultAppearance: Appearance = { gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#b98157', shirt: '#ef734c', trousers: '#c7be9c' };
export function appearance(value: unknown): Appearance {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaultAppearance).map(([key, fallback]) => [key, (Object.values(options[key as keyof typeof options]) as unknown[]).includes(input[key]) ? input[key] : fallback])) as Appearance;
}
