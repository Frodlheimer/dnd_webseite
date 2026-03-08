import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdCombatListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="combat"
      title="Combat (SRD)"
      description="Turn structure, actions, attacks, damage, and mounted combat."
      detailBasePath="/rules/combat"
    />
  );
};
