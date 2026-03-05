import { useEffect, useMemo, useState } from 'react';

import { localSessionRepository, type LocalSnapshotSummary } from '../../local/sessionRepository';
import {
  navigationSearchEntries,
  quickActions,
  type NavigationSearchEntry,
  type QuickActionEntry,
  type SearchScope
} from './searchData';

const scopeWeight = (entryScope: SearchScope, currentScope: SearchScope): number => {
  if (currentScope === 'all') {
    return entryScope === 'all' ? 2 : 1;
  }

  if (entryScope === currentScope) {
    return 4;
  }

  if (entryScope === 'all') {
    return 2;
  }

  return 1;
};

const includesQuery = (entry: NavigationSearchEntry, normalizedQuery: string): boolean => {
  if (!normalizedQuery) {
    return true;
  }

  if (entry.label.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (entry.description.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  return entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery));
};

export const useGlobalSearch = (args: { open: boolean; scope: SearchScope }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentRooms, setRecentRooms] = useState<LocalSnapshotSummary[]>([]);
  const [loadingRecentRooms, setLoadingRecentRooms] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (!args.open) {
      return;
    }

    let cancelled = false;
    setLoadingRecentRooms(true);
    void localSessionRepository
      .listRecentSnapshotSummaries(10)
      .then((summaries) => {
        if (cancelled) {
          return;
        }

        setRecentRooms(summaries);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRecentRooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [args.open]);

  const navigationResults = useMemo(() => {
    return [...navigationSearchEntries]
      .filter((entry) => includesQuery(entry, debouncedQuery))
      .sort((left, right) => {
        const weightDiff = scopeWeight(right.scope, args.scope) - scopeWeight(left.scope, args.scope);
        if (weightDiff !== 0) {
          return weightDiff;
        }

        return left.label.localeCompare(right.label);
      });
  }, [args.scope, debouncedQuery]);

  const quickActionResults = useMemo<QuickActionEntry[]>(() => {
    if (!debouncedQuery) {
      return quickActions;
    }

    return quickActions.filter((action) => {
      return (
        action.label.toLowerCase().includes(debouncedQuery) ||
        action.description.toLowerCase().includes(debouncedQuery)
      );
    });
  }, [debouncedQuery]);

  const recentRoomResults = useMemo(() => {
    if (!debouncedQuery) {
      return recentRooms;
    }

    return recentRooms.filter((entry) => {
      return entry.roomId.toLowerCase().includes(debouncedQuery);
    });
  }, [debouncedQuery, recentRooms]);

  return {
    query,
    setQuery,
    navigationResults,
    quickActionResults,
    recentRoomResults,
    loadingRecentRooms
  };
};
