# Migrating the existing repository

This package replaces the Express/static frontend with Next.js while preserving the schema, contracts, orchestration, xAI client, and local project format.

## Safe migration

1. In GitHub Desktop, create a branch named `nextjs-migration`.
2. Back up your private `.env` or `.env.local` outside the repository.
3. Remove the old root `public/`, `src/`, `package.json`, `package-lock.json`, and old launcher files.
4. Copy every file from this package into the repository root.
5. Do not copy or commit a real `.env.local`.
6. Run `npm install`, then `npm run dev`.
7. Open `http://localhost:3000`.
8. Commit as `Migrate FullSendOS to Next.js App Router`.
9. Push the branch and merge after GitHub Actions passes.

Existing `data/projects/*.json` files are compatible with the migrated app. Keep them locally if you want to preserve prior engagements; the folder remains Git-ignored.
