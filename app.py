"""Vercel entrypoint: exposes the Django WSGI application as ``app``."""

from pontual.wsgi import application as app  # noqa: F401
