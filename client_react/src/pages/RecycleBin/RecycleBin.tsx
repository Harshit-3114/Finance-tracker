import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatCurrency, formatDate } from '../../utils/format';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_name: string;
  description: string | null;
  deleted_at: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function RecycleBin() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRecycleBin(); }, []);

  async function loadRecycleBin() {
    setLoading(true);
    try {
      const res = await api.get('/recycle-bin');
      setTransactions(res.data);
    } catch (error) {
      console.error('Recycle bin load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function restoreTransaction(id: number) {
    try {
      await api.post(`/recycle-bin/${id}/restore`);
      loadRecycleBin();
    } catch (error) {
      console.error('Restore error:', error);
    }
  }

  async function permanentDelete(id: number) {
    if (!confirm('Permanently delete this transaction? This cannot be undone.')) return;
    try {
      await api.delete(`/recycle-bin/${id}`);
      loadRecycleBin();
    } catch (error) {
      console.error('Delete error:', error);
    }
  }

  async function emptyBin() {
    if (!confirm('Empty recycle bin? All items will be permanently deleted.')) return;
    try {
      await api.delete('/recycle-bin');
      loadRecycleBin();
    } catch (error) {
      console.error('Empty bin error:', error);
    }
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recycle Bin</h1>
          <p className="text-brand-text-muted mt-1">
            {transactions.length} / 30 items
          </p>
        </div>
        {transactions.length > 0 && (
          <Button variant="danger" onClick={emptyBin}>
            <Trash2 className="w-5 h-5 mr-2" />
            Empty Recycle Bin
          </Button>
        )}
      </motion.div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array(3).fill(0).map((_, i) => <LoadingSkeleton key={i} height={72} />)}
          </div>
        ) : transactions.length > 0 ? (
          <div className="divide-y divide-white/5">
            {transactions.map((tx, idx) => (
              <motion.div
                key={tx.id}
                variants={item}
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
                  <p className="text-xs text-brand-text-muted">
                    Deleted: {formatDate(tx.deleted_at)}
                  </p>
                </div>

                <p className={`font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(tx.amount)}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => restoreTransaction(tx.id)}
                    className="p-2 rounded-lg hover:bg-green-500/10 transition-colors"
                    title="Restore"
                  >
                    <RotateCcw className="w-4 h-4 text-green-400" />
                  </button>
                  <button
                    onClick={() => permanentDelete(tx.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-card mb-4">
              <Trash2 className="w-8 h-8 text-brand-text-muted" />
            </div>
            <p className="text-brand-text-muted">Recycle bin is empty</p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}