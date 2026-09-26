import { google } from "googleapis";

const DEMO_MODE = process.env.DEMO_MODE === "1";

let cachedSheetsApi: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY manquants (voir .env.local)"
    );
  }
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsApi() {
  if (!cachedSheetsApi) {
    cachedSheetsApi = google.sheets({ version: "v4", auth: getAuth() });
  }
  return cachedSheetsApi;
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID manquant (voir .env.local)");
  return id;
}

type CacheEntry = { data: string[][]; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4000;

function invalidate(tab: string) {
  cache.delete(tab);
}

// In-memory backend used only when DEMO_MODE=1, so the app can be tried out
// end-to-end (via /api/demo/seed) without a real Google Sheet / service account.
const demoStore = new Map<string, string[][]>();

/** Deletes every data row of a tab, keeping its header row. */
export async function clearTabRows(tab: string) {
  if (DEMO_MODE) {
    const existing = demoStore.get(tab);
    if (existing && existing.length > 0) demoStore.set(tab, [existing[0]]);
    invalidate(tab);
    return;
  }
  await getSheetsApi().spreadsheets.values.clear({
    spreadsheetId: getSheetId(),
    range: `${tab}!A2:Z`,
  });
  invalidate(tab);
}

async function getRawValues(tab: string): Promise<string[][]> {
  if (DEMO_MODE) return demoStore.get(tab) ?? [];

  const now = Date.now();
  const hit = cache.get(tab);
  if (hit && hit.expires > now) return hit.data;

  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tab}!A:Z`,
  });
  const values = (res.data.values as string[][]) ?? [];
  cache.set(tab, { data: values, expires: now + CACHE_TTL_MS });
  return values;
}

export type SheetRecord<T> = T & { _row: number };

/** Reads a tab as objects keyed by its header row. Skips fully-blank rows. */
export async function readTab<T extends Record<string, string>>(
  tab: string
): Promise<SheetRecord<T>[]> {
  const values = await getRawValues(tab);
  if (values.length === 0) return [];
  const [header, ...rows] = values;
  return rows
    .map((row, i) => {
      const obj = { _row: i + 2 } as SheetRecord<T>;
      header.forEach((h, idx) => {
        (obj as Record<string, string>)[h] = row[idx] ?? "";
      });
      return obj;
    })
    .filter((r) =>
      Object.entries(r).some(([k, v]) => k !== "_row" && String(v) !== "")
    );
}

async function ensureHeaders(tab: string, headers: string[]) {
  if (DEMO_MODE) {
    if (!demoStore.has(tab) || demoStore.get(tab)!.length === 0) {
      demoStore.set(tab, [headers]);
    }
    return;
  }
  const values = await getRawValues(tab);
  if (values.length === 0) {
    await getSheetsApi().spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    invalidate(tab);
  }
}

export async function appendRows(
  tab: string,
  headers: string[],
  rows: Record<string, string | number>[]
) {
  if (rows.length === 0) return;
  await ensureHeaders(tab, headers);
  const values = rows.map((r) => headers.map((h) => String(r[h] ?? "")));

  if (DEMO_MODE) {
    const existing = demoStore.get(tab)!;
    demoStore.set(tab, [...existing, ...values]);
    invalidate(tab);
    return;
  }

  await getSheetsApi().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${tab}!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  invalidate(tab);
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Patches specific columns of a single existing row (1-indexed, as returned via `_row`). */
export async function updateRowCells(
  tab: string,
  headers: string[],
  rowNumber: number,
  patch: Record<string, string | number>
) {
  if (DEMO_MODE) {
    const existing = demoStore.get(tab);
    if (!existing) return;
    const rowIdx = rowNumber - 1; // rowNumber is 1-indexed including the header row
    Object.entries(patch).forEach(([key, value]) => {
      const colIdx = headers.indexOf(key);
      if (colIdx === -1) throw new Error(`Colonne inconnue "${key}" dans ${tab}`);
      existing[rowIdx][colIdx] = String(value);
    });
    invalidate(tab);
    return;
  }

  const data = Object.entries(patch).map(([key, value]) => {
    const colIdx = headers.indexOf(key);
    if (colIdx === -1) throw new Error(`Colonne inconnue "${key}" dans ${tab}`);
    return {
      range: `${tab}!${columnLetter(colIdx)}${rowNumber}`,
      values: [[String(value)]],
    };
  });
  await getSheetsApi().spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  invalidate(tab);
}
