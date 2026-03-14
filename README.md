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
  - Datensatz wird zur Build-Zeit aus `content\/` JSON-Dateien erzeugt (kein Runtime-Parsing)
  - Build erzeugt kleinen Index + statische Detail-JSONs:
    - `apps\/web\/src\/rules\/classes\/generated\/classesIndex.ts`
    - `apps\/web\/public\/rules\/classes\/entries\/<id>.json`
  - Worker-basierte Sofortfilterung (Name, Kind, Class, Tags) mit voraggregierten Tag-Bitsets
  - Detailansicht rendert strukturierte Dokument-Bloecke (Heading, Paragraph, List, Table, Pre)
  - Builder-friendly Extracted Data im Pack:
    - `spellSlotsByLevel`, `featuresByLevel`, `progressionByLevel`, `grantedSpellRefs`
  - strikte Link-Sanitisierung: `wikidot`/HTTP-URLs werden beim Build entfernt
  - keine API-Endpunkte, nur statische Files
- Stats & Rules -> Races & Lineages (OOG, client-only):
  - Routes `\/rules\/lineages`, `\/rules\/lineages\/:id`
  - Datensatz wird zur Build-Zeit aus `content\/` JSON-Dateien erzeugt (nur `kind=LINEAGE`)
  - Build erzeugt kleinen Index + statische Detail-JSONs:
    - `apps\/web\/src\/rules\/lineages\/generated\/lineagesIndex.ts`
    - `apps\/web\/public\/rules\/lineages\/entries\/<id>.json`
  - Worker-basierte Sofortfilterung (Name, Group, Setting, Tags) mit voraggregierten Tag-Bitsets
  - Detailansicht rendert strukturierte Dokument-Bloecke (Heading, Paragraph, List, Table, Pre)
  - Quick Facts + Traits werden aus den JSON-Inhalten best-effort extrahiert (z. B. ASI, Size, Speed, Languages)
  - strikte Link-Sanitisierung: `wikidot`/HTTP-URLs werden beim Build entfernt
  - keine API-Endpunkte, nur statische Files
- Stats & Rules -> Backgrounds (OOG, client-only):
  - Routes `\/rules\/backgrounds`, `\/rules\/backgrounds\/:id`
  - Redirects `\/backgrounds` -> `\/rules\/backgrounds` und `\/background\/:id` -> `\/rules\/backgrounds\/:id`
  - Datensatz wird zur Build-Zeit aus lokalen JSON-Dateien unter `content\/background` erzeugt (oder `BACKGROUNDS_DIR`)
  - Build erzeugt:
    - `apps\/web\/src\/rules\/backgrounds\/generated\/backgroundsIndex.ts`
    - `apps\/web\/src\/characterBuilder\/generated\/backgroundsLookup.ts`
    - `apps\/web\/public\/rules\/backgrounds\/<id>.json`
  - Liste bietet schnelle clientseitige Suche/Filter (Kategorie, Skills, Tools, Languages, Choices, Feature, Equipment) ueber Worker + Bitsets
  - Detailansicht zeigt Quick Facts, strukturierte Proficiencies, Equipment, Feature, Personality/Variants und darunter den kompletten Original-Regeltext
  - Background-Details enthalten neben Text auch machine-readable Grants fuer Skills, Tools, Languages, Equipment, Features, Varianten und Personality-Listen
  - keine API-Endpunkte, nur statische Files
- Stats & Rules -> Feats (OOG, client-only):
  - Routes `\/rules\/feats`, `\/rules\/feats\/:id`
  - Datensatz wird zur Build-Zeit aus `content\/` JSON-Dateien erzeugt (nur `kind=FEAT`)
  - Build erzeugt kleinen Index + statische Detail-JSONs:
    - `apps\/web\/src\/rules\/feats\/generated\/featsIndex.ts`
    - `apps\/web\/public\/rules\/feats\/entries\/<id>.json`
  - Worker-basierte Sofortfilterung (Name, Race-Prerequisite, Ability-Increase, Tags)
  - strikte Link-Sanitisierung: `wikidot`/HTTP-URLs werden beim Build entfernt
  - keine API-Endpunkte, nur statische Files
- Stats & Rules -> SRD 5.1 CC (OOG, client-only):
  - neue SRD-Sektionen unter `/rules`: `Races`, `Equipment`, `Adventuring`, `Combat`, `Spellcasting Rules`, `Conditions`, `Magic Items`, `SRD Attribution`
  - Build-Time Verarbeitung aus `content/SRD_CC_v5.1.json` (oder `SRD_JSON_PATH`)
  - Races werden zusaetzlich als eigener strukturierter Pack fuer Rules & Stats und Character Builder aus derselben SRD-Datei extrahiert
  - Build erzeugt:
    - `apps/web/src/rules/srd/generated/srdIndex.ts` (leichter Meta-Index)
    - `apps/web/src/rules/srd/generated/srdBitsets.ts` (Tag-Bitsets fuer Worker-Filter)
    - `apps/web/public/rules/srd/<category>/<id>.json` (Detaildateien on-demand)
    - `apps/web/src/rules/races/generated/racesIndex.ts` (leichter Race-Meta-Index mit Filterdaten)
    - `apps/web/src/rules/races/generated/raceLookup.ts` (ID- und Parent/Subrace-Lookups)
    - `apps/web/public/rules/races/<id>.json` (vollstaendige strukturierte Race/Subrace-Details on-demand)
  - Suche/Filterung voll clientseitig per Web Worker + Bitsets
  - Race-Detailseiten zeigen Quick Facts, Proficiencies, Defenses, Traits und den vollstaendigen Original-Regeltext
  - Race-Details enthalten neben Text auch machine-readable Facts fuer Ability Bonuses, Speed, Size, Senses, Languages, Proficiencies, Defenses und Traits
  - keine API-Endpunkte, nur statische Files
- DM -> Monsters (SRD) (OOG, client-only):
  - Routes `/dm/monsters`, `/dm/monsters/:id`
  - schnelle Filter (Name/Type/CR/Size) via SRD Worker
  - Monster-Detailansicht inkl. `Add to NPC Library` (lokales IndexedDB Repo `dnd-vtt-dm-data-v1`)
  - keine API-Endpunkte, nur statische Files
- Character Builder -> Guided Builder (OOG, client-only):
  - Hauptflow fuer Charaktererstellung:
    - `/player/characters` (Your Characters Uebersicht)
    - `/player/characters/new` (neuen Build starten)
    - `/player/characters/:characterId` (Builder fortsetzen/bearbeiten)
    - `/player/characters/:characterId/review` (Final Review + Export)
  - nur ein gefuehrter Modus (kein separater Expert-Mode)
  - Canonical Character JSON als Source of Truth (`CharacterRecord`)
  - lokale Rules-/Derivation-Engine erzeugt:
    - abgeleitete Stats (Abilities, Mods, PB, HP, AC best effort, Initiative, Spellwerte)
    - dynamische Pending Decisions (Class/Subclass/Origin/Subrace/Race Choices/Skills/Features/Spells/Equipment/ASI-Feat)
    - Validation Errors/Warnings + Completion Status (`draft`, `in_progress`, `ready`, `invalid`)
  - Legacy-SRD-Races konsumieren den strukturierten Race/Subrace-Pack direkt fuer Ability Bonuses, Speed, Senses, Languages, Proficiencies, Defenses und Traits
  - Backgrounds konsumieren den strukturierten Background-Pack direkt fuer Skills, Tools, Languages, Equipment Choices, Feature-Text, Varianten und Personality-Metadaten
  - bestehender Point-Buy ist direkt im Builder integriert (keine doppelte Regelimplementation)
  - keine Live-PDF-Vorschau waehrend des Builds; Sheet wird erst im Review gefuellt/exportiert
  - rein local-first:
    - keine neuen Server-APIs
    - keine Server-Persistenz
    - keine zusaetzliche Server-Last
  - lokale Persistenz in IndexedDB (`dnd-vtt-characters-v1`) inkl. Autosave-Snapshots
  - fertige/teilfertige Charaktere erscheinen als First-Class-Eintraege in `Your Characters`
- Character Builder -> Character Sheets (OOG, client-only):
  - Route `\/player\/characters\/sheets` ist der zentrale Character-Sheets Hub (ohne PDF-Preview im Hauptflow)
  - sichtbarer Direkt-Download nur fuer `General Character Sheet` (`Download blank PDF`)
  - Hinweis/Empfehlung zu class-spezifischen Sheets auf DMs Guild (externer Link, neuer Tab)
  - class-spezifische Templates bleiben intern voll unterstuetzt fuer Import/Template-Matching
  - Build-Time Generator extrahiert AcroForm-Widget-Felder aus lokalen PDFs in JSON Templates
  - Import:
    - `Upload filled character sheet PDF` liest Feldwerte clientseitig
    - Template-Matching per Feldnamen-Overlap ueber alle implementierten Templates
    - validiert importierte Werte (Errors/Warnings) und zeigt strukturierte Parsed-Tabellen nach Sektionen
    - Import speichert strukturierte Daten lokal in IndexedDB (`dnd-vtt-character-sheets-v1`, Store `imports`)
    - gespeicherte Imports koennen lokal erneut geoeffnet oder geloescht werden
  - Legacy/Interne Route `\/player\/characters\/sheets\/:templateId` (Editor mit Overlay/Preview) bleibt fuer interne Nutzung verfuegbar
  - Final-Review im Guided Builder nutzt dieselbe PDF-Fill-Pipeline im Hintergrund (`Download filled General Sheet`)
  - keine Server-Endpunkte, keine Server-Last fuer Character Sheets
- Character Builder -> Point Buy Calculator (OOG, client-only):
  - Route `\/player\/characters\/point-buy`
  - exakte SRD Point-Buy-Kostentabelle (27 Punkte, Scores 8..15)
  - zwei Bonusmodi:
    - `SRD 5.2 Background bonuses` (+2/+1 oder +1/+1/+1 innerhalb der 3 Background-Abilities)
    - `Legacy Race bonuses` (inkl. Half-Elf- und Custom-Option)
  - Level-/Class-abhaengige ASI/Feat-Slots mit Auswahl:
    - `Ability Score Improvement` (+2 oder +1/+1)
    - `Feat (no ASI)`
    - `Feat (+1 ability)`
  - Feat-Auswahl nutzt den eingebauten Feats-Datensatz (Prerequisite + Ability-Increase werden erkannt)
  - Bei `Feat (+1 ability)` wird die erlaubte Ability aus dem gewaehlten Feat abgeleitet (fix oder Auswahlmenge)
  - Finalscores werden auf 20 gecappt (inkl. Validierungs-Hinweisen)
  - Persistenz lokal in `localStorage` (`characterBuilder.pointBuy.v1`)
  - keine Server-Endpunkte, keine Server-Last
- OOG Dice Page (client-only):
  - Route `\/dice` (lazy loaded, getrennt von `/vtt`)
  - Multi-Dice Roller mit Standardwuerfeln (`d4`..`d100`), Modifier, Verlauf (lokal) und Copy-Output
  - Initiative Roller:
    - Quick Groups (`name`, `count`, `initiativeMod`)
    - optional aus lokaler NPC Library (`dnd-vtt-dm-data-v1`, Store `npcs`)
    - globale Initiative-Modifikatoren, Sortierung (Total -> d20 -> Name), Copy als TSV + Markdown
  - Animation modes: `Off`, `2D` (SVG), `3D` (`@3d-dice/dice-box`)
    - Default: `Off` bei `prefers-reduced-motion`, sonst `2D`
    - `3D` ist lazy-loaded und faellt bei Init-Fehler automatisch auf `2D`/`Off` zurueck
    - gemischte Wuerfelgruppen rollen in `3D` gleichzeitig
  - Ergebnis-Optionen:
    - `Add all dice` oder `Add same dice only`
    - optional `Separate d20 / d100` fuer DnD-orientierte Auswertung
  - keine API-Endpunkte, keine Server-Persistenz, kein Server-Compute fuer Rolls
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
  - `/dice` = OOG Dice Tools (Multi Dice + Initiative, client-only)
  - `/player` = Player Hub
  - `/player/join` = Join Formular (Join-Code, Display Name, Role)
  - `/player/characters` = Your Characters Uebersicht (Builder-Records + Imports)
  - `/player/characters/new` = Guided Character Builder Start
  - `/player/characters/:characterId` = Guided Character Builder Editor
  - `/player/characters/:characterId/review` = Final Review & Export (filled sheet download)
  - `/player/characters/point-buy` = Point Buy Calculator
  - `/player/characters/sheets` = Character Sheets Hub (General download + Import + lokale Importliste + Parsed-Values Tabelle)
  - `/player/characters/sheets/:templateId` = Character Sheet Editor (interne/Legacy Detailroute)
  - `/player/notes`, `/player/tools` = Placeholder
  - `/dm` = DM Hub
  - `/dm/session`, `/dm/maps`, `/dm/npcs`, `/dm/encounters`, `/dm/notes`, `/dm/audio`, `/dm/backups` = Placeholder
  - `/dm/monsters` = SRD Monsterliste
  - `/dm/monsters/:id` = SRD Monsterdetail
  - `/help`, `/feedback`, `/imprint`, `/login` = Placeholder/Info-Seiten
  - `/rules` = Stats & Rules Layout (linke Navigation)
  - `/rules/spells` = Spells Liste
  - `/rules/spells/:slug` = Spell Detail
  - `/rules/classes` = Classes/Subclasses Liste
  - `/rules/classes/:id` = Class Detail
  - `/rules/subclasses/:id` = Subclass Detail
  - `/rules/lineages` = Races/Lineages Liste
  - `/rules/lineages/:id` = Lineage Detail
  - `/rules/feats` = Feats Liste
  - `/rules/feats/:id` = Feat Detail
  - `/rules/races` = SRD Races Liste
  - `/rules/races/:id` = SRD Race Detail
  - `/rules/backgrounds` = Backgrounds Liste
  - `/rules/backgrounds/:id` = Background Detail
  - `/rules/equipment` = SRD Equipment Liste
  - `/rules/equipment/:id` = SRD Equipment Detail
  - `/rules/adventuring` = SRD Adventuring Kapitel
  - `/rules/adventuring/:id` = SRD Adventuring Kapitel Detail
  - `/rules/combat` = SRD Combat Kapitel
  - `/rules/combat/:id` = SRD Combat Kapitel Detail
  - `/rules/spellcasting` = SRD Spellcasting Rules Kapitel
  - `/rules/spellcasting/:id` = SRD Spellcasting Kapitel Detail
  - `/rules/conditions` = SRD Conditions Liste
  - `/rules/conditions/:id` = SRD Condition Detail
  - `/rules/magic-items` = SRD Magic Items Liste
  - `/rules/magic-items/:id` = SRD Magic Item Detail
  - `/rules/srd-attribution` = CC-BY Attributionstext
- IN-GAME:
  - `/vtt` = bestehende VTT UI (`AppShell`, Create/Join + Board), per Route Lazy-Load
- TESTING:
  - `/battlemap-oog` = leere Out-of-Game Battlemap Sandbox (kein Room-Create/Join, nur lokales Testen)
- Legacy Redirects:
  - `/player/tools/dice` -> `/dice`
  - `/dm/tools/dice` -> `/dice`
  - `/spells` -> `/rules/spells`
  - `/spells/:slug` -> `/rules/spells/:slug`
  - `/classes` -> `/rules/classes`
  - `/class/:id` -> `/rules/classes/:id`
  - `/subclass/:id` -> `/rules/subclasses/:id`
  - `/lineages` -> `/rules/lineages`
  - `/lineages/:id` -> `/rules/lineages/:id`
  - `/races` -> `/rules/races`
  - `/races/:id` -> `/rules/races/:id`
  - `/backgrounds` -> `/rules/backgrounds`
  - `/background/:id` -> `/rules/backgrounds/:id`
  - `/equipment` -> `/rules/equipment`
  - `/conditions` -> `/rules/conditions`
  - `/magic-items` -> `/rules/magic-items`
  - `/adventuring` -> `/rules/adventuring`
  - `/combat` -> `/rules/combat`
  - `/spellcasting` -> `/rules/spellcasting`
  - `/feats` -> `/rules/feats`
  - `/feats/:id` -> `/rules/feats/:id`
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
- `apps/web/src/routes/DiceRoute.tsx` - OOG Dice Seite (Multi-Dice + Initiative)
- `apps/web/src/dice3d/DiceBoxTray.tsx` - lazy 3D Dice Tray Adapter (`@3d-dice/dice-box`)
- `apps/web/src/routes/VttRoute.tsx` - Route Wrapper fuer bestehendes `AppShell` (Lazy-Route)
- `apps/web/src/routes/LoginRoute.tsx` - Login Placeholder Route
- `apps/web/src/routes/PlaceholderRoute.tsx` - generische Placeholder Seite fuer OOG Unterrouten
- `apps/web/src/routes/player/PlayerHubRoute.tsx` - Player Hub
- `apps/web/src/routes/player/PlayerJoinRoute.tsx` - Player Join Flow (join/name/role -> `/vtt?...`)
- `apps/web/src/routes/player/CharacterBuilderRoute.tsx` - Character Builder Layout mit Navigation
- `apps/web/src/routes/player/CharacterBuilderListRoute.tsx` - Your Characters Uebersicht (lokale Builder-Charaktere + importierte Sheets)
- `apps/web/src/routes/player/CharacterBuilderNewRoute.tsx` - erstellt lokalen Character-Draft und startet Guided Builder
- `apps/web/src/routes/player/CharacterBuilderEditorRoute.tsx` - Guided Builder Editor fuer `:characterId`
- `apps/web/src/routes/player/CharacterBuilderReviewRoute.tsx` - Final Review, Validation Summary, Sheet Export
- `apps/web/src/routes/player/CharacterBuilderHomeRoute.tsx` - Legacy Builder Home (Weiterleitung/Bestandsroute)
- `apps/web/src/routes/player/PointBuyRoute.tsx` - Point Buy Route Wrapper
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
- `apps/web/src/routes/rules/LineagesListRoute.tsx` - Races/Lineages Liste + Filter
- `apps/web/src/routes/rules/LineageDetailRoute.tsx` - Lineage Detail Route
- `apps/web/src/routes/rules/FeatsListRoute.tsx` - Feats Liste + Filter
- `apps/web/src/routes/rules/FeatDetailRoute.tsx` - Feat Detail Route
- `apps/web/src/routes/rules/BackgroundsListRoute.tsx` - Backgrounds Liste + Filter
- `apps/web/src/routes/rules/BackgroundDetailRoute.tsx` - Background Detail Route
- `apps/web/src/routes/rules/SrdCategoryListBaseRoute.tsx` - gemeinsame SRD Listenlogik (Filter + Pagination)
- `apps/web/src/routes/rules/SrdCategoryDetailBaseRoute.tsx` - gemeinsame SRD Detaillogik
- `apps/web/src/routes/rules/SrdRacesListRoute.tsx` / `SrdRaceDetailRoute.tsx` - SRD Races
- `apps/web/src/routes/rules/SrdEquipmentListRoute.tsx` / `SrdEquipmentDetailRoute.tsx` - SRD Equipment
- `apps/web/src/routes/rules/SrdAdventuringListRoute.tsx` / `SrdAdventuringDetailRoute.tsx` - SRD Adventuring
- `apps/web/src/routes/rules/SrdCombatListRoute.tsx` / `SrdCombatDetailRoute.tsx` - SRD Combat
- `apps/web/src/routes/rules/SrdSpellcastingRulesListRoute.tsx` / `SrdSpellcastingRulesDetailRoute.tsx` - SRD Spellcasting Rules
- `apps/web/src/routes/rules/SrdConditionsListRoute.tsx` / `SrdConditionDetailRoute.tsx` - SRD Conditions
- `apps/web/src/routes/rules/SrdMagicItemsListRoute.tsx` / `SrdMagicItemDetailRoute.tsx` - SRD Magic Items
- `apps/web/src/routes/rules/SrdAttributionRoute.tsx` - SRD CC-BY Attribution
- `apps/web/src/routes/dm/SrdMonstersListRoute.tsx` / `SrdMonsterDetailRoute.tsx` - SRD Monsters (DM)
- `apps/web/src/routes/DiceRoute.test.tsx` - Dice Route Rendering Smoke Test
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
- `apps/web/src/dm/npcs/npcsRepository.ts` - lokale NPC Library in IndexedDB (`dnd-vtt-dm-data-v1`, Store `npcs`)
- `apps/web/src/dice/rng.ts` - sichere RNG-Helfer (`crypto.getRandomValues`, rejection sampling)
- `apps/web/src/dice/roll.ts` - Multi-Dice Roll Domainlogik + Resultmodell
- `apps/web/src/dice/initiative.ts` - Initiative-Rolling, Sortierung und Copy-Formatter (TSV/Markdown)
- `apps/web/src/dice/animation/useDiceAnimation.ts` - optionale clientseitige Dice-Animation
- `apps/web/src/dice/ui/DiceTile.tsx` - SVG Dice Tile Renderer
- `apps/web/src/dice/ui/DiceTray.tsx` - Dice Tray/Animation Renderer mit Visible-Cap
- `apps/web/src/types/dice-box.d.ts` - minimale Type-Decls fuer `@3d-dice/dice-box`
- `apps/web/src/characterSheets/types.ts` - Character Sheets Domaintypen
- `apps/web/src/characterSheets/generated/templatesIndex.ts` - generierter Template-Index + Lazy-Loader
- `apps/web/src/characterSheets/generated/template_*.json` - generierte Feld-/Page-Metadaten pro PDF-Template
- `apps/web/src/characterSheets/ui/CharacterSheetEditor.tsx` - Overlay Editor fuer AcroForm-Felder
- `apps/web/src/characterSheets/ui/PdfPageBackground.tsx` - optionales PDF-Seitenrendering im Editor (lazy)
- `apps/web/src/characterSheets/ui/CharacterSheetsHub.tsx` - vereinfachter Character Sheets Hub ohne Preview
- `apps/web/src/characterSheets/ui/GeneralSheetDownloadCard.tsx` - General Sheet Download (einziger sichtbarer Direkt-Download)
- `apps/web/src/characterSheets/ui/RecommendedSheetsNotice.tsx` - DMs Guild Empfehlung fuer class-spezifische Sheets
- `apps/web/src/characterSheets/ui/SheetUploadCard.tsx` - Upload/Import Einstieg
- `apps/web/src/characterSheets/ui/ImportedSheetsList.tsx` - lokale Liste gespeicherter Imports
- `apps/web/src/characterSheets/ui/ImportedSheetSummary.tsx` - Import-Status/Meta Zusammenfassung
- `apps/web/src/characterSheets/ui/ImportedFieldsTable.tsx` - strukturierte Parsed-Values Tabelle mit Validation-Status
- `apps/web/src/characterSheets/storage/characterSheetsRepository.ts` - IndexedDB Repository fuer Sheet-Instanzen + lokale Import-Records
- `apps/web/src/characterSheets/pdf/fillPdf.ts` - clientseitiges PDF-Fuellen + Download
- `apps/web/src/characterSheets/pdf/readPdfFields.ts` - clientseitiges Feld-Auslesen aus hochgeladenem PDF
- `apps/web/src/characterSheets/templateMatching.ts` - Template-Matching Heuristik (Feldnamen-Overlap)
- `apps/web/src/characterSheets/validation/validateImportedSheet.ts` - Import-Validierung + Normalisierung + Extracted-Fields-Aufbereitung
- `apps/web/src/characterBuilder/model/character.ts` - canonical CharacterRecord Modell + Default-Factory
- `apps/web/src/characterBuilder/model/decisions.ts` - generisches Decision-Modell + Builder Sections
- `apps/web/src/characterBuilder/storage/characterRepository.ts` - IndexedDB Repository (`dnd-vtt-characters-v1`) inkl. Debounced Autosave/Snapshots
- `apps/web/src/characterBuilder/rules/rulesFacade.ts` - normalisierte Rules-Zugriffsschicht (Classes/Subclasses/Races/Backgrounds/Feats/Spells/Equipment)
- `apps/web/src/characterBuilder/rules/backgroundRulesFacade.ts` - Builder-Zugriff auf strukturierte Background-Details + Alias-Resolution
- `apps/web/src/characterBuilder/generated/backgroundsLookup.ts` - generierter Builder-Lookup fuer Backgrounds
- `apps/web/src/characterBuilder/engine/deriveCharacter.ts` - zentrale Derivation (Stats, Limits, Decisions, Validation Input)
- `apps/web/src/characterBuilder/engine/pendingDecisions.ts` - dynamische Pending-Decision-Erzeugung
- `apps/web/src/characterBuilder/engine/validation.ts` - Blocking Errors / Warnings
- `apps/web/src/characterBuilder/engine/completion.ts` - Completion-Status (`draft`, `in_progress`, `ready`, `invalid`)
- `apps/web/src/characterBuilder/engine/choiceResolution.ts` - Invalidations bei Upstream-Edits (class/race/background/level)
- `apps/web/src/characterBuilder/export/mapCharacterToGeneralSheet.ts` - Mapping CharacterRecord -> General Sheet Felder
- `apps/web/src/characterBuilder/ui/CharacterBuilderShell.tsx` - Guided Builder Shell (Sidebar, Steps, Decision Panel, Autosave)
- `apps/web/src/characterBuilder/ui/BuilderSidebar.tsx` - Sections + Completion/Warning/Pending Status
- `apps/web/src/characterBuilder/ui/ReviewPanel.tsx` - Final Review & Export UI
- `apps/web/src/characterBuilder/ui/spells/SpellChoicePanel.tsx` - Spell-Auswahl Panel (granted/known/prepared)
- `apps/web/src/characterBuilder/ui/spells/SpellPickerTable.tsx` - schnelle Spell-Tabelle mit Suche/Filtern
- `apps/web/src/characterBuilder/ui/spells/SelectedSpellsPanel.tsx` - aktuelle Spell-Selections + Zaehler
- `apps/web/src/characterBuilder/pointBuy/types.ts` - gemeinsame Point-Buy Typen/Abilities
- `apps/web/src/characterBuilder/pointBuy/rules.ts` - Point-Buy Kernregeln und Finale-Score-Berechnung
- `apps/web/src/characterBuilder/pointBuy/bonuses.ts` - SRD Background- und Legacy Race-Bonuslogik
- `apps/web/src/characterBuilder/pointBuy/advancement.ts` - ASI/Feat-Slot-Berechnung aus Class-Daten + Fallback-Presets
- `apps/web/src/characterBuilder/pointBuy/PointBuyCalculator.tsx` - Point-Buy UI inkl. lokaler Persistenz
- `apps/web/scripts/build-character-sheets.ts` - Build-Script fuer Character Sheets aus lokalen PDFs
- `apps/web/scripts/copy-dice-box-assets.ts` - kopiert Dice-Box Assets nach `public/assets/dice-box`
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
- `apps/web/src/rules/classes/parse/parseClassesContentJson.ts` - JSON Parser + strukturierte Extraction fuer `content/*.json`
- `apps/web/src/rules/classes/worker/classesWorker.ts` - Worker Entry fuer schnelle Klassenfilter
- `apps/web/src/rules/classes/worker/classesWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/classes/worker/filterClasses.ts` - Bitset-Filterlogik
- `apps/web/src/rules/classes/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/src/rules/classes/ui/ClassDocumentBlocks.tsx` - Renderer fuer Klassen-Dokumentbloecke
- `apps/web/src/rules/classes/ui/tagLabels.ts` - Tag-Label Formatter fuer Classes/Subclasses
- `apps/web/src/rules/classes/api/classesData.ts` - future-proof Data Access API fuer Character Builder Lookups
- `apps/web/scripts/build-classes-pack.ts` - Build-Script fuer eingebautes Classes/Subclasses Pack
- `apps/web/src/rules/backgrounds/model.ts` - gemeinsame Background Pack/Detail Typen
- `apps/web/src/rules/backgrounds/generated/backgroundsIndex.ts` - generierter Backgrounds-Index (Build-Time)
- `apps/web/src/rules/backgrounds/api/backgroundsData.ts` - Lazy-Loading API fuer Background-Details
- `apps/web/src/rules/backgrounds/parse/extractBackgrounds.ts` - Loader fuer lokale Background JSONs
- `apps/web/src/rules/backgrounds/parse/extractStructuredBackgroundData.ts` - strukturierte Extraction fuer Skills/Tools/Languages/Equipment/Feature
- `apps/web/src/rules/backgrounds/parse/treeToBlocks.ts` - HTML-Tree -> RuleBlocks
- `apps/web/src/rules/backgrounds/parse/normalizeNames.ts` - Normalisierung/Choice-Parsing Helfer
- `apps/web/src/rules/backgrounds/ui/BackgroundFactsPanel.tsx` - Quick Facts Panel fuer Backgrounds
- `apps/web/src/rules/backgrounds/ui/BackgroundSections.tsx` - strukturierte Background-Sektionen
- `apps/web/src/rules/backgrounds/worker/backgroundsWorker.ts` - Worker Entry fuer schnelle Background-Filterung
- `apps/web/src/rules/backgrounds/worker/backgroundsWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/backgrounds/worker/filterBackgrounds.ts` - Bitset-Filterlogik
- `apps/web/src/rules/backgrounds/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/scripts/build-backgrounds-pack.ts` - Build-Script fuer strukturiertes Backgrounds Pack
- `apps/web/src/rules/lineages/types.ts` - gemeinsame Lineages Pack-Typen
- `apps/web/src/rules/lineages/generated/lineagesIndex.ts` - generierter Lineages-Index (Build-Time)
- `apps/web/src/rules/lineages/parse/parseLineagesContentJson.ts` - JSON Parser + strukturierte Extraction fuer `content/*.json` (LINEAGE)
- `apps/web/src/rules/lineages/worker/lineagesWorker.ts` - Worker Entry fuer schnelle Lineages-Filterung
- `apps/web/src/rules/lineages/worker/lineagesWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/lineages/worker/filterLineages.ts` - Bitset-Filterlogik
- `apps/web/src/rules/lineages/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/src/rules/lineages/ui/tagLabels.ts` - Tag-Label Formatter fuer Lineages
- `apps/web/src/rules/lineages/api/lineagesData.ts` - Data Access API fuer Lineages Meta/Detail
- `apps/web/scripts/build-lineages-pack.ts` - Build-Script fuer eingebautes Lineages Pack
- `apps/web/src/rules/feats/types.ts` - gemeinsame Feats Pack-Typen
- `apps/web/src/rules/feats/generated/featsIndex.ts` - generierter Feats-Index (Build-Time)
- `apps/web/src/rules/feats/parse/parseFeatsContentJson.ts` - JSON Parser + strukturierte Extraction fuer `content/*.json` (FEAT)
- `apps/web/src/rules/feats/worker/featsWorker.ts` - Worker Entry fuer schnelle Feats-Filterung
- `apps/web/src/rules/feats/worker/featsWorkerClient.ts` - Worker Client API
- `apps/web/src/rules/feats/worker/filterFeats.ts` - Bitset-Filterlogik
- `apps/web/src/rules/feats/worker/messages.ts` - Worker Request/Response Typen
- `apps/web/src/rules/feats/ui/tagLabels.ts` - Tag-Label Formatter fuer Feats
- `apps/web/src/rules/feats/api/featsData.ts` - Data Access API fuer Feats Meta/Detail + Point-Buy Lookup
- `apps/web/scripts/build-feats-pack.ts` - Build-Script fuer eingebautes Feats Pack
- `apps/web/src/rules/srd/types.ts` - SRD Datentypen (Meta/Detail/Bitsets)
- `apps/web/src/rules/srd/parse/srdJsonLoader.ts` - SRD JSON Loader + Block-Normalisierung
- `apps/web/src/rules/srd/parse/segmentByHeadings.ts` - Segmentierungshilfen fuer SRD Kapitel/Eintraege
- `apps/web/src/rules/srd/parse/extractors/index.ts` - SRD Kategorie-Extractor (Races/Equipment/Rules/Conditions/Magic Items/Monsters)
- `apps/web/src/rules/srd/generated/srdIndex.ts` - generierter SRD Meta-Index
- `apps/web/src/rules/srd/generated/srdBitsets.ts` - generierte SRD Tag-Bitsets fuer Worker
- `apps/web/src/rules/srd/api/srdData.ts` - SRD Data Access API mit Detail-Cache
- `apps/web/src/rules/srd/worker/srdWorker.ts` - SRD Worker Entry
- `apps/web/src/rules/srd/worker/srdWorkerClient.ts` - SRD Worker Client API
- `apps/web/src/rules/srd/worker/filterSrd.ts` - SRD Bitset-Filterlogik
- `apps/web/src/rules/srd/ui/SrdDocumentBlocks.tsx` - Renderer fuer SRD Content-Bloecke
- `apps/web/scripts/build-srd-pack.ts` - Build-Script fuer SRD 5.1 Pack
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
- `apps/web/src/characterSheets/validation/validateImportedSheet.test.ts` - Import-Validierungsregeln Test
- `apps/web/src/routes/player/CharacterSheetsHubRoute.test.tsx` - Hub/Import Flow Rendering Test
- `apps/web/src/rules/spells/parse/parseSpellsTxt.test.ts` - Parser Unit Tests (Fixture)
- `apps/web/src/rules/spells/parse/spellTableOverrides.test.ts` - Tests fuer Tabellen-Wiederherstellung
- `apps/web/src/rules/spells/worker/filterSpells.test.ts` - Worker-Filterlogik Tests
- `apps/web/src/rules/classes/parse/parseClassesContentJson.test.ts` - JSON Parser Unit Test inkl. Wikidot/URL-Sanitisierung
- `apps/web/src/rules/classes/worker/filterClasses.test.ts` - Worker-Filterlogik Tests
- `apps/web/src/rules/lineages/parse/parseLineagesContentJson.test.ts` - Lineages Parser Unit Test inkl. Wikidot/URL-Sanitisierung
- `apps/web/src/rules/lineages/worker/filterLineages.test.ts` - Worker-Filterlogik Tests
- `apps/web/src/rules/feats/parse/parseFeatsContentJson.test.ts` - Feats Parser Unit Test inkl. Wikidot/URL-Sanitisierung
- `apps/web/src/rules/feats/worker/filterFeats.test.ts` - Worker-Filterlogik Tests
- `apps/web/src/rules/feats/api/featsData.test.ts` - Feats Data API Tests fuer Point-Buy Lookup
- `apps/web/src/rules/srd/parse/extractors.test.ts` - SRD Parser/Extractor Unit Test mit Fixture
- `apps/web/src/rules/srd/worker/filterSrd.test.ts` - SRD Worker-Filterlogik Tests
- `apps/web/src/rules/srd/generated/srdBuildArtifacts.test.ts` - SRD Build-Artefakt-Test (Index/Details + kein `wikidot`)
- `apps/web/src/dice/rng.test.ts` - RNG Range Tests
- `apps/web/src/dice/roll.test.ts` - Multi-Dice Summen-/Anzahltests
- `apps/web/src/dice/initiative.test.ts` - Initiative Modifier-/Sortier-/Formatter Tests
- `apps/web/src/characterBuilder/pointBuy/rules.test.ts` - Point-Buy Kosten-/Cap-Tests
- `apps/web/src/characterBuilder/pointBuy/bonuses.test.ts` - Half-Elf/Legacy-Bonus Tests
- `apps/web/src/characterBuilder/pointBuy/advancement.test.ts` - ASI-Level-Erkennung + Fallback-Preset Tests

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

### Character Builder (client-only, local-first)

- Keine Builder-API im Backend. Alle Regeln, Ableitungen, Validierungen und Entscheidungen laufen im Browser.
- Datenfluss pro Charakter:
  1. `CharacterRecord` (canonical JSON) laden/editen.
  2. `deriveCharacter()` berechnet:
     - legal option scopes (ueber `rulesFacade`)
     - abgeleitete Werte (Abilities/Mods/Combat/Spells)
     - `pendingDecisions`
     - `validation.errors` / `validation.warnings`
     - Completion Status (`draft`, `in_progress`, `ready`, `invalid`)
  3. UI zeigt nur relevante Entscheidungen pro Section (guided flow).
  4. Bei Upstream-Aenderungen invalidiert `choiceResolution` nur abhaengige Downstream-Entscheidungen.
  5. Autosave persistiert lokal in `dnd-vtt-characters-v1`.
- Character Sheet:
  - waehrend des Builds keine Live-PDF-Preview.
  - erst auf `/player/characters/:characterId/review` wird das General Sheet im Hintergrund befuellt und heruntergeladen.
- Your Characters:
  - Builder-Records werden automatisch als lokale Karten gelistet (inkl. status/summary stats).
  - importierte Sheet-Records bleiben parallel sichtbar.

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

Weitere browserlokale DBs:

- `dnd-vtt-characters-v1`
  - `characters` (canonical CharacterRecord inkl. derived/validation/completion)
  - `characterSnapshots` (leichte Autosave-Checkpoints)
  - `characterIndex` (optionaler Summary-Store fuer schnelle Kartenlisten)
- `dnd-vtt-character-sheets-v1`
  - `instances` (ausgefuellte Character-Sheet Instanzen)
  - `recent` (zuletzt geoeffnete Instanzen je Template)
  - `imports` (lokale Import-Ergebnisse inkl. Parsed Data, Validation Summary, Extracted Fields, Template-Meta)
- `dnd-vtt-dm-data-v1`
  - `npcs` (lokale NPC Library fuer OOG Initiative Roller, inkl. `initiativeMod`)

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
  - Standard: `./content` (pro Class/Subclass eine JSON-Datei, optional `_index.json` fuer Reihenfolge)
  - Optional: `CLASSES_JSON_DIR=<pfad>` setzen
- Build:

```powershell
pnpm classes:build
pnpm dev
```

Wenn das Verzeichnis fehlt oder keine validen CLASS/SUBCLASS JSONs enthalten sind, bricht `classes:build` mit klarer Fehlermeldung ab.

### Lineages Pack Build (Stats & Rules)

- Races/Lineages nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal eingebettet:
  - Standard: `./content` (JSON-Dateien mit `kind: "LINEAGE"`)
  - Optional: `LINEAGES_JSON_DIR=<pfad>` setzen
- Build:

```powershell
pnpm lineages:build
pnpm dev
```

Wenn das Verzeichnis fehlt oder keine validen LINEAGE JSONs enthalten sind, bricht `lineages:build` mit klarer Fehlermeldung ab.

### Feats Pack Build (Stats & Rules)

- Feats nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal eingebettet:
  - Standard: `./content` (JSON-Dateien mit `kind: "FEAT"`)
  - Optional: `FEATS_JSON_DIR=<pfad>` setzen
- Build:

```powershell
pnpm feats:build
pnpm dev
```

Wenn das Verzeichnis fehlt oder keine validen FEAT JSONs enthalten sind, bricht `feats:build` mit klarer Fehlermeldung ab.

### Races Pack Build (Stats & Rules + Character Builder)

- Strukturierte SRD-Races nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal aus derselben SRD-Datei erzeugt:
  - Standard: `./content/SRD_CC_v5.1.json`
  - Optional: `SRD_JSON_PATH=<pfad>` setzen
- Build:

```powershell
pnpm races:build
pnpm dev
```

- Build erzeugt:
  - `apps/web/src/rules/races/generated/racesIndex.ts`
  - `apps/web/src/rules/races/generated/raceLookup.ts`
  - `apps/web/public/rules/races/<id>.json`
- `@dnd-vtt/web` fuehrt den Schritt automatisch ueber `content:build` in `predev`/`prebuild`/`pretest` aus.

Wenn die Datei fehlt, bricht `races:build` mit klarer Fehlermeldung ab.

### Backgrounds Pack Build (Stats & Rules + Character Builder)

- Strukturierte Backgrounds nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal aus den bereits exportierten JSON-Dateien erzeugt:
  - Standard: `./content/background`
  - Optional: `BACKGROUNDS_DIR=<pfad>` setzen
- Build:

```powershell
pnpm backgrounds:build
pnpm dev
```

- Build erzeugt:
  - `apps/web/src/rules/backgrounds/generated/backgroundsIndex.ts`
  - `apps/web/src/characterBuilder/generated/backgroundsLookup.ts`
  - `apps/web/public/rules/backgrounds/<id>.json`
- `@dnd-vtt/web` fuehrt den Schritt automatisch ueber `content:build` in `predev`/`prebuild`/`pretest` aus.

Wenn das Verzeichnis fehlt oder keine validen BACKGROUND JSONs enthalten sind, bricht `backgrounds:build` mit klarer Fehlermeldung ab.

### SRD 5.1 Pack Build (Stats & Rules + DM Monsters)

- SRD-Inhalte nutzen **keine Import-UI** und **keine API**.
- Datensatz wird zur Build-Zeit lokal eingebettet:
  - Standard: `./content/SRD_CC_v5.1.json`
  - Optional: `SRD_JSON_PATH=<pfad>` setzen
- Build:

```powershell
pnpm srd:build
pnpm dev
```

Wenn die Datei fehlt, bricht `srd:build` mit klarer Fehlermeldung ab.

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
- `pnpm classes:build` - baut das integrierte Classes/Subclasses Pack aus `content/*.json`
- `pnpm lineages:build` - baut das integrierte Races/Lineages Pack aus `content/*.json`
- `pnpm races:build` - baut den strukturierten SRD-Race/Subrace Pack aus `content/SRD_CC_v5.1.json`
- `pnpm backgrounds:build` - baut das strukturierte Backgrounds Pack aus `content/background/*.json`
- `pnpm feats:build` - baut das integrierte Feats Pack aus `content/*.json`
- `pnpm srd:build` - baut das integrierte SRD 5.1 Pack aus `content/SRD_CC_v5.1.json`
- `pnpm sheets:build` - baut Character Sheet Templates aus lokalen PDFs
- `pnpm dice3d:assets` - kopiert `@3d-dice/dice-box` Assets nach `apps/web/public/assets/dice-box`
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
- `pnpm --filter @dnd-vtt/web lineages:build`
- `pnpm --filter @dnd-vtt/web races:build`
- `pnpm --filter @dnd-vtt/web backgrounds:build`
- `pnpm --filter @dnd-vtt/web feats:build`
- `pnpm --filter @dnd-vtt/web srd:build`
- `pnpm --filter @dnd-vtt/web sheets:build`
- `pnpm --filter @dnd-vtt/web dice3d:assets`
- `predev`/`prebuild`/`pretest` in `@dnd-vtt/web` fuehren `content:build` (inkl. `races:build`, `backgrounds:build` und `srd:build`) + `dice3d:assets` automatisch aus

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

### 5) Manueller Stats-&-Rules Races/Lineages Smoke

1. Browser auf `/rules/lineages` oeffnen.
2. Erwartung:
   - Liste rendert schnell (ohne API-Calls), Group/Setting/Tag Filter sind sichtbar.
3. In der Liste:
   - Name-Filter tippen (z. B. `elf`) -> Ergebnisse aktualisieren sofort.
   - Group und Setting wechseln -> Treffer werden sofort eingegrenzt.
4. Einen Lineage-Eintrag klicken.
5. Erwartung:
   - Navigation auf `/rules/lineages/:id`.
   - Detailansicht zeigt Quick Facts, Traits und sauber strukturierte Rules-Bloecke (Listen/Tabellen/Headings).
6. Legacy-Redirects pruefen:
   - `/lineages` -> `/rules/lineages`
   - `/lineages/elf` -> `/rules/lineages/elf`
   - `/races` -> `/rules/lineages`
7. Optional Konsistenzcheck:
   - `rg -n -i wikidot apps/web/src/rules/lineages/generated apps/web/public/rules/lineages/entries`
   - Erwartung: keine Treffer.

### 5a) Manueller Stats-&-Rules Backgrounds Smoke

1. Browser auf `/rules/backgrounds` oeffnen.
2. Erwartung:
   - Liste rendert schnell (ohne API-Calls), Suche sowie Filter fuer Kategorie/Skills/Tools/Languages/Choices/Feature/Equipment sind sichtbar.
3. In der Liste:
   - Name- oder Alias-Filter tippen (z. B. `spy`) -> Ergebnisse aktualisieren sofort.
   - Kategorie und Checkbox-Filter wechseln -> Treffer werden sofort eingegrenzt.
4. Einen Background-Eintrag klicken.
5. Erwartung:
   - Navigation auf `/rules/backgrounds/:id`.
   - Detailansicht zeigt Quick Facts, strukturierte Proficiencies, Equipment, Feature, Personality/Variants und darunter den vollstaendigen Regeltext.
6. Legacy-Redirects pruefen:
   - `/backgrounds` -> `/rules/backgrounds`
   - `/background/acolyte` -> `/rules/backgrounds/acolyte`

### 6) Manueller SRD 5.1 Rules + DM Monsters Smoke

1. Browser auf `/rules/conditions` oeffnen.
2. Erwartung:
   - Liste rendert sofort (clientseitig), Name/Tag Filter reagieren ohne API-Requests.
3. Einen Condition-Eintrag oeffnen.
4. Erwartung:
   - Detailansicht zeigt strukturierte Regeln (List/Tabelle/Paragraph) aus statischer JSON-Datei.
5. Browser auf `/rules/magic-items` und `/rules/races` pruefen.
6. Erwartung:
   - beide Listen rendern schnell, Detailseiten laden on-demand per statischer Datei unter `/rules/srd/...` bzw. `/rules/races/...`.
   - `/rules/races` bietet strukturierte Filter fuer Size, Speed, Darkvision, Languages, Tool Choices, Weapon Proficiencies und Resistances.
   - Race-Detailseiten zeigen Quick Facts, Proficiencies, Defenses, Traits und darunter weiterhin den kompletten Original-Regeltext.
7. Browser auf `/rules/srd-attribution` oeffnen.
8. Erwartung:
   - CC-BY Attributionstext wird angezeigt.
9. Browser auf `/dm/monsters` oeffnen.
10. Erwartung:
   - Monsterliste mit Filtern `Type`, `CR`, `Size`.
11. Einen Monster-Eintrag oeffnen und `Add to NPC Library` klicken.
12. Erwartung:
   - Erfolgsmeldung erscheint, NPC ist lokal fuer OOG Initiative nutzbar.

### 6a) Manueller Guided Character Builder Smoke

1. Browser auf `/player/characters` oeffnen.
2. Erwartung:
   - `Your Characters` zeigt lokale Builder-Charaktere und (falls vorhanden) importierte Sheet-Records.
3. `New Character` klicken.
4. Erwartung:
   - Navigation nach `/player/characters/:characterId`.
   - gefuehrte Sections + Sidebar Status sind sichtbar.
   - keine Live-PDF-Preview.
5. Basics/Origin/Ability Scores ausfuellen:
   - Class + ggf. Subclass
   - Race/Species + Background
   - Point Buy direkt im Ability-Score Schritt
6. Erwartung:
   - Pending Decisions aktualisieren sich dynamisch.
   - bei Upstream-Aenderung (z. B. Class-Wechsel) werden nur abhaengige Downstream-Choices auf `Needs review` gesetzt.
7. `/player/characters/:characterId/review` oeffnen.
8. Erwartung:
   - Final Review zeigt Validation Summary, Stats, Proficiencies, Spells, Equipment.
   - `Download filled General Sheet` funktioniert ohne vorherige Live-Preview.
9. Zurueck auf `/player/characters`.
10. Erwartung:
   - der Charakter erscheint/aktualisiert sich automatisch als lokale Karte.

### 7) Manueller Character Sheets Smoke

1. Browser auf `/player/characters/sheets` oeffnen.
2. Erwartung:
   - genau ein sichtbarer Direkt-Download: `General Character Sheet` mit Button `Download blank PDF`.
   - DMs Guild Empfehlungstext fuer class-spezifische Sheets ist sichtbar.
   - kein sichtbarer PDF-Preview-Bereich im Hub.
3. `Download blank PDF` klicken.
4. Erwartung:
   - blankes General Sheet wird heruntergeladen.
5. `Upload filled character sheet PDF` mit einer ausgefuellten kompatiblen PDF testen.
6. Erwartung:
   - Import bleibt lokal/client-only.
   - ein Template wird erkannt.
   - Validation Summary (`Imported successfully`, `X warnings`, `Y errors`) erscheint.
   - strukturierte Parsed-Values Tabelle (Identity/Core stats/Combat/Skills/Spellcasting/Features / Notes) erscheint.
7. Seite neu laden.
8. Erwartung:
   - Import bleibt in `Saved local character imports` erhalten und kann ohne Re-Upload wieder geoeffnet werden.

### 8) Manueller OOG Dice Smoke

1. Browser auf `/dice` oeffnen.
2. Multi-Dice pruefen:
   - z. B. `2d20 + 3d6` setzen, Modifier eintragen, `Roll` klicken.
   - Erwartung: Ergebnis, Dice Tray und History aktualisieren sich sofort.
3. `Copy result` klicken.
4. Erwartung:
   - kompakter Roll-String landet in der Zwischenablage.
5. Initiative Quick Groups pruefen:
   - Gruppen mit Name/Count/Mod anlegen und `Roll Initiative` klicken.
   - Erwartung: Tabelle sortiert absteigend nach Total, bei Gleichstand nach d20 und Name.
6. Initiative `From NPC Library` pruefen:
   - falls NPCs in `dnd-vtt-dm-data-v1` vorhanden sind: mehrere waehlen, Count/Mod optional anpassen, rollen.
   - falls keine NPCs vorhanden: Hinweis `No NPCs found in your library yet.`.
7. Animation mode pruefen:
   - `Animation mode` auf `Off`, `2D`, `3D` umschalten.
   - `3D`: Tray muss erscheinen, `Roll` aktualisiert dieselbe Result-/History-UI.
   - gemischter Roll (`2d20 + 1d6`) in `3D`: Gruppen rollen gleichzeitig.
   - `Total mode` + `Separate d20 / d100` pruefen.
   - bei `prefers-reduced-motion`: Default ist `Off`.
8. 3D Fallback pruefen:
   - WebGL blockieren/Fehler simulieren -> UI faellt automatisch auf `2D` bzw. `Off` zurueck und zeigt Hinweis.
9. Devtools/Netzwerk pruefen:
   - keine API Requests fuer Dice oder Initiative (alles clientseitig/lokal).

### 9) Manueller LOCAL Session Smoke

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

### 10) Reconnect Smoke

1. Host refresh/reconnect.
2. Erwartung:
   - Snapshot wird aus IndexedDB geladen.
   - Teilnehmer erhalten konsistenten State nach Resync.

### 11) Export/Import Smoke (LOCAL)

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
- Character Sheets Hub Rendering + Import Flow Tests (General-only download, recommendation link, parsed table)
- Character Sheets Import Validation Unit Tests
- Character Sheets IndexedDB Import Repository Tests
- Character Builder Derivation Engine Tests (abilities/proficiency/spell limits)
- Character Builder Pending Decision Tests (subclass/class skills/subrace/race ability choices/granted spells/ASI)
- Character Builder Invalidation Tests (`choiceResolution`)
- Character Builder IndexedDB Repository Tests
- Character Builder Route Smoke Tests (guided flow + review route)
- Dice RNG + Roll + Initiative Unit Tests
- Spells TXT Parser + Pack Builder
- Spells Worker Filterlogik (Tag-Bitsets + Query + Pagination)
- Classes/Subclasses JSON Parser + Build-Time Sanitisierung (inkl. wikidot-/URL-Removal)
- Classes/Subclasses Worker Filterlogik (Tag-Bitsets + Query + Kind/Class Filter)
- Structured SRD Race Extractor + Builder Merge Tests (z. B. Dwarf/Hill Dwarf/Elf/High Elf/Human)
- Background Parser/Extractor Tests (z. B. Acolyte/Criminal/Charlatan)
- Background Builder Facade Tests (Alias-Resolution + Grants/Choices/Features)
- SRD Parser/Extractor Unit Test (Fixture mit Headings/Tabellen/Conditions)
- SRD Worker Filterlogik (Bitset + Query + Monsterfilter)
- SRD Build-Artefakt-Test (Index/Bitsets/Detail-JSON vorhanden, kein `wikidot`)

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
- Classes/Subclasses Pack Build benoetigt JSON Quelldateien in `./content` oder `CLASSES_JSON_DIR`.
- Structured Races Pack Build benoetigt `content/SRD_CC_v5.1.json` oder `SRD_JSON_PATH`.
- Structured Backgrounds Pack Build benoetigt `content/background` oder `BACKGROUNDS_DIR`.
- SRD Pack Build benoetigt `content/SRD_CC_v5.1.json` oder `SRD_JSON_PATH`.

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
