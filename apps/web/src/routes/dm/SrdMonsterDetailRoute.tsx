import { SrdCategoryDetailBaseRoute } from '../rules/SrdCategoryDetailBaseRoute';

export const SrdMonsterDetailRoute = () => {
  return <SrdCategoryDetailBaseRoute category="monsters" listPath="/dm/monsters" addNpcButton />;
};
