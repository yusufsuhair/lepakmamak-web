import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({ email, title, description, children }: {
  email: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><Link href="/" className="brand">LepakMamak</Link><span className="admin-label">Admin</span></div>
        <nav aria-label="Admin navigation">
          <Link href="/">Overview</Link><Link href="/reports">Reports</Link><Link href="/wall">Wall</Link>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </nav>
      </header>
      <section className="page-heading"><p className="eyebrow">Signed in as {email}</p><h1>{title}</h1>{description && <p>{description}</p>}</section>
      {children}
    </main>
  );
}
