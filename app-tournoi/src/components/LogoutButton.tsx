"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ends the player session and sends back to the login form. Needed now
 * that the logo/"Ma table" links auto-redirect a logged-in player straight
 * back to their table — this is the only way to switch identity or leave. */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="text-sm font-semibold text-caramel underline underline-offset-2 disabled:opacity-50"
    >
      {loading ? "…" : "Déconnexion"}
    </button>
  );
}
