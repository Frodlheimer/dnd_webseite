import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { characterRepository } from '../../characterBuilder/storage/characterRepository';

export const CharacterBuilderNewRoute = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void characterRepository
      .createCharacter()
      .then((character) => {
        if (!cancelled) {
          navigate(`/player/characters/${character.id}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          navigate('/player/characters', { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
      Creating character...
    </section>
  );
};

