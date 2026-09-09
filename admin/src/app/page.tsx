export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>LepakMamak admin</h1>
      <ul>
        <li><a href="/reports">Player reports</a> — review, mute, ban</li>
        <li><a href="/wall">Wall moderation</a> — remove posts</li>
      </ul>
    </main>
  );
}
