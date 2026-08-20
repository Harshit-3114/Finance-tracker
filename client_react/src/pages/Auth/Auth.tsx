import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

type AuthTab = 'login' | 'signup' | 'forgot' | 'reset';

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', phone: '', password: '' });
  const [forgotData, setForgotData] = useState({ identifier: '' });
  const [resetData, setResetData] = useState({ password: '' });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        identifier: loginData.identifier,
        password: loginData.password,
      });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', {
        email: signupData.email || null,
        phone: signupData.phone || null,
        password: signupData.password,
      });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const identifier = forgotData.identifier;
      const isEmail = identifier.includes('@');
      const res = await api.post('/auth/forgot-password', 
        isEmail ? { email: identifier } : { phone: identifier }
      );
      setResetToken(res.data.token);
      setActiveTab('reset');
      alert(`Reset token: ${res.data.token}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token: resetToken,
        new_password: resetData.password,
      });
      setActiveTab('login');
      alert('Password reset successful!');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: AuthTab; label: string }[] = [
    { key: 'login', label: 'Sign In' },
    { key: 'signup', label: 'Sign Up' },
    { key: 'forgot', label: 'Forgot Password' },
  ];

  const InputIcon = ({ icon: Icon }: { icon: typeof Mail }) => (
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <Icon className="w-5 h-5 text-brand-text-muted" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-dark">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-accent to-purple-400 bg-clip-text text-transparent">
            FinanceTracker
          </h1>
          <p className="text-brand-text-muted mt-2">Manage your finances with ease</p>
        </div>

        <Card>
          {/* Tabs */}
          <div className="flex border-b border-white/5 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key ? 'text-brand-accent' : 'text-brand-text-muted hover:text-brand-text-primary'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent"
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Login Form */}
            {activeTab === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="relative">
                  <InputIcon icon={User} />
                  <input
                    type="text"
                    value={loginData.identifier}
                    onChange={e => setLoginData(d => ({ ...d, identifier: e.target.value }))}
                    placeholder="Email, Phone, or User ID"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  />
                </div>
                <div className="relative">
                  <InputIcon icon={Lock} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={e => setLoginData(d => ({ ...d, password: e.target.value }))}
                    placeholder="Password"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-brand-text-muted" /> : <Eye className="w-5 h-5 text-brand-text-muted" />}
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </motion.form>
            )}

            {/* Signup Form */}
            {activeTab === 'signup' && (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                <div className="relative">
                  <InputIcon icon={Mail} />
                  <input
                    type="email"
                    value={signupData.email}
                    onChange={e => setSignupData(d => ({ ...d, email: e.target.value }))}
                    placeholder="Email (optional)"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
                <div className="relative">
                  <InputIcon icon={Phone} />
                  <input
                    type="tel"
                    value={signupData.phone}
                    onChange={e => setSignupData(d => ({ ...d, phone: e.target.value }))}
                    placeholder="Phone (optional)"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
                <div className="relative">
                  <InputIcon icon={Lock} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signupData.password}
                    onChange={e => setSignupData(d => ({ ...d, password: e.target.value }))}
                    placeholder="Password (min 6 characters)"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-brand-text-muted" /> : <Eye className="w-5 h-5 text-brand-text-muted" />}
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </motion.form>
            )}

            {/* Forgot Password Form */}
            {activeTab === 'forgot' && (
              <motion.form
                key="forgot"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleForgot}
                className="space-y-4"
              >
                <p className="text-sm text-brand-text-muted mb-4">
                  Enter your email or phone to receive a reset token.
                </p>
                <div className="relative">
                  <InputIcon icon={User} />
                  <input
                    type="text"
                    value={forgotData.identifier}
                    onChange={e => setForgotData({ identifier: e.target.value })}
                    placeholder="Email or Phone"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Request Reset'}
                </Button>
              </motion.form>
            )}

            {/* Reset Password Form */}
            {activeTab === 'reset' && (
              <motion.form
                key="reset"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleReset}
                className="space-y-4"
              >
                <div className="relative">
                  <InputIcon icon={Lock} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={resetData.password}
                    onChange={e => setResetData({ password: e.target.value })}
                    placeholder="New Password"
                    className="w-full bg-brand-card border border-white/10 rounded-xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-brand-text-muted" /> : <Eye className="w-5 h-5 text-brand-text-muted" />}
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}