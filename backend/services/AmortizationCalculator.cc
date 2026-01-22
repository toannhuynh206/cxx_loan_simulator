#include "AmortizationCalculator.h"
#include <cmath>
#include <stdexcept>
#include <algorithm>

namespace loan {

bool AmortizationCalculator::validateInput(const LoanRequest& request, std::string& error) {
    if (request.principal <= 0) {
        error = "Principal must be positive";
        return false;
    }

    if (request.apr < 0 || request.apr > 100) {
        error = "APR must be between 0 and 100";
        return false;
    }

    if (request.monthlyPayment <= 0) {
        error = "Monthly payment must be positive";
        return false;
    }

    // Check if payment covers at least the first month's interest
    double firstMonthInterest = request.principal * monthlyRate(request.apr);
    if (request.monthlyPayment <= firstMonthInterest) {
        error = "Monthly payment must exceed monthly interest ($" +
                std::to_string(std::round(firstMonthInterest * 100) / 100) +
                ") to pay off loan";
        return false;
    }

    return true;
}

LoanResponse AmortizationCalculator::calculate(const LoanRequest& request) {
    std::string error;
    if (!validateInput(request, error)) {
        throw std::invalid_argument(error);
    }

    LoanResponse response;
    response.principal = request.principal;
    response.apr = request.apr;
    response.monthlyPayment = request.monthlyPayment;
    response.totalInterest = 0.0;

    double balance = request.principal;
    double rate = monthlyRate(request.apr);
    int month = 0;

    // Maximum iterations to prevent infinite loops (100 years)
    const int MAX_MONTHS = 1200;

    while (balance > 0.01 && month < MAX_MONTHS) {
        month++;

        MonthlyEvent event;
        event.month = month;
        event.startBalance = balance;

        // Apply payment first (balance goes DOWN)
        // Final payment may be less than full monthly payment
        event.payment = std::min(request.monthlyPayment, balance);
        balance -= event.payment;

        // Then calculate interest on reduced balance (balance goes UP)
        event.interest = balance * rate;
        response.totalInterest += event.interest;
        balance += event.interest;

        event.endBalance = std::max(0.0, balance);
        response.events.push_back(event);
    }

    response.totalMonths = month;
    return response;
}

} // namespace loan
