// src/components/layout/Header.tsx - Header avec navigation (COMPLET)
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  LayoutDashboard,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
    setIsProfileOpen(false);
  };

  const navigation = [
    { name: 'Accueil', href: '/', current: pathname === '/' },
    { name: 'Fonctionnalités', href: '/features', current: pathname === '/features' },
    { name: 'Tarifs', href: '/pricing', current: pathname === '/pricing' },
    { name: 'À propos', href: '/about', current: pathname === '/about' },
  ];

  const profileNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Mon Profil', href: '/profile', icon: User },
    { name: 'Facturation', href: '/billing', icon: CreditCard },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-black hover:text-gray-800 transition-colors">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              AI Upscaler
            </Link>
          </div>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  item.current
                    ? 'text-black'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Crédits (desktop uniquement) */}
                <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.plan === 'FREE' 
                      ? `${5 - (user?.creditsUsedToday || 0)}/5`
                      : user?.creditsRemaining || 0
                    }
                  </span>
                </div>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {user?.email?.split('@')[0]}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                      >
                        {/* User info */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-black truncate">
                            {user?.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            Plan {user?.plan}
                          </p>
                        </div>

                        {/* Navigation links */}
                        <div className="py-2">
                          {profileNavigation.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsProfileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <Icon className="w-4 h-4" />
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>

                        {/* Logout */}
                        <div className="border-t border-gray-100 pt-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Déconnexion
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                {/* Boutons d'authentification */}
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                >
                  Se connecter
                </Link>
                <Link
                  href="/register"
                  className="btn-primary text-sm py-2 px-4"
                >
                  S'inscrire
                </Link>
              </>
            )}

            {/* Menu mobile */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 py-4"
            >
              <nav className="space-y-3">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      item.current
                        ? 'bg-gray-100 text-black'
                        : 'text-gray-600 hover:text-black hover:bg-gray-50'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}

                {isAuthenticated ? (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    {/* Crédits mobile */}
                    <div className="px-3 py-2 text-sm text-gray-600">
                      Crédits: {user?.plan === 'FREE' 
                        ? `${5 - (user?.creditsUsedToday || 0)}/5`
                        : user?.creditsRemaining || 0
                      }
                    </div>
                    
                    {profileNavigation.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                    
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-3 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-center"
                    >
                      S'inscrire
                    </Link>
                  </div>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}