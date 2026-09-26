"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import SiteHeader from "@/components/SiteHeader";

type TableSummary = {
  round_id: string;
  stage: string;
  gen: number;
  seatCount: number;
  complete: boolean;
};
type BracketSummary = { status: string; tables: TableSummary[] };
type StatusResponse = {
  config: { tournament_code?: string; status?: string; table_target_size?: string };
  playerCount: number;
  tournamentStarted: boolean;
  repechageEnabled: boolean;
  poules: { tables: TableSummary[]; done: boolean };
  bracketA: BracketSummary;
  bracketB: BracketSummary;
  final: { exists: boolean; complete?: boolean; seatCount?: number };
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
  const [tableSize, setTableSize] = useState(data.config.table_target_size ?? "5");
  const [repechage, setRepechage] = useState(data.repechageEnabled);

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
          <Section title="Phase de Poules">
            <p className="text-caramel mb-3">
              Génère les Poules à partir de l&apos;onglet <code>Players</code> du Google Sheet
              ({data.playerCount} joueurs chargés). Seul le vainqueur de chaque table monte au
              Tableau A
              {data.repechageEnabled
                ? ", les autres sont repêchés dans le Tableau B."
                : " ; le repêchage est désactivé, les autres sont éliminés."}
            </p>
            <button
              onClick={() => call("/api/admin/start")}
              disabled={busy !== null}
              className="rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-3 font-bold text-white"
            >
              Lancer le tournoi (générer les Poules)
            </button>
          </Section>
        ) : (
          <Section title="Phase de Poules">
            <TableList tables={data.poules.tables} />
            <p className="text-caramel text-xs mt-2">
              Le tour suivant se génère automatiquement dès que toutes les tables ont rendu leur résultat.
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
              onAdvance={() => call("/api/admin/advance", { bracket: "A" })}
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
                onAdvance={() => call("/api/admin/advance", { bracket: "B" })}
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

        <details className="rounded-xl bg-cream-alt border border-separator shadow-sm p-5">
          <summary className="font-extrabold text-ink cursor-pointer select-none">
            ⚙️ Configuration avancée
          </summary>
          <div className="flex flex-col gap-3 sm:flex-row mt-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-orange-label mb-1">Code du tournoi</label>
              <input
                className="w-full rounded-lg bg-white border border-separator px-3 py-2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-semibold text-orange-label mb-1">Taille table</label>
              <input
                className="w-full rounded-lg bg-white border border-separator px-3 py-2 disabled:opacity-50"
                value={tableSize}
                onChange={(e) => setTableSize(e.target.value)}
                disabled={data.tournamentStarted}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-orange-label">
            <input
              type="checkbox"
              checked={repechage}
              onChange={(e) => setRepechage(e.target.checked)}
              disabled={data.tournamentStarted}
              className="w-4 h-4 accent-accent disabled:opacity-50"
            />
            Activer le repêchage (Tableau B)
          </label>
          <p className="text-caramel text-xs mt-1">
            Désactivé : les non-vainqueurs de poule sont directement éliminés, la Grande Finale
            ne réunit que les qualifiés du Tableau A.
          </p>
          {data.tournamentStarted && (
            <p className="text-caramel text-xs mt-1 italic">
              Taille de table et repêchage sont figés une fois le tournoi lancé.
            </p>
          )}

          <button
            onClick={() =>
              call("/api/admin/config", {
                tournament_code: code,
                table_target_size: tableSize,
                repechage_enabled: repechage,
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

function BracketAction({
  status,
  onAdvance,
  busy,
}: {
  status: string;
  onAdvance: () => void;
  busy: boolean;
}) {
  if (status === "in-progress") {
    return <p className="text-caramel text-sm mt-2">En attente des résultats de ce tour.</p>;
  }
  if (status === "ready-to-advance") {
    return (
      <button
        onClick={onAdvance}
        disabled={busy}
        className="mt-3 rounded-lg bg-accent hover:bg-[#c94400] disabled:opacity-50 px-4 py-3 font-bold text-white"
      >
        Générer le tour suivant
      </button>
    );
  }
  if (status === "done") {
    return <p className="text-good text-sm font-semibold mt-2">Terminé — prêt pour la Grande Finale.</p>;
  }
  return null;
}

function TableList({ tables }: { tables: TableSummary[] }) {
  if (tables.length === 0) return <p className="text-caramel text-sm">Aucune table.</p>;
  const done = tables.filter((t) => t.complete).length;
  return (
    <div>
      <p className="text-sm text-caramel mb-2">
        {done}/{tables.length} tables rendues
      </p>
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => (
          <span
            key={t.round_id}
            className={`text-xs font-semibold rounded px-2 py-1 ${
              t.complete ? "bg-good/15 text-good" : "bg-cream-card text-orange-label"
            }`}
          >
            {t.round_id}
          </span>
        ))}
      </div>
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
