import { adminClient } from "@/lib/supabase";
import { listWallPosts } from "@/lib/wall";

export const dynamic = "force-dynamic";

export default async function WallPage() {
  const posts = await listWallPosts(adminClient());
  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 820 }}>
      <h1>Wall moderation</h1>
      {posts.length === 0 && <p>No posts.</p>}
      {posts.map((post) => (
        <article key={post.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <strong>{post.author}</strong>
          <time style={{ marginLeft: 8, color: "#666" }}>{new Date(post.createdAt).toLocaleString("en-MY")}</time>
          {post.text && <p style={{ whiteSpace: "pre-wrap" }}>{post.text}</p>}
          {post.mediaType === "image" && post.mediaUrl && (
            <img src={post.mediaUrl} alt="" style={{ maxWidth: "100%", borderRadius: 6 }} />
          )}
          {post.mediaType === "audio" && post.mediaUrl && (
            <div>
              <span>Voice note</span>
              <audio controls preload="metadata" src={post.mediaUrl} />
            </div>
          )}
        </article>
      ))}
    </main>
  );
}
