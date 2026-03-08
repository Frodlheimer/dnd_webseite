import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdRacesListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="races"
      title="Races (SRD)"
      description="Core SRD race references."
      detailBasePath="/rules/races"
    />
  );
};
