/**
 * Deck store — Zustand store managing the active swipe deck state.
 *
 * Responsibilities:
 * - Tracks the current card index in the feed
 * - Maintains the list of loaded cards
 * - Handles card removal on swipe
 * - Handles card restoration on undo
 */
import { create } from 'zustand';
import type { CardOut } from '@/api/types';

interface DeckState {
  cards: CardOut[];
  currentIndex: number;
  isLoadingMore: boolean;

  setCards: (cards: CardOut[]) => void;
  appendCards: (newCards: CardOut[]) => void;
  removeTopCard: () => void;
  prependCard: (card: CardOut) => void;   // For undo — puts card back on top
  setLoadingMore: (loading: boolean) => void;
  reset: () => void;
}

export const useDeckStore = create<DeckState>()((set) => ({
  cards: [],
  currentIndex: 0,
  isLoadingMore: false,

  setCards: (cards) => set({ cards, currentIndex: 0 }),

  appendCards: (newCards) =>
    set((state) => ({
      cards: [...state.cards, ...newCards],
    })),

  removeTopCard: () =>
    set((state) => ({
      cards: state.cards.slice(1),
    })),

  prependCard: (card) =>
    set((state) => ({
      cards: [card, ...state.cards],
    })),

  setLoadingMore: (loading) => set({ isLoadingMore: loading }),

  reset: () => set({ cards: [], currentIndex: 0, isLoadingMore: false }),
}));
