"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import SiteHeader from "@/components/SiteHeader";
import { planTableSizes } from "@/lib/bracket";

type TableSeat = { player_id: string; name: string; finish_rank: string };
type TableSummary = {
  round_id: string;
  stage: string;
  table_number: number;
  gen: number;
  seatCount: number;
  complete: boolean;
  seats: TableSeat[];
};
type BracketSummary = { status: string; tables: TableSummary[] };
type TableTargets = {
  poules: number;
  quartA: number;
  demiA: number;
  finaleA: number;
  quartB: number;
  demiB: number;
  finaleB: number;
};

const STAGE_FIELDS: { key: keyof TableTargets; configKey: string; label: string; bracket?: "A" | "B" }[] = [
  { key: "poules", configKey: "table_size_poules", label: "Poules" },
  { key: "quartA", configKey: "table_size_quart_a", label: "Quart A", bracket: "A" },
  { key: "demiA", configKey: "table_size_demi_a", label: "Demi A", bracket: "A" },
  { key: "finaleA", configKey: "table_size_finale_a", label: "Finale A", bracket: "A" },
  { key: "quartB", configKey: "table_size_quart_b", label: "Quart B", bracket: "B" },
  { key: "demiB", configKey: "table_size_demi_b", label: "Demi B", bracket: "B" },
  { key: "finaleB", configKey: "table_size_finale_b", label: "Finale B", bracket: "B" },
];
type StatusResponse = {
  config: {
    tournament_code?: string;
    status?: string;
    table_target_size?: string;
    poule_qualifiers?: string;
    b_repechage_count?: string;
    a_qualifiers_per_round?: string;
    b_qualifiers_per_round?: string;
  };
  playerCount: number;
  tournamentStarted: boolean;
  demoMode: boolean;
  repechageEnabled: boolean;
  tableTargets: TableTargets;
  poules: { tables: TableSummary[]; done: boolean };
  bracketA: BracketSummary;
  bracketB: BracketSummary;
  final: { exists: boolean; complete?: boolean; seatCount?: number; table?: TableSummary };
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

export default function AdminPage() {
  const { data, error, mutate } = useSWR<StatusResponse>("/api/admin/status", fetcher, {
    refreshInterval: 6000,
    shouldRetryOnError: false,
  });

  if (error && (error as { status?: number }).status === 401) {
    return <LoginForm onSuccess={() => mutate()} />;
  }

  if (!data) {
    return (
      <>
        <SiteHeader subtitle="Admin" />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-caramel">Chargement…</p>
        </main>
      </>
    );
  }

  return <Dashboard data={data} refresh={() => mutate()} />;
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

function Dashboard({ data, refresh }: { data: StatusResponse; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState(data.config.tournament_code ?? "");
  const [stageSizes, setStageSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries(STAGE_FIELDS.map((f) => [f.configKey, String(data.tableTargets[f.key])]))
  );
  const [repechage, setRepechage] = useState(data.repechageEnabled);
  const [pouleQualifiers, setPouleQualifiers] = useState(data.config.poule_qualifiers ?? "1");
  const [bRepechageCount, setBRepechageCount] = useState(data.config.b_repechage_count ?? "1");

  async function call(url: string, body?: unknown) {
    setBusy(url);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(`Erreur: ${json.error ?? "inconnue"}`);
        return;
      }
      setMessage("OK");
      refresh();
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SiteHeader
        subtitle={`Admin — ${data.playerCount} joueurs`}
        right={
          <span className="flex items-center gap-4">
            <Link href="/admin/projection" className="text-sm font-semibold text-orange-label underline underline-offset-2">
              📽️ Projection
            </Link>
            <Link href="/admin/tables" className="text-sm font-semibold text-orange-label underline underline-offset-2">
              🛠️ Toutes les tables
            </Link>
            <Link href="/classement" className="text-sm font-semibold text-orange-label underline underline-offset-2">
              🏆 Classement
            </Link>
          </span>
        }
      />
      <main className="flex flex-1 flex-col px-6 py-8 max-w-2xl w-full mx-auto gap-6">
        {message && <p className="text-sm text-caramel font-medium">{message}</p>}

        {!data.tournamentStarted ? (
          <Section title="Lancer le tournoi">
            <p className="text-ink font-semibold">
              {data.playerCount} joueurs inscrits
              {data.playerCount >= 4 && (
                <span className="text-caramel font-normal">
                  {" "}· {poulePreview(data.playerCount, data.tableTargets.poules)}
                </span>
              )}
            </p>
            <p className="text-caramel text-sm mt-1 mb-4">
              Vérifie le format dans « Configuration avancée » (joueurs par table, qualifiés,
              repêchage) avant de lancer : les Poules sont créées au moment du clic.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => call("/api/admin/start")}
                disabled={busy !== null || data.playerCount < 4}
                className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-5 py-3 font-bold text-white"
              >
                🚀 Lancer le tournoi
              </button>
              {data.demoMode && (
                <button
                  onClick={() => call("/api/demo/seed", { count: 100 })}
                  disabled={busy !== null}
                  className="rounded-lg bg-cream-card hover:bg-separator disabled:opacity-50 px-4 py-3 text-sm font-semibold text-orange-label"
                >
                  Générer 100 joueurs fictifs
                </button>
              )}
            </div>
            {data.playerCount < 4 && (
              <p className="text-bad text-sm mt-2 font-medium">
                Il faut au moins 4 joueurs pour lancer le tournoi.
              </p>
            )}
          </Section>
        ) : (
          <Section title="Phase de Poules">
            <TableList tables={data.poules.tables} />
            <p className="text-caramel text-xs mt-2">
              Rien ne se lance automatiquement : une fois toutes les poules terminées, clique
              ci-dessous pour générer le Tableau A (et B).
            </p>
            {data.poules.done && data.bracketA.status === "not-generated" && (
              <button
                onClick={() => call("/api/admin/generate-from-poules")}
                disabled={busy !== null}
                className="mt-3 rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-3 font-bold text-white"
              >
                {data.repechageEnabled ? "Générer Tableau A + Tableau B" : "Générer Tableau A"}
              </button>
            )}
          </Section>
        )}

        {data.bracketA.status !== "waiting-poules" && data.bracketA.status !== "not-generated" && (
          <Section title="Tableau A">
            <TableList tables={data.bracketA.tables} />
            <BracketAction
              status={data.bracketA.status}
              defaultQualifiers={data.config.a_qualifiers_per_round ?? "1"}
              onAdvance={(q) => call("/api/admin/advance", { bracket: "A", qualifiersPerRound: q })}
              busy={busy !== null}
            />
          </Section>
        )}

        {data.repechageEnabled &&
          data.bracketB.status !== "waiting-poules" &&
          data.bracketB.status !== "not-generated" && (
            <Section title="Tableau B (repêchage)">
              <TableList tables={data.bracketB.tables} />
              <BracketAction
                status={data.bracketB.status}
                defaultQualifiers={data.config.b_qualifiers_per_round ?? "1"}
                onAdvance={(q) => call("/api/admin/advance", { bracket: "B", qualifiersPerRound: q })}
                busy={busy !== null}
              />
            </Section>
          )}

        {data.bracketA.status === "done" &&
          (data.repechageEnabled ? data.bracketB.status === "done" : true) && (
          <Section title="Grande Finale">
            {!data.final.exists ? (
              <button
                onClick={() => call("/api/admin/finalize")}
                disabled={busy !== null}
                className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-3 font-bold text-white"
              >
                Générer la Grande Finale
              </button>
            ) : (
              <>
                <p className="text-caramel mb-3">
                  {data.final.seatCount} joueurs — {data.final.complete ? "résultat complet" : "en attente du résultat"}
                </p>
                {data.final.table && (
                  <ul className="flex flex-col gap-1 mb-4 rounded-lg bg-cream-row border border-separator p-3">
                    {data.final.table.seats
                      .slice()
                      .sort((a, b) => Number(a.finish_rank || 99) - Number(b.finish_rank || 99))
                      .map((s) => (
                        <li key={s.player_id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-caramel font-semibold">
                            {s.finish_rank ? `#${s.finish_rank}` : "—"}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
                {data.final.complete && data.config.status !== "finished" && (
                  <button
                    onClick={() => call("/api/admin/finish")}
                    disabled={busy !== null}
                    className="rounded-lg bg-good hover:opacity-90 disabled:opacity-50 px-4 py-3 font-bold text-white"
                  >
                    Clôturer le tournoi
                  </button>
                )}
                {data.config.status === "finished" && (
                  <p className="text-good font-bold">🏆 Tournoi terminé</p>
                )}
              </>
            )}
          </Section>
        )}

        {data.tournamentStarted && (
          <Section title="Nouveau tournoi">
            <p className="text-caramel text-sm mb-3">
              Efface toutes les tables et tous les résultats pour repartir de zéro. Les joueurs et
              le format sont conservés, puis tu pourras relancer le tournoi.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (confirm("Effacer toutes les tables et tous les résultats du tournoi en cours ?"))
                    call("/api/admin/reset");
                }}
                disabled={busy !== null}
                className="rounded-lg border border-bad text-bad hover:bg-bad/10 disabled:opacity-50 px-4 py-2 text-sm font-semibold"
              >
                Réinitialiser le tournoi
              </button>
              {data.demoMode && (
                <button
                  onClick={() => {
                    if (confirm("Remplacer les joueurs par 100 joueurs fictifs et effacer le tournoi en cours ?"))
                      call("/api/demo/seed", { count: 100 });
                  }}
                  disabled={busy !== null}
                  className="rounded-lg bg-cream-card hover:bg-separator disabled:opacity-50 px-4 py-2 text-sm font-semibold text-orange-label"
                >
                  Repartir avec 100 joueurs fictifs
                </button>
              )}
            </div>
          </Section>
        )}

        <details className="rounded-xl bg-cream-alt border border-separator shadow-sm p-5">
          <summary className="font-extrabold text-ink cursor-pointer select-none">
            ⚙️ Configuration avancée
          </summary>
          <div className="mt-4">
            <label className="block text-sm font-semibold text-orange-label mb-1">Code du tournoi</label>
            <input
              className="w-full rounded-lg bg-white border border-separator px-3 py-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <p className="text-sm font-semibold text-orange-label mt-4 mb-1">
            Joueurs par table, à chaque étape
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STAGE_FIELDS.filter((f) => repechage || f.bracket !== "B").map((f) => (
              <div key={f.configKey}>
                <label className="block text-xs font-semibold text-caramel mb-1">{f.label}</label>
                <select
                  className="w-full rounded-lg bg-white border border-separator px-2 py-2 text-center font-semibold"
                  value={stageSizes[f.configKey]}
                  onChange={(e) =>
                    setStageSizes((prev) => ({ ...prev, [f.configKey]: e.target.value }))
                  }
                >
                  {[3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className="text-caramel text-xs mt-1">
            Le nombre de tables est calculé au plus juste (ex : 100 joueurs à 5 = 20 tables, à 4 =
            25). S&apos;il reste 1 ou 2 joueurs, ils sont ajoutés à d&apos;autres tables (jamais
            plus de 5) ; s&apos;il en reste 3 ou plus, ils forment une table à part.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row mt-3">
            <div className="w-48">
              <label className="flex min-h-[2.5rem] items-end text-sm font-semibold text-orange-label mb-1">
                Qualifiés directs par poule
              </label>
              <input
                className="w-full rounded-lg bg-white border border-separator px-3 py-2"
                value={pouleQualifiers}
                onChange={(e) => setPouleQualifiers(e.target.value)}
              />
            </div>
            {repechage && (
              <div className="w-48">
                <label className="flex min-h-[2.5rem] items-end text-sm font-semibold text-orange-label mb-1">
                  Repêchés du Tableau B en finale
                </label>
                <input
                  className="w-full rounded-lg bg-white border border-separator px-3 py-2"
                  value={bRepechageCount}
                  onChange={(e) => setBRepechageCount(e.target.value)}
                />
              </div>
            )}
          </div>
          <p className="text-caramel text-xs mt-1">
            Ex : 1 qualifié/poule + 1 repêché = format standard (1er de poule en Tableau A, le
            reste en Tableau B, un seul repêché rejoint la finale).
          </p>

          <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-orange-label">
            <input
              type="checkbox"
              checked={repechage}
              onChange={(e) => setRepechage(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            Activer le repêchage (Tableau B)
          </label>
          <p className="text-caramel text-xs mt-1">
            Désactivé : les non-qualifiés de poule sont directement éliminés, la Grande Finale
            ne réunit que les qualifiés du Tableau A.
          </p>
          <p className="text-caramel text-xs mt-1 italic">
            Tous ces réglages peuvent être changés à tout moment — ça ne change que les tours pas
            encore générés, jamais ceux déjà joués.
          </p>

          <button
            onClick={() =>
              call("/api/admin/config", {
                tournament_code: code,
                repechage_enabled: repechage,
                poule_qualifiers: pouleQualifiers,
                b_repechage_count: bRepechageCount,
                ...stageSizes,
              })
            }
            disabled={busy !== null}
            className="mt-3 rounded-lg bg-cream-card hover:bg-separator px-4 py-2 text-sm font-semibold text-orange-label"
          >
            Enregistrer
          </button>
          <p className="text-caramel text-sm mt-2">
            Statut : <strong className="text-ink">{data.config.status ?? "non configuré"}</strong>
          </p>
        </details>
      </main>
    </>
  );
}

/**
 * The qualifiers-per-round input lives right next to the "Générer le tour
 * suivant" button for the round actually about to be generated, instead of
 * a separate standing setting — easy to leave stale between stages (e.g.
 * forgetting to switch back from 1 after using 2 for Quart -> Demi).
 */
function BracketAction({
  status,
  defaultQualifiers,
  onAdvance,
  busy,
}: {
  status: string;
  defaultQualifiers: string;
  onAdvance: (qualifiers: string) => void;
  busy: boolean;
}) {
  const [qualifiers, setQualifiers] = useState(defaultQualifiers);

  if (status === "in-progress") {
    return <p className="text-caramel text-sm mt-2">En attente des résultats de ce tour.</p>;
  }
  if (status === "ready-to-advance") {
    return (
      <div className="mt-3 flex items-end gap-2">
        <div className="w-56">
          <label className="block text-sm font-semibold text-orange-label mb-1">
            Qualifiés de ce tour vers le suivant
          </label>
          <input
            className="w-full rounded-lg bg-white border border-separator px-3 py-2"
            value={qualifiers}
            onChange={(e) => setQualifiers(e.target.value)}
          />
        </div>
        <button
          onClick={() => onAdvance(qualifiers)}
          disabled={busy}
          className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-3 font-bold text-white"
        >
          Générer le tour suivant
        </button>
      </div>
    );
  }
  if (status === "done") {
    return <p className="text-good text-sm font-semibold mt-2">Terminé — prêt pour la Grande Finale.</p>;
  }
  return null;
}

function tableLabel(t: { stage: string; table_number: number }) {
  return t.stage === "Poules" ? `Poule ${t.table_number}` : `Table ${t.table_number}`;
}

function poulePreview(playerCount: number, target: number) {
  const sizes = planTableSizes(playerCount, target);
  const bySize = new Map<number, number>();
  sizes.forEach((s) => bySize.set(s, (bySize.get(s) ?? 0) + 1));
  const detail = [...bySize.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => `${count} de ${size}`)
    .join(" + ");
  return `${sizes.length} poules (${detail})`;
}

function TableList({ tables }: { tables: TableSummary[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (tables.length === 0) return <p className="text-caramel text-sm">Aucune table.</p>;

  // tables arrive sorted by round then table number, so stages come out in play order
  const groups: { stage: string; tables: TableSummary[] }[] = [];
  for (const t of tables) {
    const group = groups.find((g) => g.stage === t.stage);
    if (group) group.tables.push(t);
    else groups.push({ stage: t.stage, tables: [t] });
  }

  function toggle(round_id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(round_id)) next.delete(round_id);
      else next.add(round_id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const done = g.tables.filter((t) => t.complete).length;
        const finished = done === g.tables.length;
        return (
          <div key={g.stage} className="rounded-lg border border-separator bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-extrabold text-ink">{g.stage}</h3>
              <span
                className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                  finished ? "bg-good/15 text-good" : "bg-cream-card text-orange-label"
                }`}
              >
                {finished
                  ? `Terminé · ${g.tables.length} table${g.tables.length > 1 ? "s" : ""}`
                  : `${done}/${g.tables.length} tables rendues`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.tables.map((t) => (
                <button
                  key={t.round_id}
                  onClick={() => toggle(t.round_id)}
                  className={`text-xs font-semibold rounded px-2 py-1 ${
                    t.complete ? "bg-good/15 text-good" : "bg-cream-card text-orange-label"
                  } ${expanded.has(t.round_id) ? "ring-2 ring-accent" : ""}`}
                >
                  {tableLabel(t)}
                </button>
              ))}
            </div>
            {g.tables
              .filter((t) => expanded.has(t.round_id))
              .map((t) => (
                <div
                  key={t.round_id}
                  className="mt-2 rounded-lg bg-cream-row border border-separator p-3"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-orange-label mb-2">
                    {g.stage} · {tableLabel(t)} · {t.seats.length} joueurs
                  </p>
                  <ul className="flex flex-col gap-1">
                    {t.seats.map((s) => (
                      <li key={s.player_id} className="flex items-center justify-between text-sm">
                        <span>{s.name}</span>
                        <span className="text-caramel font-semibold">
                          {s.finish_rank ? `#${s.finish_rank}` : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-cream-alt border border-separator shadow-sm p-5">
      <h2 className="font-extrabold mb-3 text-ink">{title}</h2>
      {children}
    </section>
  );
}
