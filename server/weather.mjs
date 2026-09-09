export function parseWeather(row, now = Date.now()) {
  if (!row || row.icaoId !== 'WMSA' || !Number.isFinite(row.obsTime) || Math.abs(now - row.obsTime * 1000) > 3 * 3600000) throw Error('Weather observation unavailable');
  const codes = String(row.wxString || '').toUpperCase();
  const rain = /(?:RA|DZ|TS)/.test(codes);
  const haze = /(?:HZ|FU|DU|SA)/.test(codes);
  const fog = /(?:FG|BR)/.test(codes);
  return { condition: rain ? 'rain' : haze ? 'haze' : fog ? 'fog' : ['BKN','OVC'].includes(row.cover) ? 'cloudy' : 'sunny', observedAt: row.obsTime * 1000, source: 'NOAA AWC · Subang (WMSA)', temperature: Number.isFinite(row.temp) ? row.temp : null };
}
export function createWeather(fetcher = fetch) {
  let cached = null, next = 0, pending = null;
  return async function weather() {
    if (Date.now() >= next && !pending) {
      next = Date.now() + 10 * 60000;
      pending = (async () => { try {
        const response = await fetcher('https://aviationweather.gov/api/data/metar?ids=WMSA&format=json', { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'LepakMamak/1.0 weather' } });
        if (!response.ok) throw Error('Weather fetch failed');
        cached = parseWeather((await response.json())[0]);
      } catch {} finally { pending = null; } })();
    }
    if (pending) await pending;
    const fresh = cached && Date.now() - cached.observedAt < 3 * 3600000;
    return fresh ? { ...cached, available: true } : { available: false, condition: 'sunny', source: 'Weather unavailable · time-only fallback' };
  };
}
