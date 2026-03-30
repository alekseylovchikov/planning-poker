# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the React + TypeScript app. Key areas include `src/components/` (UI and feature components), `src/hooks/` (custom hooks like WebSocket), `src/types/` (shared types), and `src/lib/` (utilities).
- `src/assets/` and `public/` hold static assets.
- `server.js` is a minimal WebSocket server used for local development.
- Build output is generated into `dist/` (gitignored).

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server for the client.
- `npm run start`: run the local WebSocket server (`server.js`).
- `npm run build`: build the production client into `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint over the codebase.

Tip: the client expects a WebSocket server. Override the default URL with `VITE_WS_URL=ws://host:port npm run dev`.

## Coding Style & Naming Conventions

- TypeScript + React function components; files use PascalCase for components (e.g., `VotingCards.tsx`).
- Indentation is 2 spaces, double quotes, and semicolons are standard in existing files.
- Styles are primarily SCSS modules (e.g., `App.module.scss`). Keep class names descriptive and scoped to the component.
- Linting is enforced by `eslint.config.js` using `typescript-eslint` and React hooks rules.

## Testing Guidelines

- There are no automated tests in the repository yet.
- If you add tests, prefer colocating them under `src/` and use `*.test.tsx` naming so they can be discovered easily later.

## Commit & Pull Request Guidelines

- Recent commits use short, imperative or sentence-style messages (e.g., “Update App.module.scss”, “Refactor…”). Follow that pattern and avoid “WIP”.
- PRs should include a clear description, steps to verify, and screenshots or short clips for UI changes.
- Note any required environment variables or server setup in the PR description.

## Configuration Notes

- WebSocket defaults to `ws://localhost:8080` for local development; production URLs are derived from the current host unless overridden by `VITE_WS_URL`.
