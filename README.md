# LoanScope

**Visualize your loans. Strategize your path to financial freedom.**

LoanScope is a full-stack loan simulation tool that models amortization schedules across multiple loan types simultaneously. It uses a C++ calculation engine for mathematically accurate interest modeling and provides an interactive React frontend for exploring payoff strategies, viewing per-loan breakdowns, and comparing debt elimination approaches.

---

## Features

- **Multi-loan simulation** — Add any mix of student loans, credit cards, personal loans, auto loans, and mortgages and calculate them together
- **Cascade payoff engine** — Commit to a total monthly budget; when a loan pays off, its freed payment automatically rolls to the remaining loans
- **Payoff strategy comparison** — Side-by-side comparison of Avalanche (highest APR first), Snowball (lowest balance first), and minimum-only baseline with interest and time saved metrics
- **Per-loan chart & table** — Toggle between a combined overview and per-loan views; the chart and table stay in sync with a single toggle
- **Accurate interest models** — Credit cards use daily accrual (APR/365 × 30 days); installment loans use the actuarial monthly model (APR/12) per Regulation Z/TILA
- **Mortgage PITI** — Full principal, interest, taxes, insurance, PMI, and HOA breakdown with PMI auto-removal at 80% LTV
- **Amortization milestones** — 25%, 50%, 75% payoff markers highlighted on both chart and table
- **Zoom slider** — Single range slider controls the chart time window; pan arrows scroll when zoomed in
- **Dark / light theme**

---

## Tech Stack

### Backend
| Technology | Role |
|---|---|
| **C++17** | Core calculation engine |
| **Drogon** | Async HTTP framework, route handling |
| **JsonCpp** | JSON serialization / deserialization |
| **CMake** | Build system |

### Frontend
| Technology | Role |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type safety across all components and services |
| **Vite** | Dev server (HMR) + production bundler |
| **Recharts** | Amortization and strategy charts |
| **Axios** | HTTP client |

### Infrastructure
| Technology | Role |
|---|---|
| **Docker** | Containerization (backend + frontend) |
| **Docker Compose** | Multi-service orchestration |
| **Nginx** | Static file serving + API reverse proxy (production) |

---

## Architecture

```
Browser
  │
  ├─ Production
  │    └─ Nginx (:80) ──┬── serves built React SPA
  │                     └── /api/* → C++ backend (:8080)
  │
  └─ Development
       ├─ Vite dev server (:5173)   ← HMR, instant TS/TSX/CSS reload
       └─ C++ backend (:8080)
```

The C++ backend handles all amortization math. The frontend strategy service (`payoffStrategyService.ts`) runs a separate month-by-month simulation for the interactive "what-if extra payment" sliders in the Debt Payoff Strategy panel — keeping comparisons responsive without additional backend round trips.

---

## Loan Types

### Credit Card
- Interest model: **daily accrual** — `APR / 365 × 30 days`
- Minimum payment recalculates each month on current balance: `max(balance × minPercent, minFloor)`
- Configurable credit limit, minimum payment percent, and floor

### Personal Loan
- Interest model: **actuarial monthly** — `APR / 12`
- Fixed amortization payment over a defined term
- Optional origination fee

### Auto Loan
- Interest model: **actuarial monthly** — `APR / 12`
- Supports vehicle price, down payment, trade-in value, and trade-in payoff
- Tracks vehicle depreciation alongside loan balance

### Mortgage
- Interest model: **actuarial monthly** — `APR / 12`
- Full PITI: principal + interest + property tax + homeowners insurance + PMI + HOA
- PMI automatically drops when loan-to-value reaches 80%
- Supports 15, 20, and 30-year fixed terms

### Student Loan
- Interest model: **actuarial monthly** — `APR / 12`
- Repayment plans: **Standard** (10 years / 120 months), **Extended** (25 years / 300 months), **Graduated** (10 years with step-up payments)

---

## API Endpoints

All endpoints are served from the C++ backend.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/loan/calculate` | Single-loan amortization schedule |
| `POST` | `/api/v1/loan/calculate-multiple` | Independent schedules for multiple loans |
| `POST` | `/api/v1/loan/calculate-cascade` | Cascade payoff — fixed budget redistributed by strategy each month |

### Cascade Request Example
```json
{
  "loans": [
    { "type": "student-loan", "balance": 25000, "interestRate": 6.5, ... },
    { "type": "credit-card",  "balance": 4000,  "apr": 24.99, ... }
  ],
  "totalBudget": 800,
  "strategy": "avalanche"
}
```
Strategies: `"avalanche"` · `"snowball"` · `"standard"`

---

## Running Locally

### Prerequisites
- Docker and Docker Compose

### Development (hot reload)
```bash
docker-compose -f docker-compose.dev.yml up --build
```
- Frontend: `http://localhost:5173` (Vite HMR — TypeScript/CSS changes reload instantly, no rebuild needed)
- Backend API: `http://localhost:8080`

> After any C++ file change, stop and re-run with `--build` to recompile the backend.

### Production
```bash
docker-compose up --build
```
- App: `http://localhost:80`
- Backend API: `http://localhost:8080`

---

## Project Structure

```
loan_simulation/
├── backend/
│   ├── Dockerfile                         # Multi-stage C++ build
│   ├── CMakeLists.txt                     # CMake build config (C++17)
│   ├── config.json                        # Drogon server config
│   ├── main.cc                            # Entry point + CORS setup
│   ├── controllers/
│   │   ├── LoanController.h               # Route declarations
│   │   └── LoanController.cc              # HTTP request handlers
│   ├── services/
│   │   ├── AmortizationCalculator.h       # Calculator interface + rate models
│   │   └── AmortizationCalculator.cc      # Core amortization engine + cascade logic
│   └── models/
│       └── LoanModels.h                   # Request/response structs (all loan types)
│
├── frontend/
│   ├── Dockerfile                         # Node build stage + Nginx serving
│   ├── Dockerfile.dev                     # Vite dev server
│   ├── nginx.conf                         # Production Nginx config
│   └── src/
│       ├── App.tsx                        # Root — shared state, routing to endpoints
│       ├── components/
│       │   ├── LoanInput.tsx              # Loan entry forms + budget/strategy UI
│       │   ├── LoanForm.tsx               # Per-loan type form fields
│       │   ├── AmortizationChart.tsx      # Balance-over-time chart (combined + per-loan)
│       │   ├── AmortizationTable.tsx      # Paginated schedule table (combined + per-loan tabs)
│       │   ├── DebtPayoffStrategy.tsx     # Strategy comparison panel
│       │   ├── StrategyBalanceChart.tsx   # Balance chart per strategy
│       │   ├── StrategyComparisonTable.tsx
│       │   ├── PaymentBreakdownChart.tsx  # Principal vs interest breakdown
│       │   ├── ResultsSummary.tsx         # Top-line stats (total interest, months, etc.)
│       │   └── ThemeToggle.tsx
│       ├── services/
│       │   ├── loanApi.ts                 # Axios calls to all backend endpoints
│       │   └── payoffStrategyService.ts   # Frontend cascade sim for what-if analysis
│       ├── types/
│       │   ├── loan.ts                    # All loan entry + API response types
│       │   └── payoffStrategy.ts          # Strategy simulation types
│       └── utils/
│           └── amortization.ts            # Shared math: rate models, payment formula
│
├── docker-compose.yml                     # Production compose
├── docker-compose.dev.yml                 # Development compose (Vite HMR)
└── aws/
    ├── task-definition.json               # ECS Fargate task definition
    └── deploy.sh                          # AWS deployment script
```

---

## Payoff Strategies

The **Debt Payoff Strategy** section compares three approaches given a fixed extra monthly payment on top of all minimums:

| Strategy | Priority Rule | Best For |
|---|---|---|
| **Avalanche** | Highest APR loan first | Minimizing total interest paid |
| **Snowball** | Lowest balance loan first | Fastest psychological wins, motivation |
| **Minimum Only** | No priority — baseline | Comparison reference |

When a loan is fully paid off, its minimum payment is freed and added to the extra available for all subsequent months — compounding the acceleration over time.

---

## Interest Rate Accuracy

Two rate models are enforced throughout both the C++ backend and TypeScript frontend utilities to match how lenders legally compute interest:

| Loan Type | Model | Formula | Regulation |
|---|---|---|---|
| Credit card | Daily accrual | `APR / 365 × 30` | Truth in Lending Act |
| Personal, auto, mortgage, student | Actuarial monthly | `APR / 12` | Reg Z / TILA |

This distinction matters: at 20% APR, the credit card daily model yields ~1.644% per month vs. 1.667% with APR/12 — a difference that compounds significantly over years of revolving debt.

---

## License

MIT
