import logging
from fastapi import FastAPI
from starlette.testclient import TestClient

# Import the middleware implementation from the main module
from Backend import main as backend_main


def test_access_log_middleware_exception_handled(caplog):
    """Ensure AccessLogMiddleware logs a 500 line instead of raising UnboundLocalError.

    Regression test for bug where an exception before response assignment caused
    UnboundLocalError when accessing local variable 'response' inside finally block.
    """
    app = FastAPI()
    app.add_middleware(backend_main.AccessLogMiddleware)

    @app.get("/boom")
    def boom():  # pragma: no cover - executed via client
        raise RuntimeError("boom")

    with TestClient(app) as client:
        with caplog.at_level(logging.INFO):
            resp = client.get("/boom")
    # FastAPI converts unhandled exception to 500
    assert resp.status_code == 500
    # Ensure middleware didn't log UnboundLocalError
    assert not any("UnboundLocalError" in r.message for r in caplog.records)
    # Optional: confirm access log style line present
    assert any("GET /boom 500" in r.message for r in caplog.records), "Expected access log entry for failing request"
