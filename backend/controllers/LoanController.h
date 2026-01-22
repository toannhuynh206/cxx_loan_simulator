#pragma once

#include <drogon/HttpController.h>
#include "../services/AmortizationCalculator.h"

using namespace drogon;

namespace api {
namespace v1 {

class LoanController : public drogon::HttpController<LoanController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(LoanController::calculate, "/api/v1/loan/calculate", Post, Options);
    ADD_METHOD_TO(LoanController::healthCheck, "/api/v1/health", Get);
    METHOD_LIST_END

    void calculate(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);

    void healthCheck(const HttpRequestPtr& req,
                     std::function<void(const HttpResponsePtr&)>&& callback);

private:
    loan::AmortizationCalculator calculator_;
};

} // namespace v1
} // namespace api
