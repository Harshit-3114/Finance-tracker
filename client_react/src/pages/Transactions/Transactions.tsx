import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Pencil, Trash2, ChevronDown, X } from 'lucide-react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatCurrency, formatDate } from '../../utils/format';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number;
  category_name: string;
  payment_method: string;
  date: string;
  description: string | null;
  notes: string | null;
}

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
}

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi', label: 'UPI' },
];

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState({
    period: 'month',
    categoryId: '',
    type: '',
    sort: 'date_desc',
    paymentMethod: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category_id: '',
    payment_method: 'cash',
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    setLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        api.get('/transactions', { params: buildQueryParams() }),
        api.get('/categories'),
      ]);
      setTransactions(txRes.data);
      setCategories(catRes.data);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildQueryParams() {
    const params: Record<string, string> = { sort_by: filters.sort };
    
    if (filters.period === 'custom') {
      // Handle custom dates if needed
    } else {
      const { startDate, endDate } = getDateRange(filters.period);
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    }
    
    if (filters.categoryId) params.category_id = filters.categoryId;
    if (filters.type) params.type = filters.type;
    if (filters.paymentMethod) params.payment_method = filters.paymentMethod;
    
    return params;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        category_id: parseInt(formData.category_id),
        payment_method: formData.payment_method,
        date: formData.date,
        description: formData.description || null,
        notes: formData.notes || null,
      };

      if (editingTx) {
        await api.put(`/transactions/${editingTx.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Submit error:', error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Move this transaction to recycle bin?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  function openEdit(tx: Transaction) {
    setEditingTx(tx);
    setFormData({
      type: tx.type,
      amount: tx.amount.toString(),
      category_id: tx.category_id.toString(),
      payment_method: tx.payment_method,
      date: tx.date.split('T')[0],
      description: tx.description || '',
      notes: tx.notes || '',
    });
    setShowModal(true);
  }

  function resetForm() {
    setEditingTx(null);
    setFormData({
      type: 'expense',
      amount: '',
      category_id: '',
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    });
  }

  const filteredCategories = categories.filter(c => c.type === formData.type);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-brand-text-muted mt-1">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-5 h-5 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <Card className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={filters.period}
            onChange={(e) => setFilters(f => ({ ...f, period: e.target.value }))}
            className="flex-1 min-w-[150px] bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            aria-label="Time period"
          >
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
            className="flex-1 min-w-[120px] bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            aria-label="Transaction type"
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            value={filters.sort}
            onChange={(e) => setFilters(f => ({ ...f, sort: e.target.value }))}
            className="flex-1 min-w-[150px] bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            aria-label="Sort by"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount: High to Low</option>
            <option value="amount_asc">Amount: Low to High</option>
          </select>

          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <select
                  value={filters.categoryId}
                  onChange={(e) => setFilters(f => ({ ...f, categoryId: e.target.value }))}
                  className="flex-1 bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  aria-label="Category filter"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="flex-1 bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  aria-label="Payment method filter"
                >
                  <option value="">All Methods</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>

                <Button variant="ghost" onClick={() => setFilters({
                  period: 'month', categoryId: '', type: '', sort: 'date_desc', paymentMethod: ''
                })}>
                  Clear
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Transactions List */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array(5).fill(0).map((_, i) => <LoadingSkeleton key={i} height={64} />)}
          </div>
        ) : transactions.length > 0 ? (
          <div className="divide-y divide-white/5">
            {transactions.map((tx, idx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                <div className={`p-2.5 rounded-xl ${tx.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {tx.type === 'income' ? (
                    <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.category_name}</p>
                  <p className="text-sm text-brand-text-muted truncate">
                    {tx.description || 'No description'}
                  </p>
                </div>

                <div className="hidden sm:block text-right">
                  <p className="text-sm text-brand-text-muted">
                    {paymentMethods.find(p => p.value === tx.payment_method)?.label}
                  </p>
                  <p className="text-xs text-brand-text-muted">{formatDate(tx.date)}</p>
                </div>

                <p className={`font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(tx)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    aria-label={`Edit ${tx.category_name} transaction`}
                  >
                    <Pencil className="w-4 h-4 text-brand-text-muted" />
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    aria-label={`Delete ${tx.category_name} transaction`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-brand-text-muted">
            No transactions found
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal onClose={() => setShowModal(false)} title={editingTx ? 'Edit Transaction' : 'Add Transaction'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(f => ({ ...f, type: e.target.value, category_id: '' }))}
                    className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                    className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  >
                    <option value="">Select category</option>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium mb-2">Payment Method</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    required
                  >
                    {paymentMethods.map(pm => (
                      <option key={pm.value} value={pm.value}>{pm.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  required
                />
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  placeholder="Optional description"
                />
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingTx ? 'Update' : 'Add'} Transaction
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
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
    case '6months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      break;
    default:
      break;
  }
  
  return { startDate, endDate };
}