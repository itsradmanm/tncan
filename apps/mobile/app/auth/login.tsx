/**
 * Login screen.
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
import { useLogin } from '@/api/mutations';
import { useSessionStore } from '@/state/sessionStore';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, radius, fontSize, fontWeight, shadow } = useTheme();
  const { mutateAsync: login, isPending } = useLogin();
  const { setAccessToken } = useSessionStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    try {
      const tokens = await login({ email: email.trim(), password });
      setAccessToken(tokens.access_token);
      await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Please check your credentials.';
      Alert.alert('Login failed', message);
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
              Sign in
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.md,
                marginTop: spacing[2],
              }}
            >
              Welcome back to SwipeDeck
            </Text>
          </View>

          <View style={{ gap: spacing[4] }}>
            {/* Email */}
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.sm,
                  marginBottom: spacing[2],
                  fontWeight: fontWeight.medium,
                }}
              >
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
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    color: colors.textPrimary,
                    fontSize: fontSize.md,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  },
                ]}
                accessibilityLabel="Email address"
              />
            </View>

            {/* Password */}
            <View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.sm,
                  marginBottom: spacing[2],
                  fontWeight: fontWeight.medium,
                }}
              >
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    color: colors.textPrimary,
                    fontSize: fontSize.md,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  },
                ]}
                accessibilityLabel="Password"
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
            </View>

            <Button
              variant="primary"
              size="lg"
              label="Sign in"
              onPress={handleLogin}
              loading={isPending}
              style={{ marginTop: spacing[2] }}
            />

            <Button
              variant="ghost"
              size="md"
              label="Create an account"
              onPress={() => router.push('/auth/register')}
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  input: {
    borderWidth: 1,
    height: 52,
  },
});
