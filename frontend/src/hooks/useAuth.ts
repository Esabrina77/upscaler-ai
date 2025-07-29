
// ================================
// src/hooks/useAuth.ts - Hook d'authentification
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';

export function useAuth() {
  const { user, isAuthenticated, login, logout, setLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token && !user) {
        setLoading(true);
        try {
          const response = await authAPI.getProfile();
          // Token valide, utilisateur connecté
          login(response.data.user, token);
        } catch (error) {
          // Token invalide, déconnexion
          logout();
        } finally {
          setLoading(false);
        }
      }
    };

    checkAuth();
  }, [user, login, logout, setLoading]);

  return {
    user,
    isAuthenticated,
    login,
    logout,
  };
}
