#pragma once

#include "../models/LoanModels.h"
#include <string>

namespace loan {

class AmortizationCalculator {
public:
    // Calculate complete amortization schedule
    LoanResponse calculate(const LoanRequest& request);

private:
    // Calculate monthly interest rate from APR
    double monthlyRate(double apr) const {
        return apr / 100.0 / 12.0;
    }

    // Validate input parameters
    bool validateInput(const LoanRequest& request, std::string& error);
};

} // namespace loan
