import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/api';

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      login: (token, user) => {
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        document.cookie = 'token=; path=/; max-age=0';
        set({ user: null, token: null, isAuthenticated: false });
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'pk-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Sync with cookie strictly to prevent desync bugs
        if (typeof document !== 'undefined' && state) {
          const hasTokenCookie = document.cookie.includes('token=');
          if (state.isAuthenticated && !hasTokenCookie) {
            state.logout();
          } else if (!state.isAuthenticated && hasTokenCookie) {
            document.cookie = 'token=; path=/; max-age=0';
          }
        }
      },
    }
  )
);
