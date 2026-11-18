import { ThemeMode } from '../1_types/types';

export interface AppThemeTokens {
  mode: ThemeMode;
  colors: {
    background: string;
    card: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    inputBackground: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    badgeBg: string;
    badgeFg: string;
    goldBg: string;
    goldFg: string;
    success: string;
    danger: string;
  };
}

export const THEMES: Record<ThemeMode, AppThemeTokens> = {
  light: {
    mode: 'light',
    colors: {
      background: '#F8FAFC',
      card: '#FFFFFF',
      foreground: '#0F172A',
      muted: '#F1F5F9',
      mutedForeground: '#475569',
      border: '#CBD5E1',
      inputBackground: '#FFFFFF',
      primary: '#DC2626',
      primaryForeground: '#FFFFFF',
      accent: '#FACC15',
      accentForeground: '#0F172A',
      badgeBg: '#FEE2E2',
      badgeFg: '#991B1B',
      goldBg: '#FEF08A',
      goldFg: '#854D0E',
      success: '#16A34A',
      danger: '#DC2626',
    },
  },
  dark: {
    mode: 'dark',
    colors: {
      background: '#09090B',
      card: '#121216',
      foreground: '#F8FAFC',
      muted: '#18181B',
      mutedForeground: '#A1A1AA',
      border: '#27272A',
      inputBackground: '#18181B',
      primary: '#EF4444',
      primaryForeground: '#FFFFFF',
      accent: '#FACC15',
      accentForeground: '#09090B',
      badgeBg: '#3F1D1D',
      badgeFg: '#FCA5A5',
      goldBg: '#3B2F0C',
      goldFg: '#FDE047',
      success: '#22C55E',
      danger: '#EF4444',
    },
  },
  /* Tema Vermelho, Amarelo, Preto e Branco */
  rubro: {
    mode: 'rubro',
    colors: {
      background: '#070709',
      card: '#121216',
      foreground: '#FFFFFF',
      muted: '#19191F',
      mutedForeground: '#D4D4D8',
      border: '#4A181D',
      inputBackground: '#18181E',
      primary: '#DC2626',
      primaryForeground: '#FFFFFF',
      accent: '#FACC15',
      accentForeground: '#000000',
      badgeBg: '#DC2626',
      badgeFg: '#FFFFFF',
      goldBg: '#FACC15',
      goldFg: '#000000',
      success: '#4ADE80',
      danger: '#F87171',
    },
  },
};
