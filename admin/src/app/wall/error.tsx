"use client";

export default function WallError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="admin-shell error-page">
      <h1>Something went wrong</h1>
      <p className="error-message">{error.message}</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
