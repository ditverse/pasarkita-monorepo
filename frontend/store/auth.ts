import { create } from 'zustand';
import { User } from '@/types/api';

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (token, user) => {
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    document.cookie = 'token=; path=/; max-age=0';
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
