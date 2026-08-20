from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from database import (
    get_db, hash_password, verify_password, generate_user_id,
    generate_reset_token, is_valid_email, is_valid_phone
)

class UserCreate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

    @field_validator('password')
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if v and not is_valid_email(v):
            raise ValueError('Invalid email format')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v and not is_valid_phone(v):
            raise ValueError('Invalid phone format')
        return v

class UserLogin(BaseModel):
    identifier: str
    password: str

class PasswordResetRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

class PasswordReset(BaseModel):
    token: str
    new_password: str

class CategoryCreate(BaseModel):
    name: str
    type: str

    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        if v not in ('income', 'expense'):
            raise ValueError("Type must be 'income' or 'expense'")
        return v

class BudgetCreate(BaseModel):
    month: int
    year: int
    amount: float

    @field_validator('month')
    @classmethod
    def validate_month(cls, v):
        if v < 1 or v > 12:
            raise ValueError('Month must be between 1 and 12')
        return v

    @field_validator('year')
    @classmethod
    def validate_year(cls, v):
        if v < 2000 or v > 2100:
            raise ValueError('Invalid year')
        return v

class CategoryBudgetCreate(BaseModel):
    category_id: int
    month: int
    year: int
    amount: float

    @field_validator('month')
    @classmethod
    def validate_month(cls, v):
        if v < 1 or v > 12:
            raise ValueError('Month must be between 1 and 12')
        return v

class PaymentMethodBudgetCreate(BaseModel):
    payment_method: str
    month: int
    year: int
    amount: float

    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v):
        if v not in ('credit_card', 'debit_card', 'upi', 'cash'):
            raise ValueError("Payment method must be 'credit_card', 'debit_card', 'upi', or 'cash'")
        return v

    @field_validator('month')
    @classmethod
    def validate_month(cls, v):
        if v < 1 or v > 12:
            raise ValueError('Month must be between 1 and 12')
        return v

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category_id: int
    payment_method: Optional[str] = 'cash'
    description: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None

    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        if v not in ('income', 'expense'):
            raise ValueError("Type must be 'income' or 'expense'")
        return v

    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v

    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v):
        if v and v not in ('credit_card', 'debit_card', 'upi', 'cash'):
            raise ValueError("Payment method must be 'credit_card', 'debit_card', 'upi', or 'cash'")
        return v

class NotificationService:
    def create(self, user_id: str, notif_type: str, title: str, message: str):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)""",
                (user_id, notif_type, title, message)
            )
            conn.commit()
            return cursor.lastrowid

    def get_all(self, user_id: str, unread_only: bool = False) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM notifications WHERE user_id = ?"
            if unread_only:
                query += " AND is_read = 0"
            query += " ORDER BY created_at DESC LIMIT 50"
            cursor.execute(query, (user_id,))
            return [dict(row) for row in cursor.fetchall()]

    def mark_read(self, user_id: str, notification_id: int):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
                (notification_id, user_id)
            )
            conn.commit()

    def mark_all_read(self, user_id: str):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
                (user_id,)
            )
            conn.commit()

    def get_unread_count(self, user_id: str) -> int:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
                (user_id,)
            )
            return cursor.fetchone()['count']

class AuthService:
    def create_user(self, data: UserCreate) -> dict:
        if not data.email and not data.phone:
            raise ValueError('Email or phone required')
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT id FROM users WHERE email = ? OR phone = ?", 
                         (data.email, data.phone))
            if cursor.fetchone():
                raise ValueError('User already exists')
            
            user_id = generate_user_id()
            password_hash = hash_password(data.password)
            
            cursor.execute(
                """INSERT INTO users (user_id, email, phone, password_hash)
                   VALUES (?, ?, ?, ?)""",
                (user_id, data.email, data.phone, password_hash)
            )
            conn.commit()
            
            self._create_default_categories(user_id)
            
            return {
                "user_id": user_id,
                "email": data.email,
                "phone": data.phone
            }

    def _create_default_categories(self, user_id: str):
        with get_db() as conn:
            cursor = conn.cursor()
            default_income = ['Salary', 'Freelance', 'Investment', 'Bonus', 'Other']
            default_expense = ['Food', 'Transport', 'Rent', 'Utilities', 'Entertainment', 
                             'Shopping', 'Health', 'Education', 'Other']
            
            for name in default_income:
                cursor.execute("""INSERT OR IGNORE INTO categories (user_id, name, type)
                                VALUES (?, ?, 'income')""", (user_id, name))
            for name in default_expense:
                cursor.execute("""INSERT OR IGNORE INTO categories (user_id, name, type)
                                VALUES (?, ?, 'expense')""", (user_id, name))
            conn.commit()

    def authenticate(self, identifier: str, password: str) -> Optional[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            if '@' in identifier:
                cursor.execute("SELECT * FROM users WHERE email = ?", (identifier,))
            elif identifier.replace('-', '').isdigit() and len(identifier) >= 10:
                cursor.execute("SELECT * FROM users WHERE phone = ?", (identifier,))
            else:
                cursor.execute("SELECT * FROM users WHERE user_id = ?", (identifier,))
            
            user = cursor.fetchone()
            
            if user and verify_password(password, user['password_hash']):
                return dict(user)
            return None

    def request_password_reset(self, email: Optional[str], phone: Optional[str]) -> str:
        with get_db() as conn:
            cursor = conn.cursor()
            
            if email:
                cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            else:
                cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            
            user = cursor.fetchone()
            if not user:
                raise ValueError('User not found')
            
            reset_token = generate_reset_token()
            expires = datetime.now().timestamp() + 3600
            
            cursor.execute(
                "UPDATE users SET reset_token = ?, reset_token_exp = ? WHERE id = ?",
                (reset_token, expires, user['id'])
            )
            conn.commit()
            
            return reset_token

    def reset_password(self, token: str, new_password: str) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM users WHERE reset_token = ? AND reset_token_exp > ?",
                (token, datetime.now().timestamp())
            )
            user = cursor.fetchone()
            
            if not user:
                return False
            
            password_hash = hash_password(new_password)
            cursor.execute(
                "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_exp = NULL WHERE id = ?",
                (password_hash, user['id'])
            )
            conn.commit()
            return True

class CategoryService:
    def get_all(self, user_id: str) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM categories WHERE user_id = ? ORDER BY type, name",
                (user_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def create(self, user_id: str, data) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)""",
                (user_id, data.name, data.type)
            )
            conn.commit()
            return {
                "id": cursor.lastrowid,
                "user_id": user_id,
                "name": data.name,
                "type": data.type
            }

    def delete(self, user_id: str, category_id: int) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM categories WHERE id = ? AND user_id = ?",
                (category_id, user_id)
            )
            conn.commit()
            return cursor.rowcount > 0

class BudgetService:
    def get(self, user_id: str, month: int, year: int) -> Optional[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM budgets WHERE user_id = ? AND month = ? AND year = ?",
                (user_id, month, year)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def upsert(self, user_id: str, data) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO budgets (user_id, month, year, amount)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(user_id, month, year) DO UPDATE SET amount = ?""",
                (user_id, data.month, data.year, data.amount, data.amount)
            )
            conn.commit()
            return self.get(user_id, data.month, data.year)

    def get_category_budgets(self, user_id: str, month: int, year: int) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT cb.*, c.name as category_name, c.type as category_type
                   FROM category_budgets cb
                   JOIN categories c ON cb.category_id = c.id
                   WHERE cb.user_id = ? AND cb.month = ? AND cb.year = ?
                   ORDER BY c.name""",
                (user_id, month, year)
            )
            return [dict(row) for row in cursor.fetchall()]

    def set_category_budget(self, user_id: str, data: CategoryBudgetCreate) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO category_budgets (user_id, category_id, month, year, amount)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, category_id, month, year) 
                   DO UPDATE SET amount = ?""",
                (user_id, data.category_id, data.month, data.year, data.amount, data.amount)
            )
            conn.commit()
            
            cursor.execute(
                """SELECT cb.*, c.name as category_name FROM category_budgets cb
                   JOIN categories c ON cb.category_id = c.id
                   WHERE cb.user_id = ? AND cb.category_id = ? AND cb.month = ? AND cb.year = ?""",
                (user_id, data.category_id, data.month, data.year)
            )
            return dict(cursor.fetchone())

    def delete_category_budget(self, user_id: str, category_id: int, month: int, year: int) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM category_budgets WHERE user_id = ? AND category_id = ? AND month = ? AND year = ?",
                (user_id, category_id, month, year)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_spending_vs_budget(self, user_id: str, month: int, year: int) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """SELECT c.id, c.name, COALESCE(SUM(t.amount), 0) as spent
                   FROM categories c
                   LEFT JOIN transactions t ON c.id = t.category_id 
                      AND t.user_id = ? AND t.type = 'expense'
                      AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?
                   WHERE c.user_id = ? AND c.type = 'expense'
                   GROUP BY c.id""",
                (user_id, f"{month:02d}", str(year), user_id)
            )
            spending = {row['id']: row['spent'] for row in cursor.fetchall()}
            
            cursor.execute(
                """SELECT cb.*, c.name as category_name FROM category_budgets cb
                   JOIN categories c ON cb.category_id = c.id
                   WHERE cb.user_id = ? AND cb.month = ? AND cb.year = ?""",
                (user_id, month, year)
            )
            budgets = [dict(row) for row in cursor.fetchall()]
            
            total_budget = self.get(user_id, month, year)
            total_budget_amount = total_budget['amount'] if total_budget else 0
            
            result = []
            total_spent = sum(spending.values())
            
            for budget in budgets:
                category_id = budget['category_id']
                budget_amount = budget['amount']
                spent = spending.get(category_id, 0)
                
                result.append({
                    "category_id": category_id,
                    "category_name": budget['category_name'],
                    "budget": budget_amount,
                    "spent": spent,
                    "remaining": budget_amount - spent,
                    "percentage": (spent / budget_amount * 100) if budget_amount > 0 else 0,
                    "is_over_budget": spent > budget_amount
                })
            
            return {
                "total_budget": total_budget_amount,
                "total_spent": total_spent,
                "total_remaining": total_budget_amount - total_spent,
                "category_breakdown": result
            }

    def get_budget_recommendations(self, user_id: str, month: int, year: int) -> list[dict]:
        spending_data = self.get_spending_vs_budget(user_id, month, year)
        recommendations = []
        
        over_budget_categories = [
            c for c in spending_data['category_breakdown'] 
            if c['is_over_budget']
        ]
        
        total_budget = spending_data['total_budget']
        total_spent = spending_data['total_spent']
        
        if total_budget > 0 and total_spent > total_budget:
            excess = total_spent - total_budget
            
            for cat in over_budget_categories:
                cut_possible = min(cat['spent'] * 0.1, excess)
                if cut_possible > 0:
                    recommendations.append({
                        "category": cat['category_name'],
                        "current_spent": cat['spent'],
                        "recommended_cut": cut_possible,
                        "recommended_amount": cat['spent'] - cut_possible,
                        "reason": f"You've exceeded your {cat['category_name']} budget by ${cat['spent'] - cat['budget']:.2f}"
                    })
        elif total_spent > total_budget * 0.8:
            underutilized = [
                c for c in spending_data['category_breakdown']
                if c['remaining'] > c['budget'] * 0.5 and not c['is_over_budget']
            ]
            if underutilized:
                recommendations.append({
                    "category": underutilized[0]['category_name'],
                    "current_spent": underutilized[0]['spent'],
                    "suggestion": f"Consider reallocating some budget from {underutilized[0]['category_name']} to cover other needs"
                })
        
        return recommendations

    def get_payment_method_budgets(self, user_id: str, month: int, year: int) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT * FROM payment_method_budgets 
                   WHERE user_id = ? AND month = ? AND year = ?
                   ORDER BY payment_method""",
                (user_id, month, year)
            )
            return [dict(row) for row in cursor.fetchall()]

    def set_payment_method_budget(self, user_id: str, data: PaymentMethodBudgetCreate) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO payment_method_budgets (user_id, payment_method, month, year, amount)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, payment_method, month, year) 
                   DO UPDATE SET amount = ?""",
                (user_id, data.payment_method, data.month, data.year, data.amount, data.amount)
            )
            conn.commit()
            
            cursor.execute(
                """SELECT * FROM payment_method_budgets 
                   WHERE user_id = ? AND payment_method = ? AND month = ? AND year = ?""",
                (user_id, data.payment_method, data.month, data.year)
            )
            return dict(cursor.fetchone())

    def get_spending_vs_payment_method_budget(self, user_id: str, month: int, year: int) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                """SELECT payment_method, SUM(amount) as spent FROM transactions
                   WHERE user_id = ? AND type = 'expense'
                   AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
                   GROUP BY payment_method""",
                (user_id, f"{month:02d}", str(year))
            )
            spending = {row['payment_method']: row['spent'] for row in cursor.fetchall()}
            
            cursor.execute(
                """SELECT * FROM payment_method_budgets 
                   WHERE user_id = ? AND month = ? AND year = ?""",
                (user_id, month, year)
            )
            budgets = [dict(row) for row in cursor.fetchall()]
            
            payment_methods = ['credit_card', 'debit_card', 'upi', 'cash']
            result = []
            
            for pm in payment_methods:
                budget = next((b for b in budgets if b['payment_method'] == pm), None)
                budget_amount = budget['amount'] if budget else 0
                spent = spending.get(pm, 0)
                
                result.append({
                    "payment_method": pm,
                    "budget": budget_amount,
                    "spent": spent,
                    "remaining": budget_amount - spent,
                    "percentage": (spent / budget_amount * 100) if budget_amount > 0 else 0,
                    "is_over_budget": spent > budget_amount and budget_amount > 0
                })
            
            return {
                "payment_method_breakdown": result
            }

    def delete_payment_method_budget(self, user_id: str, payment_method: str, month: int, year: int) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM payment_method_budgets WHERE user_id = ? AND payment_method = ? AND month = ? AND year = ?",
                (user_id, payment_method, month, year)
            )
            conn.commit()
            return cursor.rowcount > 0

class TransactionService:
    MAX_RECYCLE_BIN_ITEMS = 30

    def __init__(self):
        self.notification_service = NotificationService()

    def _cleanup_recycle_bin(self, conn, user_id: str):
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id, deleted_at FROM transactions 
               WHERE user_id = ? AND deleted_at IS NOT NULL 
               ORDER BY deleted_at ASC""",
            (user_id,)
        )
        deleted = cursor.fetchall()
        
        if len(deleted) > self.MAX_RECYCLE_BIN_ITEMS:
            to_delete = len(deleted) - self.MAX_RECYCLE_BIN_ITEMS
            ids_to_remove = [row['id'] for row in deleted[:to_delete]]
            
            placeholders = ','.join('?' * len(ids_to_remove))
            cursor.execute(f"DELETE FROM transactions WHERE id IN ({placeholders})", ids_to_remove)

    def get_all(self, user_id: str, filters: dict = None) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            query = "SELECT t.*, c.name as category_name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.user_id = ? AND t.deleted_at IS NULL"
            params = [user_id]
            
            if filters:
                if filters.get('start_date'):
                    query += " AND t.date >= ?"
                    params.append(filters['start_date'])
                if filters.get('end_date'):
                    query += " AND t.date <= ?"
                    params.append(filters['end_date'])
                if filters.get('category_id'):
                    query += " AND t.category_id = ?"
                    params.append(filters['category_id'])
                if filters.get('type'):
                    query += " AND t.type = ?"
                    params.append(filters['type'])
                if filters.get('payment_method'):
                    query += " AND t.payment_method = ?"
                    params.append(filters['payment_method'])
                if filters.get('sort_by') == 'amount_asc':
                    query += " ORDER BY t.amount ASC"
                elif filters.get('sort_by') == 'amount_desc':
                    query += " ORDER BY t.amount DESC"
                else:
                    query += " ORDER BY t.date DESC, t.created_at DESC"
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_recycle_bin(self, user_id: str) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT t.*, c.name as category_name FROM transactions t 
                   JOIN categories c ON t.category_id = c.id 
                   WHERE t.user_id = ? AND t.deleted_at IS NOT NULL 
                   ORDER BY t.deleted_at DESC""",
                (user_id,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def restore(self, user_id: str, transaction_id: int) -> Optional[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL",
                (transaction_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                return None
            
            cursor.execute(
                "UPDATE transactions SET deleted_at = NULL WHERE id = ?",
                (transaction_id,)
            )
            conn.commit()
            
            cursor.execute(
                "SELECT t.*, c.name as category_name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.id = ?",
                (transaction_id,)
            )
            return dict(cursor.fetchone())

    def delete(self, user_id: str, transaction_id: int) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            deleted_at = datetime.now().isoformat()
            cursor.execute(
                "UPDATE transactions SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (deleted_at, transaction_id, user_id)
            )
            conn.commit()
            
            if cursor.rowcount > 0:
                self._cleanup_recycle_bin(conn, user_id)
                return True
            return False

    def permanent_delete(self, user_id: str, transaction_id: int) -> bool:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL",
                (transaction_id, user_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def empty_recycle_bin(self, user_id: str) -> int:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM transactions WHERE user_id = ? AND deleted_at IS NOT NULL",
                (user_id,)
            )
            conn.commit()
            return cursor.rowcount

    def create(self, user_id: str, data, budget_service = None) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            date = data.date or datetime.now().strftime('%Y-%m-%d')
            created_at = datetime.now().isoformat()
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, category_id, payment_method, description, notes, date, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (user_id, data.type, data.amount, data.category_id, data.payment_method or 'cash', data.description, data.notes, date, created_at)
            )
            conn.commit()
            
            cursor.execute(
                "SELECT t.*, c.name as category_name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.id = ?",
                (cursor.lastrowid,)
            )
            transaction = dict(cursor.fetchone())
            
            if data.type == 'expense' and budget_service:
                month = int(date.split('-')[1])
                year = int(date.split('-')[0])
                budget_data = budget_service.get_spending_vs_budget(user_id, month, year)
                
                for cat in budget_data.get('category_breakdown', []):
                    if cat['category_id'] == data.category_id:
                        if cat['percentage'] > 90:
                            self.notification_service.create(
                                user_id, 'warning', 'Budget Warning',
                                f"You've used {cat['percentage']:.0f}% of your {cat['category_name']} budget"
                            )
                        elif cat['is_over_budget']:
                            self.notification_service.create(
                                user_id, 'danger', 'Budget Exceeded',
                                f"You've exceeded your {cat['category_name']} budget by ${abs(cat['remaining']):.2f}"
                            )
                        break
                
                overall = budget_service.get(user_id, month, year)
                if overall:
                    total_spent = budget_data['total_spent']
                    if total_spent > overall['amount']:
                        self.notification_service.create(
                            user_id, 'danger', 'Overall Budget Exceeded',
                            f"You've exceeded your monthly budget by ${total_spent - overall['amount']:.2f}"
                        )
            
            return transaction

    def update(self, user_id: str, transaction_id: int, data: TransactionCreate) -> Optional[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """UPDATE transactions SET type = ?, amount = ?, category_id = ?, payment_method = ?,
                   description = ?, notes = ?, date = ? WHERE id = ? AND user_id = ?""",
                (data.type, data.amount, data.category_id, data.payment_method or 'cash',
                 data.description, data.notes, data.date or datetime.now().strftime('%Y-%m-%d'),
                 transaction_id, user_id)
            )
            conn.commit()
            
            cursor.execute(
                "SELECT t.*, c.name as category_name FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.id = ?",
                (transaction_id,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_summary(self, user_id: str, start_date: str = None, end_date: str = None) -> dict:
        with get_db() as conn:
            cursor = conn.cursor()
            
            query = "SELECT type, SUM(amount) as total FROM transactions WHERE user_id = ? AND deleted_at IS NULL"
            params = [user_id]
            
            if start_date:
                query += " AND date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND date <= ?"
                params.append(end_date)
            
            query += " GROUP BY type"
            cursor.execute(query, params)
            
            totals = {row['type']: row['total'] for row in cursor.fetchall()}
            
            return {
                "total_income": totals.get("income", 0),
                "total_expense": totals.get("expense", 0),
                "balance": totals.get("income", 0) - totals.get("expense", 0)
            }

    def get_expenses_by_category(self, user_id: str, start_date: str = None, end_date: str = None) -> list[dict]:
        with get_db() as conn:
            cursor = conn.cursor()
            
            query = """SELECT c.name, c.id, SUM(t.amount) as total 
                      FROM transactions t 
                      JOIN categories c ON t.category_id = c.id 
                      WHERE t.user_id = ? AND t.type = 'expense'"""
            params = [user_id]
            
            if start_date:
                query += " AND t.date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND t.date <= ?"
                params.append(end_date)
            
            query += " GROUP BY c.id ORDER BY total DESC"
            cursor.execute(query, params)
            
            return [dict(row) for row in cursor.fetchall()]