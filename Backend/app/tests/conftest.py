"""Bridge fixtures from the primary backend test suite.

The admin capability tests live under ``Backend/app/tests`` for historical
reasons. Re-export the shared fixtures so that database initialization and
FastAPI dependency overrides remain consistent with the rest of the suite.
"""

from Backend.tests.conftest import *  # noqa: F401,F403
