import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RepoChangedEvent {
  type: "repo-changed";
  repo: string;
  digest: string;
}

/**
 * §4.5: "SSE /api/events invalidates on repo-changed". One EventSource for the whole
 * app (mounted once in AppShell), not one per component. EventSource reconnects on
 * its own after a network blip or server restart (native browser behavior — no manual
 * retry loop needed here); if it never recovers at all, each query's own staleTime +
 * refetchOnWindowFocus is the fallback, per §4.5's "falling back to interval refetch
 * if EventSource fails".
 */
export function useLiveEvents(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (e) => {
      let event: RepoChangedEvent;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type !== "repo-changed") return;
      queryClient.invalidateQueries({ queryKey: ["tasks", event.repo] });
      queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
    };

    return () => source.close();
  }, [queryClient]);
}
