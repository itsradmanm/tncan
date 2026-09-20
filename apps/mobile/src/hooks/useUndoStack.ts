/**
 * useUndoStack — manages a stack of the last N swipe decisions.
 *
 * Supports undoing swipes by:
 * 1. Storing { card, direction } tuples as decisions are made.
 * 2. Returning the most recent entry on undo().
 * 3. The deck component then animates the card back to the top.
 *
 * Does NOT persist to storage — undo is session-only (intentional
 * design decision: undo is for fat-finger recovery, not history rewrite).
 */
import { useRef, useCallback } from 'react';
import type { CardOut } from '@/api/types';

export interface UndoEntry {
  card: CardOut;
  direction: 'left' | 'right';
}

const MAX_UNDO_STACK = 5;

export function useUndoStack() {
  const stack = useRef<UndoEntry[]>([]);

  const push = useCallback((entry: UndoEntry) => {
    stack.current = [entry, ...stack.current].slice(0, MAX_UNDO_STACK);
  }, []);

  const pop = useCallback((): UndoEntry | undefined => {
    const [top, ...rest] = stack.current;
    stack.current = rest;
    return top;
  }, []);

  const canUndo = useCallback((): boolean => {
    return stack.current.length > 0;
  }, []);

  const clear = useCallback(() => {
    stack.current = [];
  }, []);

  return { push, pop, canUndo, clear };
}
