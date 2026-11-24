from django.test import TestCase


class PwaViewsTests(TestCase):
    def test_home_serves_application_shell(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Pontual")
        self.assertContains(response, "Seus dados ficam neste dispositivo")
        self.assertContains(response, "/static/core/app.js")

    def test_manifest_has_pwa_content_type(self):
        response = self.client.get("/manifest.webmanifest")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/manifest+json")

    def test_service_worker_can_control_the_application_root(self):
        response = self.client.get("/service-worker.js")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Service-Worker-Allowed"], "/")
        self.assertContains(response, "pontual-shell-v4")
