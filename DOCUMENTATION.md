# Solitaire Game — Technical Documentation

## Overview

This is a **classic Klondike solitaire** web application, built entirely through AI-assisted prompt engineering (no manual code written). The game runs in the browser with a React + TypeScript frontend and includes a high-score leaderboard backed by a lightweight API.

**Live deployment:** Hosted on [Vercel](https://vercel.com) with automatic deploys from `main`.  
**Repository:** [github.com/JimGray9999/solitaire-game](https://github.com/JimGray9999/solitaire-game)

---

## Tech Stack

| Layer                | Technology                          | Details |
| -------------------- | ----------------------------------- | ------- |
| **Language**         | TypeScript + JavaScript             | Frontend is TypeScript; backend (Express server & Vercel serverless function) is plain JavaScript |
| **Frontend framework** | React 18                          | Functional components with hooks (`useState`, `useEffect`, `useCallback`, `useRef`) |
| **Build tool**       | Vite 8                              | Fast HMR dev server, production bundler, dev proxy for the API |
| **Styling**          | Plain CSS                           | Single `global.css` file using CSS custom properties (variables), responsive media queries, keyframe animations |
| **Typography**       | Inter (via `@fontsource/inter`)     | Self-hosted web font, no external CDN requests |
| **Backend (local dev)** | Express 4 on Node.js             | Runs on port 5050; Vite proxies `/api/*` to it during development |
| **Backend (production)** | Vercel Serverless Functions      | `api/highscores.js` — a single serverless handler for GET/POST |
| **Data storage**     | JSON file                           | `server/highscores.json` (local); `/tmp/highscores.json` (Vercel — ephemeral per cold start, seeded from the repo copy) |
| **Card assets**      | SVG                                 | 52 card face SVGs from [SVG-cards](https://github.com/htdebeer/SVG-cards); 15 custom card back SVGs (3 designs x 5 colors) |
| **Analytics**        | `@vercel/analytics` + `@vercel/speed-insights` | Injected in `main.tsx` via `<Analytics />` and `<SpeedInsights />` components |
| **Linting**          | ESLint 10 + Prettier                | Flat config (`eslint.config.js`) extending `eslint:recommended` and `plugin:react/recommended`, with `eslint-config-prettier` |
| **Testing**          | Vitest + React Testing Library      | `vitest` as the test runner; `@testing-library/react` and `@testing-library/user-event` for component tests |
| **Package manager**  | npm                                 | `.npmrc` sets `legacy-peer-deps=true` for ESLint peer compatibility |
| **Dev utilities**    | `concurrently`                      | Runs Vite and Express in parallel via `npm start` |
| **Deployment**       | Vercel                              | Config in `vercel.json`: builds with `npm run build`, serves from `dist/`, rewrites `/api/*` to serverless functions |

---

## How the App Was Built

### Development Approach

The entire project was produced through **AI-assisted prompt engineering**:

| Role       | Tool                                  |
| ---------- | ------------------------------------- |
| IDE        | [Cursor](https://www.cursor.com)      |
| LLM        | [Claude Code](https://claude.ai/code) |
| Deployment | [Vercel](https://vercel.com)          |

Every feature — the game engine, drag-and-drop, scoring, animations, the high-score API, and deployment config — was produced by describing what was wanted and iterating on the result. No code was written manually.

---

## Project Structure

```
solitaire-game/
├── api/
│   └── highscores.js              # Vercel serverless function (production API)
├── playing_cards_back_side_vectors/# Source SVG files for card back designs
├── public/
│   └── cards/
│       ├── *.svg                  # 52 card face SVGs (e.g. ace_of_spades.svg)
│       └── backs/
│           └── *.svg              # 15 card back SVGs (3 designs x 5 colors)
├── server/
│   ├── index.js                   # Express API server (local development)
│   └── highscores.json            # Persistent score storage (top 10)
├── src/
│   ├── App.tsx                    # Main game component (~1,480 lines) — ALL game logic & UI
│   ├── main.tsx                   # React entry point (renders App + analytics)
│   ├── styles/
│   │   └── global.css             # All styles (~880 lines)
│   └── utils/
│       └── cards.ts               # Deck types, shuffle, card image URL helpers
├── .npmrc                         # legacy-peer-deps=true
├── eslint.config.js               # ESLint flat config
├── index.html                     # Vite HTML entry (with mobile-web-app meta tags)
├── package.json
├── tsconfig.json                  # TypeScript strict mode, ES2020 target
├── vercel.json                    # Vercel build + API rewrite config
└── vite.config.ts                 # Vite config — dev server + /api proxy
```

---

## How the App Works

### 1. Entry Point & Bootstrapping

- **`index.html`** — The shell HTML page. Contains mobile-web-app meta tags (for fullscreen behavior on iOS/Android), a theme color (`#0a1f0f`), and loads `src/main.tsx` as a module.
- **`src/main.tsx`** — Creates the React root, wraps `<App />` in `React.StrictMode`, and mounts Vercel's `<Analytics />` and `<SpeedInsights />` components for production telemetry.

### 2. Game Engine (`src/App.tsx`)

The entire game lives in a single ~1,480-line component file. This is the heart of the application.

#### Data Model

```typescript
interface Card {
  id: string;        // e.g. "spades-1"
  suit: Suit;        // "spades" | "clubs" | "hearts" | "diamonds"
  rank: number;      // 1 (Ace) through 13 (King)
  faceUp: boolean;
}

interface GameState {
  tableau: Column[];          // 7 columns of stacked cards
  stock: Card[];              // Draw pile (face-down)
  waste: Card[];              // Discard pile (drawn cards)
  foundations: Card[][];      // 4 piles, one per suit (Ace → King)
  score: number;
  moves: number;
  completionBonusAwarded: boolean;
  completed: boolean;
}
```

#### Dealing

`dealTableau()` distributes cards into the classic Klondike layout:
- 7 tableau columns with 1, 2, 3, 4, 5, 6, and 7 cards respectively
- Only the top card in each column is face-up
- Remaining 24 cards go to the stock pile

#### Scoring System

| Action                         | Points |
| ------------------------------ | ------ |
| Move card to tableau           | +5     |
| Move card to foundation        | +10    |
| Flip a face-down card          | +5     |
| Complete a foundation pile (13 cards) | +50    |
| Auto-complete bonus (all face-up)     | +1,000 |
| Win bonus (all 4 foundations full)    | +500   |
| Undo penalty                   | -5     |

#### Core Move Logic (Pure Functions)

The game uses **pure functions** for move validation and state transitions — they take a `GameState` and return a new `GameState` or `null` if the move is invalid:

- **`applyMoveToColumn()`** — Validates and executes moving cards between tableau columns:
  - Empty columns only accept Kings
  - Cards must alternate color and descend in rank
  - Automatically flips the newly exposed card underneath

- **`applyMoveToFoundation()`** — Validates and executes moving a single card to a foundation pile:
  - Empty foundations only accept Aces
  - Cards must match the pile's suit and increment in rank
  - Awards completion bonuses when a pile reaches 13 or all 4 piles are complete

- **`findFoundationIndex()`** — Finds which foundation pile (if any) can accept a given card

#### Stuck Detection

`hasAnyMove()` exhaustively checks whether any valid move exists by iterating over all tableau columns and the waste pile, testing every possible target. When the stock is empty, the waste is empty, and no moves remain, a **stuck banner** appears offering to resign or restart.

### 3. User Interaction

#### Drag and Drop

The drag-and-drop system is built from scratch using **Pointer Events** (not HTML5 drag API):

1. **`onPointerDown`** — Records the drag source, offset, and starting position in a `useRef` (no re-renders during drag)
2. **`onPointerMove`** (window listener) — After a 6px movement threshold, activates the drag:
   - Adds an `is-dragging-card` class to `<body>` for the grabbing cursor
   - Renders a **ghost element** (fixed-position clone of the dragged cards)
   - Updates ghost position via direct DOM mutation (`style.transform`) — no React re-renders
3. **`onPointerUp`** (window listener) — Uses `document.elementFromPoint()` to find the drop target, then applies the move via `applyMoveToColumn()` or `applyMoveToFoundation()`

The ghost element has `pointer-events: none` so it doesn't interfere with `elementFromPoint()`.

#### Click-to-Move

Cards can also be moved by clicking:
1. Click a face-up card to **select** it (highlighted with a gold outline)
2. Click a target column or foundation to **place** it
3. Click the same card again to **deselect**

#### Double-Click to Foundation

Double-clicking any top card on a tableau column or the waste pile automatically sends it to the correct foundation (if eligible).

#### Keyboard Navigation

Full keyboard support with arrow key navigation:

| Key        | Action |
| ---------- | ------ |
| Arrow keys | Navigate between stock, discard, foundations (top row) and tableau columns |
| Enter/Space| Activate focused position (draw, select, place) |
| D          | Draw from stock |
| U          | Undo last move |
| R          | Resign |
| Escape     | Clear selection and keyboard focus |

A gold inset box-shadow highlights the currently focused element.

### 4. State Management

All game state is managed with React's built-in `useState` and `useRef` hooks — no external state library:

- **`game`** (`useState<GameState>`) — The canonical game state
- **`gameHistory`** (`useState<GameState[]>`) — Stack of previous states for undo
- **`selection`** (`useState<Selection | null>`) — Currently selected card(s) for click-to-move
- **`dragSource`** / **`dragMetaRef`** — Drag state split between React state (for rendering the ghost) and a ref (for tracking positions without re-renders)
- **`keyboardFocus`** (`useState<KeyboardPos | null>`) — Current keyboard navigation position

Several `useRef` values avoid stale closures in window-level event listeners:
- `executeDropRef` — Updated every render so the pointerup handler always sees fresh game state
- `handleKeyRef` — Same pattern for the keydown handler
- `shouldWarnBeforeUnloadRef` — Controls the browser's "unsaved changes" dialog

### 5. UI Screens & Modals

The app has two screens and several modal dialogs:

- **Title Screen** — Simple centered card with suit symbols, title, subtitle, and a "Play" button
- **Game Screen** — The main playing area with:
  - **HUD** — Score, moves, timer, selection indicator, control buttons (Draw, Undo, Resign, Settings)
  - **Game Board** — 7-column grid for stock, waste, foundations (top row) and tableau (bottom row)
  - **Leaderboard Sidebar** — Sticky panel showing top 5 completed-game scores

**Modal dialogs:**
- Auto-complete confirmation (+1,000 bonus)
- Resign confirmation (with option to submit score)
- Win / Game Over (with score submission form and play-again/menu options)
- Settings (card back picker, restart game with confirmation)
- Refresh intercept (prevents accidental page reload during a game)

### 6. Card Assets

- **52 face cards** — SVG files in `public/cards/`, named `{rank}_of_{suit}.svg` (e.g., `ace_of_spades.svg`, `10_of_clubs.svg`). Sourced from the open-source [SVG-cards](https://github.com/htdebeer/SVG-cards) project.
- **15 card backs** — SVG files in `public/cards/backs/`, named `player_card_back_{design}_{color}.svg`. Three design styles (Classic, Pattern, Ornate) in five colors (Blue, Light Blue, Red, Green, Black). Source vectors live in `playing_cards_back_side_vectors/`.

The `cards.ts` utility module provides helper functions:
- `createDeck()` — Generates all 52 cards
- `shuffleDeck()` — Fisher-Yates shuffle
- `cardImageUrl()` — Maps a card to its SVG path
- `rankLabel()` — Maps rank numbers to display labels (1→"A", 11→"J", 12→"Q", 13→"K")
- `colorForSuit()` — Returns "red" or "black" for a given suit

### 7. Styling (`src/styles/global.css`)

~880 lines of plain CSS with:

- **CSS custom properties** for theming (green felt table, gold accents, muted text)
- **Radial gradient background** simulating a card table
- **Card styling** — Aspect ratio `167/243`, border radius, shadows, transitions
- **Tableau stacking** — Negative margins (`margin-top: -118%`) to create overlapping card columns
- **Drag ghost** — Fixed-position, `z-index: 9999`, `pointer-events: none`, `will-change: transform`
- **Responsive breakpoints:**
  - `900px` — Sidebar collapses below game board
  - `768px` — HUD stacks vertically, tighter card gaps
  - `600px` — Compact mobile layout, hidden labels, WCAG-compliant 40px touch targets
- **Animations** — `fadeIn` and `slideUp` keyframes for modals
- **Safe area insets** — Respects iPhone notch / home indicator via `env(safe-area-inset-*)`

### 8. Backend / High-Score API

#### Local Development (`server/index.js`)

An Express 4 server providing two endpoints:

- **`GET /api/highscores`** — Returns top 10 scores sorted by score (descending), then completion status, then date
- **`POST /api/highscores`** — Accepts `{ player, score, completed }`, validates input, assigns an auto-incrementing ID, persists to `server/highscores.json`, and keeps only the top 10

Vite's dev server proxies `/api/*` to `http://127.0.0.1:5050` so the frontend and API share a single origin during development.

#### Production (`api/highscores.js`)

A Vercel serverless function with identical logic but adapted for the serverless environment:
- Uses `/tmp/highscores.json` for storage (Vercel's filesystem is read-only except `/tmp`)
- Seeds from `server/highscores.json` on cold start
- Handles CORS headers explicitly
- Supports GET, POST, and OPTIONS methods
- Note: `/tmp` is ephemeral — scores persist only within a single function instance's lifetime

### 9. Build & Deployment

- **`npm run build`** — Vite bundles the app to `dist/`
- **`vercel.json`** configures:
  - Build command: `npm run build`
  - Output directory: `dist`
  - URL rewrites: `/api/*` → Vercel serverless functions
- Every push to `main` triggers an automatic Vercel deployment

### 10. Developer Tooling

- **TypeScript** — Strict mode enabled, targeting ES2020, using React JSX transform
- **ESLint** — Flat config extending recommended rules + React plugin, with Prettier integration to avoid formatting conflicts
- **Prettier** — Code formatting via `npm run format`
- **Vitest** — Test runner (configured but test suite not extensively populated)
- **`.npmrc`** — `legacy-peer-deps=true` to handle ESLint 10 peer dependency compatibility

---

## Gameplay Features Summary

- Standard Klondike rules with one-card draw
- Drag-and-drop **or** click-to-move **or** keyboard navigation
- Double-click to auto-send cards to foundations
- Undo with a 5-point penalty
- Auto-complete when all cards are face-up (+1,000 bonus)
- Stuck detection with banner prompt
- Resign with optional score submission
- Settings panel with 15 card back choices (3 designs x 5 colors, persisted in `localStorage`)
- Player name persisted in `localStorage`
- Timer, move counter, and live score display
- High-score leaderboard (top 5 displayed, top 10 stored)
- Browser refresh/close warning during active games
- Responsive design from desktop to mobile
- Accessible: ARIA roles, keyboard navigation, appropriate touch targets

---

## Running Locally

```bash
# Prerequisites: Node.js 18+, npm 9+

# Install dependencies
npm install

# Start both frontend and API
npm start
# → Frontend: http://127.0.0.1:5173
# → API:      http://127.0.0.1:5050

# Or run frontend only (no high-score API)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Format
npm run format

# Test
npm test
```
