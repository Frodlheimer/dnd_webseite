import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { SpellDescriptionBlocks } from '../../rules/spells/ui/SpellDescriptionBlocks';
import { renderSpellTextWithLinks } from '../../rules/spells/ui/spellTextLinks';
import { spellsWorkerClient } from '../../rules/spells/worker/spellsWorkerClient';

type FlagBadge = {
  key: string;
  label: string;
};

const toParagraphs = (text: string): string[] => {
  return text
    .split(/\n\s*\n/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const SpellDetailModalRoute = () => {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof spellsWorkerClient.detail>>>(null);

  const hasBackgroundLocation =
    Boolean((location.state as { backgroundLocation?: unknown } | null)?.backgroundLocation);

  const closeModal = useCallback(() => {
    if (hasBackgroundLocation) {
      navigate(-1);
      return;
    }

    navigate('/rules/spells', {
      replace: true
    });
  }, [hasBackgroundLocation, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void spellsWorkerClient
      .detail(slug)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setError(null);
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(
            detailError instanceof Error ? detailError.message : 'Failed to load spell detail'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeModal]);

  const flagBadges = useMemo<FlagBadge[]>(() => {
    if (!detail) {
      return [];
    }

    const badges: FlagBadge[] = [];
    if (detail.flags.ritual) {
      badges.push({ key: 'ritual', label: 'Ritual' });
    }
    if (detail.flags.technomagic) {
      badges.push({ key: 'technomagic', label: 'Technomagic' });
    }
    if (detail.flags.dunamancy) {
      badges.push({ key: 'dunamancy', label: 'Dunamancy' });
    }
    if (detail.flags.dunamancyGraviturgy) {
      badges.push({ key: 'graviturgy', label: 'Dunamancy: Graviturgy' });
    }
    if (detail.flags.dunamancyChronurgy) {
      badges.push({ key: 'chronurgy', label: 'Dunamancy: Chronurgy' });
    }

    return badges;
  }, [detail]);

  const descriptionBlocks = detail
    ? detail.descriptionBlocks.length > 0
      ? detail.descriptionBlocks
      : toParagraphs(detail.description).map((text) => ({
          type: 'paragraph' as const,
          text
        }))
    : [];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/75 p-4 backdrop-blur-sm md:p-8"
      onMouseDown={closeModal}
    >
      <div className="w-full max-w-5xl" onMouseDown={(event) => event.stopPropagation()}>
        <section className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-4 sm:p-5 md:max-h-[calc(100vh-4rem)]">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Link
              to={`/rules/spells/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
            >
              Open spell in new tab
            </Link>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
              aria-label="Close spell card"
            >
              X
            </button>
          </div>

          {loading ? <p className="text-sm text-slate-300">Loading spell detail...</p> : null}

          {error ? (
            <p className="rounded border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {!loading && !error && !detail ? (
            <div>
              <h2 className="text-xl font-semibold">Spell not found</h2>
              <p className="mt-2 text-sm text-slate-300">
                The requested spell slug does not exist in the built-in pack.
              </p>
            </div>
          ) : null}

          {!loading && !error && detail ? (
            <>
              <h2 className="text-3xl font-semibold tracking-tight">{detail.name}</h2>
              <p className="mt-1 text-sm text-slate-300">Source: {detail.source}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  {detail.levelLabel}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  School: {detail.school}
                </span>
                {flagBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className="rounded-full border border-sky-600/60 bg-sky-950/40 px-3 py-1 text-xs text-sky-200"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Casting Time
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">{detail.castingTime}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Range</dt>
                  <dd className="mt-1 text-sm text-slate-200">{detail.range}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Components
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">{detail.components}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Duration</dt>
                  <dd className="mt-1 text-sm text-slate-200">{detail.duration}</dd>
                </div>
              </dl>

              <section className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Available Classes
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detail.classes.length > 0 ? detail.classes : ['Unknown']).map((className) => (
                    <span
                      key={`${detail.slug}-${className}`}
                      className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200"
                    >
                      {className}
                    </span>
                  ))}
                </div>
              </section>

              <section className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Description
                </h3>
                <SpellDescriptionBlocks
                  keyPrefix={`${detail.slug}-desc`}
                  blocks={descriptionBlocks}
                  currentSlug={detail.slug}
                  linkState={location.state}
                />
              </section>

              {detail.atHigherLevels ? (
                <section className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                    At Higher Levels
                  </h3>
                  <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-200">
                    {toParagraphs(detail.atHigherLevels).map((paragraph, index) => (
                      <p key={`${detail.slug}-higher-${index}`}>
                        {renderSpellTextWithLinks(paragraph, {
                          currentSlug: detail.slug,
                          linkState: location.state
                        })}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
};

