# Repository Guidelines

## Project Structure & Module Organization

The MVP is in `TP4-mvp/`. API code is in `backend/src/`: feature modules go in `modules/<feature>/` and Prisma integration in `prisma/`. The database schema, migrations, and seeds are in `backend/prisma/`; do not change an applied migration.

The Expo/React Native app is in `front-end/`. Put screens in `src/pages/`, reusable UI in `src/components/`, navigation in `src/navigation/`, and HTTP, validation, and upload helpers in `src/services/`. Mobile tests are in `TP4-mvp/tests/`; API specs are in `backend/test/`. Documentation and evidence belong in `docs/`, `prints/`, and `video/`.

## Build, Test, and Development Commands

Run commands from the relevant package directory after installing dependencies with `npm ci`.

- `cd TP4-mvp/backend; npm run start:dev` - start the NestJS API in watch mode.
- `npm run build`, `npm run typecheck`, and `npm test` - compile, type-check, and run API specs.
- `npm run db:setup` - generate Prisma client, deploy migrations, and seed categories; configure `backend/.env` first.
- `cd TP4-mvp/front-end; npm start` - launch Expo; use `android`, `ios`, or `web` for a target.
- `npm test` and `npm run typecheck` - run Jest tests and TypeScript checks for the mobile app.

## Coding Style & Naming Conventions

Write TypeScript and match surrounding formatting. Backend code uses two spaces, single quotes, trailing commas, and Nest decorators; frontend mostly uses two spaces and double quotes. Use PascalCase component filenames (for example, `ClientNavigator.tsx`), camelCase values and screen IDs, and lowercase kebab-case backend feature directories such as `modules/direct-requests/`.

No lint or formatting command is configured. Preserve local formatting and run type checks before review.

## Testing Guidelines

Use Jest and `@testing-library/react-native` for mobile behavior; name files `*.test.ts` or `*.test.tsx` in `TP4-mvp/tests/`. The backend uses `node:test`; name service specs `*.spec.ts` in `backend/test/`. Test behavior, transitions, validation, and service boundaries, mocking API or Prisma dependencies. There is no coverage threshold, but add regression tests for changed behavior.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit-style prefixes, sometimes with an emoji: `fix(contracts): validate transition`, `refactor(uploads): isolate storage`, or `chore(config): update Expo`. Use an imperative, concise subject and a scope when useful. PRs should explain impact, link the issue or user story, list tests run, and include mobile screenshots. Call out Prisma migrations and environment changes.

## Configuration & Security

Copy the relevant `.env.example` to `.env`; never commit credentials, JWT secrets, local IP addresses, or generated uploads. `EXPO_PUBLIC_` values are client-visible.
