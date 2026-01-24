#include "LoanController.h"

namespace api {
namespace v1 {

void LoanController::calculate(const HttpRequestPtr& req,
                                std::function<void(const HttpResponsePtr&)>&& callback) {
    // Handle OPTIONS preflight request for CORS
    if (req->method() == Options) {
        auto resp = HttpResponse::newHttpResponse();
        resp->setStatusCode(k204NoContent);
        callback(resp);
        return;
    }

    try {
        auto jsonPtr = req->getJsonObject();
        if (!jsonPtr) {
            Json::Value error;
            error["error"] = "Invalid JSON body";
            auto resp = HttpResponse::newHttpJsonResponse(error);
            resp->setStatusCode(k400BadRequest);
            callback(resp);
            return;
        }

        auto request = loan::LoanRequest::fromJson(*jsonPtr);
        auto result = calculator_.calculate(request);

        auto resp = HttpResponse::newHttpJsonResponse(result.toJson());
        resp->setStatusCode(k200OK);
        callback(resp);

    } catch (const std::invalid_argument& e) {
        Json::Value error;
        error["error"] = e.what();
        auto resp = HttpResponse::newHttpJsonResponse(error);
        resp->setStatusCode(k400BadRequest);
        callback(resp);

    } catch (const std::exception& e) {
        Json::Value error;
        error["error"] = "Internal server error";
        auto resp = HttpResponse::newHttpJsonResponse(error);
        resp->setStatusCode(k500InternalServerError);
        callback(resp);
    }
}

void LoanController::calculateMultiple(const HttpRequestPtr& req,
                                        std::function<void(const HttpResponsePtr&)>&& callback) {
    // Handle OPTIONS preflight request for CORS
    if (req->method() == Options) {
        auto resp = HttpResponse::newHttpResponse();
        resp->setStatusCode(k204NoContent);
        callback(resp);
        return;
    }

    try {
        auto jsonPtr = req->getJsonObject();
        if (!jsonPtr) {
            Json::Value error;
            error["error"] = "Invalid JSON body";
            auto resp = HttpResponse::newHttpJsonResponse(error);
            resp->setStatusCode(k400BadRequest);
            callback(resp);
            return;
        }

        auto request = loan::MultiLoanRequest::fromJson(*jsonPtr);

        if (request.loans.empty()) {
            Json::Value error;
            error["error"] = "No loans provided";
            auto resp = HttpResponse::newHttpJsonResponse(error);
            resp->setStatusCode(k400BadRequest);
            callback(resp);
            return;
        }

        loan::MultiLoanResponse response;
        response.totalPrincipal = 0;
        response.totalInterest = 0;
        response.totalMonths = 0;
        response.totalMonthlyPayment = 0;
        response.totalPaid = 0;

        for (const auto& loanEntry : request.loans) {
            // Use the specialized calculator based on loan type
            auto loanResult = calculator_.calculateLoan(loanEntry);

            response.loans.push_back(loanResult);

            // Update totals
            response.totalPrincipal += loanResult.principal;
            response.totalInterest += loanResult.totalInterest;
            response.totalMonthlyPayment += loanResult.monthlyPayment;
            response.totalPaid += loanResult.totalPaid;
            if (loanResult.totalMonths > response.totalMonths) {
                response.totalMonths = loanResult.totalMonths;
            }
        }

        auto resp = HttpResponse::newHttpJsonResponse(response.toJson());
        resp->setStatusCode(k200OK);
        callback(resp);

    } catch (const std::invalid_argument& e) {
        Json::Value error;
        error["error"] = e.what();
        auto resp = HttpResponse::newHttpJsonResponse(error);
        resp->setStatusCode(k400BadRequest);
        callback(resp);

    } catch (const std::exception& e) {
        Json::Value error;
        error["error"] = "Internal server error";
        auto resp = HttpResponse::newHttpJsonResponse(error);
        resp->setStatusCode(k500InternalServerError);
        callback(resp);
    }
}

void LoanController::healthCheck(const HttpRequestPtr& req,
                                  std::function<void(const HttpResponsePtr&)>&& callback) {
    Json::Value health;
    health["status"] = "healthy";
    health["service"] = "loan-amortization-api";
    auto resp = HttpResponse::newHttpJsonResponse(health);
    resp->setStatusCode(k200OK);
    callback(resp);
}

} // namespace v1
} // namespace api
