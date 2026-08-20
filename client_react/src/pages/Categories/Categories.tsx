import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, FolderOpen, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'expense' as 'income' | 'expense' });

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (error) {
      console.error('Categories load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { name: formData.name, type: formData.type };
      
      if (editingCat) {
        await api.put(`/categories/${editingCat.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }

      setShowModal(false);
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Category save error:', error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  function openEdit(cat: Category) {
    setEditingCat(cat);
    setFormData({ name: cat.name, type: cat.type });
    setShowModal(true);
  }

  function resetForm() {
    setEditingCat(null);
    setFormData({ name: '', type: 'expense' });
  }

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-brand-text-muted mt-1">Manage your income and expense categories</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-5 h-5 mr-2" />
          Add Category
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Categories */}
        <motion.div variants={item}>
          <Card className="h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Income Categories</h2>
                <p className="text-sm text-brand-text-muted">{incomeCategories.length} categories</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <LoadingSkeleton key={i} height={48} />)}</div>
            ) : incomeCategories.length > 0 ? (
              <div className="space-y-2">
                {incomeCategories.map((cat) => (
                  <div key={cat.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label={`Edit ${cat.name}`}>
                        <Pencil className="w-4 h-4 text-brand-text-muted" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" aria-label={`Delete ${cat.name}`}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-brand-text-muted text-sm">No income categories</p>
            )}
          </Card>
        </motion.div>

        {/* Expense Categories */}
        <motion.div variants={item}>
          <Card className="h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Expense Categories</h2>
                <p className="text-sm text-brand-text-muted">{expenseCategories.length} categories</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <LoadingSkeleton key={i} height={48} />)}</div>
            ) : expenseCategories.length > 0 ? (
              <div className="space-y-2">
                {expenseCategories.map((cat) => (
                  <div key={cat.id} className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label={`Edit ${cat.name}`}>
                        <Pencil className="w-4 h-4 text-brand-text-muted" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-500/10" aria-label={`Delete ${cat.name}`}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-brand-text-muted text-sm">No expense categories</p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Add Category'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                placeholder="Category name"
                required
              />
            </div>

            <div className="form-group">
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
                className="w-full bg-brand-card border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                required
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {editingCat ? 'Update' : 'Add'} Category
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </motion.div>
  );
}