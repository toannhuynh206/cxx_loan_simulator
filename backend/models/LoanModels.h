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

    Json::Value toJson() const {
        Json::Value json;
        json["month"] = month;
        json["startBalance"] = startBalance;
        json["interest"] = interest;
        json["payment"] = payment;
        json["endBalance"] = endBalance;
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

    Json::Value toJson() const {
        Json::Value json;
        json["principal"] = principal;
        json["apr"] = apr;
        json["monthlyPayment"] = monthlyPayment;
        json["totalMonths"] = totalMonths;
        json["totalInterest"] = totalInterest;

        Json::Value eventsArray(Json::arrayValue);
        for (const auto& event : events) {
            eventsArray.append(event.toJson());
        }
        json["events"] = eventsArray;

        return json;
    }
};

} // namespace loan
