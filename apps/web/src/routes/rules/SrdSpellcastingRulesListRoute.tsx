import { SrdCategoryListBaseRoute } from './SrdCategoryListBaseRoute';

export const SrdSpellcastingRulesListRoute = () => {
  return (
    <SrdCategoryListBaseRoute
      category="spellcasting"
      title="Spellcasting Rules (SRD)"
      description="General spellcasting rules, components, duration, and targets."
      detailBasePath="/rules/spellcasting"
    />
  );
};
