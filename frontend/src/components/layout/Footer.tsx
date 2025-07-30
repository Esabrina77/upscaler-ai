// src/components/layout/Footer.tsx - Footer pour le site
import React from 'react';
import Link from 'next/link';
import { Sparkles, Mail, MapPin, Phone } from 'lucide-react';

export default function Footer() {
  const footerSections = [
    {
      title: 'Produit',
      links: [
        { name: 'Fonctionnalités', href: '/features' },
        { name: 'Tarifs', href: '/pricing' },
        { name: 'API', href: '/api' },
        { name: 'Intégrations', href: '/integrations' }
      ]
    },
    {
      title: 'Support',
      links: [
        { name: 'Centre d\'aide', href: '/help' },
        { name: 'Documentation', href: '/docs' },
        { name: 'Statut', href: '/status' },
        { name: 'Contact', href: '/contact' }
      ]
    },
    {
      title: 'Entreprise',
      links: [
        { name: 'À propos', href: '/about' },
        { name: 'Blog', href: '/blog' },
        { name: 'Carrières', href: '/careers' },
        { name: 'Presse', href: '/press' }
      ]
    },
    {
      title: 'Légal',
      links: [
        { name: 'Confidentialité', href: '/privacy' },
        { name: 'Conditions', href: '/terms' },
        { name: 'Cookies', href: '/cookies' },
        { name: 'RGPD', href: '/gdpr' }
      ]
    }
  ];

  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold">AI Upscaler</span>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Transformez vos images avec la puissance de l'intelligence artificielle. 
              Rapide, précis et accessible à tous.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="w-4 h-4" />
                <span className="text-sm">contact@aiupscaler.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Paris, France</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="w-4 h-4" />
                <span className="text-sm">+33 1 23 45 67 89</span>
              </div>
            </div>
          </div>

          {/* Links */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-white mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-300 text-sm mb-4 md:mb-0">
              © 2025 AI Upscaler. Tous droits réservés.
            </div>
            <div className="flex items-center gap-6">
              <select className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white">
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español</option>
              </select>
              <div className="flex items-center gap-4">
                <Link
                  href="/privacy"
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  Confidentialité
                </Link>
                <Link
                  href="/terms"
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  CGU
                </Link>
                <Link
                  href="/cookies"
                  className="text-gray-300 hover:text-white transition-colors text-sm"
                >
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}