// src/app/(site)/page.tsx - Page d'accueil du site (sans uploader)
'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Star,
  ArrowRight,
  PlayCircle,
  CheckCircle,
  Users,
  Award,
  Cpu
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Cpu className="w-8 h-8" />,
      title: 'IA Avancée',
      description: 'Modèles Real-ESRGAN et Waifu2x pour des résultats exceptionnels'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Traitement Rapide',
      description: 'Résultats en moins de 2 minutes grâce à notre infrastructure optimisée'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Sécurisé',
      description: 'Vos images sont automatiquement supprimées après traitement'
    }
  ];

  const testimonials = [
    {
      name: "Marie Laurent",
      role: "Photographe",
      content: "AI Upscaler a transformé mes anciennes photos. La qualité est impressionnante !",
      rating: 5
    },
    {
      name: "Thomas Martin",
      role: "Designer",
      content: "Un outil indispensable pour améliorer les images de mes clients. Très facile à utiliser.",
      rating: 5
    },
    {
      name: "Sophie Dubois",
      role: "Artiste",
      content: "Parfait pour donner une seconde vie à mes créations numériques anciennes.",
      rating: 5
    }
  ];

  const stats = [
    { label: 'Images traitées', value: '1M+' },
    { label: 'Utilisateurs satisfaits', value: '50K+' },
    { label: 'Modèles IA disponibles', value: '4' },
    { label: 'Temps de traitement moyen', value: '< 2min' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-black mb-6 leading-tight">
              Améliorez vos images avec l'
              <span className="gradient-text">IA</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transformez vos images basse résolution en chef-d'œuvres haute définition 
              grâce à notre technologie d'upscaling par intelligence artificielle.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="/register"
                className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
              >
                Commencer gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="btn-secondary inline-flex items-center gap-2 text-lg px-8 py-4">
                <PlayCircle className="w-5 h-5" />
                Voir la démo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-black mb-2">
                    {stat.value}
                  </div>
                  <div className="text-gray-600">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Pourquoi choisir AI Upscaler ?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              La technologie d'intelligence artificielle la plus avancée pour l'amélioration d'images
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -5 }}
                className="card p-8 text-center hover:shadow-elegant transition-all duration-300"
              >
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6 text-white">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-black mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-gray-600">
              3 étapes simples pour transformer vos images
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: '1', title: 'Uploadez', desc: 'Glissez votre image dans notre interface' },
              { step: '2', title: 'Traitez', desc: 'Notre IA analyse et améliore votre image' },
              { step: '3', title: 'Téléchargez', desc: 'Récupérez votre image en haute résolution' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.2 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-black mb-4">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-xl text-gray-600">
              Des milliers d'utilisateurs nous font confiance
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card p-6"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic">"{testimonial.content}"</p>
                <div>
                  <p className="font-bold text-black">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Prêt à transformer vos images ?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Rejoignez des milliers d'utilisateurs qui font confiance à notre IA
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-white text-black px-8 py-4 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
              >
                Commencer maintenant
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="border border-white text-white px-8 py-4 rounded-lg font-medium hover:bg-white hover:text-black transition-colors"
              >
                Se connecter
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}