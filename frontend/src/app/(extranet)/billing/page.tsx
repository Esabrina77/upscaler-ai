// src/app/billing/page.tsx - Page de facturation
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Shield, 
  CheckCircle, 
  Star,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function BillingPage() {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const plans = [
    {
      id: 'FREE',
      name: 'Gratuit',
      price: '0€',
      period: '/mois',
      description: 'Pour découvrir l\'upscaling IA',
      features: [
        '5 images par jour',
        'Modèles de base',
        'Support communautaire',
        'Résolution jusqu\'à 4x'
      ],
      color: 'gray',
      icon: <Shield className="w-6 h-6" />,
      current: user?.plan === 'FREE'
    },
    {
      id: 'PREMIUM',
      name: 'Premium',
      price: '9€',
      period: '/mois',
      description: 'Pour les créateurs réguliers',
      features: [
        '100 crédits mensuels',
        'Tous les modèles IA',
        'Support prioritaire',
        'Résolution jusqu\'à 8x',
        'Traitement vidéo',
        'API access'
      ],
      color: 'blue',
      icon: <Zap className="w-6 h-6" />,
      popular: true,
      current: user?.plan === 'PREMIUM'
    },
    {
      id: 'PRO',
      name: 'Pro',
      price: '29€',
      period: '/mois',
      description: 'Pour les professionnels',
      features: [
        '500 crédits mensuels',
        'Modèles premium exclusifs',
        'Support dédié 24/7',
        'Résolution jusqu\'à 8x',
        'Traitement vidéo HD',
        'API illimitée',
        'Intégrations personnalisées',
        'SLA garanti'
      ],
      color: 'purple',
      icon: <Crown className="w-6 h-6" />,
      current: user?.plan === 'PRO'
    }
  ];

  const handleUpgrade = async (planId: string) => {
    if (!user || planId === user.plan) return;

    setLoading(true);
    setSelectedPlan(planId);

    try {
      const response = await authAPI.upgrade(planId);
      updateUser(response.data.user);
      toast.success(`Plan upgradé vers ${planId} avec succès !`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upgrade');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const getPlanColor = (color: string) => {
    const colors = {
      gray: 'border-gray-200 bg-gray-50',
      blue: 'border-blue-200 bg-blue-50',
      purple: 'border-purple-200 bg-purple-50'
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const getButtonColor = (color: string) => {
    const colors = {
      gray: 'bg-gray-900 hover:bg-gray-800',
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700'
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-black mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sélectionnez le plan qui correspond le mieux à vos besoins. 
            Changez ou annulez à tout moment.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative rounded-2xl border-2 p-8 transition-all duration-300
                ${plan.current 
                  ? 'border-black bg-black text-white' 
                  : 'border-gray-200 bg-white hover:shadow-lg'
                }
                ${plan.popular ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
              `}
            >
              {/* Badge populaire */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Plus populaire
                  </div>
                </div>
              )}

              {/* Badge plan actuel */}
              {plan.current && (
                <div className="absolute -top-4 right-4">
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Plan actuel
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Header du plan */}
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
                    plan.current ? 'bg-white/20' : getPlanColor(plan.color)
                  }`}>
                    <div className={plan.current ? 'text-white' : `text-${plan.color}-600`}>
                      {plan.icon}
                    </div>
                  </div>
                  <h3 className={`text-2xl font-bold ${plan.current ? 'text-white' : 'text-black'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.current ? 'text-gray-300' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Prix */}
                <div className="text-center">
                  <div className={`text-4xl font-bold ${plan.current ? 'text-white' : 'text-black'}`}>
                    {plan.price}
                    <span className={`text-lg font-normal ${plan.current ? 'text-gray-300' : 'text-gray-600'}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className={`w-5 h-5 ${
                        plan.current ? 'text-green-400' : 'text-green-500'
                      }`} />
                      <span className={`text-sm ${plan.current ? 'text-gray-300' : 'text-gray-700'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Bouton */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading || plan.current}
                  className={`
                    w-full py-3 px-6 rounded-lg font-medium transition-all
                    ${plan.current
                      ? 'bg-white/20 text-white cursor-default'
                      : `${getButtonColor(plan.color)} text-white hover:shadow-lg`
                    }
                    ${loading && selectedPlan === plan.id ? 'opacity-50' : ''}
                    disabled:cursor-not-allowed
                  `}
                >
                  {loading && selectedPlan === plan.id ? (
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                  ) : plan.current ? (
                    'Plan actuel'
                  ) : plan.id === 'FREE' ? (
                    'Passer au gratuit'
                  ) : (
                    `Passer à ${plan.name}`
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Usage actuel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white border border-gray-200 rounded-2xl p-8 mb-8"
        >
          <h2 className="text-2xl font-bold text-black mb-6">Utilisation actuelle</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-black mb-2">
                {user.plan === 'FREE' 
                  ? `${5 - user.creditsUsedToday}`
                  : user.creditsRemaining
                }
              </div>
              <div className="text-gray-600">
                {user.plan === 'FREE' ? 'Images restantes aujourd\'hui' : 'Crédits restants'}
              </div>
            </div>

            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-black mb-2">
                {user.plan}
              </div>
              <div className="text-gray-600">Plan actuel</div>
            </div>

            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-black mb-2">
                {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
              <div className="text-gray-600">Membre depuis</div>
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white border border-gray-200 rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold text-black mb-6">Questions fréquentes</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-black mb-2">Puis-je changer de plan à tout moment ?</h3>
              <p className="text-gray-600">
                Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. 
                Les changements prennent effet immédiatement.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-black mb-2">Que se passe-t-il si je dépasse mes crédits ?</h3>
              <p className="text-gray-600">
                Vous pouvez upgrader votre plan ou attendre le renouvellement mensuel. 
                Aucun traitement supplémentaire ne sera facturé.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-black mb-2">Puis-je annuler mon abonnement ?</h3>
              <p className="text-gray-600">
                Oui, vous pouvez annuler à tout moment. Vous continuerez à avoir accès 
                aux fonctionnalités premium jusqu'à la fin de votre période de facturation.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}