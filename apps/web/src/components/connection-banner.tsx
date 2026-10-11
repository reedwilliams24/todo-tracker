"use client";

import { type ConnectionStatus, TEST_IDS } from "@/domain";
import { useT } from "@/hooks/use-t";

/** Disabled controls point here (`aria-describedby`) so assistive tech reads why they're unavailable. */
export const CONNECTION_BANNER_ID = "connection-banner";

/** Reconnecting / offline banner for the signed-in list (spec/features/realtime.md#connection-status). */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const t = useT();
  if (status !== "reconnecting" && status !== "offline") return null;
  return (
    <div
      id={CONNECTION_BANNER_ID}
      role="status"
      aria-live="polite"
      data-testid={TEST_IDS.connectionBanner}
      className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm"
    >
      {status === "reconnecting" ? (
        <>
          <span
            aria-hidden
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
          <span>
            <span className="font-medium">{t("connection.reconnecting")}</span>{" "}
            <span className="opacity-70">{t("connection.readOnly")}</span>
          </span>
        </>
      ) : (
        <span>{t("connection.offline")}</span>
      )}
    </div>
  );
}
