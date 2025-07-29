

// ================================
// src/components/layout/Footer.tsx - Pied de page
'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">AI Upscaler</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Transformez vos images avec la puissance de l'intelligence artificielle. 
              Rapide, efficace et accessible à tous.
            </p>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              Fait avec <Heart className="w-4 h-4 text-red-500 mx-1" /> en France
            </div>
          </div>

          {/* Liens */}
          <div>
            <h3 className="font-semibold mb-4">Produit</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
              <li><Link href="/gallery" className="hover:text-white transition-colors">Galerie</Link></li>
              <li><Link href="/api-docs" className="hover:text-white transition-colors">API</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/help" className="hover:text-white transition-colors">Aide</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Confidentialité</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">CGU</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2024 AI Upscaler. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
