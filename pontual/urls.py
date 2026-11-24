from django.urls import path

from core import views

urlpatterns = [
    path("", views.home, name="home"),
    path("manifest.webmanifest", views.manifest, name="manifest"),
    path("service-worker.js", views.service_worker, name="service-worker"),
]
