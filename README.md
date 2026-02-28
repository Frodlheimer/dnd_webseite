# D&D VTT Monorepo Foundation

Dieses Repository liefert das skalierbare Grundgeruest fuer eine D&D 5e SRD 5.1/5.2 VTT-Webapp.
Aktuell ist nur die Foundation plus eine lauffaehige Hello-World-Vertikalscheibe enthalten:

- `apps/web`: React + Vite + Tailwind + Zustand + PixiJS Board-Placeholder
- `apps/api`: Fastify + WebSocket Handshake + Zod Validation + Prisma Setup
- `packages/shared`: gemeinsame Zod Contracts und Domain-Typen

## Voraussetzungen

- Node.js >= 20
- pnpm >= 9
- Docker (optional, empfohlen fuer lokale PostgreSQL-Instanz)

## Projektstruktur

```text
.
|- apps/
|  |- api/
|  \- web/
|- packages/
|  \- shared/
|- docker-compose.yml
|- turbo.json
|- pnpm-workspace.yaml
\- tsconfig.base.json
```

## Setup

1. Dependencies installieren:

```bash
pnpm install
```

2. Env-Dateien anlegen:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Hinweis fuer Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

3. PostgreSQL starten:

```bash
docker compose up -d postgres
```

4. Prisma Client erzeugen + Migration ausfuehren:

```bash
pnpm prisma:generate
pnpm prisma:migrate --name init
```

## Development

```bash
pnpm dev
```

Standardports:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/health`

## Build / Lint / Test

```bash
pnpm build
pnpm lint
pnpm test
```

## WebSocket Handshake (manual)

Der WS-Handshake ist absichtlich minimal:

- Client sendet zuerst `HELLO`
- Server antwortet mit `WELCOME`

Beispiel mit Node (im Repo ausfuehren):

```bash
pnpm --filter @dnd-vtt/api exec node --input-type=module -e "import WebSocket from 'ws'; const ws = new WebSocket('ws://localhost:3000/ws'); ws.on('open', () => ws.send(JSON.stringify({ type: 'HELLO', payload: { clientId: 'manual-test', desiredRoomId: 'demo-room' } }))); ws.on('message', (msg) => { console.log(msg.toString()); ws.close(); });"
```

Erwartete Antwort:

```json
{"type":"WELCOME","payload":{"serverTime":"2026-..."}}
```

## Architektur-Notizen

- Monorepo via `pnpm workspaces` + `turborepo`
- Contracts zentral in `packages/shared` (Zod + abgeleitete TS-Typen)
- API validiert WS-Nachrichten gegen shared Schemas
- Prisma-Schema ist auf Event-Sourcing/Snapshots vorbereitet (Room, Event, Snapshot)

## Nicht enthalten (bewusst verschoben)

- Echter Room-Join via Link/Passwort
- Auth/Login
- Asset Upload/Storage
- Token Sync / Persistenzlogik
- Notes, Soundboard, Character Builder
