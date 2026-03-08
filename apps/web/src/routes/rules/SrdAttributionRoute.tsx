import { useEffect, useState } from 'react';

import { getSrdAttributionStatement } from '../../rules/srd/api/srdData';

export const SrdAttributionRoute = () => {
  const [statement, setStatement] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSrdAttributionStatement()
      .then((value) => {
        if (!cancelled) {
          setStatement(value);
          setError(null);
        }
      })
      .catch((attributionError) => {
        if (!cancelled) {
          setError(attributionError instanceof Error ? attributionError.message : 'Failed to load attribution.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-100">SRD Attribution</h2>
      <p className="mt-2 text-sm text-slate-300">
        SRD 5.1 content is provided under the Creative Commons Attribution 4.0 International License
        (CC-BY-4.0).
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : (
        <blockquote className="mt-4 rounded-lg border border-slate-700 bg-slate-950/55 p-3 text-sm text-slate-200">
          {statement ||
            'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'}
        </blockquote>
      )}
    </section>
  );
};
