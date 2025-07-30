// src/app/(site)/layout.tsx - Layout pour le site public avec Header/Footer
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}