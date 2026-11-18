import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../2_theme/ThemeContext';

export const ShadcnCard: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const ShadcnBadge: React.FC<{
  label: string;
  variant?: 'primary' | 'gold' | 'muted';
}> = ({ label, variant = 'primary' }) => {
  const { theme } = useAppTheme();
  const bg =
    variant === 'gold'
      ? theme.colors.goldBg
      : variant === 'muted'
      ? theme.colors.muted
      : theme.colors.badgeBg;
  const fg =
    variant === 'gold'
      ? theme.colors.goldFg
      : variant === 'muted'
      ? theme.colors.foreground
      : theme.colors.badgeFg;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
};

export const ShadcnButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'gold' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
}> = ({ label, onPress, variant = 'primary', style, textStyle }) => {
  const { theme } = useAppTheme();
  const bg =
    variant === 'gold'
      ? theme.colors.accent
      : variant === 'outline'
      ? 'transparent'
      : theme.colors.primary;
  const fg =
    variant === 'gold'
      ? theme.colors.accentForeground
      : variant === 'outline'
      ? theme.colors.foreground
      : theme.colors.primaryForeground;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? theme.colors.border : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
        },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const ShadcnInput: React.FC<{
  label?: string;
  value: string;
  onChangeText: (val: string) => void;
  placeholder?: string;
}> = ({ label, value, onChangeText, placeholder }) => {
  const { theme } = useAppTheme();
  return (
    <View style={styles.inputWrap}>
      {label ? (
        <Text style={[styles.inputLabel, { color: theme.colors.foreground }]}>{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.foreground,
            borderColor: theme.colors.border,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrap: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
});
