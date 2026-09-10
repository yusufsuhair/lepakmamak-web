// Browser origins plus the two Capacitor app origins: iOS serves the bundle from
// capacitor://localhost and Android from https://localhost.
export const origins = new Set([
  'https://lepakmamak.my', 'https://lepakmamak.pages.dev', 'https://lepak-city.pages.dev',
  'https://dev.lepakmamak.my', 'https://lepakmamak-dev.pages.dev',
  'http://localhost:5173', 'http://localhost:4173', 'http://localhost:5191',
  'capacitor://localhost', 'https://localhost',
]);
