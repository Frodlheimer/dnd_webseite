import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { MiniPixiStage } from '../components/landing/MiniPixiStage';

type PrimaryCardProps = {
  title: string;
  description: string;
  to: string;
  quickBadges: string[];
  scene: 'player' | 'dm';
};

const PrimaryCard = ({ title, description, to, quickBadges, scene }: PrimaryCardProps) => {
  const [isInteractiveActive, setIsInteractiveActive] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  return (
    <Link
      to={to}
      className="group block rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-slate-100 shadow-[0_20px_60px_-30px_rgba(2,6,23,0.9)] transition duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.6)] focus-visible:-translate-y-1 focus-visible:border-sky-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 lg:p-3 xl:p-4"
      onMouseEnter={() => setIsInteractiveActive(true)}
      onMouseLeave={() => setIsInteractiveActive(false)}
      onFocus={() => setIsInteractiveActive(true)}
      onBlur={() => setIsInteractiveActive(false)}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse') {
          setBurstKey((previous) => previous + 1);
        }
      }}
    >
      <MiniPixiStage
        scene={scene}
        isActive={isInteractiveActive}
        burstKey={burstKey}
        className="h-28 sm:h-32 lg:h-24 xl:h-32"
      />
      <div className="mt-3">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {quickBadges.map((badge) => (
          <li
            key={`${title}-${badge}`}
            className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-200 transition group-hover:border-sky-500/40 group-hover:text-sky-200"
          >
            {badge}
          </li>
        ))}
      </ul>
    </Link>
  );
};

const SecondaryCard = ({
  title,
  description,
  to
}: {
  title: string;
  description: string;
  to: string;
}) => {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-slate-100 transition hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
    >
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-200">{title}</h4>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </Link>
  );
};

export const LandingRoute = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const joinCode = searchParams.get('join')?.trim().toUpperCase() ?? '';
  const heroContentRef = useRef<HTMLDivElement | null>(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    if (!joinCode) {
      return;
    }

    navigate(`/player/join?join=${encodeURIComponent(joinCode)}`, {
      replace: true
    });
  }, [joinCode, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncLayoutMode = () => {
      setIsDesktopLayout(mediaQuery.matches);
    };

    syncLayoutMode();
    mediaQuery.addEventListener('change', syncLayoutMode);

    return () => {
      mediaQuery.removeEventListener('change', syncLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopLayout) {
      setLeftColumnHeight(null);
      return;
    }

    const node = heroContentRef.current;
    if (!node) {
      return;
    }

    const syncHeight = () => {
      const nextHeight = Math.max(0, Math.round(node.getBoundingClientRect().height));
      setLeftColumnHeight(nextHeight);
    };

    syncHeight();
    window.addEventListener('resize', syncHeight);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', syncHeight);
      };
    }

    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [isDesktopLayout]);

  if (joinCode) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm uppercase tracking-wide text-slate-400">
          Redirecting to join flow...
        </p>
      </main>
    );
  }

  return (
    <div className="landing-page grid gap-4 lg:gap-3 xl:gap-4">
      <section className="landing-top-grid grid gap-3 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div
          className="grid h-full grid-rows-2 gap-3"
          style={leftColumnHeight && isDesktopLayout ? { height: `${leftColumnHeight}px` } : undefined}
        >
          <Link
            to="/player/characters/sheets"
            className="group flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-4 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-100">
              Character Builder 5e
            </h2>
            <p className="mt-2 flex-1 text-sm text-slate-300">
              Open built-in character sheet templates, fill them locally, and export PDFs.
            </p>
          </Link>

          <Link
            to="/battlemap-oog"
            className="group flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-4 transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          >
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-100">
              Battlemap (Out-of-Game)
            </h2>
            <p className="mt-2 flex-1 text-sm text-slate-300">
              Open an empty local battlemap sandbox with no room creation and no join flow.
            </p>
          </Link>
        </div>

        <div
          ref={heroContentRef}
          className="landing-hero h-full rounded-3xl border border-slate-800 bg-slate-900/55 p-5 shadow-[0_25px_80px_-40px_rgba(14,165,233,0.45)] sm:p-6"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">Out-of-Game Hub</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl xl:text-4xl">
            Prepare faster, jump into your game instantly.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Use the player and DM hubs for session prep and tools. Open the in-game battlemap
            whenever you are ready.
          </p>

          <div className="landing-cta-row mt-4 flex flex-wrap gap-3">
            <Link
              to="/vtt"
              className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Resume
            </Link>
            <Link
              to="/player/join"
              className="rounded-lg border border-slate-600 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-sky-400 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
            >
              Join Session
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-primary-grid grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PrimaryCard
          title="Player"
          description="Manage character, notes, and utilities before entering the active battlemap."
          to="/player"
          quickBadges={['Character', 'Notes', 'Dice']}
          scene="player"
        />
        <PrimaryCard
          title="Dungeon Master"
          description="Control maps, encounters, NPC references, and session prep as the DM."
          to="/dm"
          quickBadges={['NPCs', 'Encounters', 'Maps']}
          scene="dm"
        />
      </section>

      <section className="landing-secondary-grid grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SecondaryCard title="Notes" description="Quick campaign notes." to="/player/notes" />
        <SecondaryCard title="Dice" description="Rolling and initiative tools." to="/dice" />
        <SecondaryCard title="Help" description="Guides and controls." to="/help" />
        <SecondaryCard title="Stats & Rules" description="Rule references." to="/rules" />
      </section>
    </div>
  );
};
