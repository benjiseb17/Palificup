"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import AdminGate from "@/components/AdminGate";
import SiteHeader from "@/components/SiteHeader";
import { poulePreview } from "@/lib/bracket";

type ProjSeat = { player_id: string; name: string };
type ProjTable = {
  round_id: string;
  bracket: string;
  stage: string;
  table_number: number;
  complete: boolean;
  seats: ProjSeat[];
};
type StatusResponse = {
  playerCount: number;
  tournamentStarted: boolean;
  tableTargets: { poules: number };
};

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) {
      const e = new Error("unauthorized") as Error & { status?: number };
      e.status = r.status;
      throw e;
    }
    return r.json();
  });

// Deceleration curve for the shuffle: fast at first, slowing down like a
// wheel coming to a stop, before the final tick reveals the real draw.
const SHUFFLE_DELAYS = [70, 80, 90, 100, 120, 140, 170, 200, 240, 290, 350, 420];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function AdminProjectionPage() {
  const { data, error, mutate } = useSWR<{ tables: ProjTable[] }>(
    "/api/admin/projection",
    fetcher,
    { refreshInterval: 6000 }
  );
  const { data: status, mutate: mutateStatus } = useSWR<StatusResponse>(
    "/api/admin/status",
    fetcher,
    { refreshInterval: 6000 }
  );
  const unauthorized = (error as { status?: number } | undefined)?.status === 401;
  const [autoReveal, setAutoReveal] = useState(false);

  return (
    <>
      <AdminGate authorized={!unauthorized} onSuccess={() => mutate()} />
      {!unauthorized && (
        <>
          <SiteHeader
            subtitle="Projection des tables"
            right={
              <Link
                href="/admin"
                className="text-sm font-semibold text-orange-label underline underline-offset-2"
              >
                ← Dashboard
              </Link>
            }
          />
          <main className="flex flex-1 flex-col px-4 py-6 w-full">
            {!data || !status ? (
              <p className="text-caramel">Chargement…</p>
            ) : !status.tournamentStarted ? (
              <StartTournament
                status={status}
                onStarted={() => {
                  setAutoReveal(true);
                  mutate();
                  mutateStatus();
                }}
              />
            ) : (
              <Content
                tables={data.tables}
                autoReveal={autoReveal}
                onAutoRevealed={() => setAutoReveal(false)}
              />
            )}
          </main>
        </>
      )}
    </>
  );
}

/** Shown before the tournament exists yet — same action as the admin
 * dashboard's "Lancer le tournoi", so the whole reveal can happen from the
 * projector screen without switching pages. */
function StartTournament({
  status,
  onStarted,
}: {
  status: StatusResponse;
  onStarted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erreur.");
        return;
      }
      onStarted();
    } catch {
      setErrorMsg("Impossible de contacter le serveur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-lg font-semibold text-ink">
        {status.playerCount} joueurs inscrits
        {status.playerCount >= 4 && (
          <span className="mt-1 block text-sm font-normal text-caramel">
            {poulePreview(status.playerCount, status.tableTargets.poules)}
          </span>
        )}
      </p>
      <button
        onClick={start}
        disabled={busy || status.playerCount < 4}
        className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-6 py-4 text-lg font-bold text-white"
      >
        {busy ? "…" : "🎲 Lancer le tournoi"}
      </button>
      {status.playerCount < 4 && (
        <p className="text-bad text-sm font-medium">
          Il faut au moins 4 joueurs pour lancer le tournoi.
        </p>
      )}
      {errorMsg && <p className="text-bad text-sm font-medium">{errorMsg}</p>}
    </div>
  );
}

/**
 * The real table assignments never change during the animation — they're
 * already decided server-side. This just dramatizes the reveal: shuffle
 * random names into every slot a few times, slowing down, then land on the
 * true draw on the last tick.
 */
function Content({
  tables,
  autoReveal,
  onAutoRevealed,
}: {
  tables: ProjTable[];
  autoReveal: boolean;
  onAutoRevealed: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "shuffling">("idle");
  const [frozenTables, setFrozenTables] = useState<ProjTable[] | null>(null);
  const [shuffledNames, setShuffledNames] = useState<string[] | null>(null);
  const [tick, setTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function launchDraw() {
    if (phase !== "idle" || tables.length === 0) return;
    const snapshot = tables;
    const allNames = snapshot.flatMap((t) => t.seats.map((s) => s.name));
    setFrozenTables(snapshot);
    setPhase("shuffling");

    let i = 0;
    const step = () => {
      const isLast = i === SHUFFLE_DELAYS.length - 1;
      setShuffledNames(isLast ? null : shuffled(allNames));
      setTick((t) => t + 1);
      if (!isLast) {
        i++;
        timeoutRef.current = setTimeout(step, SHUFFLE_DELAYS[i]);
      } else {
        timeoutRef.current = setTimeout(() => {
          setPhase("idle");
          setFrozenTables(null);
        }, 700);
      }
    };
    timeoutRef.current = setTimeout(step, SHUFFLE_DELAYS[0]);
  }

  // Right after "Lancer le tournoi" generates the Poules, reveal them the
  // same dramatic way instead of just popping the grid in silently. Deferred
  // a tick so the state updates happen outside the effect body itself.
  useEffect(() => {
    if (!(autoReveal && phase === "idle" && tables.length > 0)) return;
    const t = setTimeout(() => {
      launchDraw();
      onAutoRevealed();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReveal, tables, phase]);

  const displayTables = frozenTables ?? tables;
  if (displayTables.length === 0) {
    return <p className="text-caramel">Aucune table en cours.</p>;
  }

  const stages = [...new Set(displayTables.map((t) => t.stage))].join(" · ");
  const doneCount = displayTables.filter((t) => t.complete).length;

  const cards = displayTables.reduce<{ table: ProjTable; names: string[] }[]>(
    (acc, t) => {
      const seatCount = t.seats.length;
      const cursor = acc.reduce((sum, c) => sum + c.names.length, 0);
      const names = shuffledNames
        ? shuffledNames.slice(cursor, cursor + seatCount)
        : t.seats.map((s) => s.name);
      return [...acc, { table: t, names }];
    },
    []
  );

  return (
    <>
      <p className="text-caramel text-sm mb-4">
        {phase === "shuffling" ? (
          <span className="font-bold text-accent">🎲 Tirage au sort en cours…</span>
        ) : (
          <>
            {stages} — {doneCount}/{displayTables.length} table
            {displayTables.length > 1 ? "s" : ""} rendue{doneCount > 1 ? "s" : ""}
          </>
        )}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(({ table: t, names }) => (
          <div
            key={t.round_id}
            className={`rounded-xl border p-3 transition-colors ${
              phase === "shuffling"
                ? "border-accent bg-cream-alt"
                : t.complete
                  ? "border-good bg-good/10"
                  : "border-separator bg-cream-alt"
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-label mb-0.5">
              {t.stage}
            </p>
            <p className="font-extrabold text-ink mb-2">Table {t.table_number}</p>
            <ul className="flex flex-col gap-0.5">
              {names.map((name, idx) => (
                <li
                  key={idx}
                  className="text-sm leading-snug text-ink"
                >
                  <span
                    key={tick}
                    className="inline-block animate-[slot-flip_0.22s_ease-out]"
                  >
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
