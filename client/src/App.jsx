import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import { Cpu } from 'lucide-react';

function RootApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center space-y-4">
        <Cpu className="w-12 h-12 text-neon-blue animate-pulse" />
        <span className="text-xs uppercase font-black display-font text-text-muted tracking-widest animate-bounce">
          MarketPulse Booting...
        </span>
      </div>
    );
  }

  // Double switch layout: authenticated goes to dynamic Dashboard, guest goes to split Auth page
  return user ? <Dashboard /> : <Auth />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#0a1628',
            color: '#e8f4ff',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: '600'
          }
        }}
      />
      <RootApp />
    </AuthProvider>
  );
}
