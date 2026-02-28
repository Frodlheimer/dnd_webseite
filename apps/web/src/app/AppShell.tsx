import { useMemo } from 'react';

import type { Role } from '@dnd-vtt/shared';

import { BoardCanvas } from '../components/BoardCanvas';
import { useAppStore } from './store';

const roles: Role[] = ['DM', 'PLAYER', 'SPECTATOR'];

export const AppShell = () => {
  const {
    currentRoomId,
    role,
    connectionStatus,
    setConnectionStatus,
    setCurrentRoomId,
    setRole
  } = useAppStore();

  const roomLabel = useMemo(() => currentRoomId ?? 'No room joined', [currentRoomId]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 bg-shell-sidebar p-4">
        <h1 className="text-lg font-semibold">D&D VTT</h1>
        <p className="mt-2 text-sm text-slate-300">Room: {roomLabel}</p>
        <p className="text-sm text-slate-300">Connection: {connectionStatus}</p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
            onClick={() => setConnectionStatus('connecting')}
          >
            Join Room (placeholder)
          </button>
          <button
            type="button"
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
            onClick={() => {
              setCurrentRoomId('demo-room');
              setConnectionStatus('connected');
            }}
          >
            Create Room (placeholder)
          </button>
          <button
            type="button"
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
            onClick={() => document.documentElement.classList.toggle('dark')}
          >
            Toggle Dark Mode
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-shell-board p-4">
        <BoardCanvas />
      </main>

      <aside className="w-80 border-l border-slate-800 bg-shell-panel p-4">
        <h2 className="text-base font-semibold">Inspector</h2>
        <p className="mt-2 text-sm text-slate-300">Role preset:</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {roles.map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded px-3 py-2 text-left text-sm transition ${
                role === value ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              onClick={() => setRole(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};
