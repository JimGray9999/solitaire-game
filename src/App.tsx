import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  cardImageUrl,
  colorForSuit,
  createDeck,
  rankLabel,
  shuffleDeck,
  Suit
} from "./utils/cards";

type Column = Card[];

type Selection =
  | { source: "tableau"; columnIndex: number; cardIndex: number; cards: Card[] }
  | { source: "waste"; cards: Card[] };

interface GameState {
  tableau: Column[];
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles, suit determined by first Ace placed
  score: number;
  moves: number;
  completionBonusAwarded: boolean;
  completed: boolean;
}

interface HighScoreEntry {
  id: number;
  player: string;
  score: number;
  completed: number;
  earned_at: string;
}

const TABLEAU_MOVE_SCORE = 5;
const FOUNDATION_MOVE_SCORE = 10;
const FLIP_BONUS = 5;
const FOUNDATION_COMPLETE_BONUS = 50;
const COMPLETION_BONUS = 500;

const createFoundations = (): Card[][] => [[], [], [], []];

// Returns the foundation index that accepts this card, or -1 if none.
const findFoundationIndex = (state: GameState, card: Card): number => {
  // Prefer a pile already started with this suit
  const existingIdx = state.foundations.findIndex(
    (pile) => pile.length > 0 && pile[0].suit === card.suit && pile.length + 1 === card.rank
  );
  if (existingIdx !== -1) return existingIdx;
  // An Ace can start any empty pile
  if (card.rank === 1) {
    const emptyIdx = state.foundations.findIndex((pile) => pile.length === 0);
    return emptyIdx; // -1 if all full (shouldn't happen in a valid game)
  }
  return -1;
};

const dealTableau = (deck: Card[]): { tableau: Column[]; stock: Card[] } => {
  const tableau: Column[] = [];
  let position = 0;
  for (let columnCount = 0; columnCount < 7; columnCount += 1) {
    const column: Column = [];
    for (let cardIndex = 0; cardIndex <= columnCount; cardIndex += 1) {
      const card = deck[position++];
      column.push({ ...card, faceUp: cardIndex === columnCount });
    }
    tableau.push(column);
  }
  const stock = deck.slice(position).map((card) => ({ ...card, faceUp: false }));
  return { tableau, stock };
};

const createNewGame = (): GameState => {
  const deck = shuffleDeck(createDeck());
  const { tableau, stock } = dealTableau(deck);
  return {
    tableau,
    stock,
    waste: [],
    foundations: createFoundations(),
    score: 0,
    moves: 0,
    completionBonusAwarded: false,
    completed: false
  };
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const removeCardsFromColumn = (
  column: Column,
  count: number
): { column: Column; flipped: boolean } => {
  const remaining = column.slice(0, column.length - count);
  if (!remaining.length) return { column: [], flipped: false };
  const topCard = remaining[remaining.length - 1];
  if (topCard.faceUp) return { column: remaining, flipped: false };
  const updated = [...remaining.slice(0, -1), { ...topCard, faceUp: true }];
  return { column: updated, flipped: true };
};

// ── Pure move functions (no React dependencies) ───────────────────────────────

const applyMoveToColumn = (
  state: GameState,
  source: Selection,
  targetIndex: number
): GameState | null => {
  const targetColumn = state.tableau[targetIndex];
  const cardToPlace = source.cards[0];

  if (source.source === "tableau" && source.columnIndex === targetIndex) return null;
  if (targetColumn.length === 0 && cardToPlace.rank !== 13) return null;
  if (targetColumn.length > 0) {
    const targetTop = targetColumn[targetColumn.length - 1];
    if (
      colorForSuit(targetTop.suit) === colorForSuit(cardToPlace.suit) ||
      targetTop.rank !== cardToPlace.rank + 1
    )
      return null;
  }

  const cardsToMove = source.cards.map((c) => ({ ...c, faceUp: true }));
  let flipped = false;
  const newTableau = state.tableau.map((col, idx) => {
    if (source.source === "tableau" && idx === source.columnIndex) {
      const count = col.length - source.cardIndex;
      const { column: remainder, flipped: didFlip } = removeCardsFromColumn(col, count);
      if (didFlip) flipped = true;
      return remainder;
    }
    if (idx === targetIndex) return [...col, ...cardsToMove];
    return col;
  });
  const updatedWaste = source.source === "waste" ? state.waste.slice(0, -1) : state.waste;
  return {
    ...state,
    tableau: newTableau,
    waste: updatedWaste,
    score: state.score + TABLEAU_MOVE_SCORE + (flipped ? FLIP_BONUS : 0),
    moves: state.moves + 1
  };
};

const applyMoveToFoundation = (
  state: GameState,
  source: Selection,
  foundationIndex: number
): GameState | null => {
  const candidate = source.cards[0];
  if (source.cards.length !== 1) return null;

  const pile = state.foundations[foundationIndex];
  if (pile.length === 0) {
    // Only an Ace can start an empty foundation pile
    if (candidate.rank !== 1) return null;
  } else {
    const top = pile[pile.length - 1];
    if (candidate.suit !== top.suit || candidate.rank !== top.rank + 1) return null;
  }

  const updatedFoundations = state.foundations.map((p, i) =>
    i === foundationIndex ? [...p, { ...candidate, faceUp: true }] : p
  );
  let flipped = false;
  const updatedTableau = state.tableau.map((col, idx) => {
    if (source.source === "tableau" && idx === source.columnIndex) {
      const { column: remainder, flipped: didFlip } = removeCardsFromColumn(col, 1);
      if (didFlip) flipped = true;
      return remainder;
    }
    return col;
  });
  const updatedWaste = source.source === "waste" ? state.waste.slice(0, -1) : state.waste;

  const foundationComplete = updatedFoundations[foundationIndex].length === 13;
  const allComplete = updatedFoundations.every((p) => p.length === 13);
  let scoreDelta = FOUNDATION_MOVE_SCORE + (flipped ? FLIP_BONUS : 0);
  if (foundationComplete) scoreDelta += FOUNDATION_COMPLETE_BONUS;
  if (allComplete && !state.completionBonusAwarded) scoreDelta += COMPLETION_BONUS;

  return {
    ...state,
    foundations: updatedFoundations,
    tableau: updatedTableau,
    waste: updatedWaste,
    score: state.score + scoreDelta,
    moves: state.moves + 1,
    completionBonusAwarded: state.completionBonusAwarded || allComplete,
    completed: state.completed || allComplete
  };
};

// ── Stuck detection ───────────────────────────────────────────────────────────

const hasAnyMove = (state: GameState): boolean => {
  const wasteTop = state.waste[state.waste.length - 1];

  for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
    const col = state.tableau[sourceCol];
    for (let cardIdx = 0; cardIdx < col.length; cardIdx++) {
      const card = col[cardIdx];
      if (!card.faceUp) continue;
      const isTopCard = cardIdx === col.length - 1;

      if (isTopCard && findFoundationIndex(state, card) !== -1) return true;

      for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
        if (targetCol === sourceCol) continue;
        const target = state.tableau[targetCol];
        if (target.length === 0 && card.rank === 13) return true;
        if (target.length > 0) {
          const targetTop = target[target.length - 1];
          if (
            targetTop.faceUp &&
            colorForSuit(targetTop.suit) !== colorForSuit(card.suit) &&
            targetTop.rank === card.rank + 1
          )
            return true;
        }
      }
    }
  }

  if (wasteTop) {
    if (findFoundationIndex(state, wasteTop) !== -1) return true;
    for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
      const target = state.tableau[targetCol];
      if (target.length === 0 && wasteTop.rank === 13) return true;
      if (target.length > 0) {
        const targetTop = target[target.length - 1];
        if (
          targetTop.faceUp &&
          colorForSuit(targetTop.suit) !== colorForSuit(wasteTop.suit) &&
          targetTop.rank === wasteTop.rank + 1
        )
          return true;
      }
    }
  }

  return false;
};

// ── Drag metadata (ref, not state — no re-renders during pointermove) ─────────

interface DragMeta {
  source: Selection;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  started: boolean;
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

type KeyboardPos =
  | { area: "stock" }
  | { area: "discard" }
  | { area: "foundation"; index: number }
  | { area: "tableau"; columnIndex: number; cardIndex: number };

// Returns the lowest face-up card index in a column (entry point for keyboard nav)
const firstFaceUpIdx = (col: Column): number => {
  const i = col.findIndex((c) => c.faceUp);
  return i === -1 ? Math.max(0, col.length - 1) : i;
};

// Top-row slot indices: stock=0, discard=1, foundation[0..3]=2..5
const kbTopIdx = (pos: KeyboardPos): number => {
  if (pos.area === "stock") return 0;
  if (pos.area === "discard") return 1;
  if (pos.area === "foundation") return 2 + pos.index;
  return 0;
};
const kbPosForTopIdx = (i: number): KeyboardPos => {
  if (i <= 0) return { area: "stock" };
  if (i === 1) return { area: "discard" };
  return { area: "foundation", index: Math.min(i - 2, 3) };
};

// ── Card back catalogue ───────────────────────────────────────────────────────

const CARD_BACK_DESIGNS = [
  { id: "design_1", label: "Classic" },
  { id: "design_2", label: "Pattern" },
  { id: "design_3", label: "Ornate" }
] as const;

const CARD_BACK_COLORS = [
  { id: "blue",      label: "Blue" },
  { id: "lightblue", label: "Light Blue" },
  { id: "red",       label: "Red" },
  { id: "green",     label: "Green" },
  { id: "black",     label: "Black" }
] as const;

const DEFAULT_CARD_BACK = "player_card_back_design_1_blue";

const cardBackUrl = (back: string) => `/cards/backs/${back}.svg`;

// ── Component ─────────────────────────────────────────────────────────────────

const FlashStatus = ({ message }: { message: string }): JSX.Element | null => {
  if (!message) return null;
  return <div className="panel">{message}</div>;
};

type Screen = "title" | "game";

// ── Title Screen ──────────────────────────────────────────────────────────────

const TitleScreen = ({ onPlay }: { onPlay: () => void }): JSX.Element => (
  <div className="title-screen">
    <div className="title-card">
      <div className="title-suits" aria-hidden="true">♠ ♥ ♦ ♣</div>
      <h1 className="title-heading">Solitaire</h1>
      <p className="title-sub">Classic Klondike — one card draw</p>
      <button className="title-play-btn" type="button" onClick={onPlay}>
        Play
      </button>
    </div>
  </div>
);

// ── Main App ──────────────────────────────────────────────────────────────────

const App = (): JSX.Element => {
  const [screen, setScreen] = useState<Screen>("game");
  const [game, setGame] = useState<GameState>(() => createNewGame());
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [resigned, setResigned] = useState(false);
  const [showAutoCompleteModal, setShowAutoCompleteModal] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const autoCompleteShownRef = useRef(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showPlayAgainModal, setShowPlayAgainModal] = useState(false);
  const endGameShownRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [cardBack, setCardBack] = useState<string>(
    () => localStorage.getItem("solitaire-card-back") ?? DEFAULT_CARD_BACK
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("solitaire-player") ?? ""
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [highscores, setHighscores] = useState<HighScoreEntry[]>([]);

  // dragSource drives ghost rendering. dragMetaRef holds positional data without
  // triggering re-renders on every pointermove.
  const [dragSource, setDragSource] = useState<Selection | null>(null);
  const dragMetaRef = useRef<DragMeta | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  // executeDropRef is updated every render so the window pointerup handler
  // always gets a closure with fresh `game` state.
  const executeDropRef = useRef<(x: number, y: number) => void>(() => {});

  // Keyboard focus position (null = keyboard nav inactive)
  const [keyboardFocus, setKeyboardFocus] = useState<KeyboardPos | null>(null);
  // handleKeyRef updated every render (same pattern as executeDropRef)
  const handleKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const [showRefreshModal, setShowRefreshModal] = useState(false);
  // Tracks whether the page should prompt before unloading (always fresh via ref)
  const shouldWarnBeforeUnloadRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("solitaire-player", playerName);
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem("solitaire-card-back", cardBack);
  }, [cardBack]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/highscores");
        if (!res.ok) throw new Error("Failed to load highscores.");
        const list = (await res.json()) as HighScoreEntry[];
        setHighscores(list);
      } catch (error) {
        console.error(error);
        setStatusMessage("Unable to load leaderboard right now.");
      }
    };
    refresh();
  }, []);

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [timerKey]);

  const isGameComplete = game.completed;

  // Auto-complete is available when all remaining cards are face-up (stock exhausted,
  // no hidden tableau cards) — the outcome is guaranteed, so we offer to finish for them.
  const isAutoCompleteAvailable =
    !game.completed &&
    !resigned &&
    !isAutoCompleting &&
    game.stock.length === 0 &&
    game.tableau.every((col) => col.every((card) => card.faceUp));

  // Show the modal exactly once per eligible game state
  useEffect(() => {
    if (isAutoCompleteAvailable && !autoCompleteShownRef.current) {
      autoCompleteShownRef.current = true;
      setShowAutoCompleteModal(true);
    }
    if (!isAutoCompleteAvailable) {
      autoCompleteShownRef.current = false;
    }
  }, [isAutoCompleteAvailable]);

  // Show the win/play-again modal once when the game is completed
  useEffect(() => {
    if (game.completed && !endGameShownRef.current) {
      endGameShownRef.current = true;
      setShowPlayAgainModal(true);
    }
    if (!game.completed) {
      endGameShownRef.current = false;
    }
  }, [game.completed]);

  // Animation loop: move one card to its foundation every 80 ms
  useEffect(() => {
    if (!isAutoCompleting || game.completed) return;

    const timer = setTimeout(() => {
      // Find the lowest-ranked card that can go to a foundation (waste first, then tableau)
      let bestSource: Selection | null = null;
      let bestFoundationIdx = -1;
      let bestRank = Infinity;

      const wasteTop = game.waste[game.waste.length - 1];
      if (wasteTop) {
        const idx = findFoundationIndex(game, wasteTop);
        if (idx !== -1) {
          bestSource = { source: "waste", cards: [wasteTop] };
          bestFoundationIdx = idx;
          bestRank = wasteTop.rank;
        }
      }

      game.tableau.forEach((col, i) => {
        const top = col[col.length - 1];
        if (top && top.faceUp) {
          const idx = findFoundationIndex(game, top);
          if (idx !== -1 && top.rank < bestRank) {
            bestSource = {
              source: "tableau",
              columnIndex: i,
              cardIndex: col.length - 1,
              cards: [top]
            };
            bestFoundationIdx = idx;
            bestRank = top.rank;
          }
        }
      });

      if (bestSource && bestFoundationIdx !== -1) {
        const next = applyMoveToFoundation(game, bestSource, bestFoundationIdx);
        if (next) {
          if (next.completed) {
            setGame({ ...next, score: next.score + 1000 });
            setIsAutoCompleting(false);
          } else {
            setGame(next);
          }
        } else {
          setIsAutoCompleting(false);
        }
      } else {
        setIsAutoCompleting(false);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [isAutoCompleting, game]);

  const cancelDrag = useCallback(() => {
    dragMetaRef.current = null;
    setDragSource(null);
    document.body.classList.remove("is-dragging-card");
  }, []);

  // Updated every render — always reads fresh `game`.
  executeDropRef.current = (x: number, y: number) => {
    const meta = dragMetaRef.current;
    if (!meta?.started) return;

    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const colEl = el?.closest("[data-drop-column]") as HTMLElement | null;
    const foundEl = el?.closest("[data-drop-foundation]") as HTMLElement | null;

    if (colEl) {
      const colIndex = parseInt(colEl.dataset.dropColumn!);
      const next = applyMoveToColumn(game, meta.source, colIndex);
      if (next) {
        setGameHistory((h) => [...h, game]);
        setGame(next);
        setStatusMessage("Moved cards.");
      }
    } else if (foundEl) {
      const foundationIndex = parseInt(foundEl.dataset.dropFoundation!);
      const next = applyMoveToFoundation(game, meta.source, foundationIndex);
      if (next) {
        setGameHistory((h) => [...h, game]);
        setGame(next);
        setStatusMessage("Card added to the foundation.");
      }
    }

    setSelection(null);
    cancelDrag();
  };

  // Keep the unload-warning flag fresh every render (no stale-closure risk)
  shouldWarnBeforeUnloadRef.current =
    !game.completed && !resigned && game.moves > 0 && screen === "game";

  // Updated every render — always reads fresh state and latest handler callbacks.
  handleKeyRef.current = (e: KeyboardEvent) => {
    // Never intercept while user is typing in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key;

    // Intercept browser refresh shortcuts (F5, Ctrl/Cmd + R, Ctrl/Cmd + Shift + R)
    const isRefreshShortcut =
      key === "F5" ||
      ((e.ctrlKey || e.metaKey) && (key === "r" || key === "R"));
    if (isRefreshShortcut && shouldWarnBeforeUnloadRef.current) {
      e.preventDefault();
      setShowRefreshModal(true);
      return;
    }

    const anyModalOpen =
      showResignModal || showPlayAgainModal || showSettings || showAutoCompleteModal || showRefreshModal;
    const upper = key.toUpperCase();

    // Escape always clears selection + focus (works even when modals open)
    if (key === "Escape") {
      setSelection(null);
      setKeyboardFocus(null);
      return;
    }

    // Don't handle game shortcuts while a modal is blocking the board
    if (anyModalOpen) return;

    // ── Single-key shortcuts ──────────────────────────────────────────────────
    if (upper === "D") {
      e.preventDefault();
      if (!resigned && !game.completed) handleStockClick();
      return;
    }
    if (upper === "U") {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (upper === "R") {
      e.preventDefault();
      if (!resigned && !game.completed) handleResign();
      return;
    }

    // ── Enter / Space — activate focused position ─────────────────────────────
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      const focus = keyboardFocus;
      if (!focus) {
        setKeyboardFocus({ area: "stock" });
        return;
      }
      if (focus.area === "stock") {
        handleStockClick();
      } else if (focus.area === "discard") {
        selectWaste();
      } else if (focus.area === "foundation") {
        handleFoundationClick(focus.index);
      } else {
        // Tableau — if selection exists try to place it, otherwise select the card
        const col = game.tableau[focus.columnIndex];
        const card = col[focus.cardIndex];
        if (selection) {
          handleColumnClick(focus.columnIndex);
        } else if (card?.faceUp) {
          selectTableau(focus.columnIndex, focus.cardIndex);
        } else {
          handleColumnClick(focus.columnIndex); // flips top face-down card
        }
      }
      return;
    }

    // ── Arrow navigation ──────────────────────────────────────────────────────
    if (!key.startsWith("Arrow")) return;
    e.preventDefault();

    const focus = keyboardFocus;
    if (!focus) {
      setKeyboardFocus({ area: "stock" });
      return;
    }

    if (focus.area !== "tableau") {
      // Top row: stock(0) discard(1) foundation[0..3](2..5)
      const rowIdx = kbTopIdx(focus);
      if (key === "ArrowLeft") {
        setKeyboardFocus(kbPosForTopIdx(Math.max(0, rowIdx - 1)));
      } else if (key === "ArrowRight") {
        setKeyboardFocus(kbPosForTopIdx(Math.min(5, rowIdx + 1)));
      } else if (key === "ArrowDown") {
        const colIdx = Math.min(rowIdx, 6);
        const col = game.tableau[colIdx];
        setKeyboardFocus({
          area: "tableau",
          columnIndex: colIdx,
          cardIndex: col.length > 0 ? firstFaceUpIdx(col) : 0
        });
      }
      // ArrowUp from top row: no-op
    } else {
      // Tableau row
      const col = game.tableau[focus.columnIndex];
      const faceStart = col.length > 0 ? firstFaceUpIdx(col) : 0;

      if (key === "ArrowLeft") {
        const newCol = Math.max(0, focus.columnIndex - 1);
        const newColData = game.tableau[newCol];
        setKeyboardFocus({
          area: "tableau",
          columnIndex: newCol,
          cardIndex: newColData.length > 0 ? firstFaceUpIdx(newColData) : 0
        });
      } else if (key === "ArrowRight") {
        const newCol = Math.min(6, focus.columnIndex + 1);
        const newColData = game.tableau[newCol];
        setKeyboardFocus({
          area: "tableau",
          columnIndex: newCol,
          cardIndex: newColData.length > 0 ? firstFaceUpIdx(newColData) : 0
        });
      } else if (key === "ArrowDown") {
        if (col.length > 0 && focus.cardIndex < col.length - 1) {
          setKeyboardFocus({ ...focus, cardIndex: focus.cardIndex + 1 });
        }
      } else if (key === "ArrowUp") {
        if (focus.cardIndex > faceStart) {
          setKeyboardFocus({ ...focus, cardIndex: focus.cardIndex - 1 });
        } else {
          // Bubble up to top row
          setKeyboardFocus(kbPosForTopIdx(Math.min(focus.columnIndex, 5)));
        }
      }
    }
  };

  // Window listeners registered once — use refs for fresh state, no re-registration.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const meta = dragMetaRef.current;
      if (!meta) return;

      meta.currentX = e.clientX;
      meta.currentY = e.clientY;

      if (!meta.started) {
        const dx = e.clientX - meta.startX;
        const dy = e.clientY - meta.startY;
        if (Math.hypot(dx, dy) > 6) {
          meta.started = true;
          document.body.classList.add("is-dragging-card");
          setDragSource({ ...meta.source }); // triggers render of ghost
          setSelection(null);
        }
        return;
      }

      // Position ghost via direct DOM mutation — no setState = no React re-render
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${e.clientX - meta.offsetX}px, ${
          e.clientY - meta.offsetY
        }px)`;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragMetaRef.current?.started) {
        executeDropRef.current(e.clientX, e.clientY);
      } else {
        dragMetaRef.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => handleKeyRef.current(e);

    // Warn before tab/window close or toolbar-refresh (browser native dialog)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldWarnBeforeUnloadRef.current) {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome to show the dialog
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []); // empty — stale closure avoided entirely via refs

  const handleRestart = useCallback(() => {
    cancelDrag();
    setGame(createNewGame());
    setGameHistory([]);
    setResigned(false);
    setShowAutoCompleteModal(false);
    setIsAutoCompleting(false);
    autoCompleteShownRef.current = false;
    setScoreSubmitted(false);
    setShowResignModal(false);
    setShowPlayAgainModal(false);
    endGameShownRef.current = false;
    setShowSettings(false);
    setShowRestartConfirm(false);
    setSelection(null);
    setKeyboardFocus(null);
    setShowRefreshModal(false);
    setTimerKey((prev) => prev + 1);
    setStatusMessage("");
    setScreen("game");
  }, [cancelDrag]);

  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, source: Selection) => {
      e.preventDefault(); // prevent text selection / default drag
      const rect = e.currentTarget.getBoundingClientRect();
      dragMetaRef.current = {
        source,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        started: false
      };
    },
    []
  );

  const selectTableau = useCallback(
    (columnIndex: number, cardIndex: number) => {
      if (dragMetaRef.current?.started) return;
      const column = game.tableau[columnIndex];
      const card = column[cardIndex];
      if (!card || !card.faceUp) return;
      if (
        selection &&
        selection.source === "tableau" &&
        selection.columnIndex === columnIndex &&
        selection.cardIndex === cardIndex
      ) {
        setSelection(null);
        return;
      }
      setSelection({
        source: "tableau",
        columnIndex,
        cardIndex,
        cards: column.slice(cardIndex)
      });
    },
    [game.tableau, selection]
  );

  const selectWaste = useCallback(() => {
    if (dragMetaRef.current?.started) return;
    const top = game.waste[game.waste.length - 1];
    if (!top) return;
    if (selection && selection.source === "waste") {
      setSelection(null);
      return;
    }
    setSelection({ source: "waste", cards: [top] });
  }, [game.waste, selection]);

  const handleColumnClick = useCallback(
    (columnIndex: number) => {
      if (dragMetaRef.current?.started) return;

      if (selection) {
        const next = applyMoveToColumn(game, selection, columnIndex);
        if (next) {
          setGameHistory((h) => [...h, game]);
          setGame(next);
          setStatusMessage("Moved cards.");
        } else {
          const targetColumn = game.tableau[columnIndex];
          const cardToPlace = selection.cards[0];
          if (selection.source === "tableau" && selection.columnIndex === columnIndex) {
            setStatusMessage("Select another column to move onto.");
          } else if (targetColumn.length === 0 && cardToPlace.rank !== 13) {
            setStatusMessage("Only Kings can start an empty column.");
          } else {
            setStatusMessage(
              "Each card must be placed on an alternating color and descending rank."
            );
          }
        }
        setSelection(null);
        return;
      }

      // No selection — flip top face-down card
      const column = game.tableau[columnIndex];
      if (!column.length) return;
      const topCard = column[column.length - 1];
      if (topCard.faceUp) return;
      const updatedColumn = [...column.slice(0, -1), { ...topCard, faceUp: true }];
      const flippedGame = {
        ...game,
        tableau: game.tableau.map((col, idx) => (idx === columnIndex ? updatedColumn : col)),
        score: game.score + FLIP_BONUS,
        moves: game.moves + 1
      };
      setGameHistory((h) => [...h, game]);
      setGame(flippedGame);
      setStatusMessage("");
    },
    [game, selection]
  );

  const handleStockClick = useCallback(() => {
    let next: GameState | null = null;
    if (game.stock.length === 0 && game.waste.length > 0) {
      next = {
        ...game,
        stock: game.waste.map((c) => ({ ...c, faceUp: false })).reverse(),
        waste: [],
        moves: game.moves + 1
      };
    } else if (game.stock.length > 0) {
      const nextStock = [...game.stock];
      const card = nextStock.pop()!;
      next = {
        ...game,
        stock: nextStock,
        waste: [...game.waste, { ...card, faceUp: true }],
        moves: game.moves + 1
      };
    }
    if (next) {
      setGameHistory((h) => [...h, game]);
      setGame(next);
    }
    setSelection(null);
  }, [game]);

  const handleCardDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, card: Card, source: Selection) => {
      e.stopPropagation();
      const idx = findFoundationIndex(game, card);
      if (idx === -1) return;
      const next = applyMoveToFoundation(game, source, idx);
      if (next) {
        setGameHistory((h) => [...h, game]);
        setGame(next);
        setStatusMessage("Card moved to foundation.");
        setSelection(null);
      }
    },
    [game]
  );

  const handleFoundationClick = useCallback(
    (foundationIndex: number) => {
      if (dragMetaRef.current?.started) return;
      const wasteTop = game.waste[game.waste.length - 1];
      const source: Selection | null =
        selection ?? (wasteTop ? { source: "waste", cards: [wasteTop] } : null);
      if (!source?.cards[0]) {
        setStatusMessage("No card available to move to foundations.");
        return;
      }
      const next = applyMoveToFoundation(game, source, foundationIndex);
      if (next) {
        setGameHistory((h) => [...h, game]);
        setGame(next);
        setStatusMessage("Card added to the foundation.");
      } else {
        const candidate = source.cards[0];
        const pile = game.foundations[foundationIndex];
        if (source.source === "tableau" && source.cards.length !== 1)
          setStatusMessage("Only single cards can move to a foundation.");
        else if (pile.length > 0 && candidate.suit !== pile[0].suit)
          setStatusMessage("That card doesn't match this foundation's suit.");
        else setStatusMessage("Cards must stack from Ace onward.");
      }
      setSelection(null);
    },
    [game, selection]
  );

  const handleUndo = useCallback(() => {
    if (gameHistory.length === 0) return;
    const prev = gameHistory[gameHistory.length - 1];
    setGameHistory((h) => h.slice(0, -1));
    setGame({ ...prev, score: Math.max(0, prev.score - 5) });
    setSelection(null);
    setStatusMessage("Move undone. −5 points.");
  }, [gameHistory]);

  const handleResign = useCallback(() => {
    setShowResignModal(true);
  }, []);

  const handleResignConfirm = useCallback(async (withSubmit: boolean) => {
    setShowResignModal(false);
    setResigned(true);
    setSelection(null);
    cancelDrag();
    if (withSubmit && playerName.trim() && !scoreSubmitted) {
      await submitScore(false);
    }
    setShowPlayAgainModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelDrag, playerName, scoreSubmitted, game.score]);

  async function submitScore(isCompleted: boolean) {
    if (!playerName.trim() || scoreSubmitted) return;
    try {
      const payload = {
        player: playerName.trim(),
        score: game.score,
        completed: isCompleted ? 1 : 0
      };
      const res = await fetch("/api/highscores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Unable to submit score.");
      const created = (await res.json()) as HighScoreEntry;
      setHighscores((prev) => [created, ...prev].slice(0, 10));
      setScoreSubmitted(true);
      setPlayerName("");
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to submit score.");
    }
  }

  // ── Title screen ───────────────────────────────────────────────────────────
  if (screen === "title") {
    return <TitleScreen onPlay={handleRestart} />;
  }

  const selectedCard = selection?.cards[0];
  const dragSourceIds = dragSource ? new Set(dragSource.cards.map((c) => c.id)) : null;

  // Detect definitively stuck state: stock exhausted, waste empty, no valid moves remain
  const isStuck =
    !game.completed &&
    !resigned &&
    game.stock.length === 0 &&
    game.waste.length === 0 &&
    !hasAnyMove(game);

  // Initial ghost position (subsequent moves use direct DOM transform)
  const ghostInitTransform =
    dragSource && dragMetaRef.current
      ? `translate(${dragMetaRef.current.currentX - dragMetaRef.current.offsetX}px, ${
          dragMetaRef.current.currentY - dragMetaRef.current.offsetY
        }px)`
      : "translate(-9999px, -9999px)";

  return (
    <div className="app-shell">
      {/* Refresh / new-game intercept modal */}
      {showRefreshModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Start a new game?</h2>
            <p>
              You have a game in progress with <strong>{game.score} pts</strong>. Starting a
              new game will lose your current progress.
            </p>
            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => {
                  setShowRefreshModal(false);
                  handleRestart();
                }}
              >
                New game
              </button>
              <button type="button" onClick={() => setShowRefreshModal(false)}>
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-complete modal */}
      {showAutoCompleteModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Auto-Complete?</h2>
            <p>All cards are face-up — the game can be finished automatically.</p>
            <p className="modal-bonus">+1 000 bonus points awarded on completion.</p>
            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => {
                  setShowAutoCompleteModal(false);
                  setIsAutoCompleting(true);
                }}
              >
                Yes, finish it!
              </button>
              <button
                type="button"
                onClick={() => setShowAutoCompleteModal(false)}
              >
                No, I'll play it out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign confirmation modal */}
      {showResignModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>Resign game?</h2>
            <p>You're about to end this game with <strong>{game.score} pts</strong>.</p>
            <p className="modal-bonus">Submit your score before leaving?</p>
            <div className="modal-name-input">
              <input
                aria-label="Player name"
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-buttons modal-buttons-col">
              <button
                type="button"
                disabled={!playerName.trim()}
                onClick={() => handleResignConfirm(true)}
              >
                Resign &amp; submit score
              </button>
              <button type="button" onClick={() => handleResignConfirm(false)}>
                Resign without submitting
              </button>
              <button type="button" className="modal-btn-ghost" onClick={() => setShowResignModal(false)}>
                Cancel — keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win / end-of-game modal — shown when game.completed, includes score submission */}
      {showPlayAgainModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>{game.completed ? "You won! 🎉" : "Game over"}</h2>
            <p>Final score: <strong>{game.score} pts</strong></p>

            {scoreSubmitted ? (
              <p className="modal-bonus">Score submitted ✓</p>
            ) : (
              <>
                <p className="modal-bonus">Submit your score to the leaderboard:</p>
                <div className="modal-name-input">
                  <input
                    aria-label="Player name"
                    placeholder="Your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <button
                    type="button"
                    className="modal-submit-btn"
                    disabled={!playerName.trim()}
                    onClick={() => submitScore(game.completed)}
                  >
                    Submit score
                  </button>
                </div>
              </>
            )}

            <div className="modal-buttons">
              <button type="button" onClick={() => { setShowPlayAgainModal(false); handleRestart(); }}>
                Play again
              </button>
              <button type="button" onClick={() => { setShowPlayAgainModal(false); setScreen("title"); }}>
                Return to menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal settings-modal">
            <h2>Settings</h2>

            {!showRestartConfirm ? (
              <>
                {/* Card back picker */}
                <div className="settings-section">
                  <h3>Card Back</h3>
                  {CARD_BACK_DESIGNS.map((design) => (
                    <div key={design.id} className="card-back-row">
                      <span className="card-back-design-label">{design.label}</span>
                      <div className="card-back-swatches">
                        {CARD_BACK_COLORS.map((color) => {
                          const id = `player_card_back_${design.id}_${color.id}`;
                          const isSelected = cardBack === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`card-back-swatch${isSelected ? " swatch-selected" : ""}`}
                              title={`${design.label} — ${color.label}`}
                              onClick={() => setCardBack(id)}
                            >
                              <img
                                src={cardBackUrl(id)}
                                alt={`${design.label} ${color.label}`}
                                draggable={false}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Restart game */}
                <div className="settings-section settings-danger">
                  <h3>Game</h3>
                  <button
                    type="button"
                    className="settings-restart-btn"
                    onClick={() => setShowRestartConfirm(true)}
                  >
                    Restart game
                  </button>
                </div>

                <div className="modal-buttons" style={{ marginTop: "1.25rem" }}>
                  <button type="button" onClick={() => setShowSettings(false)}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              /* Restart confirmation */
              <>
                <p>Are you sure you want to restart? Your current game will be lost.</p>
                <div className="modal-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      handleRestart();
                    }}
                  >
                    Yes, restart
                  </button>
                  <button type="button" onClick={() => setShowRestartConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Drag ghost — pointer-events: none so elementFromPoint sees through it */}
      {dragSource && (
        <div
          ref={ghostRef}
          className="drag-ghost"
          style={{ transform: ghostInitTransform }}
          aria-hidden="true"
        >
          {dragSource.cards.map((card) => (
            <div key={card.id} className="card">
              <img
                src={cardImageUrl(card)}
                alt={`${rankLabel(card.rank)} of ${card.suit}`}
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}

      <div className="game-area">
      <div className="hud">
        <div className="panel score-panel">
          <h2>Score</h2>
          <div className="score-row">
            <div>Points: {game.score}</div>
            <div>Moves: {game.moves}</div>
            <div>Time: {formatTime(seconds)}</div>
          </div>
          {isGameComplete && <div>Game complete! +500 bonus applied.</div>}
          {resigned && !isGameComplete && <div>Game resigned.</div>}
        </div>
        <div className="panel selection-panel">
          <h2>Selection</h2>
          <div>
            {selectedCard
              ? `${rankLabel(selectedCard.rank)} of ${selectedCard.suit}`
              : <span className="selection-hint">Tap a card to move it.</span>}
          </div>
          <div className="controls">
            <button type="button" onClick={handleStockClick}>
              {game.stock.length ? "Draw card" : "Reset stock"}
            </button>
            <button type="button" onClick={handleUndo} disabled={gameHistory.length === 0 || resigned}>
              Undo
            </button>
            <button type="button" onClick={handleResign} disabled={resigned || isGameComplete}>
              Resign
            </button>
            <button
              type="button"
              className="settings-btn"
              aria-label="Settings"
              onClick={() => { setShowSettings(true); setShowRestartConfirm(false); }}
            >
              ⚙
            </button>
          </div>
        </div>
        <FlashStatus message={statusMessage} />
      </div>

      {isStuck && (
        <div className="stuck-banner">
          No moves remaining. Resign to register your score or restart.
          <button type="button" onClick={handleResign}>Resign &amp; save score</button>
          <button type="button" onClick={() => { setShowSettings(true); setShowRestartConfirm(true); }}>New game</button>
        </div>
      )}

      <div className={`game-board${isAutoCompleting ? " is-autocompleting" : ""}`}>
        <div className="piles">
          <div className={`pile${keyboardFocus?.area === "stock" ? " keyboard-focused" : ""}`} onClick={handleStockClick} role="button" tabIndex={0}>
            {game.stock.length ? (
              <div className="card face-down">
                <img src={cardBackUrl(cardBack)} alt="Card back" draggable={false} />
              </div>
            ) : (
              <div className="card card-empty">Empty</div>
            )}
            <p>Deck ({game.stock.length})</p>
          </div>

          <div className={`pile${keyboardFocus?.area === "discard" ? " keyboard-focused" : ""}`} role="button" tabIndex={0} onClick={selectWaste}>
            {game.waste.length
              ? (() => {
                  const top = game.waste[game.waste.length - 1];
                  return (
                    <div
                      className={`card${selection?.source === "waste" ? " selected" : ""}${
                        dragSourceIds?.has(top.id) ? " is-dragging" : ""
                      }`}
                      onPointerDown={(e) =>
                        handleCardPointerDown(e, { source: "waste", cards: [top] })
                      }
                      onDoubleClick={(e) =>
                        handleCardDoubleClick(e, top, { source: "waste", cards: [top] })
                      }
                    >
                      <img
                        src={cardImageUrl(top)}
                        alt={`${rankLabel(top.rank)} of ${top.suit}`}
                        draggable={false}
                      />
                    </div>
                  );
                })()
              : (
                <div className="card card-empty">Discard</div>
              )}
            <p>Discard Pile</p>
          </div>

          {game.foundations.map((pile, foundationIndex) => {
            const top = pile[pile.length - 1];
            return (
              <div
                key={foundationIndex}
                className={`pile${keyboardFocus?.area === "foundation" && keyboardFocus.index === foundationIndex ? " keyboard-focused" : ""}`}
                data-drop-foundation={foundationIndex}
                onClick={() => handleFoundationClick(foundationIndex)}
                role="button"
                tabIndex={0}
              >
                {top ? (
                  <div className="card">
                    <img
                      src={cardImageUrl(top)}
                      alt={`${rankLabel(top.rank)} of ${top.suit}`}
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="card card-empty">A</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="piles">
          {game.tableau.map((column, columnIndex) => (
            <div
              key={`column-${columnIndex}`}
              className={`pile${column.length === 0 ? " empty" : ""}`}
              data-drop-column={columnIndex}
              onClick={() => handleColumnClick(columnIndex)}
              role="button"
              tabIndex={0}
            >
              <div className="card-stack">
                {column.length === 0 && <div className="card card-empty">K</div>}
                {column.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className={[
                      "card",
                      card.faceUp ? "" : "face-down",
                      selection?.source === "tableau" &&
                      selection.columnIndex === columnIndex &&
                      selection.cardIndex <= cardIndex
                        ? "selected"
                        : "",
                      dragSourceIds?.has(card.id) ? "is-dragging" : "",
                      keyboardFocus?.area === "tableau" &&
                      keyboardFocus.columnIndex === columnIndex &&
                      keyboardFocus.cardIndex === cardIndex
                        ? "keyboard-focused"
                        : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onPointerDown={
                      card.faceUp
                        ? (e) =>
                            handleCardPointerDown(e, {
                              source: "tableau",
                              columnIndex,
                              cardIndex,
                              cards: column.slice(cardIndex)
                            })
                        : undefined
                    }
                    onDoubleClick={
                      card.faceUp && cardIndex === column.length - 1
                        ? (e) =>
                            handleCardDoubleClick(e, card, {
                              source: "tableau",
                              columnIndex,
                              cardIndex,
                              cards: [card]
                            })
                        : undefined
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!card.faceUp) return;
                      selectTableau(columnIndex, cardIndex);
                    }}
                  >
                    {card.faceUp ? (
                      <img
                        src={cardImageUrl(card)}
                        alt={`${rankLabel(card.rank)} of ${card.suit}`}
                        draggable={false}
                      />
                    ) : (
                      <img src={cardBackUrl(cardBack)} alt="Card back" draggable={false} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      </div>{/* end .game-area */}

      <div className="highscore-list">
        <div className="panel">
          <h2>Leaderboard</h2>
          {highscores.filter((e) => e.completed).length === 0 ? (
            <p>No entries yet.</p>
          ) : (
            highscores
              .filter((e) => e.completed)
              .slice(0, 5)
              .map((entry) => (
                <div key={entry.id} className="highscore-card">
                  <strong>{entry.player}</strong>
                  <span>{entry.score} pts</span>
                  <span>{new Date(entry.earned_at).toLocaleString()}</span>
                </div>
              ))
          )}
        </div>
      </div>
      <footer className="app-footer">
        <p>© {new Date().getFullYear()} Solitaire. Test project made along with Claude Code. 
          AI can be a great help, but it's not a replacement for human intelligence.
          AI can also make mistakes, so it's important to review the code carefully.
          <a href="https://github.com/JimGray9999/solitaire-game">GitHub</a>
          <a href="https://www.claude.com/code">Claude Code</a>
          <a href="https://www.linkedin.com/in/jgray00/">LinkedIn</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
