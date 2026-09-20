/**
 * SwipeDeck — renders a stack of up to 3 cards with coordinated animations.
 *
 * Architecture:
 * - Cards are stacked in absolute-position Views (bottom of stack rendered first)
 * - The top card (index 0) receives the gesture handler
 * - Cards N+1 and N+2 receive the top card's translateX as a prop
 *   so they can animate "rising up" as the top card is dragged away
 * - On swipe commit: top card is removed from the deck store
 * - Undo: previous card is prepended back and animates back to center
 */
import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Card } from './Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/useTheme';
import { useDeckStore } from '@/state/deckStore';
import { useUndoStack } from '@/hooks/useUndoStack';
import { usePrefetchQueue } from '@/hooks/usePrefetchQueue';
import { useRecordDecision } from '@/api/mutations';
import type { CardOut } from '@/api/types';

/** Generate a UUID v4 using the Crypto API (available in RN via Hermes). */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STACK_VISIBLE = 3;  // How many cards to render in the stack

interface SwipeDeckProps {
  cards: CardOut[];
  onEmpty?: () => void;
  onNeedMore?: () => void;  // Called when deck gets low (trigger fetch)
}

export function SwipeDeck({ cards, onEmpty, onNeedMore }: SwipeDeckProps) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  const reducedMotion = useReducedMotion();
  const { removeTopCard, prependCard } = useDeckStore();
  const { push: pushUndo, pop: popUndo, canUndo } = useUndoStack();
  const { mutate: recordDecision } = useRecordDecision();

  // Shared value from the top card's gesture — passed down to stack cards
  const topCardX = useSharedValue(0);

  // Ref to access the top card's swipe functions from the action buttons
  const swipeRef = useRef<{
    triggerLeft: () => void;
    triggerRight: () => void;
    animateBack: () => void;
  } | null>(null);

  // Prefetch media for upcoming cards
  usePrefetchQueue({ cards, currentIndex: 0 });

  const handleSwipe = useCallback(
    (cardId: string, direction: 'left' | 'right') => {
      const card = cards[0];
      if (!card || card.id !== cardId) return;

      // Push to undo stack before removing
      pushUndo({ card, direction });

      // Remove from deck
      removeTopCard();

      // Record decision (handles offline queue internally)
      recordDecision({
        id: generateUUID(),
        card_id: cardId,
        direction,
      });

      // Trigger load-more when down to last 3 cards
      if (cards.length <= 3 && onNeedMore) {
        onNeedMore();
      }

      if (cards.length <= 1 && onEmpty) {
        onEmpty();
      }
    },
    [cards, pushUndo, removeTopCard, recordDecision, onNeedMore, onEmpty],
  );

  const handleUndo = useCallback(() => {
    if (!canUndo()) return;
    const entry = popUndo();
    if (!entry) return;

    // Put card back on top of deck
    prependCard(entry.card);

    // Animate the card back from off-screen
    // The swipeRef will be updated once the card re-renders as top
    setTimeout(() => {
      swipeRef.current?.animateBack();
    }, 50);
  }, [canUndo, popUndo, prependCard]);

  if (cards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.medium,
          }}
          accessibilityRole="text"
        >
          No more cards
        </Text>
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: fontSize.sm,
            marginTop: spacing[2],
          }}
        >
          Check back later
        </Text>
      </View>
    );
  }

  // Render only the top STACK_VISIBLE cards
  const visibleCards = cards.slice(0, STACK_VISIBLE);

  return (
    <View style={styles.container}>
      {/* Card stack — render from bottom to top */}
      <View style={styles.deckArea}>
        {[...visibleCards].reverse().map((card, reversedIndex) => {
          const stackIndex = visibleCards.length - 1 - reversedIndex;
          const isTop = stackIndex === 0;

          return (
            <Card
              key={card.id}
              card={card}
              isTop={isTop}
              stackIndex={stackIndex}
              topCardTranslateX={isTop ? undefined : topCardX}
              onSwipe={handleSwipe}
              swipeRef={isTop ? swipeRef : undefined}
            />
          );
        })}
      </View>

      {/* Action buttons — same animation path as gesture swipes */}
      <View
        style={[
          styles.actionBar,
          {
            paddingHorizontal: spacing[6],
            paddingBottom: spacing[8],
            gap: spacing[4],
          },
        ]}
      >
        {/* Pass button */}
        <Button
          variant="secondary"
          size="lg"
          label="Pass"
          onPress={() => swipeRef.current?.triggerLeft()}
          accessibilityLabel="Pass this card"
          style={{ flex: 1, borderColor: colors.swipePassText }}
        />

        {/* Undo button */}
        {canUndo() && (
          <Button
            variant="ghost"
            size="md"
            label="Undo"
            onPress={handleUndo}
            accessibilityLabel="Undo last swipe"
            style={{ minWidth: 72 }}
          />
        )}

        {/* Keep button */}
        <Button
          variant="primary"
          size="lg"
          label="Keep"
          onPress={() => swipeRef.current?.triggerRight()}
          accessibilityLabel="Keep this card"
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deckArea: {
    flex: 1,
    margin: 16,
    marginBottom: 0,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
