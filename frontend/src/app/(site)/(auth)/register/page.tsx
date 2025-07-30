// src/app/register/page.tsx - Page d'inscription (CORRIGÉ)
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Sparkles, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(6, 'Mot de passe trop court (min 6 caractères)')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Doit contenir: minuscule, majuscule, chiffre'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'Vous devez accepter les conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');

  const passwordCriteria = [
    { label: 'Au moins 6 caractères', isValid: password?.length >= 6 },
    { label: 'Une minuscule', isValid: /[a-z]/.test(password || '') },
    { label: 'Une majuscule', isValid: /[A-Z]/.test(password || '') },
    { label: 'Un chiffre', isValid: /\d/.test(password || '') },
  ];

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await authAPI.register(data.email, data.password);
      login(response.data.user, response.data.token);
      toast.success('Compte créé avec succès !');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création du compte');
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
            Créer un compte
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Commencez gratuitement avec 5 images par jour
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
                  autoComplete="new-password"
                  className={`
                    block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm placeholder-gray-400 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.password ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Créer un mot de passe"
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
              
              {/* Critères du mot de passe */}
              {password && (
                <div className="mt-2 space-y-1">
                  {passwordCriteria.map((criterion, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <Check className={`w-3 h-3 ${criterion.isValid ? 'text-green-600' : 'text-gray-300'}`} />
                      <span className={criterion.isValid ? 'text-green-600' : 'text-gray-500'}>
                        {criterion.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmer le mot de passe
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`
                    block w-full pl-10 pr-10 py-3 border rounded-lg shadow-sm placeholder-gray-400 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}
                  `}
                  placeholder="Confirmer le mot de passe"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Conditions */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  {...register('acceptTerms')}
                  id="accept-terms"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="accept-terms" className="text-gray-700">
                  J'accepte les{' '}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                    conditions d'utilisation
                  </Link>{' '}
                  et la{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
                    politique de confidentialité
                  </Link>
                </label>
              </div>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
            )}
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
              'Créer mon compte'
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Déjà un compte ?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}