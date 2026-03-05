import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { LocalSnapshotSummary } from '../../local/sessionRepository';
import type { NavigationSearchEntry, QuickActionEntry } from './searchData';

type SearchPaletteProps = {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  navigationResults: NavigationSearchEntry[];
  quickActions: QuickActionEntry[];
  recentRooms: LocalSnapshotSummary[];
  loadingRecentRooms: boolean;
  onNavigate: (path: string) => void;
  onOpenRecentRoom: (roomId: string) => void;
  onCopyRoomId: (roomId: string) => void;
  statusMessage: string | null;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const SearchPalette = ({
  open,
  query,
  onQueryChange,
  onClose,
  navigationResults,
  quickActions,
  recentRooms,
  loadingRecentRooms,
  onNavigate,
  onOpenRecentRoom,
  onCopyRoomId,
  statusMessage
}: SearchPaletteProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  if (!document.body) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/70 p-4 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search navigation, tools, and recent local rooms..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500"
          />
          {statusMessage ? <p className="mt-2 text-xs text-sky-300">{statusMessage}</p> : null}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Navigation
            </h3>
            <ul className="space-y-1">
              {navigationResults.slice(0, 14).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-transparent px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                    onClick={() => onNavigate(entry.path)}
                  >
                    <p className="text-sm font-medium text-slate-100">{entry.label}</p>
                    <p className="text-xs text-slate-400">{entry.description}</p>
                  </button>
                </li>
              ))}
              {navigationResults.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No navigation results.</li>
              ) : null}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Recent Rooms (Local)
            </h3>
            {loadingRecentRooms ? (
              <p className="px-3 py-2 text-sm text-slate-500">Loading local snapshots...</p>
            ) : null}
            {!loadingRecentRooms && recentRooms.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No local rooms stored yet.</p>
            ) : null}
            <ul className="space-y-1">
              {recentRooms.map((entry) => (
                <li
                  key={entry.roomId}
                  className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-slate-100">{entry.roomId}</p>
                  <p className="text-xs text-slate-400">
                    Last updated: {formatDate(entry.updatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-sky-500 hover:text-sky-200"
                      onClick={() => onOpenRecentRoom(entry.roomId)}
                    >
                      Open /vtt
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-sky-500 hover:text-sky-200"
                      onClick={() => onCopyRoomId(entry.roomId)}
                    >
                      Copy Room ID
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Quick Actions
            </h3>
            <ul className="space-y-1">
              {quickActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-transparent px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                    onClick={() => onNavigate(action.path)}
                  >
                    <p className="text-sm font-medium text-slate-100">{action.label}</p>
                    <p className="text-xs text-slate-400">{action.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};
