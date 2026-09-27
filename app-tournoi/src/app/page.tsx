"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RosterPlayer = { name: string; team: string };

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const lastFetchedCode = useRef<string>("");
  const nameFieldRef = useRef<HTMLDivElement>(null);

  // Native <datalist> suggestions are unreliable on mobile browsers (iOS
  // Safari in particular often shows nothing at all), so the dropdown below
  // is built entirely by hand instead — same behaviour everywhere.
  useEffect(() => {
    function onOutsidePointer(e: MouseEvent | TouchEvent) {
      if (nameFieldRef.current && !nameFieldRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onOutsidePointer);
    document.addEventListener("touchstart", onOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", onOutsidePointer);
      document.removeEventListener("touchstart", onOutsidePointer);
    };
  }, []);

  // Once the tournament code looks complete-ish, fetch the real player list
  // so the name field can offer autocomplete + a team confirmation instead of
  // free text (typos, or worse: accidentally typing someone else's name).
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 3 || trimmed === lastFetchedCode.current) return;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/lookup?code=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setRoster([]);
          return;
        }
        const data = await res.json();
        lastFetchedCode.current = trimmed;
        setRoster(Array.isArray(data.players) ? data.players : []);
      } catch {
        setRoster([]);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [code]);

  const matched = roster.find((p) => normalize(p.name) === normalize(name));
  const showNoMatchHint = roster.length > 0 && name.trim().length > 2 && !matched;
  const suggestions =
    name.trim().length > 0
      ? roster.filter((p) => normalize(p.name).includes(normalize(name))).slice(0, 8)
      : [];

  function selectName(n: string) {
    setName(n);
    setShowDropdown(false);
  }

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
            <label className="block text-sm font-semibold text-orange-label mb-1" htmlFor="code">
              Code du tournoi
            </label>
            <input
              id="code"
              className="w-full rounded-lg bg-white border border-separator px-4 py-3 text-base text-ink outline-none focus:border-accent tracking-widest uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: PALIF5"
              autoCapitalize="characters"
              autoCorrect="off"
              required
            />
          </div>
          <div ref={nameFieldRef} className="relative">
            <label className="block text-sm font-semibold text-orange-label mb-1" htmlFor="name">
              Nom &amp; prénom
            </label>
            <input
              id="name"
              className="w-full rounded-lg bg-white border border-separator px-4 py-3 text-base text-ink outline-none focus:border-accent"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={roster.length > 0 ? "Commence à taper ton nom…" : "Ex: Thomas Perigaud"}
              autoComplete="off"
              required
            />
            {showDropdown && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-separator bg-white shadow-lg">
                {suggestions.map((p) => (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => selectName(p.name)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-cream-row active:bg-cream-row"
                    >
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.team && <span className="text-caramel"> · {p.team}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {matched && (
              <p className="text-good text-sm font-medium mt-1">
                ✓ C&apos;est bien toi{matched.team ? ` — équipe ${matched.team}` : ""} ?
              </p>
            )}
            {showNoMatchHint && (
              <p className="text-caramel text-sm mt-1">
                Aucun joueur ne correspond exactement — choisis ton nom dans la liste qui
                s&apos;affiche en tapant.
              </p>
            )}
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
