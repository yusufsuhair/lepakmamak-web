import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const allowedEmail = process.env.ADMIN_EMAIL;

  if (!supabaseUrl || !supabasePublishableKey || !allowedEmail) {
    throw new Error("Supabase Auth is not configured.");
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 520, margin: "0 auto" }}>
      <h1>LepakMamak admin</h1>
      <p style={{ color: "#666", margin: "12px 0 24px" }}>
        Sign in with the authorised Yusuf account to continue.
      </p>
      <LoginForm
        supabaseUrl={supabaseUrl}
        supabasePublishableKey={supabasePublishableKey}
        allowedEmail={allowedEmail}
        nextPath={safeNext(params.next)}
        callbackError={params.error === "not_authorized"
          ? "This Supabase account is not authorised for the admin console."
          : params.error === "auth_callback_failed"
            ? "Google sign-in could not be completed. Try again."
            : ""}
      />
    </main>
  );
}
