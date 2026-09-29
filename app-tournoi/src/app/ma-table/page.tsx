"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import LogoutButton from "@/components/LogoutButton";
import SiteHeader from "@/components/SiteHeader";

type Player = { id: string; name: string; team: string };
type MeResponse = {
  player: Player;
  view: ApiView;
  teamChangeLocked: boolean;
  availableTeams: string[];
};
type Seatmate = { player: Player; finishRank: string | null };
type ApiView =
  | { status: "not-started" }
  | {
      status: "playing" | "waiting-table-results";
      round: { round_id: string; stage: string; table_number: string };
      stage: string;
      seatmates: Seatmate[];
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
  const { data, error, mutate } = useSWR<MeResponse>("/api/me", fetcher, {
    refreshInterval: 8000,
  });

  useEffect(() => {
    if (error) router.push("/");
  }, [error, router]);

  return (
    <>
      <SiteHeader
        subtitle="Ma table"
        right={
          <span className="flex items-center gap-4">
            <Link
              href="/classement"
              className="text-sm font-semibold text-orange-label underline underline-offset-2"
            >
              🏆 Classement
            </Link>
            <LogoutButton />
          </span>
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

function Content({ data, mutate }: { data: MeResponse; mutate: () => void }) {
  const { player, view, teamChangeLocked, availableTeams } = data;

  return (
    <main className="flex flex-1 flex-col px-6 py-8 max-w-md w-full mx-auto">
      <p className="text-sm text-caramel mb-1">Bonjour</p>
      <h1 className="text-2xl font-extrabold mb-4 text-ink">{player.name}</h1>

      <TeamSection
        player={player}
        locked={teamChangeLocked}
        availableTeams={availableTeams}
        onChanged={() => mutate()}
      />

      {view.status === "not-started" && (
        <Card>
          <p>Le tournoi n&apos;a pas encore démarré. Reviens dès que l&apos;admin lance les poules.</p>
        </Card>
      )}

      {(view.status === "playing" || view.status === "waiting-table-results") && (
        <TableView view={view} />
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

function TeamSection({
  player,
  locked,
  availableTeams,
  onChanged,
}: {
  player: Player;
  locked: boolean;
  availableTeams: string[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState(player.team ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = selected !== (player.team ?? "");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur.");
        return;
      }
      onChanged();
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <div className="mb-6 rounded-lg border border-separator bg-cream-alt px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-label mb-1">
          Mon équipe
        </p>
        <p className="font-semibold text-ink">{player.team || "Aucune équipe"}</p>
        <p className="text-caramel text-xs mt-1">
          Verrouillée : les Poules sont terminées.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-separator bg-cream-alt px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-orange-label mb-2">
        Mon équipe
      </p>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-separator bg-white px-3 py-2 text-sm font-medium"
        >
          <option value="">— Aucune équipe —</option>
          {availableTeams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-2 text-sm font-bold text-white"
          >
            {saving ? "…" : "Changer"}
          </button>
        )}
      </div>
      {error && <p className="text-bad text-xs mt-1 font-medium">{error}</p>}
      <p className="text-caramel text-xs mt-1">
        Pour créer une nouvelle équipe, va voir les admins du tournoi. Modifiable jusqu&apos;à
        la fin des Poules.
      </p>
    </div>
  );
}

/**
 * Read-only: only the admin enters table results now (from /admin/tables).
 * Players just watch their table and, once the result is in, their rank.
 */
function TableView({
  view,
}: {
  view: Extract<ApiView, { status: "playing" | "waiting-table-results" }>;
}) {
  const [historyName, setHistoryName] = useState<string | null>(null);

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-label mb-1">
        {view.stage}
      </p>
      <h2 className="text-lg font-extrabold mb-4 text-ink">Table {view.round.table_number}</h2>

      <p className="text-caramel mb-3">
        {view.status === "waiting-table-results"
          ? "Résultat enregistré par l'organisation. En attente que les autres tables de ce tour terminent."
          : "Adversaires à ta table. L'organisation viendra rentrer le résultat une fois la partie terminée."}
      </p>
      <ul className="flex flex-col gap-2">
        {view.seatmates
          .slice()
          .sort((a, b) => Number(a.finishRank ?? 99) - Number(b.finishRank ?? 99))
          .map((s) => (
            <SeatmateRow
              key={s.player.id}
              name={s.player.name}
              onOpenHistory={setHistoryName}
              right={
                s.finishRank ? (
                  <span className="text-caramel text-sm font-semibold">#{s.finishRank}</span>
                ) : null
              }
            />
          ))}
      </ul>

      <PlayerHistoryModal name={historyName} onClose={() => setHistoryName(null)} />
    </Card>
  );
}

/** A table row for one seatmate, whose name can be tapped to open their
 * historical record from past tournaments in a popup (read live, nothing
 * stored here). */
function SeatmateRow({
  name,
  right,
  onOpenHistory,
}: {
  name: string;
  right: React.ReactNode;
  onOpenHistory: (name: string) => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-cream-row border border-separator px-4 py-2">
      <button
        type="button"
        onClick={() => onOpenHistory(name)}
        className="font-medium text-left underline decoration-dotted decoration-caramel/50 underline-offset-2"
      >
        {name}
      </button>
      {right}
    </li>
  );
}

type PlayerHistory = {
  available: boolean;
  tournaments?: number;
  totalPoints?: number;
  entries?: { tournoi: string; resultat: string; points: number }[];
};

const AVATAR_COLORS = ["#1565C0", "#E8850A", "#2E7D32", "#D32F2F", "#8A5A00", "#6A1B9A"];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Un résultat ne compte comme victoire que s'il contient "vainqueur" sans
 * être un parcours de finaliste passé par le repêchage. */
function isVictory(resultat: string) {
  const r = resultat.toLowerCase();
  return r.includes("vainqueur") && !r.includes("finaliste");
}

function resultBadgeClass(resultat: string) {
  const r = resultat.toLowerCase();
  if (isVictory(resultat)) return "bg-gold/20 text-[#8a6d00]";
  if (r.includes("finaliste") && !r.includes("repê") && !r.includes("repe"))
    return "bg-silver/20 text-[#5a5a5a]";
  if (r.includes("demi") && !r.includes("repê") && !r.includes("repe"))
    return "bg-bronze/20 text-[#7a4a20]";
  return "bg-cream-card text-orange-label";
}

/** Popup façon palificup.fr : avatar, résumé, tableau des résultats passés —
 * lu en direct depuis le classement historique externe (rien n'est stocké
 * dans l'app de tournoi). */
function PlayerHistoryModal({ name, onClose }: { name: string | null; onClose: () => void }) {
  // Keyed by name so a stale response for a previously-opened player can
  // never flash before the current one has loaded.
  const [entry, setEntry] = useState<{ name: string; data: PlayerHistory } | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    fetch(`/api/players/history?name=${encodeURIComponent(name)}`)
      .then((res) => (res.ok ? res.json() : { available: false }))
      .catch(() => ({ available: false }))
      .then((data: PlayerHistory) => {
        if (!cancelled) setEntry({ name, data });
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const loading = !name || entry?.name !== name;
  const history = loading ? null : entry.data;

  useEffect(() => {
    if (!name) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [name, onClose]);

  if (!name) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-accent bg-cream-alt p-6 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white"
              style={{ background: colorForName(name) }}
            >
              {getInitials(name)}
            </div>
            <div>
              <p className="text-lg font-extrabold text-ink leading-tight">{name}</p>
              {history?.available && (history.tournaments ?? 0) > 0 && (
                <p className="text-sm text-caramel">
                  {history.totalPoints} pts (top 3) · {history.tournaments} tournoi
                  {(history.tournaments ?? 0) > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-caramel hover:text-ink"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-caramel text-sm text-center py-6">Chargement…</p>}

        {!loading && (!history || !history.available) && (
          <p className="text-caramel text-sm text-center py-6">Historique indisponible.</p>
        )}

        {!loading && history?.available && (history.tournaments ?? 0) === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🎲</div>
            <p className="text-caramel text-sm">Premier tournoi !</p>
          </div>
        )}

        {!loading && history?.available && (history.entries?.length ?? 0) > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-accent/30">
                <th className="text-left py-1.5 text-xs font-bold uppercase tracking-wide text-orange-label">
                  Tournoi
                </th>
                <th className="text-left py-1.5 text-xs font-bold uppercase tracking-wide text-orange-label">
                  Résultat
                </th>
                <th className="text-right py-1.5 text-xs font-bold uppercase tracking-wide text-orange-label">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {history.entries!.map((e) => (
                <tr key={e.tournoi} className="border-b border-separator">
                  <td className="py-2 font-bold text-accent">{e.tournoi}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${resultBadgeClass(e.resultat)}`}
                    >
                      {e.resultat}
                    </span>
                  </td>
                  <td className="py-2 text-right font-bold text-ink">{e.points} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
