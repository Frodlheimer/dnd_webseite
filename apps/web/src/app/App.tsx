import { Suspense, lazy } from 'react';
import type { Location } from 'react-router-dom';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';

import { LandingRoute } from '../routes/LandingRoute';
import { LoginRoute } from '../routes/LoginRoute';
import { PlaceholderRoute } from '../routes/PlaceholderRoute';
import { DmHubRoute } from '../routes/dm/DmHubRoute';
import { PlayerHubRoute } from '../routes/player/PlayerHubRoute';
import { PlayerJoinRoute } from '../routes/player/PlayerJoinRoute';
import { OogLayout } from '../oog/OogLayout';

const VttRoute = lazy(async () => {
  const module = await import('../routes/VttRoute');
  return {
    default: module.VttRoute
  };
});

const BattlemapSandboxRoute = lazy(async () => {
  const module = await import('../routes/BattlemapSandboxRoute');
  return {
    default: module.BattlemapSandboxRoute
  };
});

const RulesRoute = lazy(async () => {
  const module = await import('../routes/rules/RulesRoute');
  return {
    default: module.RulesRoute
  };
});

const SpellsListRoute = lazy(async () => {
  const module = await import('../routes/rules/SpellsListRoute');
  return {
    default: module.SpellsListRoute
  };
});

const SpellDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SpellDetailRoute');
  return {
    default: module.SpellDetailRoute
  };
});

const SpellDetailModalRoute = lazy(async () => {
  const module = await import('../routes/rules/SpellDetailModalRoute');
  return {
    default: module.SpellDetailModalRoute
  };
});

const ClassesListRoute = lazy(async () => {
  const module = await import('../routes/rules/ClassesListRoute');
  return {
    default: module.ClassesListRoute
  };
});

const ClassDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/ClassDetailRoute');
  return {
    default: module.ClassDetailRoute
  };
});

const SubclassDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SubclassDetailRoute');
  return {
    default: module.SubclassDetailRoute
  };
});

const LineagesListRoute = lazy(async () => {
  const module = await import('../routes/rules/LineagesListRoute');
  return {
    default: module.LineagesListRoute
  };
});

const LineageDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/LineageDetailRoute');
  return {
    default: module.LineageDetailRoute
  };
});

const FeatsListRoute = lazy(async () => {
  const module = await import('../routes/rules/FeatsListRoute');
  return {
    default: module.FeatsListRoute
  };
});

const FeatDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/FeatDetailRoute');
  return {
    default: module.FeatDetailRoute
  };
});

const SrdRacesListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdRacesListRoute');
  return {
    default: module.SrdRacesListRoute
  };
});

const SrdRaceDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdRaceDetailRoute');
  return {
    default: module.SrdRaceDetailRoute
  };
});

const BackgroundsListRoute = lazy(async () => {
  const module = await import('../routes/rules/BackgroundsListRoute');
  return {
    default: module.BackgroundsListRoute
  };
});

const BackgroundDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/BackgroundDetailRoute');
  return {
    default: module.BackgroundDetailRoute
  };
});

const SrdEquipmentListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdEquipmentListRoute');
  return {
    default: module.SrdEquipmentListRoute
  };
});

const SrdEquipmentDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdEquipmentDetailRoute');
  return {
    default: module.SrdEquipmentDetailRoute
  };
});

const SrdConditionsListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdConditionsListRoute');
  return {
    default: module.SrdConditionsListRoute
  };
});

const SrdConditionDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdConditionDetailRoute');
  return {
    default: module.SrdConditionDetailRoute
  };
});

const SrdMagicItemsListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdMagicItemsListRoute');
  return {
    default: module.SrdMagicItemsListRoute
  };
});

const SrdMagicItemDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdMagicItemDetailRoute');
  return {
    default: module.SrdMagicItemDetailRoute
  };
});

const SrdAdventuringListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdAdventuringListRoute');
  return {
    default: module.SrdAdventuringListRoute
  };
});

const SrdAdventuringDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdAdventuringDetailRoute');
  return {
    default: module.SrdAdventuringDetailRoute
  };
});

const SrdCombatListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdCombatListRoute');
  return {
    default: module.SrdCombatListRoute
  };
});

const SrdCombatDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdCombatDetailRoute');
  return {
    default: module.SrdCombatDetailRoute
  };
});

const SrdSpellcastingRulesListRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdSpellcastingRulesListRoute');
  return {
    default: module.SrdSpellcastingRulesListRoute
  };
});

const SrdSpellcastingRulesDetailRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdSpellcastingRulesDetailRoute');
  return {
    default: module.SrdSpellcastingRulesDetailRoute
  };
});

const SrdAttributionRoute = lazy(async () => {
  const module = await import('../routes/rules/SrdAttributionRoute');
  return {
    default: module.SrdAttributionRoute
  };
});

const SrdMonstersListRoute = lazy(async () => {
  const module = await import('../routes/dm/SrdMonstersListRoute');
  return {
    default: module.SrdMonstersListRoute
  };
});

const SrdMonsterDetailRoute = lazy(async () => {
  const module = await import('../routes/dm/SrdMonsterDetailRoute');
  return {
    default: module.SrdMonsterDetailRoute
  };
});

const CharacterBuilderRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderRoute');
  return {
    default: module.CharacterBuilderRoute
  };
});

const CharacterBuilderHomeRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderHomeRoute');
  return {
    default: module.CharacterBuilderHomeRoute
  };
});

const CharacterBuilderListRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderListRoute');
  return {
    default: module.CharacterBuilderListRoute
  };
});

const CharacterBuilderNewRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderNewRoute');
  return {
    default: module.CharacterBuilderNewRoute
  };
});

const CharacterBuilderEditorRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderEditorRoute');
  return {
    default: module.CharacterBuilderEditorRoute
  };
});

const CharacterBuilderReviewRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterBuilderReviewRoute');
  return {
    default: module.CharacterBuilderReviewRoute
  };
});

const PointBuyRoute = lazy(async () => {
  const module = await import('../routes/player/PointBuyRoute');
  return {
    default: module.PointBuyRoute
  };
});

const PlayerToolsRoute = lazy(async () => {
  const module = await import('../routes/player/PlayerToolsRoute');
  return {
    default: module.PlayerToolsRoute
  };
});

const CharacterSheetsHubRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterSheetsHubRoute');
  return {
    default: module.CharacterSheetsHubRoute
  };
});

const CharacterSheetEditorRoute = lazy(async () => {
  const module = await import('../routes/player/CharacterSheetEditorRoute');
  return {
    default: module.CharacterSheetEditorRoute
  };
});

const DiceRoute = lazy(async () => {
  const module = await import('../routes/DiceRoute');
  return {
    default: module.DiceRoute
  };
});

const LoadingVttFallback = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <p className="text-sm uppercase tracking-wide text-slate-400">Loading VTT...</p>
    </main>
  );
};

const LoadingSandboxFallback = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <p className="text-sm uppercase tracking-wide text-slate-400">Loading battlemap sandbox...</p>
    </main>
  );
};

const LoadingRulesFallback = () => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
      Loading rules...
    </section>
  );
};

const LoadingCharacterBuilderFallback = () => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
      Loading character builder...
    </section>
  );
};

const LoadingDiceFallback = () => {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm text-slate-300">
      Loading dice tools...
    </section>
  );
};

const LegacySpellDetailRedirect = () => {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';
  return <Navigate to={`/rules/spells/${slug}`} replace />;
};

const LegacyClassDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/classes/${id}`} replace />;
};

const LegacySubclassDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/subclasses/${id}`} replace />;
};

const LegacyLineageDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/lineages/${id}`} replace />;
};

const LegacyRaceDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/races/${id}`} replace />;
};

const LegacyBackgroundDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/backgrounds/${id}`} replace />;
};

const LegacyFeatDetailRedirect = () => {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  return <Navigate to={`/rules/feats/${id}`} replace />;
};

const AppRoutes = () => {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<OogLayout />}>
          <Route index element={<LandingRoute />} />
          <Route path="player" element={<PlayerHubRoute />} />
          <Route path="player/join" element={<PlayerJoinRoute />} />
          <Route
            path="player/characters"
            element={
              <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                <CharacterBuilderRoute />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterBuilderHomeRoute />
                </Suspense>
              }
            />
            <Route
              path="list"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterBuilderListRoute />
                </Suspense>
              }
            />
            <Route
              path="new"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterBuilderNewRoute />
                </Suspense>
              }
            />
            <Route
              path=":characterId"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterBuilderEditorRoute />
                </Suspense>
              }
            />
            <Route
              path=":characterId/review"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterBuilderReviewRoute />
                </Suspense>
              }
            />
            <Route
              path="point-buy"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <PointBuyRoute />
                </Suspense>
              }
            />
            <Route
              path="sheets"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterSheetsHubRoute />
                </Suspense>
              }
            />
            <Route
              path="sheets/:templateId"
              element={
                <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                  <CharacterSheetEditorRoute />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="player/notes"
            element={
              <PlaceholderRoute
                title="Player Notes"
                description="Campaign note management is coming soon. Use /vtt for in-game notes."
              />
            }
          />
          <Route
            path="player/tools"
            element={
              <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                <PlayerToolsRoute />
              </Suspense>
            }
          />
          <Route path="player/tools/dice" element={<Navigate to="/dice" replace />} />
          <Route
            path="player/tools/point-buy"
            element={
              <Suspense fallback={<LoadingCharacterBuilderFallback />}>
                <PointBuyRoute />
              </Suspense>
            }
          />
          <Route path="dm" element={<DmHubRoute />} />
          <Route
            path="dm/session"
            element={
              <PlaceholderRoute
                title="Session Workspace"
                description="The dedicated DM session workspace is coming soon."
              />
            }
          />
          <Route
            path="dm/maps"
            element={
              <PlaceholderRoute
                title="Maps & Scenes"
                description="Advanced map library tools are coming soon."
              />
            }
          />
          <Route
            path="dm/npcs"
            element={
              <PlaceholderRoute
                title="NPC Library"
                description="NPC templates and management are coming soon."
              />
            }
          />
          <Route
            path="dm/monsters"
            element={
              <Suspense fallback={<LoadingRulesFallback />}>
                <SrdMonstersListRoute />
              </Suspense>
            }
          />
          <Route
            path="dm/monsters/:id"
            element={
              <Suspense fallback={<LoadingRulesFallback />}>
                <SrdMonsterDetailRoute />
              </Suspense>
            }
          />
          <Route
            path="dm/encounters"
            element={
              <PlaceholderRoute
                title="Encounters"
                description="Encounter planning tools are coming soon."
              />
            }
          />
          <Route
            path="dm/notes"
            element={
              <PlaceholderRoute
                title="DM Notes"
                description="Private DM note workflows are coming soon."
              />
            }
          />
          <Route
            path="dm/audio"
            element={
              <PlaceholderRoute
                title="Audio"
                description="Audio and ambience controls are coming soon."
              />
            }
          />
          <Route
            path="dm/backups"
            element={
              <PlaceholderRoute
                title="Backups"
                description="DM backup management is coming soon."
              />
            }
          />
          <Route path="dm/tools/dice" element={<Navigate to="/dice" replace />} />
          <Route
            path="dice"
            element={
              <Suspense fallback={<LoadingDiceFallback />}>
                <DiceRoute />
              </Suspense>
            }
          />
          <Route
            path="help"
            element={
              <PlaceholderRoute
                title="Help"
                description="Guides and support content are coming soon. For now, open /vtt to start playing."
              />
            }
          />
          <Route
            path="rules"
            element={
              <Suspense fallback={<LoadingRulesFallback />}>
                <RulesRoute />
              </Suspense>
            }
          >
            <Route index element={<Navigate to="spells" replace />} />
            <Route
              path="spells"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SpellsListRoute />
                </Suspense>
              }
            />
            <Route
              path="spells/:slug"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SpellDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="classes"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <ClassesListRoute />
                </Suspense>
              }
            />
            <Route
              path="classes/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <ClassDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="subclasses/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SubclassDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="lineages"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <LineagesListRoute />
                </Suspense>
              }
            />
            <Route
              path="lineages/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <LineageDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="feats"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <FeatsListRoute />
                </Suspense>
              }
            />
            <Route
              path="feats/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <FeatDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="races"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdRacesListRoute />
                </Suspense>
              }
            />
            <Route
              path="races/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdRaceDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="backgrounds"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <BackgroundsListRoute />
                </Suspense>
              }
            />
            <Route
              path="backgrounds/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <BackgroundDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="equipment"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdEquipmentListRoute />
                </Suspense>
              }
            />
            <Route
              path="equipment/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdEquipmentDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="conditions"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdConditionsListRoute />
                </Suspense>
              }
            />
            <Route
              path="conditions/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdConditionDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="magic-items"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdMagicItemsListRoute />
                </Suspense>
              }
            />
            <Route
              path="magic-items/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdMagicItemDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="adventuring"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdAdventuringListRoute />
                </Suspense>
              }
            />
            <Route
              path="adventuring/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdAdventuringDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="combat"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdCombatListRoute />
                </Suspense>
              }
            />
            <Route
              path="combat/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdCombatDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="spellcasting"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdSpellcastingRulesListRoute />
                </Suspense>
              }
            />
            <Route
              path="spellcasting/:id"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdSpellcastingRulesDetailRoute />
                </Suspense>
              }
            />
            <Route
              path="srd-attribution"
              element={
                <Suspense fallback={<LoadingRulesFallback />}>
                  <SrdAttributionRoute />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="feedback"
            element={
              <PlaceholderRoute
                title="Feedback"
                description="Feedback workflow is coming soon. Thanks for testing."
              />
            }
          />
          <Route
            path="imprint"
            element={
              <PlaceholderRoute title="Imprint" description="Legal information is coming soon." />
            }
          />
          <Route path="login" element={<LoginRoute />} />
        </Route>
        <Route
          path="/vtt"
          element={
            <Suspense fallback={<LoadingVttFallback />}>
              <VttRoute />
            </Suspense>
          }
        />
        <Route
          path="/battlemap-oog"
          element={
            <Suspense fallback={<LoadingSandboxFallback />}>
              <BattlemapSandboxRoute />
            </Suspense>
          }
        />
        <Route path="/spells" element={<Navigate to="/rules/spells" replace />} />
        <Route path="/spells/:slug" element={<LegacySpellDetailRedirect />} />
        <Route path="/classes" element={<Navigate to="/rules/classes" replace />} />
        <Route path="/class/:id" element={<LegacyClassDetailRedirect />} />
        <Route path="/subclass/:id" element={<LegacySubclassDetailRedirect />} />
        <Route path="/lineages" element={<Navigate to="/rules/lineages" replace />} />
        <Route path="/lineages/:id" element={<LegacyLineageDetailRedirect />} />
        <Route path="/races" element={<Navigate to="/rules/races" replace />} />
        <Route path="/races/:id" element={<LegacyRaceDetailRedirect />} />
        <Route path="/backgrounds" element={<Navigate to="/rules/backgrounds" replace />} />
        <Route path="/background/:id" element={<LegacyBackgroundDetailRedirect />} />
        <Route path="/equipment" element={<Navigate to="/rules/equipment" replace />} />
        <Route path="/conditions" element={<Navigate to="/rules/conditions" replace />} />
        <Route path="/magic-items" element={<Navigate to="/rules/magic-items" replace />} />
        <Route path="/adventuring" element={<Navigate to="/rules/adventuring" replace />} />
        <Route path="/combat" element={<Navigate to="/rules/combat" replace />} />
        <Route path="/spellcasting" element={<Navigate to="/rules/spellcasting" replace />} />
        <Route path="/feats" element={<Navigate to="/rules/feats" replace />} />
        <Route path="/feats/:id" element={<LegacyFeatDetailRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {backgroundLocation ? (
        <Routes>
          <Route
            path="/rules/spells/:slug"
            element={
              <Suspense fallback={null}>
                <SpellDetailModalRoute />
              </Suspense>
            }
          />
        </Routes>
      ) : null}
    </>
  );
};

export const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};
