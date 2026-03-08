import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdEquipmentListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="equipment"
      title="Equipment (SRD)"
      description="Weapons, armor, gear, tools, and packs from SRD 5.1."
      detailBasePath="/rules/equipment"
    />
  );
};
