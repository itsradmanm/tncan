/**
 * History screen — shows the user's past swipe decisions.
 */
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useTheme } from '@/theme/useTheme';
import type { DecisionHistoryResponse } from '@/api/types';

export default function HistoryScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();

  const { data, isLoading, isError } = useQuery<DecisionHistoryResponse>({
    queryKey: ['decisions', 'history'],
    queryFn: async () => {
      const { data } = await apiClient.get<DecisionHistoryResponse>(
        '/decisions/history',
        { params: { page_size: 50 } },
      );
      return data;
    },
    staleTime: 30_000,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[3] }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}
          accessibilityRole="header"
        >
          History
        </Text>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Could not load history</Text>
        </View>
      )}

      {data && (
        <FlatList
          data={data.decisions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.decisionRow,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing[4],
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.directionPill,
                  {
                    backgroundColor:
                      item.direction === 'right'
                        ? colors.swipeKeep
                        : colors.swipePass,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      item.direction === 'right'
                        ? colors.swipeKeepText
                        : colors.swipePassText,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 1,
                  }}
                >
                  {item.direction === 'right' ? 'KEPT' : 'PASSED'}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: fontSize.xs,
                  marginTop: spacing[1],
                }}
              >
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>
                No decisions yet
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  decisionRow: {},
  directionPill: { alignSelf: 'flex-start' },
});
