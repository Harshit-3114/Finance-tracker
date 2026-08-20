import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
}

export default function Button({ 
  variant = 'primary', 
  children, 
  className = '', 
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-brand-accent text-white hover:bg-brand-accent-hover hover:shadow-lg hover:shadow-brand-accent/25 active:scale-[0.97] focus-visible:ring-brand-accent',
    secondary: 'bg-brand-card text-brand-text-secondary border border-white/10 hover:bg-brand-card-hover hover:border-white/20 hover:text-brand-text-primary active:scale-[0.97] focus-visible:ring-brand-accent',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.97] focus-visible:ring-red-500',
    ghost: 'text-brand-text-muted hover:text-brand-text-primary hover:bg-white/5 active:scale-[0.97]',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}