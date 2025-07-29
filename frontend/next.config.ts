/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pas de experimental.appDir pour Next.js 14+
  images: {
    domains: ['storage.googleapis.com', 'firebasestorage.googleapis.com'],
  },
  // Configuration PWA si nécessaire
  reactStrictMode: true,
}

module.exports = nextConfig