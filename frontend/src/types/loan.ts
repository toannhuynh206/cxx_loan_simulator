export interface MonthlyEvent {
  month: number;
  startBalance: number;
  interest: number;
  payment: number;
  endBalance: number;
}

export interface LoanRequest {
  principal: number;
  apr: number;
  monthlyPayment: number;
}

export interface LoanResponse {
  principal: number;
  apr: number;
  monthlyPayment: number;
  events: MonthlyEvent[];
  totalMonths: number;
  totalInterest: number;
}

export interface ChartDataPoint {
  month: number;
  interest: number | null;
  payment: number | null;
}
