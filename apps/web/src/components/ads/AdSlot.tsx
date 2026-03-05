type AdSlotVariant = 'hero' | 'rail' | 'footer' | 'inline';

type AdSlotProps = {
  variant?: AdSlotVariant;
};

const variantClassName: Record<AdSlotVariant, string> = {
  hero: 'min-h-20',
  rail: 'min-h-64',
  footer: 'min-h-16',
  inline: 'min-h-16'
};

export const AdSlot = ({ variant = 'inline' }: AdSlotProps) => {
  return (
    <section
      aria-label="Ad placeholder"
      className={`relative overflow-hidden rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 ${variantClassName[variant]}`}
    >
      <span className="absolute right-3 top-3 rounded bg-amber-500/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-950">
        Ad
      </span>
      <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300">
        Advertisement Placeholder
      </p>
      <p className="mt-1 text-xs text-amber-100/90 sm:text-sm">
        Reserved space for future advertising integrations. No external ad network is loaded.
      </p>
    </section>
  );
};
