// src/components/layout/Sidebar.tsx - Navigation sidebar pour l'extranet
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard,
  User,
  CreditCard,
  Settings,
  LogOut,
  Sparkles,
  Crown,
  Zap,
  Shield
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: pathname === '/dashboard'
    },
    {
      name: 'Mon Profil',
      href: '/profile',
      icon: User,
      current: pathname === '/profile'
    },
    {
      name: 'Facturation',
      href: '/billing',
      icon: CreditCard,
      current: pathname === '/billing'
    },
  ];

  const getPlanInfo = (plan: string) => {
    switch (plan) {
      case 'FREE':
        return {
          name: 'Gratuit',
          color: 'text-gray-600 bg-gray-100',
          icon: <Shield className="w-4 h-4" />
        };
      case 'PREMIUM':
        return {
          name: 'Premium',
          color: 'text-blue-600 bg-blue-100',
          icon: <Zap className="w-4 h-4" />
        };
      case 'PRO':
        return {
          name: 'Pro',
          color: 'text-purple-600 bg-purple-100',
          icon: <Crown className="w-4 h-4" />
        };
      default:
        return {
          name: plan,
          color: 'text-gray-600 bg-gray-100',
          icon: <Shield className="w-4 h-4" />
        };
    }
  };

  const planInfo = getPlanInfo(user?.plan || 'FREE');

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-200">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl text-black">AI Upscaler</span>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black truncate">
              {user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Plan Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${planInfo.color}`}>
          {planInfo.icon}
          <span className="text-sm font-medium">{planInfo.name}</span>
        </div>

        {/* Credits */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600">
              {user?.plan === 'FREE' ? 'Aujourd\'hui' : 'Crédits'}
            </span>
            <span className="text-xs font-medium text-black">
              {user?.plan === 'FREE' 
                ? `${5 - (user?.creditsUsedToday || 0)}/5`
                : user?.creditsRemaining || 0
              }
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-black h-1.5 rounded-full transition-all duration-300"
              style={{
                width: user?.plan === 'FREE'
                  ? `${((5 - (user?.creditsUsedToday || 0)) / 5) * 100}%`
                  : `${((user?.creditsRemaining || 0) / (user?.plan === 'PREMIUM' ? 100 : 500)) * 100}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${item.current
                      ? 'bg-black text-white'
                      : 'text-gray-600 hover:text-black hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Upgrade CTA */}
        {user?.plan === 'FREE' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg"
          >
            <Crown className="w-8 h-8 text-purple-600 mb-3" />
            <h3 className="font-medium text-black mb-1">Passez au Premium</h3>
            <p className="text-xs text-gray-600 mb-3">
              Plus de crédits et de fonctionnalités avancées
            </p>
            <Link
              href="/billing"
              className="block w-full bg-black text-white text-center py-2 px-4 rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              Upgrade
            </Link>
          </motion.div>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}