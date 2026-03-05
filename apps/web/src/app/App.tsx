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
              <PlaceholderRoute
                title="Player Tools"
                description="Dice and helper utilities are coming soon. You can still roll in /vtt."
              />
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
