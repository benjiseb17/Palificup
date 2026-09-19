"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur inconnue.");
        return;
      }
      router.push("/ma-table");
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-cream-header to-cream-card px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Palificup"
            width={88}
            height={88}
            className="rounded-2xl shadow-[0_8px_32px_rgba(232,85,0,.15)] mb-5"
          />
          <h1 className="text-3xl font-black tracking-[3px] text-accent">
            LA PALIFICUP
          </h1>
          <p className="text-caramel text-center mt-2">
            Entre ton nom et le code du tournoi pour voir ta table.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-orange-label mb-1" htmlFor="name">
              Nom &amp; prénom
            </label>
            <input
              id="name"
              className="w-full rounded-lg bg-white border border-separator px-4 py-3 text-base text-ink outline-none focus:border-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Thomas Perigaud"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-orange-label mb-1" htmlFor="code">
              Code du tournoi
            </label>
            <input
              id="code"
              className="w-full rounded-lg bg-white border border-separator px-4 py-3 text-base text-ink outline-none focus:border-accent tracking-widest uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: PALIF5"
              required
            />
          </div>
          {error && <p className="text-bad text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 transition-colors py-3 font-bold text-white tracking-wide"
          >
            {loading ? "Connexion…" : "C'est parti"}
          </button>
        </form>
        <p className="text-center mt-8">
          <Link href="/classement" className="text-sm text-orange-label underline underline-offset-2">
            Voir le classement en direct
          </Link>
        </p>
      </div>
    </main>
  );
}
