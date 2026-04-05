# Solitaire

A classic Klondike solitaire game built entirely through AI-assisted prompt engineering — no manual code written.

---

## About this project

This project is an experiment in how far you can go building a complete, polished web application by writing prompts rather than code. Every feature — the game engine, drag-and-drop, scoring, animations, the high-score API, deployment config — was produced by describing what I wanted and iterating on the result.

### Tools used

| Role | Tool |
|---|---|
| IDE | [Cursor](https://www.cursor.com) |
| LLM | [Claude Code](https://claude.ai/code) |
| Deployment | [Vercel](https://vercel.com) |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build tool | Vite 8 |
| Styling | Plain CSS (CSS custom properties) |
| Backend (local) | Express 4 (Node.js) |
| Backend (production) | Vercel Serverless Functions |
| Score storage | JSON file (`server/highscores.json`) |
| Card assets | SVG — [SVG-cards](https://github.com/htdebeer/SVG-cards) card faces, custom card backs |

---

## Directory tree

```
solitaire-game/
├── api/
│   └── highscores.js          # Vercel serverless function (production API)
├── public/
│   └── cards/
│       ├── *.svg              # 52 card face SVGs
│       └── backs/
│           └── *.svg          # 15 card back SVGs (3 designs × 5 colours)
├── server/
│   ├── index.js               # Express API server (local development)
│   └── highscores.json        # Persistent score storage (top 10)
├── src/
│   ├── App.tsx                # Main game component — all game logic & UI
│   ├── main.tsx               # React entry point
│   ├── styles/
│   │   └── global.css         # All styles
│   └── utils/
│       └── cards.ts           # Deck types, shuffle, card image URL helpers
├── .npmrc                     # legacy-peer-deps=true (ESLint peer compat)
├── index.html                 # Vite HTML entry
├── package.json
├── tsconfig.json
├── vercel.json                # Vercel build + API rewrite config
└── vite.config.ts             # Vite config — dev server + /api proxy
```

---

## Running locally

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm start
```

This runs two processes concurrently:

| Process | Command | URL |
|---|---|---|
| Vite frontend | `npm run dev` | http://127.0.0.1:5173 |
| Express API | `npm run serve-api` | http://127.0.0.1:5050 |

Vite proxies all `/api/*` requests to the Express server automatically, so the frontend and API work together on a single origin during development.

> **Why two servers?** In production Vercel handles the API via serverless functions (`api/highscores.js`). Locally, Express (`server/index.js`) provides the same API so you can develop and test without needing a Vercel account or internet connection.

### Run frontend only (no high-score API)

```bash
npm run dev
```

The game is fully playable without the API — you just won't be able to submit or load high scores.

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Vercel runs this automatically on every push to `main`.

---

## Gameplay features

- Drag-and-drop or click-to-move cards
- Double-click to send a card straight to its foundation pile
- Undo (−5 point penalty per move)
- Auto-complete modal when all cards are face-up (+1 000 bonus)
- Resign option when no moves remain
- Stuck-game detection with banner prompt
- Settings panel: card back picker (3 designs × 5 colours), restart with confirmation
- Persistent high-score leaderboard (top 10 stored, top 5 displayed)
- Timer, move counter, and live score
- Title screen and post-game play-again flow
