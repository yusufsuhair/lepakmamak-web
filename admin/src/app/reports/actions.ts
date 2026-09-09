"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/session";
import { adminClient } from "@/lib/supabase";
import { applyPenalty, liftPenalty, resolveReport } from "@/lib/moderation";

// Mute is deliberately time-boxed and ban is not: a mute is a cool-down a player serves,
// a ban is a decision someone has to revisit and lift by hand.
const MUTE_HOURS = 24;

export async function actOnReport(formData: FormData) {
  const identity = await currentAdmin();
  const client = adminClient();
  const decision = String(formData.get("decision") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) throw new Error("No report selected.");

  if (decision === "dismiss") {
    await resolveReport(client, reportId, "dismissed", identity.email);
    revalidatePath("/reports");
    return;
  }
  if (decision !== "mute" && decision !== "ban") throw new Error("Choose mute, ban or dismiss.");

  await applyPenalty(client, {
    userId: String(formData.get("userId") ?? ""),
    kind: decision,
    hours: decision === "mute" ? MUTE_HOURS : null,
    reason: String(formData.get("reason") ?? ""),
    reportId,
    actor: identity.email,
  });
  await resolveReport(client, reportId, "actioned", identity.email);
  revalidatePath("/reports");
}

export async function lift(formData: FormData) {
  const identity = await currentAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("No account selected.");
  await liftPenalty(adminClient(), userId, identity.email);
  revalidatePath("/reports");
}
