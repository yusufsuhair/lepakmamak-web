"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { isAllowedAdminEmail } from "@/lib/admin-email";

type Props = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  allowedEmail: string;
  nextPath: string;
  callbackError: string;
};

export function LoginForm({ supabaseUrl, supabasePublishableKey, allowedEmail, nextPath, callbackError }: Props) {
  const client = useMemo<SupabaseClient>(
    () => createBrowserClient(supabaseUrl, supabasePublishableKey),
    [supabaseUrl, supabasePublishableKey],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(callbackError);
  const [busy, setBusy] = useState(false);

  const enter = () => window.location.assign(nextPath || "/");

  async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    if (!isAllowedAdminEmail(data.user?.email, allowedEmail)) {
      await client.auth.signOut();
      setMessage("This Supabase account is not authorised for the admin console.");
      setBusy(false);
      return;
    }
    enter();
  }

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath || "/");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: 20 }}>
      <button type="button" onClick={signInWithGoogle} disabled={busy} style={{ width: "100%", padding: 10 }}>
        Continue with Google
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "#777" }}>
        <span style={{ height: 1, background: "#ddd", flex: 1 }} /> or <span style={{ height: 1, background: "#ddd", flex: 1 }} />
      </div>
      <form onSubmit={signInWithPassword}>
        <label style={{ display: "block", marginBottom: 12 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" disabled={busy} style={{ padding: 10 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {message && <p role="alert" style={{ color: "#a13f31", marginTop: 14 }}>{message}</p>}
      <p style={{ color: "#666", fontSize: 13, marginTop: 16 }}>
        Access is limited to the authorised admin email. Other Supabase accounts are rejected.
      </p>
    </section>
  );
}
