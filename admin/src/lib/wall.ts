import type { SupabaseClient } from "@supabase/supabase-js";

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
