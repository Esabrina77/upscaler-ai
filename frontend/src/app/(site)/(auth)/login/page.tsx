
// ================================
// src/app/login/page.tsx - Page de connexion
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (min 6 caractères)'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authAPI.login(data.email, data.password);
      login(response.data.user, response.data.token);
      toast.success('Connexion réussie !');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Bon retour !
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Connectez-vous pour accéder à vos projets
          </p>
        </div>

        {/* Formulaire */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-8 space-y-6 bg-white p-8 rounded-xl shadow-lg border"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={`
                    block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-gray-400 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.email ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Votre email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`
                    block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm placeholder-gray-400 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.password ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Votre mot de passe"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Se souvenir de moi
              </label>
            </div>

            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {/* Submit */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isLoading}
            className={`
              group relative w-full flex justify-center py-3 px-4 border border-transparent 
              text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 
              hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Se connecter'
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
