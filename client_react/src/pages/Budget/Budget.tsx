import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, PieChart, Lightbulb, CreditCard, Smartphone, Banknote, Credit } from 'lucide-react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatCurrency } from '../../utils/format';

interface CategoryBudget {
  category_id: number;
  category_name: string;
  budget: number;
  spent: number;
  percentage: number;
  is_over_budget: boolean;
}

interface PaymentMethodBudget {
  payment_method: string;
  budget: number;
  spent: number;
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  credit_card: <CreditCard className="w-5 h-5" />,
  debit_card: <Credit className="w-5 h-5" />,
  upi: <Smartphone className="w-5 h-5" />,
  cash: <Banknote className="w-5 h-5" />,
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Budget() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [pmBudgets, setPmBudgets] = useState<PaymentMethodBudget[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBudget(); }, [month, year]);

  async function loadBudget() {
    setLoading(true);
    try {
      const [budgetRes, catRes, pmRes, recRes] = await Promise.all([
        api.get('/budget', { params: { month, year } }),
        api.get('/budget/category', { params: { month, year } }),
        api.get('/budget/payment-method', { params: { month, year } }),
        api.get('/budget/recommendations', { params: { month, year } }),
      ]);

      setMonthlyBudget(budgetRes.data.amount?.toString() || '');
      setCategoryBudgets(catRes.data);
      setPmBudgets(pmRes.data);
      setRecommendations(recRes.data || []);
    } catch (error) {
      console.error('Budget load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveMonthlyBudget() {
    try {
      await api.post('/budget', {
        month, year, amount: parseFloat(monthlyBudget) || 0
      });
      loadBudget();
    } catch (error) {
      console.error('Save budget error:', error);
    }
  }

  async function saveCategoryBudget(catId: number, amount: string) {
    try {
      await api.post('/budget/category', {
        category_id: catId, month, year, amount: parseFloat(amount) || 0
      });
    } catch (error) {
      console.error('Save category budget error:', error);
    }
  }

  async function savePmBudget(paymentMethod: string, amount: string) {
    try {
      await api.post('/budget/payment-method', {
        payment_method: paymentMethod, month, year, amount: parseFloat(amount) || 0
      });
    } catch (error) {
      console.error('Save PM budget error:', error);
    }
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYr = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYr - 2 + i);

  const totalBudget = parseFloat(monthlyBudget) || 0;
  const totalSpent = categoryBudgets.reduce((sum, c) => sum + c.spent, 0);
  const budgetProgress = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const isOverBudget = totalSpent > totalBudget && totalBudget > 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-6"
    >
      <motion.div variants={item}>
        <h1 className="text-3xl font-bold">Budget Settings</h1>
        <p className="text-brand-text-muted mt-1">Manage your monthly budget and spending limits</p>
      </motion.div>

      {/* Month/Year Selector */}
      <motion.div variants={item} className="flex items-center gap-4">
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          aria-label="Select month"
        >
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          aria-label="Select year"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </motion.div>

      {/* Monthly Budget */}
      <motion.div variants={item}>
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-brand-accent/10 rounded-xl">
              <Wallet className="w-6 h-6 text-brand-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Monthly Budget</h2>
              <p className="text-sm text-brand-text-muted">Set your total spending limit</p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              placeholder="Enter monthly budget"
              className="flex-1 bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <Button onClick={saveMonthlyBudget}>Save</Button>
          </div>

          {totalBudget > 0 && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-text-muted">Spent: {formatCurrency(totalSpent)}</span>
                <span className={isOverBudget ? 'text-red-400' : 'text-brand-text-primary'}>
                  {formatCurrency(totalBudget - totalSpent)} remaining
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-gradient-to-r from-brand-accent to-purple-500'}`}
                />
              </div>
              <p className="text-xs text-brand-text-muted mt-2 text-right">{budgetProgress.toFixed(1)}% used</p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Budgets */}
        <motion.div variants={item}>
          <Card className="h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <PieChart className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold">Category Budgets</h2>
            </div>

            {loading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <LoadingSkeleton key={i} height={48} />)}</div>
            ) : categoryBudgets.length > 0 ? (
              <div className="space-y-4">
                {categoryBudgets.map((cat) => (
                  <div key={cat.category_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{cat.category_name}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={cat.budget?.toString() || ''}
                        placeholder="Budget"
                        onBlur={(e) => saveCategoryBudget(cat.category_id, e.target.value)}
                        className="w-32 bg-brand-card border border-white/10 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-accent"
                      />
                    </div>
                    {cat.budget > 0 && (
                      <>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              cat.is_over_budget ? 'bg-red-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-brand-text-muted">
                          {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                          {cat.is_over_budget && <span className="text-red-400 ml-2">Over by {formatCurrency(cat.spent - cat.budget)}</span>}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-brand-text-muted text-sm">No category budgets set</p>
            )}
          </Card>
        </motion.div>

        {/* Payment Method Budgets */}
        <motion.div variants={item}>
          <Card className="h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CreditCard className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold">Payment Method Budgets</h2>
            </div>
            <p className="text-sm text-brand-text-muted mb-4">Set budgets for each payment method</p>

            {loading ? (
              <div className="space-y-3">{Array(4).fill(0).map((_, i) => <LoadingSkeleton key={i} height={48} />)}</div>
            ) : (
              <div className="space-y-4">
                {['credit_card', 'debit_card', 'upi', 'cash'].map((pm) => {
                  const budget = pmBudgets.find(b => b.payment_method === pm);
                  const label = { credit_card: 'Credit Card', debit_card: 'Debit Card', upi: 'UPI', cash: 'Cash' }[pm];

                  return (
                    <div key={pm} className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg text-brand-text-muted">
                        {paymentMethodIcons[pm]}
                      </div>
                      <span className="flex-1 font-medium text-sm">{label}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={budget?.budget?.toString() || ''}
                        placeholder="Budget"
                        onBlur={(e) => savePmBudget(pm, e.target.value)}
                        className="w-32 bg-brand-card border border-white/10 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-accent"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Recommendations */}
      <motion.div variants={item}>
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold">Budget Recommendations</h2>
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/20 transition-colors"
                >
                  <h3 className="font-medium text-yellow-400 mb-1">{rec.category}</h3>
                  {rec.reason && <p className="text-sm text-brand-text-secondary mb-1">{rec.reason}</p>}
                  {rec.suggestion && <p className="text-sm text-brand-text-muted">{rec.suggestion}</p>}
                  {rec.recommended_cut > 0 && (
                    <p className="text-sm text-red-400 mt-2">
                      Consider cutting <strong>{formatCurrency(rec.recommended_cut)}</strong> to stay within budget
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-brand-text-muted text-sm">No recommendations at this time</p>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}