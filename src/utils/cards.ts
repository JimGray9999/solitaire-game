export type Suit = "spades" | "clubs" | "hearts" | "diamonds";
export const allSuits: Suit[] = ["spades", "clubs", "hearts", "diamonds"];
export type Color = "black" | "red";

export interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

const suits: Suit[] = allSuits;

export const colorForSuit = (suit: Suit): Color =>
  suit === "hearts" || suit === "diamonds" ? "red" : "black";

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        faceUp: false
      });
    }
  }
  return deck;
};

export const shuffleDeck = (cards: Card[]): Card[] => {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const rankLabel = (rank: number): string => {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return rank.toString();
};

const rankFilename = (rank: number): string => {
  if (rank === 1) return "ace";
  if (rank === 11) return "jack";
  if (rank === 12) return "queen";
  if (rank === 13) return "king";
  return rank.toString();
};

export const cardImageUrl = (card: Card): string =>
  `/cards/${rankFilename(card.rank)}_of_${card.suit}.svg`;
