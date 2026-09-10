export function normaliseEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isAllowedAdminEmail(email: string | null | undefined, allowedEmail: string | null | undefined): boolean {
  const allowed = normaliseEmail(allowedEmail);
  return Boolean(allowed) && Boolean(normaliseEmail(email)) && normaliseEmail(email) === allowed;
}
