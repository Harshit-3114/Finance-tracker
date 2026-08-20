# Finance Tracker

A comprehensive personal finance management application with budget tracking, transaction management, and analytics.

## Features

### Authentication
- Sign up with email or phone number
- Login with email, phone, or user ID
- Password reset functionality
- Secure password hashing (PBKDF2)

### Transactions
- Add income and expense transactions
- Select payment method (Credit Card, Debit Card, UPI, Cash)
- Add categories, descriptions, and notes
- Filter by time period, category, type, payment method
- Sort by date or amount
- Soft delete with recycle bin (30 item limit)
- Restore or permanently delete transactions

### Budget Management
- Set monthly budget
- Set category-wise budgets
- Set payment method budgets
- Visual spending analysis
- Budget recommendations based on spending patterns
- Real-time budget tracking with notifications

### Dashboard
- Interactive pie chart with hover effects showing expenses by category
- Color-coded summary cards for income, expenses, and balance
- Recent transactions list
- Period selection (This Month, Last 3 Months, This Year)

### Calendar View
- Monthly calendar with transaction markers
- Daily transaction breakdown on date selection

### Categories
- Default income categories: Salary, Freelance, Investment, Bonus, Other
- Default expense categories: Food, Transport, Rent, Utilities, Entertainment, Shopping, Health, Education, Other
- Add custom categories

## Tech Stack

### Frontend (NEW - React + TypeScript + Vite)
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations and transitions
- **React Router v6** for client-side routing
- **Chart.js** via react-chartjs-2 for visualizations
- **Lucide React** for consistent iconography

### Backend
- Python 3.12
- FastAPI
- SQLite3
- JWT Authentication
- Pydantic validation

## Getting Started

### Prerequisites
- Python 3.8 or higher
- Node.js 18 or higher
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd finance_tracker
```

2. Install Python dependencies:
```bash
cd server
pip install -r requirements.txt
```

3. Install Node.js dependencies (frontend):
```bash
cd ..\client_react
npm install
```

### Running the Application

#### Option 1: Using start.bat (Windows)
Simply double-click `start.bat` or run it from command prompt.

#### Option 2: Manual Start

1. Start the backend server:
```bash
cd server
python main.py
```

2. Start the frontend development server:
```bash
cd client_react
npm run dev
```

3. Open http://localhost:3000 in your browser

## Project Structure

```
finance_tracker/
├── server/
│   ├── main.py           # FastAPI application
│   ├── database.py       # Database initialization
│   ├── service.py        # Business logic
│   ├── requirements.txt  # Python dependencies
│   └── finance.db        # SQLite database
├── client_react/         # NEW: React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   │   ├── ui/       # Base components (Card, Button, Modal)
│   │   │   └── Sidebar/  # Navigation sidebar
│   │   ├── context/      # React Context (AuthContext)
│   │   ├── pages/        # Page components
│   │   │   ├── Dashboard/
│   │   │   ├── Transactions/
│   │   │   ├── Calendar/
│   │   │   ├── Budget/
│   │   │   ├── Categories/
│   │   │   ├── RecycleBin/
│   │   │   └── Auth/
│   │   ├── services/     # API client
│   │   ├── utils/        # Utility functions
│   │   ├── App.tsx       # Main app component
│   │   └── main.tsx      # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── postcss.config.js
├── start.bat            # Quick start script (Windows)
├── README.md
└── .gitignore
```

## Frontend Architecture

### Component Structure

- **UI Components**: Base reusable components (`Card`, `Button`, `Modal`, `LoadingSkeleton`)
- **Layout Components**: `Sidebar` for navigation
- **Page Components**: Full-page views for each route

### State Management

- **AuthContext**: Manages authentication state and user data
- **Component-level state**: `useState` for local component state
- **Server state**: Direct API calls with React hooks

### Styling

The app uses **Tailwind CSS** with a custom design system:

| Token | Value | Usage |
|-------|-------|-------|
| `brand-dark` | `#0b0f19` | Page background |
| `brand-section` | `#111827` | Card backgrounds |
| `brand-card` | `#1f2937` | Inputs, nested elements |
| `brand-accent` | `#3b82f6` | Primary actions, highlights |
| `brand-success` | `#10b981` | Income, positive values |
| `brand-danger` | `#ef4444` | Expenses, delete actions |
| `brand-warning` | `#f59e0b` | Warnings, alerts |

### Animations

Built with **Framer Motion**:
- Page transitions with staggered children
- Card entrance animations
- Modal scale/fade transitions
- Button hover/tap feedback
- Smooth sidebar slide-in (mobile)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Transactions
- `GET /api/transactions` - List transactions (with filters)
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Soft delete transaction

### Recycle Bin
- `GET /api/recycle-bin` - List deleted transactions
- `POST /api/recycle-bin/{id}/restore` - Restore transaction
- `DELETE /api/recycle-bin/{id}` - Permanent delete
- `DELETE /api/recycle-bin` - Empty recycle bin

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `DELETE /api/categories/{id}` - Delete category

### Budget
- `GET /api/budget?month=&year=` - Get monthly budget
- `POST /api/budget` - Set monthly budget
- `GET /api/budget/category?month=&year=` - Get category budgets
- `POST /api/budget/category` - Set category budget
- `GET /api/budget/payment-method?month=&year=` - Get payment method budgets
- `POST /api/budget/payment-method` - Set payment method budget
- `GET /api/budget/spending?month=&year=` - Get spending vs budget analysis
- `GET /api/budget/recommendations?month=&year=` - Get budget recommendations

### Summary & Analytics
- `GET /api/summary` - Get financial summary
- `GET /api/expenses-by-category` - Get expenses grouped by category

### Notifications
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Get unread count
- `POST /api/notifications/{id}/read` - Mark as read
- `POST /api/notifications/read-all` - Mark all as read

## Security

- Passwords are hashed using PBKDF2 with SHA256
- JWT tokens for session management
- Token expiration: 24 hours
- CORS enabled for local development

## License

MIT License