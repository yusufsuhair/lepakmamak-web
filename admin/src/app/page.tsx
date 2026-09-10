import { currentAdmin } from "@/lib/admin-auth";
import { logout } from "./auth/actions";

export default async function Home() {
  const identity = await currentAdmin();
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>LepakMamak admin</h1>
      <p style={{ color: "#666", margin: "12px 0 24px" }}>Signed in as {identity.email}</p>
      <ul>
        <li><a href="/reports">Player reports</a> — review, mute, ban</li>
        <li><a href="/wall">Wall moderation</a> — remove posts</li>
      </ul>
      <form action={logout} style={{ marginTop: 24 }}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
