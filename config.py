"""Top-level config shim.

Provides compatibility for imports like `from config import settings` when the
actual configuration module lives at `Backend/config.py`.

This mirrors the pattern used for the top-level `app` shim so that CI/test
runners (which invoke tools from the repository root without setting
PYTHONPATH) can still resolve configuration without altering workflows.
"""
from importlib import import_module as _imp

# Import the real Backend config module
_backend_config = _imp('Backend.config')

# Re-export its public API
Settings = getattr(_backend_config, 'Settings')
get_settings = getattr(_backend_config, 'get_settings')
settings = getattr(_backend_config, 'settings')

__all__ = ['Settings', 'get_settings', 'settings']
