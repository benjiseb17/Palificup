import { cookies } from "next/headers";

const PLAYER_COOKIE = "palificup_player_id";
const ADMIN_COOKIE = "palificup_admin";

export async function setPlayerSession(playerId: string) {
  const store = await cookies();
  store.set(PLAYER_COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
  });
}

export async function getPlayerSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(PLAYER_COOKIE)?.value ?? null;
}

export async function clearPlayerSession() {
  const store = await cookies();
  store.delete(PLAYER_COOKIE);
}

export async function setAdminSession() {
  const store = await cookies();
  const secret = process.env.ADMIN_PASSWORD ?? "";
  store.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  const secret = process.env.ADMIN_PASSWORD;
  return Boolean(secret) && value === secret;
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
