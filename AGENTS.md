# Repository Guidelines

## Required Architecture and Style References

Read and follow these documents before changing application code:

- [Architecture](docs/architecture.md): module responsibilities, dependency boundaries, intermediate types, platform adapters, and pragmatic application of SOLID and KISS.
- [Code style](docs/code-style.md): Prettier configuration, logical code blocks, multiline conditionals with braces, spacing between functions and arrow functions, explicit TypeScript types, Zod usage, and readable tests.

Keep changes consistent with both guides. Prefer the simplest abstraction that isolates a real responsibility or dependency, and keep platform-specific types inside their adapters. For formatting, the actual `.prettierrc` and `.editorconfig` settings are the source of truth.

## Project Structure & Module Organization

TypeScript source lives in `src/`. See [Architecture](docs/architecture.md) for the current module map. `src/telegram/bot.ts` configures the Telegram bot, `src/index.ts` loads environment variables and starts it, and `src/logging.ts` configures Pino. Agent-specific code lives in `src/agent/`. Follow screaming architecture: organize code by feature or domain so the directory structure communicates what the application does. When a module grows into related parts, promote it to a directory with focused submodules (for example, `agent/agent.ts` and `agent/response.ts`). Declare functions in the module that owns their responsibility. Reusable prompt text lives in `prompts/`; character reference material lives in `context/character/`. TypeScript emits JavaScript and declarations to `dist/`, which is ignored by Git. Keep generated files and dependencies out of commits.

## Build, Test, and Development Commands

Use pnpm for dependency management and project commands. Use the version declared in the `packageManager` field of `package.json`, and keep `pnpm-lock.yaml` and `pnpm-workspace.yaml` in sync with dependency and installation settings.

- `pnpm install --frozen-lockfile` installs the versions recorded in `pnpm-lock.yaml`.
- `pnpm add <package>` adds a runtime dependency; `pnpm add -D <package>` adds a development dependency.
- `pnpm run build` compiles `src/` with the strict TypeScript settings in `tsconfig.json` and writes to `dist/`.
- `pnpm start` runs the Telegram bot from `src/index.ts` through `tsx`; set `NYMPH_TELEGRAM_TOKEN` first.
- `pnpm test` runs Vitest in watch mode; `pnpm test --run` runs the suite once.
- `pnpm lint` runs Oxlint and checks formatting in `src/` with Prettier.
- `pnpm lint:fix` applies automatic Oxlint fixes.
- `pnpm format` formats `src/` with Prettier using `.prettierrc`.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep type checking strict. Follow [Code style](docs/code-style.md). Use Prettier with `.prettierrc` and `.editorconfig` as the source of truth for formatting, including tabs, double quotes, no semicolons, no trailing commas, and a print width of 120. Insert a blank line between distinct code blocks. Always write `if` statements with braces and a multiline body; never use inline `if` statements. Use descriptive camelCase names for variables and functions, and lowercase filenames such as `logging.ts`. For relative imports of local TypeScript modules, use the `.js` extension required by the NodeNext module configuration (for example, `./platform.js`). Use Oxlint for lint checks. After code changes, run `pnpm format` and fix lint issues, using `pnpm lint:fix` where appropriate. Review automatic changes and ensure `pnpm lint` and `pnpm run build` pass before submitting.

## Testing Guidelines

Use the existing Vitest test runner and filenames such as `platform.test.ts`. For changes to source code, verify that `pnpm lint` and `pnpm run build` succeed, run the relevant tests with `pnpm test --run`, and describe any manual checks in the pull request. There are no coverage requirements yet.

## Commit & Pull Request Guidelines

Git is initialized on `main`, but there are no commits yet, so no commit message convention can be inferred. Write concise, imperative subjects that describe the change, such as `Add prompt loading`. Pull requests should explain the behavior changed, list verification commands, and identify any new configuration variables. Include screenshots only for changes with a visual result.

## README Documentation

Do not describe functional aspects of the application in `README.md` unless explicitly requested.

## Configuration & Secrets

Copy `.env.example` to `.env` for local settings. Set `NYMPH_OPENAI_API_KEY` and `NYMPH_TELEGRAM_TOKEN` only in local or deployment secrets, and do not commit credentials. `NYMPH_LOG_LEVEL` controls logging verbosity; `NYMPH_LOG_FILE` can override the default log destination. Keep `.env` untracked.

## Database Schema

Maintain the complete PostgreSQL schema in `sql/squema.sql`; do not create migration files. Validate application data in TypeScript rather than with database validation constraints such as `CHECK`, `NOT NULL`, or `UNIQUE`. Primary keys, column types, defaults, and non-unique indexes may be defined in the schema. Task UUID duplicate checks must be serialized in the repository so concurrent inserts cannot bypass application validation.

## Code and Test Conventions

Define types and interfaces explicitly in TypeScript. Do not derive application types from Zod schemas with `z.infer`, `z.input`, or `z.output`. Use Zod only where runtime validation or an external API schema is needed; schemas must conform to the independently declared TypeScript types.

Treat parsed external data as unknown and validate it at the domain boundary. Value objects use public, typed constructors that call a private `validate` method to check the validity of their public readonly `value`, without repeating TypeScript type checks. Expose value objects as public readonly properties on the owning class rather than adding forwarding getters.

Keep tests direct and readable: import the code under test normally, construct it with plain object fixtures when appropriate, and assert the result or thrown error. Avoid dynamic source loading, test-only wrappers, and type casts for malformed input. When an `if` condition becomes long, evaluate its parts into clearly named boolean constants before the `if`.
