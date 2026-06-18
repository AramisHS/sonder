import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () =>
        set((s) => {
          const next = !s.dark;
          document.documentElement.classList.toggle('dark', next);
          return { dark: next };
        }),
      setDark: (dark) => {
        document.documentElement.classList.toggle('dark', dark);
        set({ dark });
      },
    }),
    { name: 'mercurio-theme' }
  )
);
