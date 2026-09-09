import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "./audit";

const BUCKET = "social-wall";

export type AdminWallPost = {
  id: string;
  userId: string;
  author: string;
  text: string;
  mediaType: "image" | "audio" | null;
  mediaUrl: string | null;
  mediaPath: string | null;
  createdAt: string;
};

export async function listWallPosts(client: SupabaseClient, limit = 50): Promise<AdminWallPost[]> {
  const { data, error } = await client
    .from("social_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load Wall posts: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    author: row.author_name,
    text: row.body,
    mediaType: row.media_type ?? null,
    mediaPath: row.media_path ?? null,
    mediaUrl: row.media_path
      ? client.storage.from(BUCKET).getPublicUrl(row.media_path).data.publicUrl
      : null,
    createdAt: row.created_at,
  }));
}

export async function deleteWallPost(
  client: SupabaseClient,
  postId: string,
  actor: string,
): Promise<void> {
  const found = await client.from("social_posts").select("*").eq("id", postId).single();
  if (found.error || !found.data) throw new Error("That post no longer exists.");

  // Audited before anything is destroyed: if this write fails, nothing has been deleted yet.
  await recordAudit(client, {
    actor,
    action: "wall.delete",
    targetTable: "social_posts",
    targetId: postId,
    detail: found.data,
  });

  const removal = await client.from("social_posts").delete().eq("id", postId);
  if (removal.error) throw new Error(`Could not delete the post: ${removal.error.message}`);

  if (found.data.media_path) {
    const storageResult = await client.storage.from(BUCKET).remove([found.data.media_path]);
    if (storageResult.error) {
      throw new Error(
        `Post deleted but its file could not be removed from storage: ${found.data.media_path} (${storageResult.error.message})`,
      );
    }
  }
}
