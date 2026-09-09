// What one running instance is doing right now. Every counter here dies with the process,
// which is correct: these numbers describe this instance, not the city's history.
//
// Byte counts are WebSocket payload bytes as handed to ws.send and as received from it. They
// leave out frame headers and TLS, so they read a few percent under what Railway bills.

const SAMPLE_MS = 1000;
const FLUSH_MS = 1500;

async function deliver(url, body) {
  await fetch(url, {
    signal: AbortSignal.timeout(5000),
    // Discord reads `content`, Slack reads `text`, ntfy.sh shows whatever arrives.
    ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

export function createMetrics({ env = process.env, send = deliver, log = console.error, exit = code => process.exit(code) } = {}) {
  // The sample being collected right now.
  let inBytes = 0, outBytes = 0, voiceIn = 0, voiceOut = 0, drops = 0, sampledAt = Date.now();
  const roomOut = new Map();
  // The last completed second. /health reports this, never the half-finished sample.
  let rates = { bytesInPerSecond: 0, bytesOutPerSecond: 0, voicePacketsInPerSecond: 0, voicePacketsOutPerSecond: 0, droppedFramesPerSecond: 0 };
  let roomRates = new Map();
  let saturatedSamples = 0, clearSamples = 0, saturated = false, leaving = false;

  // Calibration knobs. The byte ceiling stays off until somebody measures what this Railway
  // instance actually tops out at; until then saturation means observed drops, not a guess.
  const bytesCeiling = Number(env.ALERT_BYTES_PER_SECOND || 0);
  const samplesToFire = Math.max(1, Number(env.ALERT_SAMPLES || 5));
  const webhook = env.ALERT_WEBHOOK_URL;
  const heartbeat = env.HEARTBEAT_URL;

  function alert(text) {
    if (!webhook) return Promise.resolve();
    return send(webhook, { content: text, text }).catch(error => log('alert failed:', error.message));
  }

  function sample() {
    const at = Date.now();
    // Real elapsed time, not the nominal second: this timer slips exactly when the box is busy,
    // which is the one moment the rate has to be right.
    const seconds = Math.max(0.001, (at - sampledAt) / 1000);
    sampledAt = at;
    const per = value => Math.round(value / seconds);
    rates = {
      bytesInPerSecond: per(inBytes), bytesOutPerSecond: per(outBytes),
      voicePacketsInPerSecond: per(voiceIn), voicePacketsOutPerSecond: per(voiceOut),
      droppedFramesPerSecond: per(drops),
    };
    roomRates = new Map([...roomOut].map(([name, bytes]) => [name, per(bytes)]));
    inBytes = outBytes = voiceIn = voiceOut = drops = 0;
    roomOut.clear();

    // Not a guess about load: a dropped frame is one this server already gave up on sending
    // because that socket was too far behind to take it.
    const over = rates.droppedFramesPerSecond > 0 || (bytesCeiling > 0 && rates.bytesOutPerSecond >= bytesCeiling);
    if (over) { saturatedSamples++; clearSamples = 0; } else { clearSamples++; saturatedSamples = 0; }
    // Edge-triggered, so a one-second blip stays a graph and only a sustained one is a phone call.
    if (!saturated && saturatedSamples >= samplesToFire) {
      saturated = true;
      alert(`LepakMamak realtime is saturated: ${rates.droppedFramesPerSecond} frames/s dropped, ${rates.bytesOutPerSecond} bytes/s out across ${roomRates.size} room(s).`);
    } else if (saturated && clearSamples >= samplesToFire) {
      saturated = false;
      alert(`LepakMamak realtime recovered: ${rates.bytesOutPerSecond} bytes/s out, no frames dropped.`);
    }
  }
  setInterval(sample, SAMPLE_MS).unref();

  // A process that has already died cannot page anybody, so the dead-man's switch lives outside:
  // point HEARTBEAT_URL at a service that shouts when the pings stop.
  if (heartbeat) setInterval(() => { send(heartbeat).catch(error => log('heartbeat failed:', error.message)); }, Math.max(1, Number(env.HEARTBEAT_SECONDS || 60)) * 1000).unref();

  // Railway sends SIGTERM before it replaces or stops the instance, and a crash arrives as an
  // uncaught error. Either way every room is about to be wiped, so say so on the way out.
  function farewell(reason, code) {
    if (leaving) return;
    leaving = true;
    // Leave the moment the alert is away, which with no webhook configured is immediately.
    // A shutdown that dawdles is a port still held and a deploy still waiting behind it.
    const done = () => exit(code);
    const backstop = setTimeout(done, FLUSH_MS);
    alert(`LepakMamak realtime is going down (${reason}). Rooms are in memory, so they are gone.`)
      .then(done, done).finally(() => clearTimeout(backstop));
  }
  process.on('SIGTERM', () => farewell('SIGTERM', 0));
  process.on('SIGINT', () => farewell('SIGINT', 0));
  // Handling these overrides Node's crash-on-error default, so the exit has to be put back.
  process.on('uncaughtException', error => { log(error); farewell(`crash: ${error.message}`, 1); });
  process.on('unhandledRejection', error => { log(error); farewell(`unhandled rejection: ${error?.message || error}`, 1); });

  return {
    countIn(bytes) { inBytes += bytes; },
    countOut(bytes, room) { outBytes += bytes; if (room) roomOut.set(room, (roomOut.get(room) || 0) + bytes); },
    countVoiceIn() { voiceIn++; },
    countVoiceOut(listeners) { voiceOut += listeners; },
    countDrop() { drops++; },
    report({ rooms, sockets, version }) {
      return {
        // Always served with HTTP 200. The whole test suite treats a non-200 here as "not up
        // yet", and Railway restarts an instance that fails a health check it has been given,
        // which would wipe the very rooms the 503 was complaining about. (healthcheckPath is
        // unset today, but it is one dashboard toggle away.) Saturation goes in the body.
        ok: !saturated,
        saturated,
        version,
        service: 'lepak-city-realtime',
        uptimeSeconds: Math.round(process.uptime()),
        residentMegabytes: Math.round(process.memoryUsage.rss() / 1048576),
        // Sockets outnumbering players means connections that opened but never joined.
        sockets,
        players: [...rooms.values()].reduce((total, players) => total + players.size, 0),
        rooms: [...rooms].map(([name, players]) => ({ name, sockets: players.size, bytesOutPerSecond: roomRates.get(name) || 0 })).sort((a, b) => b.sockets - a.sockets),
        ...rates,
      };
    },
  };
}
