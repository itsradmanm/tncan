/**
 * Main swipe screen — the primary application view.
 *
 * Wires together:
 * - TanStack Query infinite card feed
 * - Deck store
 * - SwipeDeck component
 * - Load-more trigger when deck gets low
 */
import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  SafeAreaView,
} from 'react-native';
import { useCardFeed } from '@/api/queries';
import { useDeckStore } from '@/state/deckStore';
import { SwipeDeck } from '@/components/Deck/SwipeDeck';
import { useTheme } from '@/theme/useTheme';
import { flushOfflineDecisions } from '@/api/mutations';
import type { CardOut } from '@/api/types';

export default function SwipeScreen() {
  const { colors, fontSize, fontWeight } = useTheme();
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useCardFeed();

  const { cards, setCards, appendCards } = useDeckStore();

  // Flush any offline decisions stored while the network was unavailable
  useEffect(() => {
    flushOfflineDecisions().catch(() => {});
  }, []);

  // Hydrate deck store from query data
  useEffect(() => {
    if (!data) return;
    const allCards = data.pages.flatMap((p) => p.cards) as CardOut[];
    setCards(allCards);
  }, [data, setCards]);

  const handleNeedMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage().then((result) => {
        const lastPage = result.data?.pages.at(-1);
        if (lastPage?.cards) {
          appendCards(lastPage.cards as CardOut[]);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: fontSize.md,
            fontWeight: fontWeight.medium,
          }}
        >
          Could not load cards
        </Text>
        <Text
          style={{
            color: colors.accent,
            fontSize: fontSize.sm,
            marginTop: 8,
          }}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading cards"
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: fontWeight.bold,
          }}
          accessibilityRole="header"
        >
          SwipeDeck
        </Text>
      </View>
      <SwipeDeck
        cards={cards}
        onNeedMore={handleNeedMore}
        onEmpty={handleNeedMore}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
});
