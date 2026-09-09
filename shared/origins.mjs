// Browser origins plus the two Capacitor app origins: iOS serves the bundle from
// capacitor://localhost and Android from https://localhost.
export const origins = new Set([
  'https://lepakmamak.my', 'https://lepakmamak.pages.dev', 'https://lepak-city.pages.dev',
  'http://localhost:5173', 'http://localhost:4173',
  'capacitor://localhost', 'https://localhost',
]);
