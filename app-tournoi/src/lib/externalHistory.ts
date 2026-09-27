import { normalizeName } from "./players";
import { readExternalTab } from "./sheets";

const SAISIE_TAB = "Saisie";
const MAX_TOURNAMENTS = 5; // T1..T5 columns in the "Saisie" tab today

type SaisieRow = Record<string, string>;

export type ExternalHistory = {
  tournaments: number;
  totalPoints: number;
  last: { tournoi: string; resultat: string; points: number } | null;
};

/**
 * Read-only lookup into the Palificup historical classement spreadsheet
 * (palificup.fr), kept and maintained entirely outside this app. Returns
 * `null` when the feature isn't configured (no HISTORY_SHEET_ID) so callers
 * can hide it gracefully, or when the name isn't found there (first-timer).
 */
export async function getExternalHistory(name: string): Promise<ExternalHistory | null> {
  const sheetId = process.env.HISTORY_SHEET_ID;
  if (!sheetId) return null;

  const rows = await readExternalTab<SaisieRow>(sheetId, SAISIE_TAB);
  const target = normalizeName(name);
  const row = rows.find((r) => normalizeName(r["Joueur"] ?? "") === target);
  if (!row) return { tournaments: 0, totalPoints: 0, last: null };

  let last: ExternalHistory["last"] = null;
  for (let n = MAX_TOURNAMENTS; n >= 1; n--) {
    const resultat = row[`Résultat T${n}`]?.trim();
    if (resultat) {
      last = { tournoi: `T${n}`, resultat, points: Number(row[`Points T${n}`]) || 0 };
      break;
    }
  }

  const tournaments = Number(row["Tournois joués"]) || 0;
  const totalPoints = Number(row["Total Officiel (Top 3)"]) || 0;
  return { tournaments, totalPoints, last };
}
