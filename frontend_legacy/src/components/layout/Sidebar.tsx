import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, ClipboardList, GraduationCap,
  Bell, QrCode, Settings, LogOut, Menu, X, ChevronLeft, ChevronRight,
  BookOpen, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { classNames } from '../../utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
}

export const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    { label: 'Usuarios', path: '/users', icon: <Users className="w-5 h-5" />, roles: ['ADMIN'] },
    { label: 'Horarios', path: '/schedules', icon: <Calendar className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    { label: 'Asistencias', path: '/attendance', icon: <ClipboardList className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER'] },
    { label: 'Escanear QR', path: '/scan-qr', icon: <QrCode className="w-5 h-5" />, roles: ['TEACHER'] },
    { label: 'Calificaciones', path: '/grades', icon: <GraduationCap className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    { label: 'Semáforo Rojo', path: '/red-semaphore', icon: <AlertTriangle className="w-5 h-5" />, roles: ['ADMIN'] },
    { label: 'Notificaciones', path: '/notifications', icon: <Bell className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    { label: 'Mi QR', path: '/my-qr', icon: <QrCode className="w-5 h-5" />, roles: ['STUDENT'] },
    { label: 'Configuración', path: '/settings', icon: <Settings className="w-5 h-5" />, roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
  ];

  const filteredItems = navItems.filter((item) => hasRole(item.roles as any));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md lg:hidden"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={classNames(
          'fixed top-0 left-0 z-40 h-screen bg-primary-800 text-white transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-primary-700">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-accent" />
              <span className="font-bold text-lg">CBTIS 61</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg hover:bg-primary-700 transition-colors hidden lg:block"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={classNames(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-200 hover:bg-primary-700 hover:text-white',
                  isCollapsed && 'justify-center',
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info & Logout */}
        <div className="border-t border-primary-700 p-4">
          {!isCollapsed && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-primary-300 capitalize">{user.role.toLowerCase()}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={classNames(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-primary-200 hover:bg-primary-700 hover:text-white transition-colors w-full',
              isCollapsed && 'justify-center',
            )}
            title={isCollapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
