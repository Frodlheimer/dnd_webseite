import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdMagicItemsListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="magic-items"
      title="Magic Items (SRD)"
      description="Magic Items A-Z from SRD 5.1."
      detailBasePath="/rules/magic-items"
    />
  );
};
