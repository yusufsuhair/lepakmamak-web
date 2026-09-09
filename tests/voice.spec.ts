import { test, expect, chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
let server: ChildProcess;
test.beforeAll(async () => {
  server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: '8095', ALLOW_GUESTS: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: 'ignore' });
  await expect.poll(async () => { try { return (await fetch('http://127.0.0.1:8095/health')).ok; } catch { return false; } }).toBe(true);
});
test.afterAll(() => server?.kill());
const harness = `<div id="hud"></div><script type="module">
import { setupVoice } from '/src/voice.ts';
const socket = new WebSocket('ws://127.0.0.1:8095/ws');
const voice = setupVoice(m => { if (socket.readyState !== 1) return false; socket.send(JSON.stringify(m)); return true; });
// The game reveals this panel after projecting the character anchor.
document.getElementById('voice-panel').hidden = false;
socket.onopen = () => socket.send(JSON.stringify({type:'join',room:'voice-test'}));
socket.onmessage = e => { const m = JSON.parse(e.data); if(m.type==='welcome') voice.connected(true); if(m.type==='voice-audio') voice.receive(m.id,m.name,m.audio); if(m.type==='voice-audience') voice.audience(m.count,m.names); };
socket.onclose = () => voice.connected(false);
window.disconnectVoice = () => socket.close();
</script>`;
test('voice requires opt-in, streams to another player, mutes independently and releases microphone', async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const pages = [];
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ permissions: ['local-network-access', 'microphone'] });
      const page = await context.newPage();
      page.on("pageerror", e => console.log("Voice page error:", e.message));
      page.on("console", m => { if(m.type() === "error") console.log("Voice console:",m.text()); });
      await page.addInitScript(() => {
        const state = { requests: 0, plays: 0, tracks: [] as MediaStreamTrack[] };
        Object.assign(window, { voiceTest: state });
        const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async constraints => { state.requests++; const stream = await get(constraints); state.tracks.push(...stream.getTracks()); return stream; };
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function(...args) { state.plays++; return start.apply(this, args); };
      });
      await page.route('**/voice-test', route => route.fulfill({ contentType: 'text/html', body: harness }));
      await page.goto('/voice-test');
      await expect(page.locator('#voice-mic')).toBeEnabled(); pages.push(page);
    }
    const [sender, receiver] = pages;
    const stats = (page: typeof sender) => page.evaluate(() => { const s = (window as any).voiceTest; return { requests: s.requests, plays: s.plays, stopped: s.tracks.every((t: MediaStreamTrack) => t.readyState === 'ended') }; });
    expect((await stats(sender)).requests).toBe(0);
    await receiver.bringToFront();
    await receiver.locator('#voice-speaker').click();
    expect((await stats(receiver)).requests).toBe(0);
    await expect(receiver.locator('#voice-mic')).toHaveAttribute('aria-pressed', 'false');
    await sender.bringToFront();
    await sender.locator('#voice-mic').click();
    await expect(sender.locator('#voice-mic')).toHaveAttribute('aria-pressed', 'true');
    await expect(sender.locator('#voice-speaker')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await stats(receiver)).plays).toBeGreaterThan(3);
    await expect(sender.locator('#voice-audience')).toContainText('can hear you');
    await receiver.bringToFront();
    await receiver.locator('#voice-speaker').click();
    const muted = (await stats(receiver)).plays;
    await receiver.waitForTimeout(200);
    expect((await stats(receiver)).plays).toBe(muted);
    await expect(sender.locator('#voice-mic')).toHaveAttribute('aria-pressed', 'true');
    await receiver.bringToFront();
    await receiver.locator('#voice-speaker').click();
    await expect.poll(async () => (await stats(receiver)).plays).toBeGreaterThan(muted);
    await sender.bringToFront();
    await sender.locator('#voice-mic').click();
    expect((await stats(sender)).stopped).toBe(true);
    await sender.bringToFront();
    await sender.locator('#voice-mic').click();
    await expect(sender.locator('#voice-mic')).toHaveAttribute('aria-pressed', 'true');
    await sender.evaluate(() => (window as any).disconnectVoice());
    await expect(sender.locator('#voice-mic')).toBeDisabled();
    expect((await stats(sender)).stopped).toBe(true);
    // Permission denial leaves capture off and offers recovery.
    await receiver.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await receiver.locator('#voice-mic').click();
    await expect(receiver.locator('#voice-status')).toContainText('Microphone blocked');
    await expect(receiver.locator('#voice-mic')).toHaveAttribute('aria-pressed', 'false');
  } finally { await browser.close(); }
});
