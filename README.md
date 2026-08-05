# CallFlow — Call Center CRM (UI/UX Frontend)

A React + TypeScript + Vite frontend for a call-center CRM, covering:

- **Login** — split-screen sign-in with the app's signature waveform motif
- **Customer List** — searchable/filterable directory with expandable per-customer call history
- **Call Details** — recording player, transcript, disposition, and metadata for a single call
- **Reports** — KPI cards and charts (volume, outcomes, agent performance)
- **Export** — configure and generate CSV / Excel / PDF exports, with export history
- **Search & filters** — a shared `FilterBar` component (search input + dropdown filters) reused across screens

## Design system

Tokens live in `src/index.css` as CSS variables:
- **Color**: dark ink sidebar (`--ink`), light paper canvas (`--paper`), and a signal palette — teal (`--brand`) for connected/healthy, amber (`--amber`) for waiting, coral (`--coral`) for missed/errors, violet (`--violet`) for voicemail/enterprise.
- **Type**: Space Grotesk (display), Manrope (body), IBM Plex Mono (phone numbers, timestamps, durations, IDs).
- **Signature element**: `src/components/ui/Waveform.tsx` — every call recording renders as a waveform; it animates gently for live/in-progress calls and tiles as a quiet background pattern on the login screen.

## Run it

```bash
npm install
npm run dev      # start dev server
npm run build     # type-check + production build
npm run lint      # oxlint
```

## Structure

```
src/
  pages/            Login, CustomerList, CallDetails, Reports, Export
  components/
    layout/          Sidebar, AppShell (nav + routed content)
    ui/               Waveform, StatusBadge, Avatar, FilterBar, PageHeader
  data/mockData.ts    Sample customers, calls, agents, export jobs
  lib/format.ts       Date/duration formatting helpers
  types.ts            Shared TypeScript types
```

Routing is handled by `react-router-dom` in `src/App.tsx`. All data is mocked in `src/data/mockData.ts` — swap in real API calls where the pages import from that file.

Login is a mock: any non-empty email/password signs you in and routes to `/customers`.
