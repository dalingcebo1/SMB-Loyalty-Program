"""Backend package marker.

This file makes the Backend directory a proper Python package so tests and
application code can reliably use absolute imports like `import Backend` or
`from Backend import main` regardless of pytest's chosen rootdir.
"""

__all__ = []
