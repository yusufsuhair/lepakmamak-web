import { adminClient } from "@/lib/supabase";
import { currentAdmin } from "@/lib/admin-auth";
import { chatAround, listPenalties, listReports, type ChatLine, type PlayerReport } from "@/lib/moderation";
import { actOnReport, lift } from "./actions";
import { AdminShell } from "../admin-shell";

export const dynamic = "force-dynamic";

const SURFACE: Record<string, string> = {
  voice: "Voice in the room", chat: "City chat", wall: "Wall post",
  drawing: "Lukis drawing", name: "Display name", behaviour: "Behaviour",
};
const REASON: Record<string, string> = {
  harassment: "Harassment", sexual: "Sexual content", hate: "Hate speech",
  threat: "Threat", scam: "Scam", "child-safety": "Child safety", other: "Other",
};

const when = (value: string) => new Date(value).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });

function Evidence({ report, chat }: { report: PlayerReport; chat: ChatLine[] }) {
  if (report.surface === "chat") {
    return chat.length ? (
      <details>
        <summary>City chat around this report ({chat.length} lines)</summary>
        <ol className="evidence-list">
          {chat.map((line, index) => (
            <li key={index}>
              <b>{line.name}</b>: {line.text} <span className="muted">· {when(line.sentAt)}</span>
            </li>
          ))}
        </ol>
      </details>
    ) : <p className="muted">No public chat survives from that window in this room.</p>;
  }
  if (report.surface === "voice") {
    return (
      <p className="muted">
        Voice is never recorded, so there is no clip to play.{" "}
        {report.witnesses.length
          ? <>In earshot at the time: <b>{report.witnesses.join(", ")}</b>. Ask them before acting on this alone.</>
          : <>Nobody else was in earshot, so this is one player&apos;s word.</>}
      </p>
    );
  }
  return <p className="muted">Check the {SURFACE[report.surface] ?? report.surface} surface for this player.</p>;
}

export default async function ReportsPage() {
  const identity = await currentAdmin();
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
    <AdminShell email={identity.email} title="Player reports" description="Review open reports and active penalties.">
      <p className="notice">
        <b>Child safety reports do not stop here.</b> This console can mute and ban, which
        does nothing about material that is already out there and nothing about the legal
        duty to report it. Anything involving a minor goes to Yusuf directly, not into this
        queue. See the note in the repo README.
      </p>

      <h2>Open ({reports.length})</h2>
      {reports.length === 0 && <p>Nothing waiting.</p>}
      {reports.map(report => (
        <article key={report.id} className="card">
          <p>
            <b>{report.reportedName}</b> reported by <b>{report.reporterName}</b>
            <span className="muted"> · {when(report.createdAt)} · room {report.room}</span>
          </p>
          <p>
            <b>{REASON[report.reason] ?? report.reason}</b>
            <span className="muted"> · {SURFACE[report.surface] ?? report.surface}</span>
          </p>
          {report.note && <blockquote>{report.note}</blockquote>}
          <Evidence report={report} chat={chat.get(report.id) ?? []} />

          <form action={actOnReport} className="action-form">
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="userId" value={report.reportedUserId ?? ""} />
            <input name="reason" placeholder="Reason the player is shown" maxLength={200} />
            <button name="decision" value="mute" type="submit" disabled={!report.reportedUserId}>Mute 24h</button>
            <button name="decision" value="ban" type="submit" disabled={!report.reportedUserId} className="danger">Ban</button>
            <button name="decision" value="dismiss" type="submit">Dismiss</button>
          </form>
          {!report.reportedUserId && (
            <p className="muted">No account behind this player, so there is nothing durable to penalise.</p>
          )}
        </article>
      ))}

      <h2>Active penalties ({penalties.length})</h2>
      {penalties.length === 0 && <p>Nobody is muted or banned.</p>}
      {penalties.map(penalty => (
        <article key={penalty.userId} className="card">
          <p>
            <b>{penalty.kind === "ban" ? "Banned" : "Muted"}</b>
            <span className="muted">
              {" "}· {penalty.expiresAt ? `until ${when(penalty.expiresAt)}` : "no expiry"} · by {penalty.actor} · {when(penalty.createdAt)}
            </span>
          </p>
          <p className="muted break-word">{penalty.userId}</p>
          {penalty.reason && <p>{penalty.reason}</p>}
          <form action={lift}>
            <input type="hidden" name="userId" value={penalty.userId} />
            <button type="submit">Lift</button>
          </form>
        </article>
      ))}
    </AdminShell>
  );
}
