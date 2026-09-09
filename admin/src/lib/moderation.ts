import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

export type ReportStatus = "open" | "actioned" | "dismissed";
export type PenaltyKind = "mute" | "ban";

export type PlayerReport = {
  id: string;
  reporterName: string;
  reportedUserId: string | null;
  reportedName: string;
  room: string;
  surface: string;
  reason: string;
  note: string;
  witnesses: string[];
  status: ReportStatus;
  createdAt: string;
};

export type ChatLine = { name: string; text: string; sentAt: string };

export type ActivePenalty = {
  userId: string;
  kind: PenaltyKind;
  expiresAt: string | null;
  reason: string;
  actor: string;
  createdAt: string;
};

export async function listReports(
  client: SupabaseClient,
  status: ReportStatus = "open",
  limit = 50,
): Promise<PlayerReport[]> {
  const { data, error } = await client
    .from("player_reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    reporterName: String(row.reporter_name),
    reportedUserId: (row.reported_user_id as string | null) ?? null,
    reportedName: String(row.reported_name),
    room: String(row.room),
    surface: String(row.surface),
    reason: String(row.reason),
    note: String(row.note ?? ""),
    witnesses: Array.isArray(row.witnesses) ? (row.witnesses as string[]) : [],
    status: row.status as ReportStatus,
    createdAt: String(row.created_at),
  }));
}

// A chat report is reviewable from the room history the game already keeps, so nothing
// extra is stored at report time. Voice reports have no equivalent by design: the audio
// was never recorded, and the report's witness list is what a human works from instead.
export async function chatAround(
  client: SupabaseClient,
  room: string,
  at: string,
  minutes = 5,
): Promise<ChatLine[]> {
  const centre = Date.parse(at);
  if (!Number.isFinite(centre)) return [];
  const span = minutes * 60_000;
  const { data, error } = await client
    .from("chat_messages")
    .select("player_name,message,created_at")
    .eq("room", room)
    .gte("created_at", new Date(centre - span).toISOString())
    .lte("created_at", new Date(centre + span).toISOString())
    .order("created_at", { ascending: true })
    .limit(60);
  if (error) throw new Error(`Could not load the surrounding chat: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    name: String(row.player_name),
    text: String(row.message),
    sentAt: String(row.created_at),
  }));
}

export async function listPenalties(client: SupabaseClient): Promise<ActivePenalty[]> {
  const { data, error } = await client
    .from("player_bans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load active penalties: ${error.message}`);
  const now = Date.now();
  return (data ?? [])
    .filter((row: Record<string, unknown>) => !row.expires_at || Date.parse(String(row.expires_at)) > now)
    .map((row: Record<string, unknown>) => ({
      userId: String(row.user_id),
      kind: row.kind as PenaltyKind,
      expiresAt: (row.expires_at as string | null) ?? null,
      reason: String(row.reason ?? ""),
      actor: String(row.actor),
      createdAt: String(row.created_at),
    }));
}

export type PenaltyRequest = {
  userId: string;
  kind: PenaltyKind;
  hours?: number | null;
  reason: string;
  reportId?: string | null;
  actor: string;
};

// One live penalty per account: escalating a mute to a ban replaces the row rather than
// stacking, so the game only ever has to answer "what is true about this account now".
// Audited before it is applied, matching the Wall: if the trail cannot be written, the
// action does not happen. MCMC expects us to be able to say who did what and when.
export async function applyPenalty(client: SupabaseClient, request: PenaltyRequest): Promise<void> {
  if (!request.userId) throw new Error("This report has no account behind it, so it cannot be penalised.");
  if (!request.reason.trim()) throw new Error("Write a reason — the player is shown it and the log keeps it.");
  const expiresAt = request.hours ? new Date(Date.now() + request.hours * 3_600_000).toISOString() : null;

  await recordAudit(client, {
    actor: request.actor,
    action: `moderation.${request.kind}`,
    targetTable: "player_bans",
    targetId: request.userId,
    detail: { kind: request.kind, expiresAt, reason: request.reason, reportId: request.reportId ?? null },
  });

  const { error } = await client.from("player_bans").upsert({
    user_id: request.userId,
    kind: request.kind,
    expires_at: expiresAt,
    reason: request.reason.trim().slice(0, 200),
    actor: request.actor,
    report_id: request.reportId ?? null,
  }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not apply the penalty: ${error.message}`);
}

export async function liftPenalty(client: SupabaseClient, userId: string, actor: string): Promise<void> {
  await recordAudit(client, {
    actor,
    action: "moderation.lift",
    targetTable: "player_bans",
    targetId: userId,
  });
  const { error } = await client.from("player_bans").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not lift the penalty: ${error.message}`);
}

export async function resolveReport(
  client: SupabaseClient,
  reportId: string,
  status: Exclude<ReportStatus, "open">,
  actor: string,
): Promise<void> {
  await recordAudit(client, {
    actor,
    action: `report.${status}`,
    targetTable: "player_reports",
    targetId: reportId,
  });
  const { error } = await client
    .from("player_reports")
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: actor })
    .eq("id", reportId);
  if (error) throw new Error(`Could not update the report: ${error.message}`);
}
