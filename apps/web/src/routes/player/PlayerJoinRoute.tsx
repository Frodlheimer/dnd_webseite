import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export const PlayerJoinRoute = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialJoinCode = useMemo(() => {
    return searchParams.get('join')?.trim().toUpperCase() ?? '';
  }, [searchParams]);

  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [displayName, setDisplayName] = useState('Player');
  const [desiredRole, setDesiredRole] = useState<'PLAYER' | 'SPECTATOR'>('PLAYER');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJoinCode(initialJoinCode);
  }, [initialJoinCode]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedJoinCode = joinCode.trim().toUpperCase();
    if (!normalizedJoinCode) {
      setError('Join code is required.');
      return;
    }

    const params = new URLSearchParams();
    params.set('join', normalizedJoinCode);
    if (displayName.trim()) {
      params.set('name', displayName.trim());
    }
    params.set('role', desiredRole);

    navigate(`/vtt?${params.toString()}`);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/65 p-6">
      <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Player</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join Session</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">
        Enter your invite code, choose your display name, and continue to the in-game table.
      </p>

      <form className="mt-6 grid max-w-xl gap-3" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-200">
          Join code
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 uppercase text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="ABCD1234"
          />
        </label>

        <label className="text-sm text-slate-200">
          Display name
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Player"
          />
        </label>

        <label className="text-sm text-slate-200">
          Desired role
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            value={desiredRole}
            onChange={(event) => setDesiredRole(event.target.value as 'PLAYER' | 'SPECTATOR')}
          >
            <option value="PLAYER">Player</option>
            <option value="SPECTATOR">Spectator</option>
          </select>
        </label>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Join in VTT
          </button>
          <Link
            to="/vtt"
            className="rounded-lg border border-slate-600 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            Resume
          </Link>
        </div>
      </form>
    </section>
  );
};
