import { currentAdmin } from "@/lib/admin-auth";
import { AdminShell } from "./admin-shell";

export default async function Home() {
  const identity = await currentAdmin();
  return (
    <AdminShell email={identity.email} title="Moderation overview" description="Review reports and keep the community wall tidy.">
      <div className="task-grid">
        <a className="task-card" href="/reports"><span>Player reports</span><small>Review, mute, ban</small></a>
        <a className="task-card" href="/wall"><span>Wall moderation</span><small>Review and remove posts</small></a>
      </div>
    </AdminShell>
  );
}
