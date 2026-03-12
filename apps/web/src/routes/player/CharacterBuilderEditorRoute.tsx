import { useParams } from 'react-router-dom';

import { CharacterBuilderShell } from '../../characterBuilder/ui/CharacterBuilderShell';

export const CharacterBuilderEditorRoute = () => {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId ?? '';
  return <CharacterBuilderShell characterId={characterId} />;
};

