# Realtime Fintech Dashboard

An Angular and TypeScript dashboard backed by a Go market generator compiled to
WebAssembly. The generator runs in a Web Worker, which calculates cumulative
metrics and sends snapshots to Angular. All market data is simulated.

## Run locally

Requirements:

- Node.js 24.15 or newer within the 24.x release line. `.nvmrc` selects Node 24;
  `package.json` lists all supported Node versions.
- Go 1.24 or newer, available on `PATH`, or selected with `GO_BINARY`.

From the repository root, with Node and Go installed:

```sh
npm ci
npm start
```

If you use nvm, run `nvm install` and `nvm use` first. Open
<http://127.0.0.1:4200/> for Dashboard or <http://127.0.0.1:4200/settings> for
Settings. Stop the development server with Ctrl+C.

This workspace also has ignored local toolchains. To use its local Node:

```sh
export PATH="$PWD/.tools/node/node_modules/.bin:$PATH"
npm start
```

The build script automatically finds `.tools/go/bin/go` when present. These
toolchains are not included in a fresh checkout. `GO_BINARY` takes precedence
when selecting the Go compiler.

Angular source changes reload during development. After editing Go, restart
`npm start` to rebuild Wasm and reload the page.

## Build and verify

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check application, worker, and unit-test TypeScript. |
| `npm run build` | Compile Go/Wasm and create the production Angular build. |
| `npm run build:wasm` | Rebuild only Wasm and its matching JavaScript runtime. |
| `npm test` | Run all TypeScript and Go unit tests once. |
| `npm run test:unit` | Run the Angular/TypeScript unit tests once. |
| `npm run test:watch` | Re-run Angular/TypeScript tests while editing. |
| `npm run test:go` | Run the Go generator unit tests once. |

Both `npm start` and `npm run build` compile Wasm automatically. Production files
are written to `dist/realtime-fintech-dashboard/browser/`. A static host must
serve the generated worker JavaScript and `wasm/market.wasm`, with a fallback to
`index.html` for application routes such as `/settings`.

The generated files `public/wasm/market.wasm` and
`src/runtime/market/generated/wasm_exec.js` are ignored by Git. The build script
copies `wasm_exec.js` from the same Go installation used to compile the binary.

Automatic deployment is not configured yet.

## Unit tests

Run `npm test` after `npm ci`. The Angular test commands automatically build Wasm
and copy its matching Go runtime first, just like `npm start`, so a fresh checkout
does not need generated assets committed to Git. The TypeScript tests use
[Angular's Vitest runner](https://angular.dev/guide/testing) with a simulated DOM;
they do not require a browser or a running development server. Go tests exercise
the source compiled into Wasm using Go's standard `testing` package.

| Requirement | Tests |
| --- | --- |
| Worked example, zero denominators, repeated symbols, instrument isolation, and unrounded cumulative VWAP | [market-accumulator.spec.ts](src/app/market/market-accumulator.spec.ts) |
| Required integer settings, inclusive ranges, and injected limits | [range-settings-policy.service.spec.ts](src/app/shared/policies/range-settings-policy.service.spec.ts) |
| Field errors, disabled Apply, draft isolation, current applied values, and navigation after Apply | [settings.spec.ts](src/app/pages/settings/settings.spec.ts) |
| Fresh Apply, unchanged/paused resets, snapshot replacement, pause acknowledgement, and stale results | [market-producer.service.spec.ts](src/app/shared/services/market-producer.service.spec.ts) |
| Connection validation, initialization failures/timeouts, stale messages, and cleanup | [producer.service.spec.ts](src/app/shared/services/producer.service.spec.ts) |
| Batch scheduling, stopping generation, retaining totals on pause, and resuming without catch-up trades | [market-worker-handler.factory.spec.ts](src/app/market/factories/market-worker-handler.factory.spec.ts) |
| Exact batch sizes, valid quotes/trades, positive price floor, and independent price evolution | [generator_test.go](internal/market/generator_test.go) |

Timer tests advance Vitest's fake clock instead of waiting. Generator tests use
fixed seeds and controlled minimum/maximum random values. Worker-handler tests
replace the Wasm loader with a controlled generator and exercise the same message
handler used by the real worker. Browser/Wasm integration is covered separately
by the manual checks below.

`npm run test:go` uses the same Go selection as the build: `GO_BINARY`, an ignored
local `.tools/go/bin/go` when available, or `go` on `PATH`. It invokes
`go test -count=1 ./...` so successful results are not served from Go's test cache.
For verbose Go output, use `npm run test:go -- -v`.

## Settings and run behavior

| Setting | Default | Inclusive range |
| --- | ---: | ---: |
| Instrument count | 5 | 1–50 |
| Updates per batch | 100 | 1–1,000 |
| Batch interval | 500 ms | 50–2,000 ms |

All fields require whole numbers. Settings opens with the applied values, and
editing creates a draft. Apply always starts a fresh running simulation with
empty rows and zero totals, including when settings are unchanged or the old run
was paused. Leaving Settings without applying discards the draft.

Pause waits for the producer's acknowledgement, including every trade generated
before the pause. Resume preserves prices and totals and waits a full interval
before the next batch; it does not generate catch-up trades. Dashboard and
Settings share the same producer. Reloading starts from the defaults.

Each symbol has one stable row. Last price, spread, and book imbalance use its
latest update. Volume includes every trade quantity, and VWAP is cumulative
`sum(priceCents * quantity) / sum(quantity)`. Book imbalance is
`(bidQuantity - askQuantity) / (bidQuantity + askQuantity)`.

Prices and cumulative notional use integer cents. VWAP can contain fractional
cents and is rounded only for display. Missing values and zero denominators
display as `—`. The worker keeps running totals without storing trade history
and stops with an error if cumulative integer totals exceed JavaScript's safe
integer range.

## Code map

| File | Responsibility |
| --- | --- |
| [app.config.ts](src/app/app.config.ts) | Defaults, limits, and runtime configuration. |
| [market.providers.ts](src/app/shared/providers/market.providers.ts) | DI bindings for configuration, source, validation, and application startup. |
| [market-producer.service.ts](src/app/shared/services/market-producer.service.ts) | Market state, Apply/reset, and run controls shared by both routes. |
| [producer.service.ts](src/app/shared/services/producer.service.ts) | Generic `listen()` API, validation, stale-response rejection, timeouts, and session cleanup. |
| [producer-source.ts](src/app/shared/contracts/producer-source.ts) | Source and session contracts, including Start, Pause, Resume, and disposal. |
| [worker-source.adapter.ts](src/app/shared/adapters/worker-source.adapter.ts) | Reusable `connectWorker()` function for messages, native errors, and worker cleanup. |
| [market-source.factory.ts](src/app/shared/factories/market-source.factory.ts) | Connect the market worker and prepare its commands. |
| [producer-message-type.enum.ts](src/app/shared/enums/producer-message-type.enum.ts) | Shared command and response types used by senders and listeners. |
| [market.worker.ts](src/app/market/market.worker.ts) | Wire browser worker messages to the market handler and Wasm loader. |
| [market-worker-handler.factory.ts](src/app/market/factories/market-worker-handler.factory.ts) | Wasm initialization, generation timer, controls, and snapshot publishing. |
| [market-accumulator.ts](src/app/market/market-accumulator.ts) | Per-symbol totals and dashboard metrics. |
| [market-runtime.adapter.ts](src/runtime/market/market-runtime.adapter.ts) | Load Go/Wasm and validate generated batch sizes and trades. |
| [generator.go](internal/market/generator.go) | Randomness, valid quotes/trades, and each symbol's previous price. |
| [main.go](cmd/market/main.go) | Go-to-JavaScript bridge. |
| [build-wasm.mjs](scripts/build-wasm.mjs) | Compile Wasm and copy the matching Go runtime. |

`MARKET_SOURCE` selects the source through DI. A replacement source must satisfy
the same connection and event contracts; the market service's `listen()` call
does not change. `MARKET_SNAPSHOT_VALIDATOR` supplies the market payload rules.
Each session owns its connection, so replacing or disposing one leaves other
sessions independent. The configured implementation remains the Go/Wasm worker.

Pages live under `src/app/pages/`; reusable components, directives, and services
live under `src/app/shared/`. `MarketDirective` exposes market data to the page,
while `ContextService` selects and updates success, pending, empty, and error
templates. Styling uses SCSS and BEM, with `src/styles.scss` as the global entry
point and shared Sass files under `src/styles/`.

## Manual browser checks

1. Open Dashboard and confirm five rows appear, then volumes grow as batches arrive.
2. Pause, note a volume, edit Settings without applying, and return. The volume
   should remain frozen. Resume and confirm it continues growing.
3. Pause again, apply a different instrument count, and confirm a fresh running
   simulation with the correct rows. Repeat Apply with identical settings.
4. Apply 50 instruments. At desktop and narrow widths, scroll the table to its
   last row and check that its headings and the header controls remain usable.
5. Check the browser console and network panel for worker/Wasm loading errors.
