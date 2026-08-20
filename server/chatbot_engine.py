import os
import re
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

DATABASE_PATH = Path(__file__).parent / "finance.db"

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = """
You are an expert Data Analyst and SQL Developer for a personal finance tracker application.

Your job:
1. Generate a valid SQLite SQL query based on the user's natural language question.
2. Always include WHERE user_id = ? for multi-user data isolation.
3. Never query data from other users.

DATABASE SCHEMA:
Table: users
- id (INTEGER PRIMARY KEY)
- user_id (TEXT UNIQUE)
- email (TEXT UNIQUE)
- phone (TEXT UNIQUE)
- password_hash (TEXT)
- created_at (TEXT)

Table: categories
- id (INTEGER PRIMARY KEY)
- user_id (TEXT)
- name (TEXT)
- type (TEXT) - 'income' or 'expense'
- created_at (TEXT)

Table: transactions
- id (INTEGER PRIMARY KEY)
- user_id (TEXT)
- type (TEXT) - 'income' or 'expense'
- amount (REAL) - positive number
- category_id (INTEGER)
- payment_method (TEXT) - 'credit_card', 'debit_card', 'upi', 'cash'
- description (TEXT)
- notes (TEXT)
- date (TEXT) - format 'YYYY-MM-DD'
- deleted_at (TEXT) - NULL if not deleted
- created_at (TEXT)

Table: budgets
- id (INTEGER PRIMARY KEY)
- user_id (TEXT)
- month (INTEGER) - 1-12
- year (INTEGER)
- amount (REAL)

Table: category_budgets
- id (INTEGER PRIMARY KEY)
- user_id (TEXT)
- category_id (INTEGER)
- month (INTEGER)
- year (INTEGER)
- amount (REAL)

Table: payment_method_budgets
- id (INTEGER PRIMARY KEY)
- user_id (TEXT)
- payment_method (TEXT)
- month (INTEGER)
- year (INTEGER)
- amount (REAL)

BUSINESS RULES:
1. Income has positive amounts, expenses have positive amounts stored as 'expense' type
2. Balance = SUM(income) - SUM(expense) where type determines direction
3. Payment methods: 'credit_card', 'debit_card', 'upi', 'cash'
4. Always filter by user_id = ? for user data isolation
5. Only query non-deleted transactions (deleted_at IS NULL)

OUTPUT FORMAT:
SQL:
<Write only the raw SQL query without markdown blocks>
"""

def generate_sql_from_gemini(user_query):
    if not GEMINI_AVAILABLE or not api_key:
        return None, "Gemini API not configured. Please set GEMINI_API_KEY in .env file."
    
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_query,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.0,
            )
        )
        return extract_sql(response.text), None
    except Exception as e:
        return None, str(e)

def extract_sql(response_text):
    sql_query = response_text.replace("```sql", "").replace("```sqlite", "").replace("```", "")
    sql_query = sql_query.strip()
    if sql_query.upper().startswith("SQL"):
        sql_query = sql_query[3:].strip()
    if sql_query.startswith(":"):
        sql_query = sql_query[1:].strip()
    return sql_query

def execute_query(sql_query, user_id):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql_query, (user_id,))
        results = cursor.fetchall()
        conn.close()
        
        if not results:
            return [], None
        
        columns = results[0].keys()
        data = [[dict(zip(columns, row))[col] for col in columns] for row in results]
        return data, None
    except Exception as e:
        return None, f"Query execution error: {str(e)}"

def generate_insight_from_data(user_query, db_results):
    if not GEMINI_AVAILABLE or not api_key:
        return "Configure Gemini API to get AI-powered insights."
    
    try:
        prompt = f"""
        The user asked: "{user_query}"
        We ran the SQL query and the database returned exactly this data:
        {db_results}

        TASK: Analyze the database result and provide a helpful response with:
        - A direct answer to the question
        - Key statistics from the data
        - Any insights or patterns noticed

        CONSTRAINTS:
        - Always use $ for monetary values
        - Base statistics ONLY on the provided Database Result
        """
        
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"Insight generation error: {str(e)}"

def process_chat_query(user_query, user_id):
    sql_query, error = generate_sql_from_gemini(user_query)
    if error:
        return None, None, error
    
    results, error = execute_query(sql_query, user_id)
    if error:
        return None, None, error
    
    insight = generate_insight_from_data(user_query, results)
    
    return sql_query, results, insight

def handle_fallback_query(user_query, user_id):
    query_lower = user_query.lower()
    
    if any(word in query_lower for word in ['total', 'sum', 'income', 'earning', 'revenue']):
        sql = "SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income FROM transactions WHERE user_id = ? AND deleted_at IS NULL"
    elif any(word in query_lower for word in ['expense', 'spending', 'spent', 'cost']):
        sql = "SELECT COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense FROM transactions WHERE user_id = ? AND deleted_at IS NULL"
    elif any(word in query_lower for word in ['balance', 'net']):
        sql = """SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
            FROM transactions WHERE user_id = ? AND deleted_at IS NULL"""
    elif any(word in query_lower for word in ['transaction', 'recent', 'last', 'latest']):
        sql = "SELECT t.*, c.name as category_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ? AND t.deleted_at IS NULL ORDER BY t.date DESC, t.created_at DESC LIMIT 10"
    elif any(word in query_lower for word in ['budget', 'limit']):
        sql = "SELECT * FROM budgets WHERE user_id = ? ORDER BY year DESC, month DESC LIMIT 12"
    elif any(word in query_lower for word in ['category', 'categories']):
        sql = "SELECT * FROM categories WHERE user_id = ? ORDER BY type, name"
    else:
        return None, None, "I couldn't understand that query. Try asking about your income, expenses, balance, transactions, budget, or categories."
    
    results, error = execute_query(sql, user_id)
    if error:
        return None, None, error
    
    return sql, results, None