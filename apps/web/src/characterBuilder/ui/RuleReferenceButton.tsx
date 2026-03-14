export const RuleReferenceButton = (props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!props.disabled) {
          props.onClick();
        }
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition ${
        props.disabled
          ? 'cursor-not-allowed border-slate-700 bg-slate-900/40 text-slate-500'
          : 'border-slate-600 bg-slate-900 text-slate-100 hover:border-sky-500 hover:text-sky-200'
      }`}
    >
      i
    </button>
  );
};
