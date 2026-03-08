import { SrdCategoryListBaseRoute } from '../rules/SrdCategoryListBaseRoute';

export const SrdMonstersListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="monsters"
      title="Monsters (SRD)"
      description="Search and filter SRD monsters. Add entries directly to your local NPC library."
      detailBasePath="/dm/monsters"
      showMonsterFilters
    />
  );
};
