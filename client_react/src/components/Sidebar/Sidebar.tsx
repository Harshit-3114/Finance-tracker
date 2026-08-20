import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Receipt, Calendar, Wallet, FolderOpen, Trash2, 
  Info, FileText, Bell, LogOut, X, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/budget', label: 'Budget', icon: Wallet },
  { path: '/categories', label: 'Categories', icon: FolderOpen },
  { path: '/recycle-bin', label: 'Recycle Bin', icon: Trash2 },
];

const externalLinks = [
  { path: '/about', label: 'About', icon: Info },
  { path: '/terms', label: 'Terms & Conditions', icon: FileText },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-0 h-full w-[280px] bg-brand-section border-r border-white/5 z-50 flex flex-col lg:relative lg:translate-x-0"
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-brand-accent to-purple-400 bg-clip-text text-transparent">
            FinanceTracker
          </h1>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" role="navigation">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' 
                    : 'text-brand-text-secondary hover:bg-white/5 hover:text-brand-text-primary border border-transparent'}
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-accent' : ''}`} />
                <span className="font-medium">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-accent"
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  />
                )}
              </Link>
            );
          })}

          <div className="my-4 border-t border-white/5" />

          {externalLinks.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-text-secondary hover:bg-white/5 hover:text-brand-text-primary transition-all duration-200 border border-transparent"
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-3">
          {/* Notifications */}
          <button
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-brand-text-secondary hover:bg-white/5 hover:text-brand-text-primary transition-all duration-200"
            aria-label="View notifications"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-danger rounded-full text-[10px] font-bold flex items-center justify-center">
                0
              </span>
            </div>
            <span className="font-medium">Notifications</span>
          </button>

          {/* User Info */}
          {user && (
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
              <p className="text-sm font-mono text-brand-text-muted">Signed in as</p>
              <p className="font-medium truncate">{user.user_id}</p>
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 p-4 bg-brand-accent rounded-full shadow-lg shadow-brand-accent/30 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
    </>
  );
}