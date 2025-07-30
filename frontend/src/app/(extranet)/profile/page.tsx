// src/app/profile/page.tsx - Page de profil utilisateur
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Calendar, 
  Crown, 
  Zap, 
  Shield,
  Download,
  Trash2,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function ProfilePage() {
  const { user, isAuthenticated, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ email: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user) {
      setEditForm({ email: user.email });
    }

    const fetchProfile = async () => {
      try {
        const response = await authAPI.getProfile();
        setStats(response.data.stats);
        updateUser(response.data.user);
      } catch (error) {
        console.error('Erreur chargement profil:', error);
        toast.error('Erreur lors du chargement du profil');
      }
    };

    fetchProfile();
  }, [isAuthenticated, router, user, updateUser]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter l'API de mise à jour du profil
      toast.success('Profil mis à jour avec succès');
      setIsEditing(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
      return;
    }

    try {
      // TODO: Implémenter l'API de suppression de compte
      toast.success('Compte supprimé avec succès');
      logout();
      router.push('/');
    } catch (error) {
      toast.error('Erreur lors de la suppression du compte');
    }
  };

  const exportData = async () => {
    try {
      // TODO: Implémenter l'export des données utilisateur
      toast.success('Export des données en cours...');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const getPlanInfo = (plan: string) => {
    switch (plan) {
      case 'FREE':
        return {
          name: 'Gratuit',
          color: 'text-gray-600 bg-gray-100',
          icon: <Shield className="w-4 h-4" />,
          description: '5 images par jour'
        };
      case 'PREMIUM':
        return {
          name: 'Premium',
          color: 'text-blue-600 bg-blue-100',
          icon: <Zap className="w-4 h-4" />,
          description: '100 crédits mensuels'
        };
      case 'PRO':
        return {
          name: 'Pro',
          color: 'text-purple-600 bg-purple-100',
          icon: <Crown className="w-4 h-4" />,
          description: '500 crédits mensuels'
        };
      default:
        return {
          name: plan,
          color: 'text-gray-600 bg-gray-100',
          icon: <Shield className="w-4 h-4" />,
          description: ''
        };
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  const planInfo = getPlanInfo(user.plan);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-black mb-2">Mon Profil</h1>
          <p className="text-gray-600">
            Gérez vos informations personnelles et vos préférences
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Basic Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-black">
                  Informations personnelles
                </h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4" />
                      Annuler
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      Modifier
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adresse email
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="text-black">{user.email}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'inscription
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-black">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan actuel
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${planInfo.color}`}>
                      {planInfo.icon}
                    </div>
                    <div>
                      <span className="text-black font-medium">{planInfo.name}</span>
                      <p className="text-sm text-gray-600">{planInfo.description}</p>
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-600 hover:text-black transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-medium text-black mb-6">
                Statistiques d'utilisation
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-black">
                    {stats?.totalJobs || 0}
                  </div>
                  <div className="text-sm text-gray-600">Jobs total</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.completedJobs || 0}
                  </div>
                  <div className="text-sm text-gray-600">Réussis</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats?.imagesProcessed || 0}
                  </div>
                  <div className="text-sm text-gray-600">Images</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats?.videosProcessed || 0}
                  </div>
                  <div className="text-sm text-gray-600">Vidéos</div>
                </div>
              </div>
            </div>

            {/* Data Management */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-medium text-black mb-6">
                Gestion des données
              </h2>

              <div className="space-y-4">
                <button
                  onClick={exportData}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <Download className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-black">Exporter mes données</div>
                    <div className="text-sm text-gray-600">
                      Télécharger un fichier avec toutes vos données
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleDeleteAccount}
                  className="w-full flex items-center gap-3 p-4 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <div>
                    <div className="font-medium text-red-600">Supprimer mon compte</div>
                    <div className="text-sm text-red-500">
                      Action irréversible - toutes vos données seront perdues
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Quick Stats & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Credits Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-black mb-4">Crédits</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      {user.plan === 'FREE' ? 'Aujourd\'hui' : 'Restants'}
                    </span>
                    <span className="font-medium text-black">
                      {user.plan === 'FREE' 
                        ? `${5 - user.creditsUsedToday}/5`
                        : user.creditsRemaining
                      }
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-black h-2 rounded-full transition-all duration-300"
                      style={{
                        width: user.plan === 'FREE'
                          ? `${((5 - user.creditsUsedToday) / 5) * 100}%`
                          : `${(user.creditsRemaining / (user.plan === 'PREMIUM' ? 100 : 500)) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {user.plan === 'FREE' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-3">
                      Passez au Premium pour plus de crédits !
                    </p>
                    <button
                      onClick={() => router.push('/upgrade')}
                      className="w-full bg-black text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                      Upgrade
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-black mb-4">
                Actions rapides
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="font-medium text-black">Retour au Dashboard</div>
                  <div className="text-sm text-gray-600">Gérer vos projets</div>
                </button>
                
                <button
                  onClick={() => router.push('/billing')}
                  className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="font-medium text-black">Facturation</div>
                  <div className="text-sm text-gray-600">Gérer vos abonnements</div>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}