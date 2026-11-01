"use client";

import { useEffect, useState, useCallback } from "react";

export function useServiceAuth() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const goLogin = useCallback(() => {
    const next = encodeURIComponent(
      "/services" + (typeof window !== "undefined" ? window.location.search : "")
    );
    window.location.href = `/login?next=${next}`;
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d?.user))
      .catch(() => setLoggedIn(false));
  }, []);

  const requireLogin = useCallback(() => {
    if (loggedIn === false) {
      goLogin();
      return false;
    }
    return true;
  }, [loggedIn, goLogin]);

  return { loggedIn, goLogin, requireLogin };
}

/** If 401, redirect to login */
export async function fetchAuthed(
  input: RequestInfo,
  init?: RequestInit,
  goLogin?: () => void
) {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    goLogin?.();
    throw new Error("Please sign in to continue");
  }
  return res;
}
