// src/useVersionCheck.ts
import { useEffect } from "react";
import { APP_VERSION } from "./version";

type UseVersionCheckOptions = {
  // Callback invoked when a newer version is detected on the server
  onUpdateDetected: () => void;
  // Interval (in milliseconds) to poll version.json
  intervalMs?: number;
};

export function useVersionCheck(options: UseVersionCheckOptions) {
  const { onUpdateDetected, intervalMs = 30000 } = options;

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        // Do not start the path with "/" so it resolves under /PhyloWeaver/
        const res = await fetch("version.json", { cache: "no-cache" });
        if (!res.ok) return;

        const json = await res.json();
        const serverVersion = String(json.version || "");

        // If the server version differs from the current bundle version,
        // notify the app that an update is available.
        if (!cancelled && serverVersion && serverVersion !== APP_VERSION) {
          onUpdateDetected();
        }
      } catch (e) {
        console.error("version check failed", e);
      }
    };

    // Run once immediately on mount
    check();

    // Then poll periodically
    const timer = setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onUpdateDetected, intervalMs]);
}

