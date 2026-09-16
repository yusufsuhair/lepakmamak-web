import { adminClient } from "@/lib/supabase";
import { currentAdmin } from "@/lib/admin-auth";
import { listWallPosts } from "@/lib/wall";
import { removePost } from "./actions";
import { AdminShell } from "../admin-shell";

export const dynamic = "force-dynamic";

export default async function WallPage() {
  const identity = await currentAdmin();
  const posts = await listWallPosts(adminClient());
  return (
    <AdminShell email={identity.email} title="Wall moderation" description="Review the latest community posts.">
      {posts.length === 0 && <p>No posts.</p>}
      {posts.map((post) => (
        <article key={post.id} className="card">
          <strong>{post.author}</strong>
          <time className="post-time">{new Date(post.createdAt).toLocaleString("en-MY")}</time>
          {post.text && <p className="post-text">{post.text}</p>}
          {post.mediaType === "image" && post.mediaUrl && (
            <img src={post.mediaUrl} alt="" className="post-media" />
          )}
          {post.mediaType === "audio" && post.mediaUrl && (
            <div className="voice-note">
              <span>Voice note</span>
              <audio controls preload="metadata" src={post.mediaUrl} />
            </div>
          )}
          <form action={removePost}>
            <input type="hidden" name="postId" value={post.id} />
            <button type="submit" className="danger">Delete post</button>
          </form>
        </article>
      ))}
    </AdminShell>
  );
}
