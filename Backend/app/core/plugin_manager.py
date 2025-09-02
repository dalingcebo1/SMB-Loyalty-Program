import os
import pkgutil
import importlib
from fastapi import FastAPI
from typing import Protocol, runtime_checkable
from app.core.database import Base

from .database import engine
from app.plugins.admin.routes import router as admin_router

PLUGIN_FOLDER = os.path.join(os.path.dirname(__file__), "..", "plugins")
PLUGIN_PACKAGE = "app.plugins"


@runtime_checkable
class PluginProtocol(Protocol):  # Phase 1 formal contract
    name: str
    def register_models(self, metadata): ...  # pragma: no cover - interface only
    def register_routes(self, app: FastAPI): ...  # pragma: no cover


class PluginManager:
    def __init__(self, app: FastAPI):
        self.app = app
        # use centralized metadata from declarative Base
        self.metadata = Base.metadata

    def discover_plugins(self):
        """Dynamically import all plugins in the plugins folder.

        Returns only modules exposing a Plugin class implementing PluginProtocol.
        """
        for finder, name, ispkg in pkgutil.iter_modules([PLUGIN_FOLDER]):
            module_path = f"{PLUGIN_PACKAGE}.{name}.plugin"
            try:
                module = importlib.import_module(module_path)
            except ModuleNotFoundError:
                continue
            if hasattr(module, "Plugin"):
                inst = module.Plugin()
                if isinstance(inst, PluginProtocol):
                    yield inst

    def register_models(self):
        """Call register_models on each plugin, then create all tables."""
        for plugin in self.discover_plugins():
            plugin.register_models(self.metadata)
        self.metadata.create_all(bind=engine)

    def register_routes(self):
        """Call register_routes on each plugin to include routers and include standalone routers."""
        for plugin in self.discover_plugins():
            plugin.register_routes(self.app)
        # direct include for simple admin router (non plugin class yet)
        self.app.include_router(admin_router, prefix="/api")
