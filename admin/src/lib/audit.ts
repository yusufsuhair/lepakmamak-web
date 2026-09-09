import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntry = {
  actor: string;
  action: string;
  targetTable: string;
  targetId: string;
  detail?: Record<string, unknown>;
};

export async function recordAudit(client: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { error } = await client.from("admin_audit_log").insert({
    actor: entry.actor,
    action: entry.action,
    target_table: entry.targetTable,
    target_id: entry.targetId,
    detail: entry.detail ?? null,
  });
  if (error) throw new Error(`Could not write the audit entry: ${error.message}`);
}
