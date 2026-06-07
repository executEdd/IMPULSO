import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <Header />
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
