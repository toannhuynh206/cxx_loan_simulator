# Loan Amortization Graph Simulator

A full-stack application that calculates and visualizes loan payoff schedules with a sawtooth pattern showing interest accrual (balance up) and payments (balance down).

## Tech Stack

- **Backend**: C++17 with [Drogon](https://github.com/drogonframework/drogon) HTTP framework
- **Frontend**: React + TypeScript + [Recharts](https://recharts.org/)
- **Infrastructure**: Docker Compose (dev) / AWS ECS Fargate (prod)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- (Optional) AWS CLI configured for deployment

### Run Locally

```bash
# Build and start all services
docker-compose up --build

# Open in browser
open http://localhost
```

The backend API runs on port 8080, frontend on port 80.

### Test the API

```bash
curl -X POST http://localhost:8080/api/v1/loan/calculate \
  -H "Content-Type: application/json" \
  -d '{"principal":10000,"apr":18.99,"monthlyPayment":250}'
```

## Project Structure

```
loan_simulation/
├── docker-compose.yml           # Local development orchestration
├── backend/
│   ├── Dockerfile               # Multi-stage C++ build
│   ├── CMakeLists.txt           # CMake build config
│   ├── config.json              # Drogon server config
│   ├── main.cc                  # Entry point + CORS
│   ├── controllers/
│   │   └── LoanController.cc    # REST API endpoint
│   ├── services/
│   │   └── AmortizationCalculator.cc  # Core calculation
│   └── models/
│       └── LoanModels.h         # Data structures
├── frontend/
│   ├── Dockerfile               # Node build + Nginx
│   ├── nginx.conf               # Production config
│   └── src/
│       ├── App.tsx
│       └── components/
│           ├── LoanForm.tsx
│           ├── AmortizationChart.tsx
│           └── ResultsSummary.tsx
└── aws/
    ├── task-definition.json     # ECS task definition
    └── deploy.sh                # Deployment script
```

## API Reference

### POST /api/v1/loan/calculate

Calculate loan amortization schedule.

**Request Body:**
```json
{
  "principal": 10000,
  "apr": 18.99,
  "monthlyPayment": 250
}
```

**Response:**
```json
{
  "principal": 10000,
  "apr": 18.99,
  "monthlyPayment": 250,
  "events": [
    {
      "month": 1,
      "startBalance": 10000.00,
      "interest": 158.25,
      "payment": 250.00,
      "endBalance": 9908.25
    }
  ],
  "totalMonths": 56,
  "totalInterest": 3842.17
}
```

### GET /api/v1/health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "loan-amortization-api"
}
```

## Features

- **Sawtooth Visualization**: Red lines show interest (balance up), green lines show payments (balance down)
- **Input Validation**: Ensures payment exceeds monthly interest
- **Responsive Design**: Works on desktop and mobile
- **Dark/Light Mode**: Follows system preference

## AWS Deployment

1. Update `aws/deploy.sh` with your AWS account details:
   ```bash
   AWS_ACCOUNT_ID="your-account-id"
   AWS_REGION="us-east-1"
   ```

2. Run the deployment script:
   ```bash
   chmod +x aws/deploy.sh
   ./aws/deploy.sh
   ```

3. For the first deployment, create the ECS service manually with your VPC configuration.

## Development

### Backend Development

The backend is built inside Docker, but you can develop locally if you have Drogon installed:

```bash
cd backend
mkdir build && cd build
cmake ..
make
./loan_amortization_api
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8080`.

## Algorithm

The amortization calculation works as follows:

```
for each month until balance <= 0:
    1. Calculate interest: balance * (APR / 100 / 12)
    2. Add interest to balance (balance goes UP)
    3. Subtract payment from balance (balance goes DOWN)
    4. Record the event
```

## License

MIT
