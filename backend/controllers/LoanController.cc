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
