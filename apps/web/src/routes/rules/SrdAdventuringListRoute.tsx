import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdAdventuringListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="adventuring"
      title="Adventuring (SRD)"
      description="Travel, movement, rests, and exploration rules."
      detailBasePath="/rules/adventuring"
    />
  );
};
