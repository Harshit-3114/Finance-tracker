import os
import re
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator, constr
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import init_db
from service import (
    AuthService, CategoryService, BudgetService, TransactionService,
    NotificationService, UserCreate, UserLogin, PasswordResetRequest, PasswordReset,
    CategoryCreate, BudgetCreate, CategoryBudgetCreate, PaymentMethodBudgetCreate, TransactionCreate
)
from chatbot_engine import process_chat_query, handle_fallback_query

# ==================== CONFIGURATION ====================

# Security configuration with environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "your-very-strong-secret-key-change-this-in-production")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# CORS configuration - strict by default
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(",")]
if DEBUG:
    origins.append("*")

# JWT token settings
TOKEN_EXPIRY = 86400  # 24 hours in seconds

# Rate limiting configuration
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

# ==================== RATE LIMITING ====================

limiter = Limiter(key_func=get_remote_address)

# ==================== FASTAPI APP ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    init_db()
    logger.info("Finance Tracker API started successfully")
    yield
    logger.info("Finance Tracker API shutting down")

app = FastAPI(
    title="Finance Tracker API",
    version="1.0.0",
    docs_url=None if ENVIRONMENT == "production" else "/docs",
    redoc_url=None if ENVIRONMENT == "production" else "/redoc",
    lifespan=lifespan
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ==================== SECURITY MIDDLEWARES ====================

# CORS middleware - restrictive by default
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    max_age=600,
)

# Trusted host middleware (production only)
if ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*.yourdomain.com", "localhost", "127.0.0.1"]
    )

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:3001;"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["X-Content-Security-Policy"] = response.headers["Content-Security-Policy"]
    
    # Cache control for sensitive endpoints
    if request.url.path.startswith("/api/") and request.method in ["POST", "PUT", "DELETE"]:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    
    return response

# Request size limit middleware
@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Limit request body size to prevent DoS."""
    content_length = request.headers.get("Content-Length")
    if content_length:
        max_size = 10 * 1024 * 1024  # 10MB
        if int(content_length) > max_size:
            raise HTTPException(status_code=413, detail="Request entity too large (max 10MB)")
    return await call_next(request)

# ==================== AUTH HELPERS ====================

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + TOKEN_EXPIRY,
        "iat": int(time.time()),
        "type": "access"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    
    user_id = decode_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user_id

# ==================== SERVICE INSTANCES ====================

auth_service = AuthService()
category_service = CategoryService()
budget_service = BudgetService()
transaction_service = TransactionService()
notification_service = NotificationService()

# ==================== VALIDATION MODELS ====================

class ValidatedCategoryCreate(BaseModel):
    name: constr(min_length=1, max_length=50, strip_whitespace=True)
    type: str
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        if v not in ('income', 'expense'):
            raise ValueError("Type must be 'income' or 'expense'")
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Name is required')
        if len(v) > 50:
            raise ValueError('Name must be less than 50 characters')
        # Prevent special characters that could be used in injection
        if re.search(r'[<>&;`]', v):
            raise ValueError('Name contains invalid characters')
        return v

class ValidatedBudgetCreate(BaseModel):
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
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError('Amount cannot be negative')
        if v > 999999999:
            raise ValueError('Amount is too large')
        return v

class ValidatedTransactionCreate(BaseModel):
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
        if v > 999999999:
            raise ValueError('Amount is too large')
        return v
    
    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v):
        if v and v not in ('credit_card', 'debit_card', 'upi', 'cash'):
            raise ValueError("Payment method must be 'credit_card', 'debit_card', 'upi', or 'cash'")
        return v
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v and len(v) > 500:
            raise ValueError('Description must be less than 500 characters')
        if v and re.search(r'[<>&;`]', v):
            raise ValueError('Description contains invalid characters')
        return v
    
    @field_validator('notes')
    @classmethod
    def validate_notes(cls, v):
        if v and len(v) > 1000:
            raise ValueError('Notes must be less than 1000 characters')
        if v and re.search(r'[<>&;`]', v):
            raise ValueError('Notes contain invalid characters')
        return v

# ==================== HEALTH CHECK ====================

@app.get("/health")
@limiter.limit("10/minute")
def health_check(request: Request):
    return {"status": "ok", "environment": ENVIRONMENT}

# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/signup")
@limiter.limit("5/minute")
def signup(request: Request, data: UserCreate):
    try:
        user = auth_service.create_user(data)
        token = create_token(user["user_id"])
        logger.info(f"User {user['user_id']} signed up from {request.client.host}")
        return {"data": {"user": user, "token": token}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, data: UserLogin):
    user = auth_service.authenticate(data.identifier, data.password)
    if not user:
        logger.warning(f"Failed login attempt for {data.identifier} from {request.client.host}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["user_id"])
    logger.info(f"User {user['user_id']} logged in from {request.client.host}")
    return {
        "data": {
            "user": {
                "user_id": user["user_id"],
                "email": user["email"],
                "phone": user["phone"]
            },
            "token": token
        }
    }

@app.post("/api/auth/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, data: PasswordResetRequest):
    try:
        token = auth_service.request_password_reset(data.email, data.phone)
        logger.info(f"Password reset requested for {data.email or data.phone}")
        # SECURITY FIX: Do not return the token in production
        # In a real app, send via email/SMS. For now, only return in debug mode.
        if DEBUG:
            return {"data": {"message": "Reset token generated", "token": token}}
        return {"data": {"message": "If an account exists, a reset link has been sent"}}
    except ValueError as e:
        # Don't reveal if user exists
        logger.info(f"Password reset attempt for non-existent user")
        return {"data": {"message": "If an account exists, a reset link has been sent"}}

@app.post("/api/auth/reset-password")
@limiter.limit("5/minute")
def reset_password(request: Request, data: PasswordReset):
    success = auth_service.reset_password(data.token, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    logger.info("Password reset successful")
    return {"data": {"message": "Password reset successfully"}}

# ==================== CATEGORIES ====================

@app.get("/api/categories")
@limiter.limit("60/minute")
def list_categories(request: Request, user_id: str = Depends(get_current_user)):
    return {"data": category_service.get_all(user_id)}

@app.post("/api/categories")
@limiter.limit("30/minute")
def create_category(request: Request, data: ValidatedCategoryCreate, user_id: str = Depends(get_current_user)):
    category = category_service.create(user_id, data)
    logger.info(f"Category created by {user_id}")
    return {"data": category}

@app.delete("/api/categories/{category_id}")
@limiter.limit("30/minute")
def delete_category(request: Request, category_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(category_id, int) or category_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    if not category_service.delete(user_id, category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    logger.info(f"Category deleted by {user_id}")
    return {"success": True}

# ==================== BUDGET ====================

@app.get("/api/budget")
@limiter.limit("60/minute")
def get_budget(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    budget = budget_service.get(user_id, month, year)
    if not budget:
        return {"data": {"month": month, "year": year, "amount": 0}}
    return {"data": budget}

@app.post("/api/budget")
@limiter.limit("30/minute")
def set_budget(request: Request, data: ValidatedBudgetCreate, user_id: str = Depends(get_current_user)):
    return {"data": budget_service.upsert(user_id, data)}

@app.get("/api/budget/category")
@limiter.limit("60/minute")
def get_category_budgets(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    return {"data": budget_service.get_category_budgets(user_id, month, year)}

@app.post("/api/budget/category")
@limiter.limit("30/minute")
def set_category_budget(request: Request, data: CategoryBudgetCreate, user_id: str = Depends(get_current_user)):
    return {"data": budget_service.set_category_budget(user_id, data)}

@app.delete("/api/budget/category/{category_id}")
@limiter.limit("30/minute")
def delete_category_budget(request: Request, category_id: int, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not isinstance(category_id, int) or category_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    if not budget_service.delete_category_budget(user_id, category_id, month, year):
        raise HTTPException(status_code=404, detail="Category budget not found")
    return {"success": True}

@app.get("/api/budget/payment-method")
@limiter.limit("60/minute")
def get_payment_method_budgets(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    return {"data": budget_service.get_payment_method_budgets(user_id, month, year)}

@app.post("/api/budget/payment-method")
@limiter.limit("30/minute")
def set_payment_method_budget(request: Request, data: PaymentMethodBudgetCreate, user_id: str = Depends(get_current_user)):
    return {"data": budget_service.set_payment_method_budget(user_id, data)}

@app.delete("/api/budget/payment-method/{payment_method}")
@limiter.limit("30/minute")
def delete_payment_method_budget(request: Request, payment_method: str, month: int, year: int, user_id: str = Depends(get_current_user)):
    if payment_method not in ('credit_card', 'debit_card', 'upi', 'cash'):
        raise HTTPException(status_code=400, detail="Invalid payment method")
    if not budget_service.delete_payment_method_budget(user_id, payment_method, month, year):
        raise HTTPException(status_code=404, detail="Payment method budget not found")
    return {"success": True}

@app.get("/api/budget/payment-method/spending")
@limiter.limit("60/minute")
def get_payment_method_spending(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    return {"data": budget_service.get_spending_vs_payment_method_budget(user_id, month, year)}

@app.get("/api/budget/spending")
@limiter.limit("60/minute")
def get_spending_vs_budget(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    return {"data": budget_service.get_spending_vs_budget(user_id, month, year)}

@app.get("/api/budget/recommendations")
@limiter.limit("30/minute")
def get_budget_recommendations(request: Request, month: int, year: int, user_id: str = Depends(get_current_user)):
    if not (1 <= month <= 12) or not (2000 <= year <= 2100):
        raise HTTPException(status_code=400, detail="Invalid month or year")
    return {"data": budget_service.get_budget_recommendations(user_id, month, year)}

# ==================== TRANSACTIONS ====================

@app.get("/api/transactions")
@limiter.limit("120/minute")
def list_transactions(request: Request, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    type: Optional[str] = None,
    sort_by: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "category_id": category_id,
        "type": type,
        "sort_by": sort_by
    }
    return {"data": transaction_service.get_all(user_id, filters)}

@app.get("/api/transactions/{transaction_id}")
@limiter.limit("120/minute")
def get_transaction(request: Request, transaction_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(transaction_id, int) or transaction_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")
    transactions = transaction_service.get_all(user_id)
    for t in transactions:
        if t["id"] == transaction_id:
            return {"data": t}
    raise HTTPException(status_code=404, detail="Transaction not found")

@app.post("/api/transactions")
@limiter.limit("60/minute")
def create_transaction(request: Request, data: ValidatedTransactionCreate, user_id: str = Depends(get_current_user)):
    try:
        return {"data": transaction_service.create(user_id, data, budget_service)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/transactions/{transaction_id}")
@limiter.limit("60/minute")
def update_transaction(request: Request, transaction_id: int, data: ValidatedTransactionCreate, user_id: str = Depends(get_current_user)):
    if not isinstance(transaction_id, int) or transaction_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")
    result = transaction_service.update(user_id, transaction_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    logger.info(f"Transaction {transaction_id} updated by {user_id}")
    return {"data": result}

@app.delete("/api/transactions/{transaction_id}")
@limiter.limit("60/minute")
def delete_transaction(request: Request, transaction_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(transaction_id, int) or transaction_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")
    if not transaction_service.delete(user_id, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")
    logger.info(f"Transaction {transaction_id} deleted by {user_id}")
    return {"success": True}

# ==================== RECYCLE BIN ====================

@app.get("/api/recycle-bin")
@limiter.limit("60/minute")
def get_recycle_bin(request: Request, user_id: str = Depends(get_current_user)):
    return {"data": transaction_service.get_recycle_bin(user_id)}

@app.post("/api/recycle-bin/{transaction_id}/restore")
@limiter.limit("60/minute")
def restore_transaction(request: Request, transaction_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(transaction_id, int) or transaction_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")
    result = transaction_service.restore(user_id, transaction_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found in recycle bin")
    logger.info(f"Transaction {transaction_id} restored by {user_id}")
    return {"data": result}

@app.delete("/api/recycle-bin/{transaction_id}")
@limiter.limit("60/minute")
def permanent_delete_transaction(request: Request, transaction_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(transaction_id, int) or transaction_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid transaction ID")
    if not transaction_service.permanent_delete(user_id, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found in recycle bin")
    logger.info(f"Transaction {transaction_id} permanently deleted by {user_id}")
    return {"success": True}

@app.delete("/api/recycle-bin")
@limiter.limit("30/minute")
def empty_recycle_bin(request: Request, user_id: str = Depends(get_current_user)):
    count = transaction_service.empty_recycle_bin(user_id)
    logger.info(f"Recycle bin emptied by {user_id}, {count} items deleted")
    return {"data": {"deleted_count": count}}

# ==================== SUMMARY & ANALYTICS ====================

@app.get("/api/summary")
@limiter.limit("120/minute")
def get_summary(request: Request, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    return {"data": transaction_service.get_summary(user_id, start_date, end_date)}

@app.get("/api/expenses-by-category")
@limiter.limit("120/minute")
def get_expenses_by_category(request: Request, 
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    return {"data": transaction_service.get_expenses_by_category(user_id, start_date, end_date)}

# ==================== NOTIFICATIONS ====================

@app.get("/api/notifications")
@limiter.limit("120/minute")
def get_notifications(request: Request, user_id: str = Depends(get_current_user)):
    return {"data": notification_service.get_all(user_id)}

@app.get("/api/notifications/unread-count")
@limiter.limit("120/minute")
def get_unread_count(request: Request, user_id: str = Depends(get_current_user)):
    return {"data": {"count": notification_service.get_unread_count(user_id)}}

@app.post("/api/notifications/{notification_id}/read")
@limiter.limit("120/minute")
def mark_notification_read(request: Request, notification_id: int, user_id: str = Depends(get_current_user)):
    if not isinstance(notification_id, int) or notification_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    notification_service.mark_read(user_id, notification_id)
    return {"success": True}

@app.post("/api/notifications/read-all")
@limiter.limit("30/minute")
def mark_all_read(request: Request, user_id: str = Depends(get_current_user)):
    notification_service.mark_all_read(user_id)
    return {"success": True}

# ==================== CHATBOT ENDPOINT ====================

class ChatQuery(BaseModel):
    query: str

@app.post("/api/chatbot/query")
@limiter.limit("20/minute")
def chatbot_query(request: Request, data: ChatQuery, user_id: str = Depends(get_current_user)):
    query = data.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    sql_query, results, error = process_chat_query(query, user_id)
    
    if error:
        sql_query, results, error = handle_fallback_query(query, user_id)
    
    if error:
        return {"success": False, "error": error, "insight": None, "data": None}
    
    return {
        "success": True,
        "sql": sql_query,
        "data": results,
        "insight": results
    }

# ==================== ERROR HANDLERS ====================

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )

@app.exception_handler(jwt.ExpiredSignatureError)
async def jwt_expired_handler(request: Request, exc: jwt.ExpiredSignatureError):
    return JSONResponse(
        status_code=401,
        content={"detail": "Token has expired"}
    )

@app.exception_handler(jwt.InvalidTokenError)
async def jwt_invalid_handler(request: Request, exc: jwt.InvalidTokenError):
    return JSONResponse(
        status_code=401,
        content={"detail": "Invalid token"}
    )

# Run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")
