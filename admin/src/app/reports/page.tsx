import { adminClient } from "@/lib/supabase";
import { chatAround, listPenalties, listReports, type ChatLine, type PlayerReport } from "@/lib/moderation";
import { actOnReport, lift } from "./actions";

export const dynamic = "force-dynamic";

const SURFACE: Record<string, string> = {
  voice: "Voice in the room", chat: "City chat", wall: "Wall post",
  drawing: "Lukis drawing", name: "Display name", behaviour: "Behaviour",
};
const REASON: Record<string, string> = {
  harassment: "Harassment", sexual: "Sexual content", hate: "Hate speech",
  threat: "Threat", scam: "Scam", "child-safety": "Child safety", other: "Other",
};

const card = { border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 12 } as const;
const muted = { color: "#666" } as const;
const when = (value: string) => new Date(value).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });

function Evidence({ report, chat }: { report: PlayerReport; chat: ChatLine[] }) {
  if (report.surface === "chat") {
    return chat.length ? (
      <details>
        <summary>City chat around this report ({chat.length} lines)</summary>
        <ol style={{ ...muted, fontSize: 13 }}>
          {chat.map((line, index) => (
            <li key={index}>
              <b>{line.name}</b>: {line.text} <span style={muted}>· {when(line.sentAt)}</span>
            </li>
          ))}
        </ol>
      </details>
    ) : <p style={muted}>No public chat survives from that window in this room.</p>;
  }
  if (report.surface === "voice") {
    return (
      <p style={muted}>
        Voice is never recorded, so there is no clip to play.{" "}
        {report.witnesses.length
          ? <>In earshot at the time: <b>{report.witnesses.join(", ")}</b>. Ask them before acting on this alone.</>
          : <>Nobody else was in earshot, so this is one player&apos;s word.</>}
      </p>
    );
  }
  return <p style={muted}>Check the {SURFACE[report.surface] ?? report.surface} surface for this player.</p>;
}

export default async function ReportsPage() {
  const client = adminClient();
  const [reports, penalties] = await Promise.all([listReports(client), listPenalties(client)]);
  // One extra query per chat report. A single-moderator console reviewing a page of
  // reports does not need this batched.
  // ponytail: N+1 by design; group by room and window if the queue ever gets long.
  const chat = new Map<string, ChatLine[]>(
    await Promise.all(reports.filter(r => r.surface === "chat").map(async r =>
      [r.id, await chatAround(client, r.room, r.createdAt).catch(() => [])] as const,
    )),
  );

  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 820 }}>
      <h1>Player reports</h1>

      <p style={{ ...card, background: "#fff6f4", borderColor: "#e0a99c" }}>
        <b>Child safety reports do not stop here.</b> This console can mute and ban, which
        does nothing about material that is already out there and nothing about the legal
        duty to report it. Anything involving a minor goes to Yusuf directly, not into this
        queue — see the note in the repo README.
      </p>

      <h2>Open ({reports.length})</h2>
      {reports.length === 0 && <p>Nothing waiting.</p>}
      {reports.map(report => (
        <article key={report.id} style={card}>
          <p>
            <b>{report.reportedName}</b> reported by <b>{report.reporterName}</b>
            <span style={muted}> · {when(report.createdAt)} · room {report.room}</span>
          </p>
          <p>
            <b>{REASON[report.reason] ?? report.reason}</b>
            <span style={muted}> · {SURFACE[report.surface] ?? report.surface}</span>
          </p>
          {report.note && <blockquote style={{ whiteSpace: "pre-wrap", margin: "8px 0", paddingLeft: 12, borderLeft: "3px solid #ddd" }}>{report.note}</blockquote>}
          <Evidence report={report} chat={chat.get(report.id) ?? []} />

          <form action={actOnReport} style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="userId" value={report.reportedUserId ?? ""} />
            <input name="reason" placeholder="Reason the player is shown" maxLength={200} style={{ flex: "1 1 260px", padding: 6 }} />
            <button name="decision" value="mute" type="submit" disabled={!report.reportedUserId}>Mute 24h</button>
            <button name="decision" value="ban" type="submit" disabled={!report.reportedUserId} style={{ color: "#a13f31" }}>Ban</button>
            <button name="decision" value="dismiss" type="submit">Dismiss</button>
          </form>
          {!report.reportedUserId && (
            <p style={muted}>No account behind this player, so there is nothing durable to penalise.</p>
          )}
        </article>
      ))}

      <h2>Active penalties ({penalties.length})</h2>
      {penalties.length === 0 && <p>Nobody is muted or banned.</p>}
      {penalties.map(penalty => (
        <article key={penalty.userId} style={card}>
          <p>
            <b>{penalty.kind === "ban" ? "Banned" : "Muted"}</b>
            <span style={muted}>
              {" "}· {penalty.expiresAt ? `until ${when(penalty.expiresAt)}` : "no expiry"} · by {penalty.actor} · {when(penalty.createdAt)}
            </span>
          </p>
          <p style={muted}>{penalty.userId}</p>
          {penalty.reason && <p>{penalty.reason}</p>}
          <form action={lift}>
            <input type="hidden" name="userId" value={penalty.userId} />
            <button type="submit">Lift</button>
          </form>
        </article>
      ))}
    </main>
  );
}
