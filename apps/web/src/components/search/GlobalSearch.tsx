import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SearchPalette } from './SearchPalette';
import { useGlobalSearch } from './useGlobalSearch';
import type { SearchScope } from './searchData';

type GlobalSearchProps = {
  scope: SearchScope;
};

export const GlobalSearch = ({ scope }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const {
    query,
    setQuery,
    navigationResults,
    quickActionResults,
    recentRoomResults,
    loadingRecentRooms
  } = useGlobalSearch({
    open,
    scope
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open || !statusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage(null);
    }, 1600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, statusMessage]);

  const placeholderText = useMemo(() => {
    if (scope === 'player') {
      return 'Search player pages and local rooms...';
    }

    if (scope === 'dm') {
      return 'Search DM pages and local rooms...';
    }

    return 'Search pages and local rooms...';
  }, [scope]);

  const closePalette = () => {
    setOpen(false);
    setStatusMessage(null);
  };

  const navigateTo = (path: string) => {
    navigate(path);
    closePalette();
  };

  const copyRoomId = async (roomId: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(roomId);
        setStatusMessage(`Copied room ID: ${roomId}`);
        return;
      }
    } catch {
      // no-op fallback below
    }

    setStatusMessage(`Room ID: ${roomId}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
        aria-label="Open global search"
      >
        <span className="text-slate-400">Search</span>
        <span className="truncate text-slate-500">{placeholderText}</span>
        <span className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-400">
          Ctrl/Cmd+K
        </span>
      </button>

      <SearchPalette
        open={open}
        query={query}
        onQueryChange={setQuery}
        onClose={closePalette}
        navigationResults={navigationResults}
        quickActions={quickActionResults}
        recentRooms={recentRoomResults}
        loadingRecentRooms={loadingRecentRooms}
        onNavigate={navigateTo}
        onOpenRecentRoom={() => navigateTo('/vtt')}
        onCopyRoomId={(roomId) => {
          void copyRoomId(roomId);
        }}
        statusMessage={statusMessage}
      />
    </>
  );
};
