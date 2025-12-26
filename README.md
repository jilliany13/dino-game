# Adaptive Dino Runner (Next.js)

Local Next.js port of the original canvas `Duck Duck Jump` game with optional Supabase auth + server-backed high scores.

Quick start

1. Install dependencies

```bash
npm install
```

2. Provide environment variables in a `.env.local` (do NOT commit):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-SUPABASE-URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

3. Start dev server

```bash
npm run dev
```

Notes
- The app uses Supabase Auth but the UI asks for username/password only. The email used for Supabase is `${username}@duckduckjump.local`.
- The `profiles` table stores `username` and `high_score`. See project notes for SQL required to create the table and RLS policies.
- High scores are persisted server-side when a signed-in user finishes a run.

Files changed/added
- `lib/supabaseClient.ts` — Supabase client initializer
- `lib/highScore.ts` — helpers to get/update high scores
- `components/AuthPanel.tsx` — sign-in / sign-up modal
- `components/GameShell.tsx` — main UI updated to support auth and server scores
