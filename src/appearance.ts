import options from '../shared/appearance.json';
export { options as appearanceOptions };
export type Appearance = { gender: string; hairstyle: string; hair: string; skin: string; shirt: string; trousers: string; tudung: string };
export const defaultAppearance: Appearance = { gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#b98157', shirt: '#ef734c', trousers: '#c7be9c', tudung: 'none' };

// Head coverings are part of the avatar look rather than shop accessories. Keeping the
// colours here gives the 3D avatar, the small face portraits and the wardrobe swatches the
// same visual language without storing a second colour on the account.
export const tudungColours: Record<string, string> = {
  none: '#00000000', long: '#73518b', turban: '#c98267', short: '#4d8b80', shawl: '#c99a58',
  bawal: '#385e83', satin: '#b394c8', instant: '#c85c72', 'duck-luxe': '#e9bd6f', ruffle: '#db7896',
};
export const tudungColour = (style: string) => tudungColours[style] || '#6b7f78';
export const TUDUNG_COMING_SOON = new Set(['duck-luxe', 'ruffle']);
export function appearance(value: unknown): Appearance {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaultAppearance).map(([key, fallback]) => [key, (Object.values(options[key as keyof typeof options]) as unknown[]).includes(input[key]) ? input[key] : fallback])) as Appearance;
}
