// Public listener streams, discovered through Radio Browser and checked against
// broadcaster players. No stream relay, recording, or third-party scripts.
export const RADIO_STATIONS = [
  {id:'fly', name:'Fly FM', language:'English', url:'https://stream.rcs.revma.com/q17aka9mtd3vv', website:'https://listen.flyfm.audio/'},
  {id:'hot', name:'Hot FM', language:'Malay', url:'https://stream.rcs.revma.com/drakdf8mtd3vv', website:'https://www.hotfm.audio/'},
  {id:'eight', name:'Eight FM', language:'Chinese', url:'https://stream.rcs.revma.com/qp0xrd9mtd3vv', website:'https://listen.eight.audio/'},
] as const;
export type RadioStatus = 'paused' | 'connecting' | 'live' | 'error';

export function createRadio(changed: () => void) {
  const audio = new Audio();
  audio.id = 'live-radio'; audio.preload = 'none'; audio.crossOrigin = 'anonymous';
  document.body.append(audio);
  let station: typeof RADIO_STATIONS[number] = RADIO_STATIONS[0];
  try { station = RADIO_STATIONS.find(s => s.id === localStorage.getItem('lepakmamak-radio-station')) ?? station; } catch { /* Storage is optional. */ }
  let status: RadioStatus = 'paused', attempt = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const publish = (value: RadioStatus) => { status = value; changed(); };
  const release = () => { ++attempt; clearTimeout(timeout); audio.pause(); audio.removeAttribute('src'); audio.load(); };
  const fail = () => { release(); publish('error'); };
  function wait() { clearTimeout(timeout); timeout = setTimeout(fail, 15000); publish('connecting'); }
  const pause = () => { release(); publish('paused'); };
  function play() {
    if (status === 'connecting' || status === 'live') return;
    const current = ++attempt;
    audio.src = station.url;
    wait();
    void audio.play().catch(error => {
      if (current !== attempt) return;
      // A blocked autoplay must wait for an explicit tap, rather than retry forever.
      if (error?.name === 'AbortError') return;
      fail();
    });
  }
  audio.addEventListener('playing', () => { if (audio.hasAttribute('src')) { clearTimeout(timeout); publish('live'); } });
  audio.addEventListener('waiting', () => { if (audio.hasAttribute('src')) wait(); });
  audio.addEventListener('stalled', () => { if (audio.hasAttribute('src')) wait(); });
  audio.addEventListener('error', () => { if (audio.hasAttribute('src')) fail(); });
  audio.addEventListener('ended', () => { if (audio.hasAttribute('src')) fail(); });
  return {
    audio, play, pause,
    get station() { return station; },
    get status() { return status; },
    select(id: string) {
      const next = RADIO_STATIONS.find(s => s.id === id);
      if (!next || next === station) return;
      pause(); station = next;
      try { localStorage.setItem('lepakmamak-radio-station', station.id); } catch { /* Storage is optional. */ }
      changed();
    },
  };
}
