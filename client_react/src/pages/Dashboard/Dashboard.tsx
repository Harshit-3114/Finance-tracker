import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { TrendingUp, TrendingDown, DollarSign, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatCurrency, formatDate } from '../../utils/format';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
}

interface ExpenseByCategory {
  name: string;
  total: number;
  category_id: number;
}

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_name: string;
  description: string | null;
  payment_method: string;
  date: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseByCategory[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  async function loadDashboard() {
    if (!token) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period);
      const params = startDate ? `?start_date=${startDate}&end_date=${endDate}` : '';
      
      const [summaryRes, expensesRes, txRes] = await Promise.all([
        api.get(`/summary${params}`),
        api.get(`/expenses-by-category${params}`),
        api.get('/transactions?sort_by=date_desc')
      ]);

      setSummary(summaryRes.data);
      setExpenses(expensesRes.data);
      setRecentTransactions(txRes.data.slice(0, 5));
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }

  const chartData = {
    labels: expenses.map(e => e.name),
    datasets: [{
      data: expenses.map(e => e.total),
      backgroundColor: [
        '#f97316', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899',
        '#f43f5e', '#22c55e', '#eab308', '#6366f1', '#14b8a6'
      ],
      borderWidth: 0,
      hoverOffset: 12,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f9fafb',
        bodyColor: '#9ca3af',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => ` $${ctx.raw.toFixed(2)}`
        }
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 800,
      easing: 'easeOutQuart' as const
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-brand-text-muted mt-1">Your financial overview</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
          aria-label="Select time period"
        >
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
          <option value="year">This Year</option>
        </select>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-text-muted text-sm font-medium">Total Income</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {loading ? <LoadingSkeleton width={100} height={32} /> : formatCurrency(summary?.total_income || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-text-muted text-sm font-medium">Total Expenses</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                {loading ? <LoadingSkeleton width={100} height={32} /> : formatCurrency(summary?.total_expense || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-brand-text-muted text-sm font-medium">Balance</p>
              <p className={`text-2xl font-bold mt-1 ${(summary?.balance || 0) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {loading ? <LoadingSkeleton width={100} height={32} /> : formatCurrency(summary?.balance || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Chart and Legend */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Expenses Overview</h2>
            <span className="text-sm text-brand-text-muted">
              Total: {formatCurrency(totalExpenses)}
            </span>
          </div>
          <div className="relative h-[300px]">
            {loading ? (
              <LoadingSkeleton height={300} />
            ) : expenses.length > 0 ? (
              <>
                <Doughnut data={chartData} options={chartOptions} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xs text-brand-text-muted">Total Spent</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-brand-text-muted">
                No expense data available
              </div>
            )}
          </div>
        </Card>

        {/* Legend */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">By Category</h2>
          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <LoadingSkeleton key={i} height={24} />
              ))
            ) : expenses.length > 0 ? (
              expenses.map((exp, idx) => {
                const percent = ((exp.total / totalExpenses) * 100).toFixed(1);
                return (
                  <div key={exp.category_id} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: chartData.datasets[0].backgroundColor[idx] }}
                    />
                    <span className="flex-1 text-sm truncate">{exp.name}</span>
                    <span className="text-sm text-brand-text-muted">{percent}%</span>
                  </div>
                );
              })
            ) : (
              <p className="text-brand-text-muted text-sm">No categories</p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div variants={item}>
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link 
              to="/transactions" 
              className="flex items-center gap-1 text-sm text-brand-accent hover:text-brand-accent-hover transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => <LoadingSkeleton key={i} height={56} />)}
            </div>
          ) : recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className={`p-2.5 rounded-xl ${tx.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {tx.type === 'income' ? (
                      <TrendingUp className={`w-5 h-5 text-green-400`} />
                    ) : (
                      <TrendingDown className={`w-5 h-5 text-red-400`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{tx.category_name}</p>
                    <p className="text-sm text-brand-text-muted truncate">
                      {tx.description || 'No description'} • {formatDate(tx.date)}
                    </p>
                  </div>
                  <p className={`font-semibold ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-brand-text-muted">
              No transactions yet
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function getDateRange(period: string) {
  const now = new Date();
  let startDate: string | null = null;
  let endDate: string | null = null;
  
  switch (period) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      break;
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      break;
  }
  
  return { startDate, endDate };
}