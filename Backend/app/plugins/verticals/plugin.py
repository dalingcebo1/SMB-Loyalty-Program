from fastapi import FastAPI
from sqlalchemy import MetaData
from app.core.plugin_manager import PluginProtocol

class Plugin:  # registers vertical stubs collectively (meta plugin)
    name = "verticals"

    def register_models(self, metadata: MetaData):
        # No models; purely behavioral
        pass

    def register_routes(self, app: FastAPI):
        # Hook registrations moved to vertical modules via the registry
        # (see app.verticals.*.module.compute_loyalty_earn / decorate_tenant_meta).
        pass
