from fastapi import FastAPI

from . import routes


class Plugin:
    name = "inventory"

    def register_models(self, metadata):  # no additional models
        return

    def register_routes(self, app: FastAPI):
        app.include_router(routes.router, prefix="/api/inventory")
