# D&D VTT Monorepo (Stand: 2026-03-03)

Dieses README dokumentiert den aktuellen Code-Stand des gesamten Repositories:

- Tech Stack
- Architektur und Datenfluss
- alle wichtigen Features im Code
- alle relevanten Dateien
- Build-/Test-/Smoke-Test-Workflow

## README-Pflichtprozess (ab sofort verbindlich)

Bei jeder Codeaenderung gilt:

1. Dieses README vor der Aenderung lesen.
2. README im selben Branch/PR mit aktualisieren, wenn sich etwas an Features, Contracts, Scripts, Tests, Storage, DB, Dateistruktur oder Betrieb aendert.
3. Smoke-Tests (`pnpm health`, `pnpm ws:test`) und passende Unit-Tests ausfuehren oder begruenden, warum nicht.
4. Fuer LOCAL-Haertung regelmaessig `pnpm local:audit` ausfuehren.
5. Keine Aenderung gilt als fertig, wenn README und Tests nicht mitgezogen wurden.

Empfohlene Commit-Checkliste:

- [ ] README gelesen
- [ ] README aktualisiert
- [ ] relevante Tests ausgefuehrt
- [ ] Smoke-Tests geprueft
- [ ] `pnpm local:audit` geprueft (bei LOCAL-Aenderungen)

## Produktstatus und Funktionsumfang

### Kernfunktionen

- Room erstellen (`POST /rooms`) und joinen (`POST /rooms/join`) mit Rollen `DM`, `PLAYER`, `SPECTATOR`
- Realtime Presence (online Mitglieder + Host-Status)
- Realtime Token-Lifecycle:
  - Create
  - Move
  - Update (inkl. Name, Farbe, Elevation, Bild-Framing)
  - Delete
- Battlemap-Verwaltung:
  - Upload
  - Asset-Liste
  - aktive Map setzen
  - Realtime Broadcast bei Mapwechsel
- Realtime Map-Editing mit Operationen:
  - `UPSERT`, `DELETE`, `CLEAR`
  - Tools: Zeichnen, Eraser, Linie, Rechteck, Ellipse, Text, Bild, Objektbibliothek
- Realtime Chat im LOCAL-Modus:
  - Public Room-Chat (alle Mitglieder)
  - Whisper vom DM an einzelne oder mehrere Empfaenger
  - optionale DM-Notizen (nur DM sichtbar)
  - Dateianhaenge (Bilder + Dokumente, size-limitiert pro Nachricht, Bytes via WebRTC P2P on-demand)
  - HTTP/HTTPS Links im Chat sind klickbar und oeffnen in neuem Tab
- Stats & Rules -> Spells (OOG, client-only):
  - Route `\/rules\/spells` mit integrierter Spell-Tabelle und Detailseiten
  - Linksklick auf einen Spell oeffnet Detail als Overlay-Karte (kein Seitenwechsel)
  - `Esc` oder `X` schliesst die Karte und behaelt Scrollposition + aktive Filter bei
  - Option `Open spell in new tab`; Middle Click auf Spell-Link oeffnet ebenfalls neuen Tab
  - Build-Time Tabellen-Wiederherstellung fuer bekannte kaputte TXT-Tabellen (z. B. `animate-objects`, `teleport`, `reincarnate`)
  - Spell-Referenzen in Description/Tabellen/At-Higher-Levels werden automatisch als interne Links gerendert
  - keine Import-UI und keine API-Endpoints fuer Spells
  - Datensatz wird zur Build-Zeit aus `dnd5e_spells.txt` in den Web-Bundle generiert
  - sehr schnelle Filterung per Web Worker + voraggregierten Tag-Bitsets
  - Filter in der Liste: Name, Klassen, Level, Schools, Flags, Konzentration (Ja/Nein), Zieltyp (Area/Single/Self)
  - Flags/Legende in der Liste:
    - `^R` Ritual
    - `^D` Dunamancy
    - `^DG` Graviturgy Dunamancy
    - `^DC` Chronurgy Dunamancy
    - `^T` Technomagic
- Stats & Rules -> Classes & Subclasses (OOG, client-only):
  - Routes `\/rules\/classes`, `\/rules\/classes\/:id`, `\/rules\/subclasses\/:id`
  - Datensatz wird zur Build-Zeit aus `dnd5e_classes_subclasses.txt` erzeugt (kein Runtime-TXT-Parsing)
  - Build erzeugt kleinen Index + statische Detail-JSONs:
    - `apps\/web\/src\/rules\/classes\/generated\/classesIndex.ts`
    - `apps\/web\/public\/rules\/classes\/entries\/<id>.json`
  - Worker-basierte Sofortfilterung (Name, Kind, Class, Tags) mit voraggregierten Tag-Bitsets
  - Detailansicht rendert strukturierte Dokument-Bloecke (Heading, Paragraph, List, Table, Pre)
  - Builder-friendly Extracted Data im Pack:
    - `spellSlotsByLevel`, `featuresByLevel`, `progressionByLevel`, `grantedSpellRefs`
  - strikte Link-Sanitisierung:
    - alle `wikidot`-Links/URLs werden beim Build entfernt
    - Headerfeld `URL:` wird nicht gespeichert/angezeigt
  - keine API-Endpunkte, nur statische Files
- Character Builder -> Character Sheets (OOG, client-only):
  - Route `\/player\/characters\/sheets` listet eingebaute PDF-Templates (General + Klassen)
  - Build-Time Generator extrahiert AcroForm-Widget-Felder aus lokalen PDFs in JSON Templates
  - Editor `\/player\/characters\/sheets\/:templateId`:
    - exakte Overlay-Eingaben anhand PDF-Koordinaten (Blank-Page Basis)
    - optionales `Show PDF background` (pdfjs im Browser, lazy geladen)
    - Zoom + Seitennavigation
    - Autosave lokal in IndexedDB (`dnd-vtt-character-sheets-v1`)
  - Export:
    - `Download PDF` fuellt das Original-Template clientseitig mit `pdf-lib`
  - Import:
    - `Import filled PDF` liest Feldwerte clientseitig, matched Template per Feldnamen-Overlap und oeffnet Editor mit Werten
  - keine Server-Endpunkte, keine Server-Last fuer Character Sheets
- Neue Landing/Home als Hub:
  - OOG Layout mit Header (Logo, Global Search, Login Placeholder), Footer und Ad-Placeholder Slots
  - Primary CTA `Resume` (oeffnet `/vtt`) + `Join Session` (`/player/join`)
  - zwei grosse Rollen-Cards (`Player`, `Dungeon Master`) mit Mini-Pixi Hover/Focus/Tap Szenen
  - Mini-Pixi auf Landing wird lazy initialisiert (sichtbar/interagiert) und respektiert `prefers-reduced-motion`
  - Player Hub (`/player`) und DM Hub (`/dm`) mit eigenen Tool-Karten
  - Search Palette (`Ctrl/Cmd+K`) wird per Portal ueber allen Layern gerendert (auch ueber Ad-Placeholdern)
  - Landing ist fuer typische Querformat-Viewports komprimiert, damit der aktuelle Inhaltsumfang ohne Scrollen sichtbar bleibt
  - globale Suche (`Ctrl/Cmd+K`) nur lokal:
    - Navigation-Ziele
    - Quick Actions
    - lokale Recent Rooms aus IndexedDB Snapshots (keine Server Calls)

### LOCAL-Modus (aktuell Standard in UI)

- Server ist Relay/Signaling, Room-State wird vom Host (DM) gefuehrt.
- Server haelt/verarbeitet/liefert in LOCAL keinen Game-State fuer Tokens/Settings/Map/MapEdit/Assets aus.
- Host-Authoritaet fuer Token, Settings, aktive Map und Map-Edit-Operationen.
- Runtime Guardrail `LOCAL_STRICT`: verbietet DB-State-Zugriffe in LOCAL fail-fast (`LOCAL_MODE_DB_ACCESS_FORBIDDEN`).
- Non-Host Clients in LOCAL arbeiten fuer Game-State-Aktionen nicht optimistisch (Anzeige erst nach Host-Event/Direct).
- Bei ausbleibender Host-Bestaetigung zeigt der Client erst bei deutlich hoher Verzoegerung (>5s) einen Hinweis an.
- Snapshot-basierte Host-Synchronisierung fuer neue/neu verbundene Clients.
- Chat/Whisper-Historie im Host-Snapshot (mit Empfaenger-Filter pro Client beim Snapshot-Versand).
- Asset-Nachladung Host -> Client via Chunk-Streaming (`ASSET_REQUEST`/`ASSET_CHUNK`).
- Chat-Dateien in LOCAL: Snapshot/Events enthalten nur Attachment-Metadaten + SHA-256 (`hash,name,mime,size,seedUserId`), Transfer-Bytes laufen nur ueber WebRTC DataChannel.
- WS in LOCAL relayed fuer Chat-Dateien nur Signaling (`FILE_REQUEST`, `FILE_SIGNAL`, `FILE_CANCEL`), keine Datei-Bytes.
- Persistenz im Browser via IndexedDB:
  - Snapshot
  - Assets
  - Room-Asset-Referenzen
- Session Export/Import als `.dndvtt.json` Bundle.
- Optionales Auto-Export Intervall (inkl. Directory Picker, falls Browser unterstuetzt).

### CLOUD-Modus (teilweise vorbereitet)

- API/Contracts/Prisma enthalten `storageMode=CLOUD`.
- Serverseitige Token/Settings/Asset-Endpunkte aktiv fuer CLOUD Rooms.
- UI zeigt CLOUD im Create-Dialog aktuell als `coming soon` (disabled).

### UI-/Board-Features aus dem aktuellen Code

- Rechte-/Policy-Steuerung im UI:
  - `tokenMovePolicy` (`ALL`, `OWNED_ONLY`, `DM_ONLY`)
  - `tokenEditPolicy` (LOCAL)
  - `mapEditPolicy` + per-member Overrides
- Board-Konfiguration:
  - Grid `SQUARE`/`HEX`
  - Cell Size/Distance/Unit
  - Grid Origin X/Y/Z
  - Snap-to-Grid
  - Stack Display (`FAN`/`EXACT`)
  - Map Transform (Offset/Scale/Rotation)
  - Grid Calibration per 2 Klickpunkte
- Token UX:
  - Kontextmenue (Create/Edit/Delete)
  - Drag-Move mit Throttling
  - Edit-Modal mit Bildframing (Offset/Scale/Rotation)
  - Elevation-Anzeige + Stack-Fan Darstellung
- Map Edit UX:
  - Tools: Pan, Pan Map, Select, Draw, Erase, Line, Rect, Ellipse, Image, Object, Text
  - Undo/Redo, Clear All
  - Shortcut: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` (bzw. `Shift+Ctrl/Cmd+Z`)
  - Tool-spezifische Hinweise und Cursor-Logik
  - Text-Editor Overlay (dragbar, `Ctrl/Cmd+Enter` fuer Apply)
  - Objektbibliothek mit lokalen Custom-Objekten in LocalStorage
- Chat UX:
  - rechter Sidebar-Bereich fuer Chat
  - Enter sendet, Shift+Enter fuer Zeilenumbruch
  - DM Compose-Mode `PUBLIC` / `WHISPER` / `DM_NOTE`
  - Whisper-Empfaenger Multi-Select (DM)
  - Datei-Upload im Chat (Bilder/Dokumente, lokal gehasht + in IndexedDB gespeichert)
  - Attachment-Status (`available`, `not downloaded`, `downloading`, `failed`) mit On-Demand-Download
  - Nachrichten-Text mit klickbaren Links (`target="_blank"`)

## Tech Stack

- Monorepo: `pnpm workspaces` + `turborepo`
- Sprache: TypeScript (strict)
- Frontend: React 19, Vite 6, Tailwind 3, Zustand, PixiJS
- Backend: Fastify 5, `@fastify/websocket`, `@fastify/multipart`, CORS
- Validation/Contracts: Zod (`packages/shared`)
- Datenbank: PostgreSQL 16 + Prisma
- Lokale Persistenz (Browser): IndexedDB via `idb`
- Tests:
  - Vitest (API, Web, Shared)
  - `ws` client fuer API Smoke Script
- Tooling: ESLint 9, Prettier 3

## Frontend Routing

- OOG (Out-of-game):
  - `/` = Landing/Home Hub
  - `/player` = Player Hub
  - `/player/join` = Join Formular (Join-Code, Display Name, Role)
  - `/player/characters` = Character Builder Hub (Builder + Character Sheets)
  - `/player/characters/sheets` = Character Sheets Template Hub
  - `/player/characters/sheets/:templateId` = Character Sheet Editor
  - `/player/notes`, `/player/tools` = Placeholder
  - `/dm` = DM Hub
  - `/dm/session`, `/dm/maps`, `/dm/npcs`, `/dm/encounters`, `/dm/notes`, `/dm/audio`, `/dm/backups` = Placeholder
  - `/help`, `/feedback`, `/imprint`, `/login` = Placeholder/Info-Seiten
  - `/rules` = Stats & Rules Layout (linke Navigation)
  - `/rules/spells` = Spells Liste
  - `/rules/spells/:slug` = Spell Detail
  - `/rules/classes` = Classes/Subclasses Liste
  - `/rules/classes/:id` = Class Detail
  - `/rules/subclasses/:id` = Subclass Detail
- IN-GAME:
  - `/vtt` = bestehende VTT UI (`AppShell`, Create/Join + Board), per Route Lazy-Load
- TESTING:
  - `/battlemap-oog` = leere Out-of-Game Battlemap Sandbox (kein Room-Create/Join, nur lokales Testen)
- Legacy Redirects:
  - `/spells` -> `/rules/spells`
  - `/spells/:slug` -> `/rules/spells/:slug`
  - `/classes` -> `/rules/classes`
  - `/class/:id` -> `/rules/classes/:id`
  - `/subclass/:id` -> `/rules/subclasses/:id`
- Join-Link-Verhalten:
  - `/?join=CODE` leitet auf `/player/join?join=CODE` weiter
  - `/player/join` navigiert mit Join-Daten nach `/vtt?join=CODE&name=...&role=...`
  - `/vtt?join=CODE` bleibt weiterhin kompatibel und befuellt den Join-Code im VTT-Join-Formular
- Produktverknuepfung:
  - `Resume` auf Landing und Hubs oeffnet aktuell immer `/vtt` (vorerst keine echte Last-Session-Logik)
  - Landing hat zusaetzlich `Battlemap (Out-of-Game)` als separaten Test-Einstieg auf `/battlemap-oog`

## Repository-Dateiindex (vollstaendig)

### Root

- `.editorconfig` - Editor-Regeln (UTF-8, LF, 2 Spaces, etc.)
- `.gitignore` - Ignore-Regeln
- `.prettierignore` - Prettier Ignore
- `.prettierrc.json` - Prettier Konfiguration
- `README.md` - diese Projektdokumentation
- `docker-compose.yml` - lokaler Postgres Service
- `eslint.config.mjs` - zentraler ESLint-Setup
- `package.json` - Root Scripts und Tooling
- `scripts/local-audit.mjs` - kombiniert Test + Smoke + statische LOCAL-Hinweise
- `pnpm-lock.yaml` - Lockfile
- `pnpm-workspace.yaml` - Workspace-Definition (`apps/*`, `packages/*`)
- `tsconfig.base.json` - gemeinsame TS-Basis
- `turbo.json` - Turborepo Task-Pipeline

### `apps/api`

Konfiguration:

- `apps/api/.env.example` - API Env Variablen (`PORT`, `WS_URL`, `DATABASE_URL`, `LOCAL_STRICT`)
- `apps/api/package.json` - API Scripts/Dependencies
- `apps/api/tsconfig.json` - TS Setup (inkl. Tests)
- `apps/api/tsconfig.build.json` - Build-TS Setup
- `apps/api/vitest.config.ts` - Vitest Setup

Prisma:

- `apps/api/prisma/schema.prisma` - DB Schema (User/Room/Token/Assets/Settings/Snapshots/Events)
- `apps/api/prisma/migrations/20260228211000_room_presence_tokens/migration.sql` - Basis-Schema
- `apps/api/prisma/migrations/20260301113000_assets_current_map/migration.sql` - Assets + aktuelle Map
- `apps/api/prisma/migrations/20260302083000_map_edit_permissions/migration.sql` - Map-Edit Policies/Overrides
- `apps/api/prisma/migrations/20260302150000_room_storage_mode/migration.sql` - `StorageMode`

Scripts:

- `apps/api/scripts/health-check.ts` - HTTP Health + WS Smoke kombiniertes CLI
- `apps/api/scripts/ws-smoke-test.ts` - WebSocket Handshake Smoke CLI

Source:

- `apps/api/src/index.ts` - API Bootstrap
- `apps/api/src/server.ts` - Fastify Build + Plugin Registration
- `apps/api/src/db/prisma.ts` - Prisma Client Singleton
- `apps/api/src/auth/index.ts` - Auth-Context Placeholder (Guest-only)

Assets:

- `apps/api/src/assets/model.ts` - Asset Mappings/Upload Dir
- `apps/api/src/assets/validation.ts` - Upload Validierung (MIME, Size, Type)
- `apps/api/src/assets/service.ts` - Asset Persistenz und Query Services

Rooms/Routes:

- `apps/api/src/rooms/service.ts` - zentrale Room/Token/Settings/Map Services
- `apps/api/src/rooms/localStrict.ts` - LOCAL_STRICT Guardrails fuer verbotene DB-State-Zugriffe
- `apps/api/src/routes/health.ts` - `GET /health`
- `apps/api/src/routes/rooms.ts` - Room APIs + Map API + Asset-List API
- `apps/api/src/routes/assets.ts` - Upload + Asset Download

WebSocket:

- `apps/api/src/ws/index.ts` - WS Endpoint, Sessionhandling, Message Routing, MapEdit-State (CLOUD only)
- `apps/api/src/ws/protocol.ts` - Message Parse/Serialize Helpers
- `apps/api/src/ws/authz.ts` - Authorisierungsregeln (Token/Map/Settings/MapEdit)
- `apps/api/src/ws/limits.ts` - Message Size + Rate Limiter
- `apps/api/src/ws/presence-registry.ts` - Online-Tracking pro Room/User
- `apps/api/src/ws/localRelay.ts` - LOCAL Relay Routing Regeln
- `apps/api/src/ws/room-events.ts` - interner Event-Bus fuer Room Map/Asset Broadcasts

Tests:

- `apps/api/tests/health.test.ts` - Health Route
- `apps/api/tests/ws-protocol.test.ts` - WS Contract Parse/Serialize
- `apps/api/tests/ws-limits.test.ts` - Rate/Size Limits
- `apps/api/tests/ws-local-relay.test.ts` - LOCAL Relay Verhalten
- `apps/api/tests/ws-local-hardening.test.ts` - LOCAL WELCOME minimal + direkte State-Message Rejection
- `apps/api/tests/token-authz.test.ts` - Authz Policy Tests
- `apps/api/tests/assets-upload-validation.test.ts` - Upload Validierung
- `apps/api/tests/rooms-local-http.test.ts` - LOCAL HTTP Payload-Minimierung + `/rooms/:id/state` Rejection
- `apps/api/tests/local-strict-guard.test.ts` - Fail-fast Guard Test fuer LOCAL_STRICT

Runtime Upload-Verzeichnis (lokale Dateien):

- `apps/api/uploads/004058cd-a9d4-40d3-8349-632b38eaa465.png`
- `apps/api/uploads/0d8d2cf9-77de-424a-9277-78b0f891a1f8.webp`
- `apps/api/uploads/1af46364-048d-4d64-9975-70f435858b0f.png`
- `apps/api/uploads/23c0f0b4-8d0e-4c40-a5db-377922f7d774.png`
- `apps/api/uploads/3b0a31a5-5119-46d0-920b-91816b706c38.png`
- `apps/api/uploads/60e5c069-b764-47df-9717-216d9ad51f1f.png`
- `apps/api/uploads/7baca96e-84bb-45cb-b791-1d6c5b40d976.jpg`
- `apps/api/uploads/8b8e0faf-a651-413e-8f2c-f416f082851c.webp`
- `apps/api/uploads/bcc2a085-6ebb-426a-8c06-89b72594c11f.png`
- `apps/api/uploads/e867ec33-424c-4555-b903-e7d1ece24aef.jpg`

### `apps/web`

Konfiguration:

- `apps/web/.env.example` - Frontend API/WS URLs
- `apps/web/index.html` - App Entry HTML
- `apps/web/package.json` - Web Scripts/Dependencies
- `apps/web/postcss.config.cjs` - PostCSS Setup
- `apps/web/tailwind.config.ts` - Tailwind Theme/Content
- `apps/web/tsconfig.json` - TS Setup
- `apps/web/vite.config.ts` - Vite + Vitest Setup

Source:

- `apps/web/src/vite-env.d.ts` - Vite Types
- `apps/web/src/main.tsx` - React Mount
- `apps/web/src/styles/index.css` - globale Styles
- `apps/web/src/oog/OogLayout.tsx` - gemeinsames OOG Layout (Header/Search/Footer + Ads)
- `apps/web/src/routes/LandingRoute.tsx` - Landing/Home Hub mit Card-Links
- `apps/web/src/routes/VttRoute.tsx` - Route Wrapper fuer bestehendes `AppShell` (Lazy-Route)
- `apps/web/src/routes/LoginRoute.tsx` - Login Placeholder Route
- `apps/web/src/routes/PlaceholderRoute.tsx` - generische Placeholder Seite fuer OOG Unterrouten
- `apps/web/src/routes/player/PlayerHubRoute.tsx` - Player Hub
- `apps/web/src/routes/player/PlayerJoinRoute.tsx` - Player Join Flow (join/name/role -> `/vtt?...`)
- `apps/web/src/routes/player/CharacterBuilderRoute.tsx` - Character Builder Layout mit Navigation
- `apps/web/src/routes/player/CharacterBuilderHomeRoute.tsx` - Builder Home (coming soon Hinweis)
- `apps/web/src/routes/player/CharacterSheetsHubRoute.tsx` - Template Auswahl + Import Flow
- `apps/web/src/routes/player/CharacterSheetEditorRoute.tsx` - Sheet Editor Route
- `apps/web/src/routes/dm/DmHubRoute.tsx` - DM Hub
- `apps/web/src/routes/rules/RulesRoute.tsx` - Stats & Rules Layout mit linker Navigation
- `apps/web/src/routes/rules/SpellsListRoute.tsx` - Spell Browser Liste + Filter
- `apps/web/src/routes/rules/SpellDetailRoute.tsx` - Spell Detail Seite
- `apps/web/src/routes/rules/ClassesListRoute.tsx` - Classes/Subclasses Liste + Filter
- `apps/web/src/routes/rules/ClassDetailRoute.tsx` - Class Detail Route
- `apps/web/src/routes/rules/SubclassDetailRoute.tsx` - Subclass Detail Route
- `apps/web/src/routes/rules/ClassesDetailBaseRoute.tsx` - gemeinsame Detaillogik fuer Class/Subclass
- `apps/web/src/routes/LandingRoute.test.tsx` - Landing Routing/UI Test
- `apps/web/src/components/search/GlobalSearch.test.tsx` - Global Search Shortcut Test

App-Layer:

- `apps/web/src/app/App.tsx` - Router Setup
- `apps/web/src/app/AppShell.tsx` - Hauptorchestrierung (UI, WS, LOCAL Sync, Settings, Export/Import)
- `apps/web/src/app/apiClient.ts` - HTTP Client fuer API Endpunkte
- `apps/web/src/app/clientId.ts` - persistente Client-ID in LocalStorage
- `apps/web/src/app/store.ts` - Zustand Store fuer Room/App State
- `apps/web/src/app/store.test.ts` - Store Unit Test

Board/UI:

- `apps/web/src/components/boardTypes.ts` - Board/Tokens Typen + Sanitizer
- `apps/web/src/components/BoardCanvas.tsx` - Pixi Board, Token Rendering, Map Edit Tools, Kontextmenu, Token Modal
- `apps/web/src/components/ChatPanel.tsx` - Chat UI (Public, Whisper, DM-Note, Compose, Attachment-Status/Download)
- `apps/web/src/characterSheets/types.ts` - Character Sheets Domaintypen
- `apps/web/src/characterSheets/generated/templatesIndex.ts` - generierter Template-Index + Lazy-Loader
- `apps/web/src/characterSheets/generated/template_*.json` - generierte Feld-/Page-Metadaten pro PDF-Template
- `apps/web/src/characterSheets/ui/CharacterSheetEditor.tsx` - Overlay Editor fuer AcroForm-Felder
- `apps/web/src/characterSheets/ui/PdfPageBackground.tsx` - optionales PDF-Seitenrendering im Editor (lazy)
- `apps/web/src/characterSheets/storage/characterSheetsRepository.ts` - IndexedDB Repository fuer Sheet-Instanzen
- `apps/web/src/characterSheets/pdf/fillPdf.ts` - clientseitiges PDF-Fuellen + Download
- `apps/web/src/characterSheets/pdf/readPdfFields.ts` - clientseitiges Feld-Auslesen aus hochgeladenem PDF
- `apps/web/src/characterSheets/templateMatching.ts` - Template-Matching Heuristik (Feldnamen-Overlap)
- `apps/web/scripts/build-character-sheets.ts` - Build-Script fuer Character Sheets aus lokalen PDFs
- `apps/web/src/components/ads/AdSlot.tsx` - Ad Placeholder Komponente (`hero`, `rail`, `inline`, `footer`)
- `apps/web/src/components/search/GlobalSearch.tsx` - Header Search Trigger + Shortcut Handling
- `apps/web/src/components/search/SearchPalette.tsx` - Search Modal (Navigation, Recent Rooms, Quick Actions)
- `apps/web/src/components/search/searchData.ts` - statischer Navigation/Search Index
- `apps/web/src/components/search/useGlobalSearch.ts` - lokale Search Logik + IndexedDB Recent Rooms
- `apps/web/src/rules/spells/types.ts` - gemeinsame Spell Pack/Meta/Detail Typen
- `apps/web/src/rules/spells/generated/spellsPack.ts` - generierter eingebauter Spell-Datensatz (Build-Time)
- `apps/web/src/rules/spells/generated/spellNameIndex.ts` - leichter Name->Slug Index fuer Spell-Linking im Text
- `apps/web/src/rules/spells/parse/parseSpellsTxt.ts` - TXT Parser + Pack Builder
- `apps/web/src/rules/spells/parse/spellTableOverrides.ts` - Build-Time Table Overrides fuer kaputte TXT-Tabellen
- `apps/web/src/rules/spells/worker/spellsWorker.ts` - Worker Entry fuer schnelle Spell-Filterung
- `apps/web/src/rules/spells/worker/spellsWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/spells/worker/filterSpells.ts` - Bitset-Filterlogik
- `apps/web/src/rules/spells/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/src/rules/spells/ui/SpellsTable.tsx` - Spell Tabellenkomponente
- `apps/web/src/rules/spells/ui/SpellFlagsLegend.tsx` - Flag-Legende
- `apps/web/src/rules/spells/ui/SpellDescriptionBlocks.tsx` - Rendering von Paragraphen + Tabellen in Spell-Details
- `apps/web/src/rules/spells/ui/spellTextLinks.tsx` - automatische Verlinkung erkannter Spell-Namen im Regeltext
- `apps/web/src/rules/spells/ui/tagLabels.ts` - Tag-Label Formatter
- `apps/web/scripts/build-spells-pack.ts` - Build-Script fuer eingebautes Spells Pack
- `apps/web/src/rules/classes/types.ts` - gemeinsame Classes/Subclasses Pack-Typen
- `apps/web/src/rules/classes/generated/classesIndex.ts` - generierter Klassen-Index (Build-Time)
- `apps/web/src/rules/classes/parse/parseClassesTxt.ts` - TXT Parser + strukturierte Extraction
- `apps/web/src/rules/classes/parse/sanitizeLinks.ts` - strikte Link-Sanitisierung (entfernt wikidot)
- `apps/web/src/rules/classes/worker/classesWorker.ts` - Worker Entry fuer schnelle Klassenfilter
- `apps/web/src/rules/classes/worker/classesWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/classes/worker/filterClasses.ts` - Bitset-Filterlogik
- `apps/web/src/rules/classes/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/src/rules/classes/ui/ClassDocumentBlocks.tsx` - Renderer fuer Klassen-Dokumentbloecke
- `apps/web/src/rules/classes/ui/tagLabels.ts` - Tag-Label Formatter fuer Classes/Subclasses
- `apps/web/src/rules/classes/api/classesData.ts` - future-proof Data Access API fuer Character Builder Lookups
- `apps/web/scripts/build-classes-pack.ts` - Build-Script fuer eingebautes Classes/Subclasses Pack
- `apps/web/src/p2p/fileTransfer.ts` - WebRTC DataChannel Transfer Layer fuer Chat-Dateien (Offer/Answer/ICE + Chunking)
- `apps/web/src/components/landing/MiniPixiStage.tsx` - lazy Mini-Pixi Stage pro Landing Card
- `apps/web/src/components/landing/usePrefersReducedMotion.ts` - Motion-Praferenz Hook
- `apps/web/src/components/landing/useIntersectionVisible.ts` - Visibility Hook fuer Lazy-Init
- `apps/web/src/components/landing/scenes/playerScene.ts` - Player Mini-Szene
- `apps/web/src/components/landing/scenes/dmScene.ts` - DM Mini-Szene
- `apps/web/src/components/landing/scenes/types.ts` - Szenen-Controller Typen

Local Persistence/Sync:

- `apps/web/src/local/hash.ts` - SHA-256 Hashing
- `apps/web/src/local/assetUrlResolver.ts` - Blob URL Resolver + Cache
- `apps/web/src/local/chatHost.ts` - LOCAL Chat Host-Authoritaet, Filter, Snapshot-Append
- `apps/web/src/local/localSync.ts` - Snapshot/Event Transformation + Chunking
- `apps/web/src/local/sessionRepository.ts` - IndexedDB Repository
- `apps/web/src/local/chatHost.test.ts` - Chat Host Unit Tests (Filter/Authz/Flow)
- `apps/web/src/local/sessionRepository.test.ts` - IndexedDB Repository Test
- `apps/web/src/characterSheets/storage/characterSheetsRepository.test.ts` - Character Sheets IndexedDB Test
- `apps/web/src/characterSheets/templateMatching.test.ts` - Template-Matching Test
- `apps/web/src/routes/player/CharacterSheetsHubRoute.test.tsx` - Hub Rendering Test
- `apps/web/src/rules/spells/parse/parseSpellsTxt.test.ts` - Parser Unit Tests (Fixture)
- `apps/web/src/rules/spells/parse/spellTableOverrides.test.ts` - Tests fuer Tabellen-Wiederherstellung
- `apps/web/src/rules/spells/worker/filterSpells.test.ts` - Worker-Filterlogik Tests
- `apps/web/src/rules/classes/parse/parseClassesTxt.test.ts` - Parser Unit Test inkl. Wikidot-Sanitisierung
- `apps/web/src/rules/classes/worker/filterClasses.test.ts` - Worker-Filterlogik Tests

Test Setup:

- `apps/web/src/test/setup.ts` - `jest-dom` Setup fuer Vitest

### `packages/shared`

Konfiguration:

- `packages/shared/package.json` - Build/Test/Lint Scripts
- `packages/shared/tsconfig.json` - TS Build Setup

Source:

- `packages/shared/src/index.ts` - zentrale Exporte
- `packages/shared/src/domain/roles.ts` - Rollen Schema/Type
- `packages/shared/src/domain/room.ts` - Domain Schemas (Room/Token/Assets/Policies/Refs)
- `packages/shared/src/contracts/http.ts` - HTTP Request/Response Schemas
- `packages/shared/src/contracts/events.ts` - WebSocket/Relay/LOCAL Snapshot Contracts

Tests:

- `packages/shared/tests/contracts.test.ts` - Contract-Validierung ueber alle Message-/HTTP Varianten

## Architektur und Datenfluss

### API und HTTP

- `GET /health`
  - liefert `{ ok: true, version, time }`
- `POST /rooms`
  - Request: `{ name, displayName, clientId, storageMode? }`
  - Response LOCAL: `{ roomId, joinSecret, storageMode, hostUserId, wsUrl, roleAssigned, member }`
  - Response CLOUD: `{ roomId, joinSecret, storageMode, hostUserId, wsUrl, roleAssigned, member, settings, tokens, members, currentMapAssetId, currentMapAsset }`
- `POST /rooms/join`
  - Request: `{ joinSecret, displayName, clientId, roleDesired? }`
  - Response LOCAL: `{ roomId, storageMode, hostUserId, wsUrl, roleAssigned, member }`
  - Response CLOUD: `{ roomId, storageMode, hostUserId, wsUrl, roleAssigned, member, settings, tokens, members, currentMapAssetId, currentMapAsset }`
  - LOCAL Sonderfall: `409 HOST_OFFLINE`, wenn Host nicht online
- `GET /rooms/:id/state`
  - CLOUD: Response `{ roomId, storageMode, hostUserId, settings, tokens, members, currentMapAssetId, currentMapAsset }`
  - LOCAL: `409 LOCAL_STATE_NOT_AVAILABLE` (kein serverseitiger Game-State)
- `GET /rooms/:roomId/assets?type=MAP|TOKEN_IMAGE|SOUND`
  - Header: `x-client-id`
  - nur fuer Room-Mitglieder
  - LOCAL: gibt absichtlich leere Liste zurueck
- `POST /rooms/:roomId/map`
  - Header: `x-client-id`
  - Request: `{ assetId }`
  - nur DM
  - LOCAL: serverseitig deaktiviert (`LOCAL_MODE_NO_SERVER_STATE`)
- `POST /assets/upload` (multipart)
  - Felder: `roomId`, `type`, `file`
  - Header: `x-client-id`
  - Upload types: `MAP`, `TOKEN_IMAGE`
  - erlaubte MIME: `image/png`, `image/jpeg`, `image/webp`
  - Maxgroesse: 10 MB
  - LOCAL: deaktiviert (`LOCAL_MODE_NO_SERVER_ASSETS`)
- `GET /assets/:id?clientId=...`
  - Membership Pflicht
  - liefert Stream mit passendem `Content-Type`
  - LOCAL: nicht verfuegbar (`ASSET_NOT_AVAILABLE_IN_LOCAL_MODE`)
- Spells Browser:
  - absichtlich **keine** Server-Endpunkte (`/spells`, `/rules/spells` sind reine Web-Routes)
  - Datenquelle ist ausschließlich der im Frontend gebundelte Build-Time Pack

### WebSocket

Handshake:

- Client sendet `HELLO` als erste Nachricht.
- Server antwortet mit:
  - `WELCOME` (CLOUD)
  - `WELCOME_LOCAL` (LOCAL)
  - oder Fehler (`HOST_OFFLINE`, `ERROR`, etc.).
- `WELCOME_LOCAL` ist minimal und enthaelt keinen Game-State (`settings`, `tokens`, `currentMapAsset`, `mapEditSnapshot` fehlen absichtlich).

Realtime Streams:

- Presence: `PRESENCE_UPDATE`
- Tokens: `TOKEN_CREATED`, `TOKEN_UPDATED`, `TOKEN_DELETED`
- Room Settings: `ROOM_SETTINGS_UPDATED`
- Map: `ROOM_MAP_UPDATED`
- Assets: `ASSET_CREATED`
- MapEdit: `MAP_EDIT_OPS` / `MAP_EDIT_OPS_APPLIED`

LOCAL Relay Kanal:

- Client -> Host: `RELAY_TO_HOST` (+ `HostRequest`)
- Host -> alle: `RELAY_BROADCAST` / `RELAY_FROM_HOST`
- Host -> einzelner User: `RELAY_TO_USER` / `DIRECT_FROM_HOST`
- Asset Pull: `ASSET_REQUEST` + `ASSET_CHUNK`
- Direkte State-Messages an den Server sind in LOCAL verboten und werden mit `ERROR` abgelehnt:
  - Code: `LOCAL_REQUIRES_RELAY_TO_HOST`
  - Betrifft: `TOKEN_CREATE`, `TOKEN_MOVE`, `TOKEN_UPDATE`, `TOKEN_DELETE`, `ROOM_SETTINGS_UPDATE`, `ROOM_SET_MAP`, `MAP_EDIT_OPS`
  - Zusatzfelder: `{ rejectedType, hint }`

Vollstaendiger Message-Katalog laut `packages/shared/src/contracts/events.ts`:

- Client -> Server:
  - `HELLO`
  - `PING`
  - `TOKEN_CREATE`
  - `TOKEN_MOVE`
  - `TOKEN_DELETE`
  - `TOKEN_UPDATE`
  - `ROOM_SETTINGS_UPDATE`
  - `ROOM_SET_MAP`
  - `MAP_EDIT_OPS`
  - `RELAY_TO_HOST`
  - `RELAY_BROADCAST`
  - `RELAY_TO_USER`
  - `ASSET_REQUEST`
  - `ASSET_CHUNK`
- Server -> Client:
  - `WELCOME`
  - `WELCOME_LOCAL`
  - `HOST_OFFLINE`
  - `PRESENCE_UPDATE`
  - `RELAY_FROM_HOST`
  - `DIRECT_FROM_HOST`
  - `RELAY_FROM_USER`
  - `TOKEN_CREATED`
  - `TOKEN_UPDATED`
  - `TOKEN_DELETED`
  - `ROOM_SETTINGS_UPDATED`
  - `ROOM_MAP_UPDATED`
  - `ASSET_CREATED`
  - `MAP_EDIT_OPS_APPLIED`
  - `ERROR`
  - `PONG`
- LOCAL HostRequest (`RELAY_TO_HOST` payload):
  - `REQUEST_TOKEN_CREATE`
  - `REQUEST_TOKEN_MOVE`
  - `REQUEST_TOKEN_UPDATE`
  - `REQUEST_TOKEN_DELETE`
  - `REQUEST_MAP_SET_ACTIVE`
  - `REQUEST_ROOM_SETTINGS_UPDATE`
  - `REQUEST_MAPEDIT_OPS`
  - `REQUEST_CHAT_SEND`
  - `FILE_REQUEST`
  - `FILE_SIGNAL`
  - `FILE_CANCEL`
- LOCAL HostEvent (`RELAY_BROADCAST` payload):
  - `TOKEN_CREATED`
  - `TOKEN_MOVED`
  - `TOKEN_UPDATED`
  - `TOKEN_DELETED`
  - `ROOM_SETTINGS_UPDATED`
  - `MAP_ACTIVE_SET`
  - `MAPEDIT_OPS_APPLIED`
  - `SNAPSHOT_ANNOUNCE`
  - `CHAT_MESSAGE_PUBLIC`
  - `CHAT_MESSAGE_WHISPER`
  - `CHAT_MESSAGE_DM_NOTE`
- LOCAL HostDirect (`RELAY_TO_USER`/`DIRECT_FROM_HOST` payload):
  - `HOST_SNAPSHOT`
  - `HOST_RESYNC`
  - `HOST_SNAPSHOT_CHUNK`
  - `ASSET_OFFER`
  - `ASSET_CHUNK`
  - `DENIED`
  - `CHAT_MESSAGE_WHISPER`
  - `CHAT_MESSAGE_DM_NOTE`
  - `FILE_REQUEST`
  - `FILE_SIGNAL`
  - `FILE_CANCEL`
  - `FILE_OFFER` (optional)

### LOCAL Snapshot- und Asset-Sync

- Host fuehrt kanonischen Snapshot (`RoomSnapshot`).
- Snapshot enthaelt auch `chat.messages` (Host-Historie, capped).
- `chat.messages` enthaelt Dateianhaenge nur als Referenzen (`hash,name,mime,size,seedUserId`), ohne data/base64 payload.
- Bei Join/Resync sendet Host Snapshot direkt oder in Chunks (`HOST_SNAPSHOT_CHUNK`).
- Host filtert beim Snapshot-Versand Whisper/DM-Notes pro Ziel-User:
  - `PUBLIC` immer
  - `WHISPER` nur fuer Empfaenger, DM oder Sender
  - `DM_NOTE` nur fuer DM
- Non-Host Clients warten nach Join explizit auf den Host-Snapshot (`Waiting for host snapshot...`).
- Clients pruefen fehlende Asset-Hashes und fordern nur fehlende Assets nach.
- Assets werden chunkweise base64 uebertragen und in IndexedDB abgelegt.
- Chat-Dateien werden nicht ueber WS-Broadcast transportiert:
  - Download on-demand via `FILE_REQUEST`
  - Signaling via `FILE_SIGNAL` (offer/answer/ice) ueber WS-Relay
  - Datei-Bytes via WebRTC DataChannel direkt Peer-to-Peer

## Persistenz

### PostgreSQL (Prisma)

Wichtige Tabellen/Modelle:

- `User`
- `Room` (inkl. `storageMode`, `currentMapAssetId`)
- `RoomMember`
- `RoomSettings` (`tokenMovePolicy`, `mapEditPolicy`, user overrides)
- `Token`
- `Asset`
- `Snapshot` (DB-seitig vorhanden)
- `Event` (DB-seitig vorhanden)

Hinweis:

- In LOCAL-Modus existiert Game-State nicht serverseitig als Source of Truth:
  - keine serverseitigen Token/Settings/MapEdit Snapshots als LOCAL-SoT
  - keine HTTP-State-Auslieferung fuer LOCAL (`/rooms/:id/state` -> `409`)
  - Asset/Map-Serverendpunkte in LOCAL eingeschraenkt
  - `LOCAL_STRICT=1` blockiert versehentliche DB-Zugriffe auf `Token`, `RoomSettings`, `Asset`, `Snapshot`, `Event` in LOCAL
- In CLOUD-Modus bleibt serverseitiger Room-State aktiv (inkl. WS `WELCOME` + MapEdit Snapshot aus API-RAM pro CLOUD-Raum).

### IndexedDB (Browser)

DB: `dnd-vtt-local-sessions-v1`
Stores:

- `snapshots` (Room Snapshot)
- `assets` (Blob + Meta)
- `roomAssets` (Room-zu-Asset Referenzen)

Session Bundle:

- Export/Import JSON mit `snapshot` + base64-Assets
- Chat im Snapshot referenziert Attachments nur per Hash/Meta; Datei-Bytes liegen separat im Asset-Teil des Bundles.
- Dateiendung: `.dndvtt.json`

## Lokale Entwicklung

### Voraussetzungen

- Node.js >= 20
- pnpm >= 9
- Docker Desktop + `docker compose`

### Setup

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Standard URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

### Spells Pack Build (Stats & Rules)

- Der Spells Browser nutzt **keinen Import-Dialog** und **keine API**.
- Datensatz wird zur Build-Zeit eingebettet:
  - Standard: `./dnd5e_spells.txt` im Repo-Root
  - Optional: `SPELLS_TXT_PATH=<pfad>` setzen
- Build:

```powershell
pnpm spells:build
pnpm dev
```

Wenn die TXT fehlt, bricht `spells:build` mit klarer Fehlermeldung ab.

### Classes/Subclasses Pack Build (Stats & Rules)

- Classes/Subclasses nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal eingebettet:
  - Standard: `./dnd5e_classes_subclasses.txt` im Repo-Root
  - Optional: `CLASSES_TXT_PATH=<pfad>` setzen
- Build:

```powershell
pnpm classes:build
pnpm dev
```

Wenn die TXT fehlt, bricht `classes:build` mit klarer Fehlermeldung ab.

### Character Sheets Build (Character Builder)

- Character Sheets nutzen **keinen Upload-Import fuer Templates** und **keine API**.
- PDF-Templates werden zur Build-Zeit lokal eingebunden:
  - Standard: `./character_sheets` im Repo-Root
  - Optional: `CHARACTER_SHEETS_DIR=<pfad>` setzen
- Build:

```powershell
pnpm sheets:build
pnpm dev
```

Wenn das Verzeichnis fehlt, bricht `sheets:build` mit klarer Fehlermeldung ab.

## Scripts

### Root Scripts (`package.json`)

- `pnpm dev` - API + Web parallel
- `pnpm dev:api` - nur API
- `pnpm dev:web` - nur Web
- `pnpm build` - Turbo Build
- `pnpm lint` - Turbo Lint
- `pnpm test` - Turbo Tests
- `pnpm typecheck` - Turbo Typecheck
- `pnpm format` / `pnpm format:check` - Prettier
- `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` - Docker Postgres
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:reset` - Prisma Commands
- `pnpm health` - API Health + WS Smoke
- `pnpm ws:test` - WS Smoke
- `pnpm spells:build` - baut das integrierte Spells Pack aus `dnd5e_spells.txt`
- `pnpm sheets:build` - baut Character Sheet Templates aus lokalen PDFs
- `pnpm local:audit` - `pnpm test` + `pnpm health` + `pnpm ws:test` + statische LOCAL-Hinweise

### API Workspace Scripts

- `pnpm --filter @dnd-vtt/api dev`
- `pnpm --filter @dnd-vtt/api test`
- `pnpm --filter @dnd-vtt/api health:check`
- `pnpm --filter @dnd-vtt/api ws:test`

### Web Workspace Scripts

- `pnpm --filter @dnd-vtt/web dev`
- `pnpm --filter @dnd-vtt/web test`
- `pnpm --filter @dnd-vtt/web spells:build`
- `pnpm --filter @dnd-vtt/web classes:build`
- `pnpm --filter @dnd-vtt/web sheets:build`
- `predev`/`prebuild`/`pretest` in `@dnd-vtt/web` fuehren `spells:build` + `classes:build` + `sheets:build` automatisch aus

### Shared Workspace Scripts

- `pnpm --filter @dnd-vtt/shared build`
- `pnpm --filter @dnd-vtt/shared test`

## Smoke-Tests (wichtig)

### 1) CLI Smoke

```powershell
pnpm health
pnpm ws:test
pnpm local:audit
```

`pnpm health`:

- ruft `GET /health` auf
- startet danach WS Smoke

`pnpm ws:test`:

- erstellt Test-Room ueber API
- verbindet auf `/ws`
- sendet `HELLO`
- erwartet Serverantwort und beendet mit Exit Code 0 bei Erfolg

`pnpm local:audit`:

- fuehrt nacheinander `pnpm test`, `pnpm health`, `pnpm ws:test` aus (harte Checks)
- gibt danach schnelle `rg`-Hinweise zu LOCAL-Branches und State-Prisma-Zugriffen aus (nur Hinweis, nicht blockierend)

Hinweis:

- Der WS Smoke erstellt bewusst einen `CLOUD` Room und erwartet den `WELCOME`-Handshake (stabil, unabhaengig von LOCAL Host-Online-Zustand).

### 2) Manuelle Landing/VTT Navigation

1. Browser auf `/` oeffnen.
2. Erwartung:
   - Landing mit Header (Global Search), zwei grossen Role-Cards, Hero-Ad und Footer erscheint.
   - Hover/Focus auf `Player`/`Dungeon Master` triggert Mini-Pixi-Animation.
3. `Ctrl/Cmd+K` druecken.
4. Erwartung:
   - Search Palette oeffnet sich mit Navigation + Quick Actions + Local Recent Rooms.
5. `Resume` klicken.
6. Erwartung:
   - Navigation nach `/vtt`.
   - bestehende Create/Join + Board UI erscheint unveraendert.
7. Browser auf `/?join=ABCD1234` oeffnen.
8. Erwartung:
   - automatische Weiterleitung nach `/player/join?join=ABCD1234`.
   - Join-Code ist im Join-Formular vorbelegt.
9. Browser auf `/player` und `/dm` oeffnen.
10. Erwartung:

- beide Hubs laden mit OOG Layout, Search und Ad Placeholder Slots.

### 3) Manueller Stats-&-Rules Spells Smoke

1. Browser auf `/rules` oeffnen.
2. Erwartung:
   - linke Navigation ist sichtbar, erster Eintrag ist `Spells`.
   - Route springt auf `/rules/spells`.
3. In der Spells-Liste:
   - Name-Filter tippen (z. B. `acid`) -> Ergebnisse aktualisieren sofort.
   - Klassen direkt waehlen (z. B. `Class: Wizard`) -> sofortige Filterung.
   - Konzentration (`Yes`/`No`) und Zieltyp (`Area of Effect`/`Single Target`/`Self`) pruefen.
4. Eine Spell-Zeile klicken.
5. Erwartung:
   - Navigation auf `/rules/spells/:slug`.
   - Detailseite zeigt Source, Level/School, Casting Time, Range, Components, Duration, Spell Lists und Description.
   - falls vorhanden: `At Higher Levels` Abschnitt.
6. Legacy-Route pruefen:
   - `/spells` oeffnen -> Redirect auf `/rules/spells`.
   - `/spells/fireball` oeffnen -> Redirect auf `/rules/spells/fireball`.

### 4) Manueller Stats-&-Rules Classes/Subclasses Smoke

1. Browser auf `/rules/classes` oeffnen.
2. Erwartung:
   - Liste rendert schnell (ohne API-Calls), Kind/Class/Tag Filter sind sichtbar.
3. In der Liste:
   - Name-Filter tippen (z. B. `wizard`) -> Ergebnisse aktualisieren sofort.
   - Kind `Subclasses` setzen und Class `Wizard` waehlen -> Treffer werden sofort eingegrenzt.
4. Eine Class-Zeile klicken.
5. Erwartung:
   - Navigation auf `/rules/classes/:id`.
   - Detailansicht zeigt Header, Quick Facts und gerenderte Dokument-Bloecke inkl. Tabellen.
6. Eine Subclass-Zeile klicken.
7. Erwartung:
   - Navigation auf `/rules/subclasses/:id`.
   - Detailansicht zeigt Parent Class + extrahierte Feature/Spell-Infos (falls vorhanden).
8. Legacy-Redirects pruefen:
   - `/classes` -> `/rules/classes`
   - `/class/wizard` -> `/rules/classes/wizard`
   - `/subclass/wizard--school-of-evocation` -> `/rules/subclasses/wizard--school-of-evocation`
9. Optional Konsistenzcheck:
   - `rg -n -i wikidot apps/web/src/rules/classes/generated apps/web/public/rules/classes/entries`
   - Erwartung: keine Treffer.

### 5) Manueller Character Sheets Smoke

1. Browser auf `/player/characters/sheets` oeffnen.
2. Erwartung:
   - General Template + Klassen-Templates werden als Karten gelistet.
3. `Create from template` auf einem Template klicken.
4. Erwartung:
   - Route auf `/player/characters/sheets/:templateId?instance=...`.
   - Editor zeigt weisse Seiten im korrekten Seitenverhaeltnis mit ueberlagerten Feldern.
5. Einige Felder ausfuellen, Seite wechseln, Zoom testen.
6. `Download PDF` klicken.
7. Erwartung:
   - heruntergeladene PDF enthaelt die eingegebenen Werte.
8. `Upload filled PDF` mit einer ausgefuellten PDF testen.
9. Erwartung:
   - Feldwerte werden in den Editor uebernommen.

### 6) Manueller LOCAL Session Smoke

1. Browser A: Room als DM erstellen (`Local (Free)`).
2. Map hochladen und aktiv setzen.
3. Tokens erstellen, bewegen, editieren, loeschen.
4. MapEdit Tools verwenden (Draw/Erase/Line/Rect/Ellipse/Text/Image/Object).
5. Browser B joinen.
6. Erwartung:
   - Joiner sieht kurz "Waiting for host snapshot..." bis Snapshot ankommt.
   - Snapshot kommt vom Host.
   - gleicher Token-/Map-/MapEdit Stand auf beiden Clients.
   - fehlende Assets werden per Chunk-Transfer nachgeladen.
7. Chat/Whisper pruefen:
   - Player sendet `PUBLIC` -> alle sehen Nachricht.
   - DM sendet Whisper an Player B -> nur DM + Player B sehen Nachricht.
   - Player C darf den Whisper nicht sehen.
8. Chat Datei/Link pruefen:
   - Bild oder PDF im Chat senden.
   - Empfaenger klickt `Request download`, Transfer laeuft (Status `downloading ...`), danach `Open`/`Download` verfuegbar.
   - Nachricht mit `https://...` senden; Link muss klickbar sein und neuen Tab oeffnen.
   - Optional in API/WS Logs pruefen: keine grossen Datei-Payloads, nur kleine Signaling Messages.

### 7) Reconnect Smoke

1. Host refresh/reconnect.
2. Erwartung:
   - Snapshot wird aus IndexedDB geladen.
   - Teilnehmer erhalten konsistenten State nach Resync.

### 8) Export/Import Smoke (LOCAL)

1. `Export Session` ausfuehren.
2. Datei wieder importieren.
3. Erwartung:
   - Snapshot + Assets + aktive Map + Token + MapEdit + Chat/Whisper Historie wiederhergestellt.

## Automatisierte Tests (aktueller Scope)

API:

- Health Route
- WS Parsing/Serialisierung
- WS Limits
- Local Relay Regeln
- LOCAL WS Hardening (`WELCOME_LOCAL` minimal, `LOCAL_REQUIRES_RELAY_TO_HOST`)
- LOCAL_STRICT Guardrails (Fail-fast bei verbotenen LOCAL DB-State-Zugriffen)
- Token/Map/Authz Regeln
- Upload Validierung
- LOCAL HTTP Hardening fuer Room Create/Join/State

Web:

- Zustand Store Grundverhalten
- Landing Route Smoke (Resume + Join CTAs, Navigation nach `/vtt`)
- Global Search Shortcut Smoke (`Ctrl/Cmd+K` oeffnet Palette)
- Chat Dedupe + Host-Chat-Logik (Filter/Authz)
- IndexedDB Session Repository
- Spells TXT Parser + Pack Builder
- Spells Worker Filterlogik (Tag-Bitsets + Query + Pagination)
- Classes/Subclasses TXT Parser + Build-Time Sanitisierung (inkl. wikidot-Removal)
- Classes/Subclasses Worker Filterlogik (Tag-Bitsets + Query + Kind/Class Filter)

Shared:

- HTTP Contracts
- WS Contracts
- LOCAL Relay/Host/Snapshot Contracts

## Bekannte Einschraenkungen

- CLOUD ist kontraktseitig vorbereitet, UI-seitig noch nicht voll aktiviert.
- CLOUD Chat ist noch nicht implementiert (`CLOUD_CHAT_NOT_IMPLEMENTED`).
- Login Route ist aktuell Placeholder (`/login`, coming soon).
- LOCAL benoetigt online Host fuer Join/Realtime.
- API `auth` ist aktuell Guest/Placeholder.
- MapEdit Zustand im API Prozessspeicher ist nur fuer CLOUD relevant (nicht persistent, kein Eventstore).
- Spells Pack Build benoetigt `dnd5e_spells.txt` im Repo-Root oder `SPELLS_TXT_PATH`.
- Classes/Subclasses Pack Build benoetigt `dnd5e_classes_subclasses.txt` im Repo-Root oder `CLASSES_TXT_PATH`.

## Troubleshooting

- `docker` nicht verfuegbar:
  - Docker Desktop starten, Terminal neu oeffnen.
- Port `5432` belegt:
  - lokalen Postgres stoppen oder Port-Mapping in `docker-compose.yml` anpassen.
- Prisma Probleme:
  - Root Scripts verwenden (`pnpm db:generate`, `pnpm db:migrate`, `pnpm db:reset`).
- WS Fehler `HOST_OFFLINE`:
  - Im LOCAL-Modus muss DM/Host online sein.

## README-Aktualisierungsregeln fuer zukuenftige Codeupdates

Bei jeder Aenderung muessen mindestens diese README-Abschnitte geprueft und ggf. aktualisiert werden:

1. `Produktstatus und Funktionsumfang`
2. `Repository-Dateiindex`
3. `Architektur und Datenfluss`
4. `Persistenz`
5. `Scripts`
6. `Smoke-Tests`
7. `Bekannte Einschraenkungen`

Wenn neue Dateien hinzukommen:

- in den Dateiindex aufnehmen
- kurz Zweck dokumentieren
- falls neue Tests: in Test-/Smoke-Sektion aufnehmen

Wenn Contracts/API/WS geaendert werden:

- Message-/Endpoint-Verhalten sofort im README anpassen
- betroffene Smoke-Tests und manuelle Testschritte mit aktualisieren
