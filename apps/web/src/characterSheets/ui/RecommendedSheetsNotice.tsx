const DMS_GUILD_CLASS_SHEETS_URL =
  'https://www.dmsguild.com/en/product/232835/class-character-sheets-the-bundle';

export const RecommendedSheetsNotice = () => {
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
        Recommended class-specific sheets
      </h3>
      <p className="mt-2 text-sm text-amber-100/90">
        Recommended: For class-specific sheets, we recommend the Class Character Sheets bundle on DMs Guild.
        These sheets are tailored to each class, very practical to use, and can be filled out there and uploaded
        here again. Our importer is compatible with them.
      </p>
      <a
        href={DMS_GUILD_CLASS_SHEETS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex text-sm font-semibold text-amber-200 underline decoration-amber-300/80 underline-offset-2 hover:text-amber-100"
      >
        Open class-specific bundle on DMs Guild
      </a>
    </section>
  );
};
