"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import SiteHeader from "@/components/SiteHeader";

type Player = { id: string; name: string; team: string };
type Seatmate = { player: Player; finishRank: string | null };
type ApiView =
  | { status: "not-started" }
  | {
      status: "playing" | "waiting-table-results";
      round: { round_id: string; stage: string; table_number: string };
      stage: string;
      seatmates: Seatmate[];
      canSubmit: boolean;
    }
  | { status: "waiting-next-round"; lastStage: string }
  | { status: "eliminated"; lastStage: string; points: number }
  | { status: "tournament-done"; finalRank: string | null; points: number };

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "erreur");
    return r.json();
  });

export default function MaTablePage() {
  const router = useRouter();
  const { data, error, mutate } = useSWR<{ player: Player; view: ApiView }>(
    "/api/me",
    fetcher,
    { refreshInterval: 8000 }
  );

  useEffect(() => {
    if (error) router.push("/");
  }, [error, router]);

  return (
    <>
      <SiteHeader
        subtitle="Ma table"
        right={
          <Link
            href="/classement"
            className="text-sm font-semibold text-orange-label underline underline-offset-2"
          >
            🏆 Classement
          </Link>
        }
      />
      {!data ? (
        <Centered>
          <p className="text-caramel">Chargement…</p>
        </Centered>
      ) : (
        <Content data={data} mutate={mutate} />
      )}
    </>
  );
}

function Content({
  data,
  mutate,
}: {
  data: { player: Player; view: ApiView };
  mutate: () => void;
}) {
  const { player, view } = data;

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-md w-full mx-auto">
      <p className="text-sm text-caramel mb-1">Bonjour</p>
      <h1 className="text-2xl font-extrabold mb-6 text-ink">{player.name}</h1>

      {view.status === "not-started" && (
        <Card>
          <p>Le tournoi n&apos;a pas encore démarré. Reviens dès que l&apos;admin lance les poules.</p>
        </Card>
      )}

      {(view.status === "playing" || view.status === "waiting-table-results") && (
        <TableView view={view} onSubmitted={() => mutate()} />
      )}

      {view.status === "waiting-next-round" && (
        <Card>
          <p className="text-lg font-bold mb-1">🎉 Tu passes au tour suivant !</p>
          <p className="text-caramel">
            Tu as fini {view.lastStage}. En attente que l&apos;admin lance la table suivante — reste sur cette page.
          </p>
        </Card>
      )}

      {view.status === "eliminated" && (
        <Card>
          <p className="text-lg font-bold mb-1">Tournoi terminé pour toi</p>
          <p className="text-caramel mb-3">Éliminé en {view.lastStage}.</p>
          <p className="text-3xl font-black text-accent">{view.points} points</p>
          <Link href="/classement" className="mt-4 inline-block underline underline-offset-2 text-sm text-orange-label">
            Voir le classement général →
          </Link>
        </Card>
      )}

      {view.status === "tournament-done" && (
        <Card>
          <p className="text-lg font-bold mb-1">Grande Finale terminée !</p>
          <p className="text-caramel mb-3">
            Tu as fini {view.finalRank === "1" ? "🏆 vainqueur" : `${view.finalRank}e`} de la finale.
          </p>
          <p className="text-3xl font-black text-accent">{view.points} points</p>
          <Link href="/classement" className="mt-4 inline-block underline underline-offset-2 text-sm text-orange-label">
            Voir le classement général →
          </Link>
        </Card>
      )}
    </main>
  );
}

function TableView({
  view,
  onSubmitted,
}: {
  view: Extract<ApiView, { status: "playing" | "waiting-table-results" }>;
  onSubmitted: () => void;
}) {
  const seatCount = view.seatmates.length;
  const [ranks, setRanks] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.seatmates.map((s) => [s.player.id, ""]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = Object.values(ranks).filter((v) => v !== "");
  const isComplete = chosen.length === seatCount;
  const hasDuplicate = new Set(chosen).size !== chosen.length;

  function setRank(playerId: string, value: string) {
    setRanks((prev) => ({ ...prev, [playerId]: value }));
  }

  async function submit() {
    if (!isComplete || hasDuplicate) return;
    const order = Object.entries(ranks)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map(([playerId]) => playerId);

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/table/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_id: view.round.round_id, order }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur.");
        return;
      }
      onSubmitted();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-label mb-1">
        {view.stage}
      </p>
      <h2 className="text-lg font-extrabold mb-4 text-ink">Table {view.round.table_number}</h2>

      {view.status === "waiting-table-results" ? (
        <>
          <p className="text-caramel mb-3">
            Résultat enregistré. En attente que les autres tables de ce tour terminent.
          </p>
          <ul className="flex flex-col gap-2">
            {view.seatmates
              .slice()
              .sort((a, b) => Number(a.finishRank ?? 99) - Number(b.finishRank ?? 99))
              .map((s) => (
                <li
                  key={s.player.id}
                  className="flex items-center justify-between rounded-lg bg-cream-row border border-separator px-4 py-2"
                >
                  <span className="font-medium">{s.player.name}</span>
                  <span className="text-caramel text-sm font-semibold">
                    {s.finishRank ? `#${s.finishRank}` : "…"}
                  </span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <>
          <p className="text-caramel mb-3">
            Adversaires à ta table. Une fois la partie finie, indique la position de chacun
            (1 = vainqueur, {seatCount} = dernier éliminé), puis valide.
          </p>
          <ul className="flex flex-col gap-2 mb-4">
            {view.seatmates.map((s) => {
              const value = ranks[s.player.id];
              const duplicate = value !== "" && chosen.filter((v) => v === value).length > 1;
              return (
                <li
                  key={s.player.id}
                  className="flex items-center justify-between rounded-lg bg-cream-row border border-separator px-4 py-2"
                >
                  <span className="font-medium">{s.player.name}</span>
                  <select
                    value={value}
                    onChange={(e) => setRank(s.player.id, e.target.value)}
                    className={`rounded-lg border px-3 py-2 font-bold text-center bg-white ${
                      duplicate ? "border-bad text-bad" : "border-separator text-orange-label"
                    }`}
                  >
                    <option value="">—</option>
                    {Array.from({ length: seatCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? "1 · 🏆" : n}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          {hasDuplicate && (
            <p className="text-bad text-sm mb-3 font-medium">
              Deux joueurs ne peuvent pas avoir la même position.
            </p>
          )}
          {error && <p className="text-bad text-sm mb-3 font-medium">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting || !isComplete || hasDuplicate}
            className="w-full rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 py-3 font-bold text-white tracking-wide"
          >
            {submitting ? "Envoi…" : "Valider le résultat"}
          </button>
        </>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-cream-alt border border-separator shadow-sm p-5">
      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 items-center justify-center">{children}</main>;
}
