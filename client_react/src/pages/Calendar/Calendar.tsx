import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import Card from '../../components/ui/Card';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatCurrency, formatDate } from '../../utils/format';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category_name: string;
  description: string | null;
  date: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});
  const [dayTransactions, setDayTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    loadCalendarData();
  }, [year, month]);

  async function loadCalendarData() {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      
      const res = await api.get('/transactions', { params: { start_date: startDate, end_date: endDate } });
      
      const totals: Record<string, number> = {};
      res.data.forEach((tx: Transaction) => {
        if (tx.type === 'expense') {
          totals[tx.date] = (totals[tx.date] || 0) + tx.amount;
        }
      });
      setDailyTotals(totals);
    } catch (error) {
      console.error('Calendar load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectDate(date: string) {
    setSelectedDate(date);
    try {
      const res = await api.get('/transactions', { params: { start_date: date, end_date: date } });
      setDayTransactions(res.data);
    } catch (error) {
      console.error('Day load error:', error);
    }
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 2, 1));
    setSelectedDate(null);
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month, 1));
    setSelectedDate(null);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const today = new Date().toISOString().split('T')[0];

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-6xl mx-auto space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-brand-text-muted mt-1">View transactions by date</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-semibold min-w-[160px] text-center">
            {months[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-4 sm:p-6">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-brand-text-muted py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {loading ? (
                Array(35).fill(0).map((_, i) => (
                  <LoadingSkeleton key={i} height={48} />
                ))
              ) : (
                <>
                  {/* Empty cells for days before the 1st */}
                  {Array(firstDay).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {/* Days of the month */}
                  {Array(daysInMonth).fill(0).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = dateStr === today;
                    const hasTx = dailyTotals[dateStr];
                    const isSelected = dateStr === selectedDate;

                    return (
                      <motion.button
                        key={day}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => selectDate(dateStr)}
                        className={`
                          aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
                          transition-all duration-200 relative
                          ${isSelected ? 'bg-brand-accent text-white' : 'hover:bg-white/5'}
                          ${isToday && !isSelected ? 'ring-2 ring-brand-accent ring-offset-2 ring-offset-brand-dark' : ''}
                        `}
                        aria-label={`${dateStr}${hasTx ? `, $${dailyTotals[dateStr].toFixed(2)} spent` : ''}`}
                      >
                        <span className="text-sm font-medium">{day}</span>
                        {hasTx && (
                          <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-brand-accent'}`}>
                            ${dailyTotals[dateStr].toFixed(0)}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                <div className="w-2 h-2 rounded-full bg-brand-accent" />
                <span>Has expenses</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                <div className="w-5 h-5 rounded border-2 border-brand-accent" />
                <span>Today</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Day Transactions */}
        <motion.div variants={item}>
          <Card className="h-full">
            <h2 className="text-lg font-semibold mb-4">
              {selectedDate ? `Transactions on ${formatDate(selectedDate)}` : 'Select a date'}
            </h2>

            {!selectedDate ? (
              <p className="text-brand-text-muted text-sm">Click on a date to see transactions</p>
            ) : dayTransactions.length > 0 ? (
              <div className="space-y-2">
                {dayTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                    <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {tx.type === 'income' ? (
                        <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{tx.category_name}</p>
                      <p className="text-xs text-brand-text-muted truncate">{tx.description || '—'}</p>
                    </div>
                    <p className={`font-semibold text-sm ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-brand-text-muted text-sm">No transactions on this day</p>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}