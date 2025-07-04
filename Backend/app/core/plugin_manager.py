import os
import pkgutil
import importlib
from fastapi import FastAPI
from app.core.database import Base

from .database import engine

PLUGIN_FOLDER = os.path.join(os.path.dirname(__file__), "..", "plugins")
PLUGIN_PACKAGE = "app.plugins"


class PluginManager:
    def __init__(self, app: FastAPI):
        self.app = app
        # use centralized metadata from declarative Base
        self.metadata = Base.metadata

    def discover_plugins(self):
        """Dynamically import all plugins in the plugins folder."""
        for finder, name, ispkg in pkgutil.iter_modules([PLUGIN_FOLDER]):
            module_path = f"{PLUGIN_PACKAGE}.{name}.plugin"
            try:
                module = importlib.import_module(module_path)
            except ModuleNotFoundError:
                continue
            if hasattr(module, "Plugin"):
                yield module.Plugin()

    def register_models(self):
        """Call register_models on each plugin, then create all tables."""
        for plugin in self.discover_plugins():
            plugin.register_models(self.metadata)
        self.metadata.create_all(bind=engine)

    def register_routes(self):
        """Call register_routes on each plugin to include routers."""
        for plugin in self.discover_plugins():
            plugin.register_routes(self.app)
