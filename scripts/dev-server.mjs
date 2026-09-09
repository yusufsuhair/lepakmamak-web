import {readFileSync} from 'node:fs';
// Reuse public Supabase connection settings; never load production service-role secrets.
const values=Object.fromEntries(readFileSync(new URL('../.env.production',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('VITE_SUPABASE_')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).trim()];}));
process.env.SUPABASE_URL=values.VITE_SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY=values.VITE_SUPABASE_PUBLISHABLE_KEY;
process.env.ALLOW_GUESTS='false';
process.env.PORT='8120';
await import('../server/index.mjs');
