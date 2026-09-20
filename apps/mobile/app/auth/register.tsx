/**
 * Register screen.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/useTheme';
import { useRegister } from '@/api/mutations';
import { useSessionStore } from '@/state/sessionStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();
  const { mutateAsync: register, isPending } = useRegister();
  const { setAccessToken } = useSessionStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    try {
      const tokens = await register({
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      });
      setAccessToken(tokens.access_token);
      await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Registration failed. Please try again.';
      Alert.alert('Registration failed', message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: spacing[10] }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
              }}
              accessibilityRole="header"
            >
              Create account
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.md,
                marginTop: spacing[2],
              }}
            >
              Start discovering with SwipeDeck
            </Text>
          </View>

          <View style={{ gap: spacing[4] }}>
            <View>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                Display name (optional)
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, color: colors.textPrimary, fontSize: fontSize.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}
                accessibilityLabel="Display name"
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, color: colors.textPrimary, fontSize: fontSize.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}
                accessibilityLabel="Email address"
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, color: colors.textPrimary, fontSize: fontSize.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}
                accessibilityLabel="Password"
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label="Create account"
              onPress={handleRegister}
              loading={isPending}
              style={{ marginTop: spacing[2] }}
            />

            <Button
              variant="ghost"
              size="md"
              label="Already have an account? Sign in"
              onPress={() => router.back()}
              style={{ alignSelf: 'center' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  input: { borderWidth: 1, height: 52 },
  label: { marginBottom: 8 },
});
