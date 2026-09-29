"use client";

import Link from "next/link";
import useSWR from "swr";
import AdminGate from "@/components/AdminGate";
import SiteHeader from "@/components/SiteHeader";

type ProjSeat = { player_id: string; name: string };
type ProjTable = {
  round_id: string;
  bracket: string;
  stage: string;
  table_number: number;
  complete: boolean;
  seats: ProjSeat[];
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

export default function AdminProjectionPage() {
  const { data, error, mutate } = useSWR<{ tables: ProjTable[] }>(
    "/api/admin/projection",
    fetcher,
    { refreshInterval: 6000 }
  );
  const unauthorized = (error as { status?: number } | undefined)?.status === 401;

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
            {!data ? (
              <p className="text-caramel">Chargement…</p>
            ) : (
              <Content tables={data.tables} />
            )}
          </main>
        </>
      )}
    </>
  );
}

function Content({ tables }: { tables: ProjTable[] }) {
  if (tables.length === 0) {
    return <p className="text-caramel">Aucune table en cours.</p>;
  }

  const stages = [...new Set(tables.map((t) => t.stage))].join(" · ");
  const doneCount = tables.filter((t) => t.complete).length;

  return (
    <>
      <p className="text-caramel text-sm mb-4">
        {stages} — {doneCount}/{tables.length} table{tables.length > 1 ? "s" : ""} rendue
        {doneCount > 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tables.map((t) => (
          <div
            key={t.round_id}
            className={`rounded-xl border p-3 ${
              t.complete ? "border-good bg-good/10" : "border-separator bg-cream-alt"
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-label mb-0.5">
              {t.stage}
            </p>
            <p className="font-extrabold text-ink mb-2">Table {t.table_number}</p>
            <ul className="flex flex-col gap-0.5">
              {t.seats.map((s) => (
                <li key={s.player_id} className="text-sm leading-snug text-ink">
                  {s.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
