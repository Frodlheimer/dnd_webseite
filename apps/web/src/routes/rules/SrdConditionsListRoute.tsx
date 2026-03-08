import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdConditionsListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="conditions"
      title="Conditions (SRD)"
      description="Appendix PH-A condition references."
      detailBasePath="/rules/conditions"
    />
  );
};
