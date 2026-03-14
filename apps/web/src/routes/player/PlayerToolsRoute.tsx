import { useState } from 'react';
import { Link } from 'react-router-dom';

const formatConvertedValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  return value.toFixed(4).replace(/\.?0+$/, '');
};

const parseMeasurement = (value: string): number | null => {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ConversionCard = (props: {
  title: string;
  description: string;
  leftLabel: string;
  rightLabel: string;
  rightPerLeft: number;
}) => {
  const [leftValue, setLeftValue] = useState('');
  const [rightValue, setRightValue] = useState('');

  const syncFromLeft = (nextValue: string) => {
    setLeftValue(nextValue);
    const parsed = parseMeasurement(nextValue);
    setRightValue(parsed === null ? '' : formatConvertedValue(parsed * props.rightPerLeft));
  };

  const syncFromRight = (nextValue: string) => {
    setRightValue(nextValue);
    const parsed = parseMeasurement(nextValue);
    setLeftValue(parsed === null ? '' : formatConvertedValue(parsed / props.rightPerLeft));
  };

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
      <h3 className="text-lg font-semibold text-slate-100">{props.title}</h3>
      <p className="mt-1 text-sm text-slate-300">{props.description}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{props.leftLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            value={leftValue}
            onChange={(event) => syncFromLeft(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-base text-slate-100 outline-none transition focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40"
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{props.rightLabel}</span>
          <input
            type="number"
            inputMode="decimal"
            value={rightValue}
            onChange={(event) => syncFromRight(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-base text-slate-100 outline-none transition focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40"
            placeholder="0"
          />
        </label>
      </div>
    </article>
  );
};

const ToolLinkCard = (props: {
  title: string;
  description: string;
  cta: string;
  to?: string;
  onClick?: () => void;
}) => {
  const classes =
    'group block rounded-2xl border border-slate-800 bg-slate-900/65 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50';

  const content = (
    <>
      <h3 className="text-lg font-semibold tracking-tight text-slate-100">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{props.description}</p>
      <p className="mt-4 text-sm font-semibold text-sky-300 transition group-hover:text-sky-200">
        {props.cta}
      </p>
    </>
  );

  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className={`w-full ${classes}`}>
        {content}
      </button>
    );
  }

  return (
    <Link to={props.to ?? '/player/tools'} className={classes}>
      {content}
    </Link>
  );
};

export const PlayerToolsRoute = () => {
  const [converterOpen, setConverterOpen] = useState(false);

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-sky-300">Player</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Tools</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Open the shared utility tools used around the player experience. Dice stays available as
          its own page, the Point Buy Calculator reuses the full guidance and feat-aware planner,
          and the converter below helps translate common table units quickly.
        </p>
      </header>

      <section className="grid gap-3 lg:grid-cols-3">
        <ToolLinkCard
          title="Dice"
          description="Open the full dice roller with 3D tray, initiative helpers, history, and notation tools."
          to="/dice"
          cta="Open Dice"
        />
        <ToolLinkCard
          title="Point Buy Calculator"
          description="Use the shared point-buy planner with guidance, legacy race mode, background bonuses, ASI, and feat planning."
          to="/player/tools/point-buy"
          cta="Open Point Buy Calculator"
        />
        <ToolLinkCard
          title="Unit Converter"
          description="Convert movement and map units without leaving the page."
          cta="Jump to converter"
          onClick={() => setConverterOpen(true)}
        />
      </section>

      {converterOpen ? (
        <section id="measurement-converter" className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">Unit Converter</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                Feet, meters, inches, centimeters
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Enter a value on either side and the opposite unit updates immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConverterOpen(false)}
              className="rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
            >
              Hide converter
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <ConversionCard
              title="Feet / Meters"
              description="Useful for movement, spell ranges, and map distances."
              leftLabel="Feet"
              rightLabel="Meters"
              rightPerLeft={0.3048}
            />
            <ConversionCard
              title="Inches / Centimeters"
              description="Useful for print sizes, sheet references, and small object dimensions."
              leftLabel="Inches"
              rightLabel="Centimeters"
              rightPerLeft={2.54}
            />
            <ConversionCard
              title="Pounds / Kilograms"
              description="Useful for carrying capacity and item weight references."
              leftLabel="Pounds"
              rightLabel="Kilograms"
              rightPerLeft={0.45359237}
            />
          </div>
        </section>
      ) : null}
    </section>
  );
};
