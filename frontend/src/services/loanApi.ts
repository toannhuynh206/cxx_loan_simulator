import axios from 'axios';
import { LoanRequest, LoanResponse, LoanEntry, CombinedLoanResult } from '../types/loan';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const calculateLoan = async (request: LoanRequest): Promise<LoanResponse> => {
  const response = await apiClient.post<LoanResponse>('/api/v1/loan/calculate', request);
  return response.data;
};

export const calculateMultipleLoans = async (loans: LoanEntry[]): Promise<CombinedLoanResult> => {
  const response = await apiClient.post<CombinedLoanResult>('/api/v1/loan/calculate-multiple', { loans });
  return response.data;
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    await apiClient.get('/api/v1/health');
    return true;
  } catch {
    return false;
  }
};
