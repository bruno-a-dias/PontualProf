from pathlib import Path

from django.http import HttpResponse
from django.shortcuts import render

BASE_DIR = Path(__file__).resolve().parent.parent


def home(request):
    return render(request, "core/index.html")


def manifest(request):
    content = (BASE_DIR / "static" / "core" / "manifest.webmanifest").read_text(
        encoding="utf-8"
    )
    return HttpResponse(content, content_type="application/manifest+json")


def service_worker(request):
    content = (BASE_DIR / "static" / "core" / "service-worker.js").read_text(
        encoding="utf-8"
    )
    response = HttpResponse(content, content_type="application/javascript")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response
