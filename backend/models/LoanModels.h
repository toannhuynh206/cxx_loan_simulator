#pragma once

#include <vector>
#include <string>
#include <json/json.h>

namespace loan {

struct LoanRequest {
    double principal;
    double apr;           // Annual Percentage Rate
    double monthlyPayment;

    static LoanRequest fromJson(const Json::Value& json) {
        LoanRequest req;
        req.principal = json["principal"].asDouble();
        req.apr = json["apr"].asDouble();
        req.monthlyPayment = json["monthlyPayment"].asDouble();
        return req;
    }
};

struct MonthlyEvent {
    int month;
    double startBalance;
    double interest;
    double payment;
    double endBalance;
    double principalPaid;
    double pmiPayment;        // For mortgages
    double escrowPayment;     // For mortgages (taxes + insurance)
    double totalPayment;      // Full monthly payment including extras

    Json::Value toJson() const {
        Json::Value json;
        json["month"] = month;
        json["startBalance"] = startBalance;
        json["interest"] = interest;
        json["payment"] = payment;
        json["endBalance"] = endBalance;
        json["principalPaid"] = principalPaid;
        json["pmiPayment"] = pmiPayment;
        json["escrowPayment"] = escrowPayment;
        json["totalPayment"] = totalPayment;
        return json;
    }
};

struct LoanResponse {
    double principal;
    double apr;
    double monthlyPayment;
    std::vector<MonthlyEvent> events;
    int totalMonths;
    double totalInterest;
    double totalPaid;
    double totalPMI;
    double totalEscrow;

    Json::Value toJson() const {
        Json::Value json;
        json["principal"] = principal;
        json["apr"] = apr;
        json["monthlyPayment"] = monthlyPayment;
        json["totalMonths"] = totalMonths;
        json["totalInterest"] = totalInterest;
        json["totalPaid"] = totalPaid;
        json["totalPMI"] = totalPMI;
        json["totalEscrow"] = totalEscrow;

        Json::Value eventsArray(Json::arrayValue);
        for (const auto& event : events) {
            eventsArray.append(event.toJson());
        }
        json["events"] = eventsArray;

        return json;
    }
};

// ============================================
// Specialized Loan Entry Types
// ============================================

// Credit Card Entry - Daily compounding, APR-based
struct CreditCardEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double apr;
    double creditLimit;
    double monthlyPayment;
    double minimumPaymentPercent;
    double minimumPaymentFloor;

    static CreditCardEntry fromJson(const Json::Value& json) {
        CreditCardEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.apr = json["apr"].asDouble();
        entry.creditLimit = json["creditLimit"].asDouble();
        entry.monthlyPayment = json["monthlyPayment"].asDouble();
        entry.minimumPaymentPercent = json.get("minimumPaymentPercent", 2.0).asDouble();
        entry.minimumPaymentFloor = json.get("minimumPaymentFloor", 25.0).asDouble();
        return entry;
    }
};

// Personal Loan Entry - Simple interest, fixed term
struct PersonalLoanEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double interestRate;
    int termMonths;
    double monthlyPayment;
    double originationFeePercent;

    static PersonalLoanEntry fromJson(const Json::Value& json) {
        PersonalLoanEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.interestRate = json["interestRate"].asDouble();
        entry.termMonths = json.get("termMonths", 36).asInt();
        entry.monthlyPayment = json["monthlyPayment"].asDouble();
        entry.originationFeePercent = json.get("originationFeePercent", 0.0).asDouble();
        return entry;
    }
};

// Auto Loan Entry - Simple interest with depreciation
struct AutoLoanEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double interestRate;
    int termMonths;
    double vehiclePrice;
    double downPayment;
    double tradeInValue;
    double tradeInPayoff;
    int vehicleYear;
    bool isUsed;

    static AutoLoanEntry fromJson(const Json::Value& json) {
        AutoLoanEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.interestRate = json["interestRate"].asDouble();
        entry.termMonths = json.get("termMonths", 60).asInt();
        entry.vehiclePrice = json["vehiclePrice"].asDouble();
        entry.downPayment = json["downPayment"].asDouble();
        entry.tradeInValue = json.get("tradeInValue", 0.0).asDouble();
        entry.tradeInPayoff = json.get("tradeInPayoff", 0.0).asDouble();
        entry.vehicleYear = json.get("vehicleYear", 2024).asInt();
        entry.isUsed = json.get("isUsed", false).asBool();
        return entry;
    }
};

// Mortgage Entry - PITI with PMI tracking
struct MortgageEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double interestRate;
    int termYears;
    double homePrice;
    double downPayment;
    double downPaymentPercent;
    double propertyTaxAnnual;
    double homeInsuranceAnnual;
    double pmiRate;
    double hoaMonthly;
    bool includeEscrow;

    static MortgageEntry fromJson(const Json::Value& json) {
        MortgageEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.interestRate = json["interestRate"].asDouble();
        entry.termYears = json.get("termYears", 30).asInt();
        entry.homePrice = json["homePrice"].asDouble();
        entry.downPayment = json["downPayment"].asDouble();
        entry.downPaymentPercent = json.get("downPaymentPercent", 20.0).asDouble();
        entry.propertyTaxAnnual = json.get("propertyTaxAnnual", 0.0).asDouble();
        entry.homeInsuranceAnnual = json.get("homeInsuranceAnnual", 0.0).asDouble();
        entry.pmiRate = json.get("pmiRate", 0.5).asDouble();
        entry.hoaMonthly = json.get("hoaMonthly", 0.0).asDouble();
        entry.includeEscrow = json.get("includeEscrow", true).asBool();
        return entry;
    }
};

// Student Loan Entry - Simple interest with repayment plans
struct StudentLoanEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double interestRate;
    double monthlyPayment;
    bool isFederal;
    bool isSubsidized;
    double originationFeePercent;
    std::string repaymentPlan;
    std::string loanServicer;

    static StudentLoanEntry fromJson(const Json::Value& json) {
        StudentLoanEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.interestRate = json["interestRate"].asDouble();
        entry.monthlyPayment = json["monthlyPayment"].asDouble();
        entry.isFederal = json.get("isFederal", true).asBool();
        entry.isSubsidized = json.get("isSubsidized", false).asBool();
        entry.originationFeePercent = json.get("originationFeePercent", 1.057).asDouble();
        entry.repaymentPlan = json.get("repaymentPlan", "standard").asString();
        entry.loanServicer = json.get("loanServicer", "").asString();
        return entry;
    }
};

// Generic Loan Entry for parsing
struct LoanEntry {
    std::string id;
    std::string name;
    std::string type;
    double balance;
    double interestRate;
    double monthlyPayment;
    Json::Value rawJson;  // Store original JSON for type-specific parsing

    static LoanEntry fromJson(const Json::Value& json) {
        LoanEntry entry;
        entry.id = json["id"].asString();
        entry.name = json["name"].asString();
        entry.type = json["type"].asString();
        entry.balance = json["balance"].asDouble();
        entry.interestRate = json.get("interestRate", json.get("apr", 0.0)).asDouble();
        entry.monthlyPayment = json["monthlyPayment"].asDouble();
        entry.rawJson = json;
        return entry;
    }
};

struct MultiLoanRequest {
    std::vector<LoanEntry> loans;

    static MultiLoanRequest fromJson(const Json::Value& json) {
        MultiLoanRequest req;
        const auto& loansArray = json["loans"];
        for (const auto& loanJson : loansArray) {
            req.loans.push_back(LoanEntry::fromJson(loanJson));
        }
        return req;
    }
};

struct LoanCalculationResult {
    std::string loanId;
    std::string loanName;
    std::string loanType;
    double principal;
    double interestRate;
    double monthlyPayment;
    std::vector<MonthlyEvent> events;
    int totalMonths;
    double totalInterest;
    double totalPaid;
    double totalPMI;
    double totalEscrow;

    // Additional loan-type specific results
    double minimumPayment;      // For credit cards
    double vehicleValue;        // For auto loans (depreciated)
    double equityPercent;       // For mortgages

    Json::Value toJson() const {
        Json::Value json;
        json["loanId"] = loanId;
        json["loanName"] = loanName;
        json["loanType"] = loanType;
        json["principal"] = principal;
        json["apr"] = interestRate;  // Keep 'apr' for frontend compatibility
        json["monthlyPayment"] = monthlyPayment;
        json["totalMonths"] = totalMonths;
        json["totalInterest"] = totalInterest;
        json["totalPaid"] = totalPaid;
        json["totalPMI"] = totalPMI;
        json["totalEscrow"] = totalEscrow;
        json["minimumPayment"] = minimumPayment;
        json["vehicleValue"] = vehicleValue;
        json["equityPercent"] = equityPercent;

        Json::Value eventsArray(Json::arrayValue);
        for (const auto& event : events) {
            eventsArray.append(event.toJson());
        }
        json["events"] = eventsArray;

        return json;
    }
};

struct MultiLoanResponse {
    std::vector<LoanCalculationResult> loans;
    double totalPrincipal;
    double totalInterest;
    int totalMonths;  // Max months across all loans
    double totalMonthlyPayment;
    double totalPaid;

    Json::Value toJson() const {
        Json::Value json;
        json["totalPrincipal"] = totalPrincipal;
        json["totalInterest"] = totalInterest;
        json["totalMonths"] = totalMonths;
        json["totalMonthlyPayment"] = totalMonthlyPayment;
        json["totalPaid"] = totalPaid;

        Json::Value loansArray(Json::arrayValue);
        for (const auto& loan : loans) {
            loansArray.append(loan.toJson());
        }
        json["loans"] = loansArray;

        return json;
    }
};

} // namespace loan
