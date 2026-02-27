#include <drogon/drogon.h>
#include <cstdlib>
#include <string>
#include <set>
#include <sstream>

int main() {
    // Load configuration from file
    drogon::app().loadConfigFile("./config.json");

    // Build allowed origins set from CORS_ORIGINS env var (comma-separated).
    // Example: CORS_ORIGINS=https://loanscope.org,https://www.loanscope.org
    // Always includes localhost for local development.
    std::set<std::string> allowedOrigins = {
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:8080",
    };
    const char* envOrigins = std::getenv("CORS_ORIGINS");
    if (envOrigins) {
        std::stringstream ss(envOrigins);
        std::string origin;
        while (std::getline(ss, origin, ',')) {
            if (!origin.empty()) allowedOrigins.insert(origin);
        }
    }

    // Register pre-routing advice for CORS preflight handling
    drogon::app().registerPreRoutingAdvice(
        [allowedOrigins](const drogon::HttpRequestPtr& req,
           drogon::FilterCallback&& stop,
           drogon::FilterChainCallback&& pass) {

            if (req->method() == drogon::Options) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k204NoContent);
                std::string origin = req->getHeader("Origin");
                if (allowedOrigins.count(origin)) {
                    resp->addHeader("Access-Control-Allow-Origin", origin);
                    resp->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                    resp->addHeader("Access-Control-Allow-Headers", "Content-Type");
                    resp->addHeader("Access-Control-Max-Age", "86400");
                    resp->addHeader("Vary", "Origin");
                }
                stop(resp);
                return;
            }
            pass();
        });

    // Add CORS headers to all responses
    drogon::app().registerPostHandlingAdvice(
        [allowedOrigins](const drogon::HttpRequestPtr& req, const drogon::HttpResponsePtr& resp) {
            std::string origin = req->getHeader("Origin");
            if (allowedOrigins.count(origin)) {
                resp->addHeader("Access-Control-Allow-Origin", origin);
                resp->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                resp->addHeader("Access-Control-Allow-Headers", "Content-Type");
                resp->addHeader("Vary", "Origin");
            }
        });

    LOG_INFO << "LoanScope API starting on port 8080";
    drogon::app().run();

    return 0;
}
