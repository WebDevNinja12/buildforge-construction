/**
 * Optional error reporting. Set SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) to enable.
 */

type SentryPayload = {
  message: string;
  level?: "error" | "warning" | "info";
  extra?: Record<string, unknown>;
};

export async function captureException(
  err: unknown,
  extra?: Record<string, unknown>
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  await report({
    message,
    level: "error",
    extra: { ...extra, stack },
  });
}

export async function captureMessage(
  message: string,
  level: "error" | "warning" | "info" = "info",
  extra?: Record<string, unknown>
): Promise<void> {
  await report({ message, level, extra });
}

async function report(payload: SentryPayload): Promise<void> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[monitor]", payload.level || "error", payload.message, payload.extra);
    } else {
      console.error("[monitor]", payload.message);
    }
    return;
  }

  try {
    if (dsn.startsWith("http")) {
      await fetch(dsn, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          service: "hama-construction",
          ts: new Date().toISOString(),
        }),
      }).catch(() => null);
    }
  } catch (e) {
    console.error("[monitor:fail]", e);
  }
}
