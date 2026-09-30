"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import AdminGate from "@/components/AdminGate";
import SiteHeader from "@/components/SiteHeader";

type Seat = { player_id: string; name: string; finish_rank: string };
type TableInfo = {
  round_id: string;
  bracket: string;
  stage: string;
  table_number: string;
  gen: number;
  complete: boolean;
  hasDownstream: boolean;
  seats: Seat[];
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

export default function AdminTablesPage() {
  const { data, error, mutate } = useSWR<{ tables: TableInfo[] }>(
    "/api/admin/tables",
    fetcher,
    { refreshInterval: 8000 }
  );
  const unauthorized = (error as { status?: number } | undefined)?.status === 401;

  return (
    <>
      <AdminGate authorized={!unauthorized} onSuccess={() => mutate()} />
      {!unauthorized && (
        <>
          <SiteHeader
            subtitle="Toutes les tables"
            right={
              <Link href="/admin" className="text-sm font-semibold text-orange-label underline underline-offset-2">
                ← Dashboard
              </Link>
            }
          />
          <main className="flex flex-1 flex-col px-6 py-8 max-w-3xl w-full mx-auto">
            {!data ? (
              <p className="text-caramel">Chargement…</p>
            ) : (
              <Content tables={data.tables} refresh={() => mutate()} />
            )}
          </main>
        </>
      )}
    </>
  );
}

type StatusFilter = "all" | "pending" | "done";

function Content({ tables, refresh }: { tables: TableInfo[]; refresh: () => void }) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Play order, not alphabetical: tables arrive sorted by round then table
  // number, so the first time each stage name appears is already the right
  // order (Poules, Quart A, Quart B, Demi A, ...).
  const stages = useMemo(() => [...new Set(tables.map((t) => t.stage))], [tables]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tables.filter((t) => {
      if (stageFilter && t.stage !== stageFilter) return false;
      if (statusFilter === "pending" && t.complete) return false;
      if (statusFilter === "done" && !t.complete) return false;
      if (!q) return true;
      return (
        t.round_id.toLowerCase().includes(q) ||
        t.stage.toLowerCase().includes(q) ||
        t.seats.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [tables, query, stageFilter, statusFilter]);

  const doneCount = tables.filter((t) => t.complete).length;

  return (
    <>
      <div className="mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un joueur…"
          className="w-full rounded-lg bg-white border border-separator px-4 py-3 outline-none focus:border-accent"
        />
        <p className="text-caramel text-sm mt-2">
          {doneCount}/{tables.length} tables avec un résultat complet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <FilterPill active={stageFilter === null} onClick={() => setStageFilter(null)}>
          Toutes les étapes ({tables.length})
        </FilterPill>
        {stages.map((s) => (
          <FilterPill key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>
            {s} ({tables.filter((t) => t.stage === s).length})
          </FilterPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          Toutes
        </FilterPill>
        <FilterPill active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
          En attente
        </FilterPill>
        <FilterPill active={statusFilter === "done"} onClick={() => setStatusFilter("done")}>
          Complètes
        </FilterPill>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((t) => (
          <TableCard key={t.round_id} table={t} onSaved={refresh} />
        ))}
        {filtered.length === 0 && (
          <p className="text-caramel">Aucune table ne correspond à ces filtres.</p>
        )}
      </div>
    </>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? "bg-accent text-white" : "bg-cream-card text-orange-label hover:bg-separator"
      }`}
    >
      {children}
    </button>
  );
}

function TableCard({ table, onSaved }: { table: TableInfo; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [ranks, setRanks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setRanks(Object.fromEntries(table.seats.map((s) => [s.player_id, s.finish_rank])));
    setError(null);
    setEditing(true);
  }

  const chosen = Object.values(ranks).filter((v) => v !== "");
  const isComplete = chosen.length === table.seats.length;
  const hasDuplicate = new Set(chosen).size !== chosen.length;

  async function save() {
    if (!isComplete || hasDuplicate) return;
    const order = Object.entries(ranks)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map(([playerId]) => playerId);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tables/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_id: table.round_id, order }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur.");
        return;
      }
      setEditing(false);
      onSaved();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSaving(false);
    }
  }

  const sortedSeats = editing
    ? table.seats
    : [...table.seats].sort((a, b) => {
        const ra = a.finish_rank ? Number(a.finish_rank) : 99;
        const rb = b.finish_rank ? Number(b.finish_rank) : 99;
        return ra - rb;
      });

  return (
    <div className="rounded-xl bg-cream-alt border border-separator shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-label">
            {table.stage}
          </p>
          <p className="font-extrabold text-ink">
            Table {table.table_number} · {table.seats.length} joueurs
          </p>
        </div>
        <span
          className={`text-xs font-semibold rounded px-2 py-1 ${
            table.complete ? "bg-good/15 text-good" : "bg-cream-card text-orange-label"
          }`}
        >
          {table.complete ? "Complet" : "En attente"}
        </span>
      </div>

      {table.hasDownstream && (
        <p className="text-xs text-bad font-medium mb-2">
          ⚠️ Le tour suivant a déjà été généré à partir de cette table — une correction ici ne
          modifiera pas automatiquement la table suivante.
        </p>
      )}

      {!editing ? (
        <>
          <ul className="flex flex-col gap-1 mb-3">
            {sortedSeats.map((s) => (
              <li key={s.player_id} className="flex items-center justify-between text-sm py-1">
                <span>{s.name}</span>
                <span className="text-caramel font-semibold">
                  {s.finish_rank ? `#${s.finish_rank}` : "—"}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={startEdit}
            className="text-sm font-semibold text-orange-label underline underline-offset-2"
          >
            {table.complete ? "Modifier le résultat" : "Saisir le résultat"}
          </button>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2 mb-3">
            {table.seats.map((s) => {
              const value = ranks[s.player_id] ?? "";
              const duplicate = value !== "" && chosen.filter((v) => v === value).length > 1;
              return (
                <li
                  key={s.player_id}
                  className="flex items-center justify-between rounded-lg bg-cream-row border border-separator px-3 py-2"
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <select
                    value={value}
                    onChange={(e) => setRanks((prev) => ({ ...prev, [s.player_id]: e.target.value }))}
                    className={`rounded-lg border px-2 py-1 font-bold text-center bg-white text-sm ${
                      duplicate ? "border-bad text-bad" : "border-separator text-orange-label"
                    }`}
                  >
                    <option value="">—</option>
                    {Array.from({ length: table.seats.length }, (_, i) => i + 1).map((n) => (
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
            <p className="text-bad text-xs mb-2 font-medium">Deux joueurs ne peuvent pas avoir la même position.</p>
          )}
          {error && <p className="text-bad text-xs mb-2 font-medium">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !isComplete || hasDuplicate}
              className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-2 text-sm font-bold text-white"
            >
              {saving ? "Envoi…" : "Valider"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg bg-cream-card px-4 py-2 text-sm font-semibold text-orange-label"
            >
              Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
}
