# Mafia

A browser-based Mafia game for private friend groups.

**Current milestone:** interactive UI preview and the initial database schema. The preview is not a live multiplayer game yet. Room creation, cross-device invitations, secure role assignment, and realtime game actions require the Supabase Edge Functions and project configuration in the next milestone.

## Stack

- React + TypeScript + Vite
- Supabase (Postgres, Auth, Realtime, Edge Functions)
- GitHub Actions + GitHub Pages

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The current preview works without environment variables.

## Build

```bash
npm run build
npm run preview
```

## Supabase setup (next milestone)

1. Create a Supabase project.
2. Enable anonymous sign-ins in **Authentication → Providers**.
3. Apply `supabase/migrations/0001_initial_schema.sql` in the SQL Editor or with the Supabase CLI.
4. Copy the project URL and anon/publishable key into `.env.local` using `.env.example` as a template.
5. Deploy the Edge Functions that own room creation, joining, starting games, role retrieval, phase transitions, and votes.

Only the anon/publishable key belongs in the browser. **Never put the service-role key in a `VITE_*` variable or commit it to Git.** The `player_roles` table is deliberately inaccessible to browser clients.

## GitHub Pages

Before the first deployment, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. This one-time setting is required before the workflow can publish the site.

The workflow in `.github/workflows/deploy.yml` builds and deploys the site on every push to `main`.

The site URL will be:

`https://kirtan-rasa.github.io/mafia/`

## Project structure

```text
src/
  App.tsx                 Landing page and interactive lobby preview
  index.css               Responsive visual system
  lib/supabase.ts         Optional Supabase browser client
supabase/
  migrations/
    0001_initial_schema.sql
.github/
  workflows/
    deploy.yml
```

## Security principles

- Role assignments are stored separately from public room/player data.
- Browser clients must not read game tables directly.
- Trusted Edge Functions validate membership and game phase before every mutation.
- Secret roles are returned only to the player who owns the assignment.
