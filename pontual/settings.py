import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

ON_VERCEL = bool(os.environ.get("VERCEL"))

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-pontual-development-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "0" if ON_VERCEL else "1") == "1"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", ".vercel.app"]
ALLOWED_HOSTS += [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h]
CSRF_TRUSTED_ORIGINS = ["https://*.vercel.app"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "pontual.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [],
        },
    },
]

WSGI_APPLICATION = "pontual.wsgi.application"
ASGI_APPLICATION = "pontual.asgi.application"

# No business data is stored by Django. The transient database satisfies
# framework checks without creating a persistent server-side database.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
# Serve static files straight from STATICFILES_DIRS (no collectstatic needed),
# which keeps serverless deployments such as Vercel working.
WHITENOISE_USE_FINDERS = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
