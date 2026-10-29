# QuoteGenerator

Internal BRIXX portal for quotes, pricing, PDF/Excel exports, sketching and 3D visualization, inventory and QR labels, planning, CRM, and retailer order requests and documents.

Built with React 19, TypeScript, Vite, Tailwind CSS, and Firebase Authentication/Firestore. Active application code lives in `src/`; Vitest tests live in `tests/`.

## Run locally

Use Node.js 22.13+ (22.x) or 24+ and npm.

```sh
npm ci
npm run dev
```

Vite opens at `http://127.0.0.1:5173` (or the next available port). If PowerShell blocks `npm.ps1`, use `cmd /c npm ...`.

Firebase client configuration is in `src/services/firebase.ts`. **Local development connects to the configured remote Firebase project**; the app does not automatically connect to an emulator. Never commit Admin credentials or local secrets.

## App structure

- `src/App.tsx` and `src/navigation/`: URL-based routes and access guards. The quote flow is content selection → configuration → pricing → summary/export.
- `src/store/`: authentication, quote state, hydration, and local persistence.
- `src/services/`: calculations, quote saving, CRM, inventory, and retailer workflows.
- `src/features/`, `src/views/`, and `src/components/`: exports, sketching, visualization, and UI.
- `src/data/` and `src/types/`: catalogs and shared contracts.
- `firestore.rules` and `firestore.indexes.json`: backend access rules and indexes.

Access levels are `full` (admin), `quote-only`, `sketch-only`, `retailer`, and `guest`. Role resolution lives in `src/store/AuthContext.tsx`; shared capabilities live in `src/config/accessControl.shared.ts`. Retailers have scoped quotes, orders, and documents. Inventory, QR tools, CRM, and planning require admin access.

## Development checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check TypeScript |
| `npm run test:confidence` | Selected regression suite |
| `npm run test:run` | Full Vitest suite |
| `npm run test:firestore` | Rules tests using the Firestore emulator; requires Java |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Preview the production build |

For a focused test, use `npm run test:run -- tests/<name>.test.js`. All scripts are listed in `package.json`. Before pushing, run `powershell -ExecutionPolicy Bypass -File ./scripts/verify-git-safety.ps1`.

Firebase Hosting serves `dist/` with the SPA rewrite configured in `firebase.json`. Local rules edits take effect only after a separate rules deployment; keep rules and application access checks aligned.

## Further reading

- [Agent instructions](AGENTS.md): architecture, invariants, and verification requirements.
- [Roadmap](roadmap.md): planned work; verify shipped behavior against source and tests.
- [3D visualization](docs/3D_VISUALIZATION.md): workflow and model limitations.
- [QR inventory](docs/QR_INVENTORY.md): labels, backfill, and rollout.
- [CRM backfill](docs/CRM_BACKFILL_GUIDE.md): preview and migration procedure.
- [Quote-save architecture](docs/adr/0001-deepen-quote-save-workflow.md): persistence and recoverable CRM synchronization.
- [Copy editing](docs/COPY_EDITING_GUIDE.md): Swedish text and encoding checks.
