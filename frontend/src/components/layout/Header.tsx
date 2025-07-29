// ================================
// src/components/layout/Header.tsx - En-tête avec navigation
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Menu, X, User, LogOut, Crown } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'pro': return 'text-purple-600';
      case 'premium': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getPlanIcon = (plan: string) => {
    if (plan === 'pro' || plan === 'premium') {
      return <Crown className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Upscaler
            </span>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="/" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Accueil
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Tarifs
            </Link>
            <Link 
              href="/gallery" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Galerie
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.email?.split('@')[0]}
                    </div>
                    <div className={`text-xs flex items-center gap-1 ${getPlanColor(user?.plan || 'free')}`}>
                      {getPlanIcon(user?.plan || 'free')}
                      {user?.plan || 'free'}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
                      onBlur={() => setIsUserMenuOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">{user?.email}</div>
                        <div className={`text-xs flex items-center gap-1 mt-1 ${getPlanColor(user?.plan || 'free')}`}>
                          {getPlanIcon(user?.plan || 'free')}
                          Plan {user?.plan || 'Free'}
                        </div>
                        {user?.plan === 'free' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {5 - (user?.creditsUsedToday || 0)}/5 crédits restants
                          </div>
                        )}
                      </div>
                      
                      <div className="py-1">
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Dashboard
                        </Link>
                        {user?.plan === 'free' && (
                          <Link
                            href="/pricing"
                            className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                          >
                            ⚡ Passer au Premium
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Déconnexion
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  S'inscrire
                </Link>
              </div>
            )}

            {/* Menu mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 py-4"
            >
              <nav className="space-y-2">
                <Link
                  href="/"
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Accueil
                </Link>
                <Link
                  href="/pricing"
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Tarifs
                </Link>
                <Link
                  href="/gallery"
                  className="block py-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Galerie
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
