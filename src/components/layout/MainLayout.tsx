import React from 'react';
import Navbar from './Navbar';
import { motion } from 'framer-motion';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>
      
      <footer className="border-t border-border mt-auto py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-xs text-muted-foreground">
          <p>© 2026 Tahsilat Sistemi - Tüm hakları saklıdır.</p>
          <div className="flex gap-4">
            <span className="bg-muted px-2 py-1 rounded">v1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
