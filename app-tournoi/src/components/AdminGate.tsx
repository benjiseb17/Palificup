"use client";

import { useState } from "react";
import SiteHeader from "./SiteHeader";

export default function AdminGate({
  authorized,
  onSuccess,
}: {
  authorized: boolean;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authorized) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader subtitle="Admin" />
      <main className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
          <h1 className="text-xl font-extrabold mb-2 text-ink">Admin Palificup</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe admin"
            className="rounded-lg bg-white border border-separator px-4 py-3 outline-none focus:border-accent"
            required
          />
          {error && <p className="text-bad text-sm font-medium">{error}</p>}
          <button
            disabled={loading}
            className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 py-3 font-bold text-white"
          >
            {loading ? "…" : "Entrer"}
          </button>
        </form>
      </main>
    </>
  );
}
