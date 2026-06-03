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
        if (typeof document !== 'undefined') {
          document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
        }
        set({ user, token, isAuthenticated: true, _hasHydrated: true });
      },
      logout: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'token=; path=/; max-age=0';
        }
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('pk-auth');
        }
        set({ user: null, token: null, isAuthenticated: false, _hasHydrated: true });
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
        if (typeof document !== 'undefined' && state) {
          const hasTokenCookie = document.cookie
            .split('; ')
            .some((cookie) => cookie.startsWith('token='));

          if (!state.token || !state.user || !hasTokenCookie) {
            state.logout();
          }
        }
      },
    }
  )
);
