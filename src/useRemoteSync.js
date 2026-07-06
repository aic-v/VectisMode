import { useEffect, useRef, useState } from 'react';
import {
  deleteTimeEntries,
  diffEntries,
  fetchRemoteState,
  pushBoard,
  pushRates,
  pushSharing,
  pushTimeEntries,
  remoteEnabled,
  subscribeRemote,
} from './remote.js';

// Two-way sync between App state and Supabase. Remote wins on load; after
// hydration every local change is written through (board debounced as one
// document, ledger as a diffed change-set). Realtime events from other
// clients are applied directly; our own board echoes are filtered by
// CLIENT_ID in remote.js, and entry echoes are idempotent by id.
export default function useRemoteSync({
  items,
  setItems,
  timeEntries,
  setTimeEntries,
  rates,
  setRates,
  sharing,
  setSharing,
}) {
  const [hydrated, setHydrated] = useState(!remoteEnabled);
  const prevEntriesRef = useRef(null);
  const lastPushedBoardRef = useRef(null);
  const lastPushedRatesRef = useRef(null);
  const lastPushedSharingRef = useRef(null);

  // Hydrate from remote, then subscribe to realtime changes.
  useEffect(() => {
    if (!remoteEnabled) return undefined;
    let cancelled = false;

    (async () => {
      const remote = await fetchRemoteState();
      if (cancelled) return;
      if (remote) {
        if (remote.board) {
          lastPushedBoardRef.current = JSON.stringify(remote.board);
          setItems(remote.board);
        }
        if (remote.timeEntries) {
          prevEntriesRef.current = remote.timeEntries;
          setTimeEntries(remote.timeEntries);
        }
        if (remote.rates) {
          lastPushedRatesRef.current = JSON.stringify(remote.rates);
          setRates(remote.rates);
        }
        if (remote.sharing) {
          lastPushedSharingRef.current = JSON.stringify(remote.sharing);
          setSharing(remote.sharing);
        }
      }
      setHydrated(true);
    })();

    const unsubscribe = subscribeRemote({
      onBoard: (state) => {
        lastPushedBoardRef.current = JSON.stringify(state);
        setItems(state);
      },
      onEntryUpsert: (entry) => {
        setTimeEntries((prev) => {
          const exists = prev.some((e) => e.id === entry.id);
          const next = exists
            ? prev.map((e) => (e.id === entry.id ? entry : e))
            : [...prev, entry];
          prevEntriesRef.current = next;
          return next;
        });
      },
      onEntryDelete: (id) => {
        setTimeEntries((prev) => {
          const next = prev.filter((e) => e.id !== id);
          prevEntriesRef.current = next;
          return next;
        });
      },
      onRates: (nextRates) => {
        lastPushedRatesRef.current = JSON.stringify(nextRates);
        setRates(nextRates);
      },
      onSharing: (memberId, level) => {
        setSharing((prev) => {
          const next = { ...prev, [memberId]: level };
          lastPushedSharingRef.current = JSON.stringify(next);
          return next;
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setItems, setTimeEntries, setRates, setSharing]);

  // Board: debounced whole-document push.
  useEffect(() => {
    if (!remoteEnabled || !hydrated) return undefined;
    const json = JSON.stringify(items);
    if (json === lastPushedBoardRef.current) return undefined;
    const timer = setTimeout(() => {
      lastPushedBoardRef.current = json;
      pushBoard(items);
    }, 600);
    return () => clearTimeout(timer);
  }, [items, hydrated]);

  // Ledger: push only what changed.
  useEffect(() => {
    if (!remoteEnabled || !hydrated) return;
    const prev = prevEntriesRef.current ?? [];
    const { upserts, deletes } = diffEntries(prev, timeEntries);
    prevEntriesRef.current = timeEntries;
    if (upserts.length) pushTimeEntries(upserts);
    if (deletes.length) deleteTimeEntries(deletes);
  }, [timeEntries, hydrated]);

  // Rates and sharing: single-document upserts with echo guards.
  useEffect(() => {
    if (!remoteEnabled || !hydrated) return;
    const json = JSON.stringify(rates);
    if (json === lastPushedRatesRef.current) return;
    lastPushedRatesRef.current = json;
    pushRates(rates);
  }, [rates, hydrated]);

  useEffect(() => {
    if (!remoteEnabled || !hydrated) return;
    const json = JSON.stringify(sharing);
    if (json === lastPushedSharingRef.current) return;
    lastPushedSharingRef.current = json;
    pushSharing(sharing);
  }, [sharing, hydrated]);

  return { remoteEnabled, hydrated };
}
