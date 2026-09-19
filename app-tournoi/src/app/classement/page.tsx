"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import SiteHeader from "@/components/SiteHeader";

type IndividualEntry = {
  rank: number;
  name: string;
  team: string;
  points: number;
  stage: string;
};
type TeamEntry = { rank: number; team: string; points: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ClassementPage() {
  const [tab, setTab] = useState<"individuel" | "equipe">("individuel");
  const { data } = useSWR<{ individual: IndividualEntry[]; team: TeamEntry[] }>(
    "/api/classement",
    fetcher,
    { refreshInterval: 15000 }
  );

  return (
    <>
      <SiteHeader
        subtitle="Classement officiel"
        right={
          <Link href="/" className="text-sm font-semibold text-orange-label underline underline-offset-2">
            Ma table
          </Link>
        }
      />
      <main className="flex flex-1 flex-col px-6 py-8 max-w-lg w-full mx-auto">
        <div className="flex gap-2 mb-4">
          <TabButton active={tab === "individuel"} onClick={() => setTab("individuel")}>
            Individuel
          </TabButton>
          <TabButton active={tab === "equipe"} onClick={() => setTab("equipe")}>
            Par équipe
          </TabButton>
        </div>

        {!data && <p className="text-caramel">Chargement…</p>}

        {data && tab === "individuel" && (
          <ol className="flex flex-col gap-2">
            {data.individual.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${rankStyle(e.rank)}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-7 text-center font-black text-lg" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
                    {e.rank}
                  </span>
                  <span>
                    <span className="font-semibold">{e.name}</span>
                    {e.team && <span className="text-caramel text-sm"> · {e.team}</span>}
                  </span>
                </span>
                <span className="font-bold text-accent">{e.points} pts</span>
              </li>
            ))}
            {data.individual.length === 0 && (
              <p className="text-caramel">Le classement apparaîtra une fois le tournoi lancé.</p>
            )}
          </ol>
        )}

        {data && tab === "equipe" && (
          <ol className="flex flex-col gap-2">
            {data.team.map((e) => (
              <li
                key={e.team}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${rankStyle(e.rank)}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-7 text-center font-black text-lg" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
                    {e.rank}
                  </span>
                  <span className="font-semibold">{e.team}</span>
                </span>
                <span className="font-bold text-accent">{e.points} pts</span>
              </li>
            ))}
            {data.team.length === 0 && (
              <p className="text-caramel">Aucune équipe pour l&apos;instant.</p>
            )}
          </ol>
        )}
      </main>
    </>
  );
}

function rankStyle(rank: number) {
  if (rank === 1) return "bg-gold/15 border-l-4 border-l-gold border-separator";
  if (rank === 2) return "bg-silver/15 border-l-4 border-l-silver border-separator";
  if (rank === 3) return "bg-bronze/15 border-l-4 border-l-bronze border-separator";
  return "bg-cream-alt border-separator";
}

function TabButton({
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
      className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide ${
        active ? "bg-accent text-white" : "bg-cream-card text-orange-label"
      }`}
    >
      {children}
    </button>
  );
}
