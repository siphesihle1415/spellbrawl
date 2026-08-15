import { useCallback, useEffect, useState } from "react";
import { defaultRunConfiguration } from "./defaultConfig";
import { requestRunConfiguration, type DirectorSource } from "./DirectorClient";
import { decodeRunConfiguration, type RunConfiguration } from "./schema";

export type DirectorStatus = "idle" | "loading" | DirectorSource;

export function useRunConfiguration(enabled: boolean) {
  const [configuration, setConfiguration] = useState(defaultRunConfiguration);
  const [status, setStatus] = useState<DirectorStatus>("idle");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setStatus("loading");

    requestRunConfiguration()
      .then((result) => {
        if (!active) return;
        setConfiguration(result.configuration);
        setStatus(result.source);
      })
      .catch(() => {
        if (!active) return;
        setConfiguration(defaultRunConfiguration);
        setStatus("fallback");
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  const applyRemoteConfiguration = useCallback((input: unknown, source: DirectorSource) => {
    const decoded = decodeRunConfiguration(input);
    if (!decoded) return false;
    setConfiguration(decoded);
    setStatus(source);
    return true;
  }, []);

  return { configuration, status, applyRemoteConfiguration };
}
