import React, { createContext, useContext, useState } from 'react';
import { ThemeMode } from '../1_types/types';
import { AppThemeTokens, THEMES } from './themes';

interface ThemeContextValue {
  themeMode: ThemeMode;
  theme: AppThemeTokens;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'rubro',
  theme: THEMES.rubro,
  setThemeMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('rubro');

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        theme: THEMES[themeMode],
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
