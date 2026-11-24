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
        self.assertContains(response, "pontual-shell-v6")


class FeatureShellTests(TestCase):
    def test_home_has_diary_navigation_and_dialogs(self):
        response = self.client.get("/")

        self.assertContains(response, 'data-page="diary"')
        self.assertContains(response, 'id="diary-dialog"')
        self.assertContains(response, 'id="plan-dialog"')
        self.assertContains(response, "/static/core/lib.js")

    def test_theme_choice_lives_in_settings_not_in_the_header(self):
        response = self.client.get("/")

        self.assertNotContains(response, 'class="theme-switch"')

    def test_helper_library_is_served(self):
        response = self.client.get("/static/core/lib.js")

        self.assertEqual(response.status_code, 200)
        self.assertIn("javascript", response["Content-Type"])

    def test_manifest_declares_app_shortcuts(self):
        import json

        data = json.loads(self.client.get("/manifest.webmanifest").content)

        self.assertIn("/?page=diary", [item["url"] for item in data["shortcuts"]])

    def test_service_worker_precaches_the_helper_library(self):
        response = self.client.get("/service-worker.js")

        self.assertContains(response, "lib.js")
        self.assertContains(response, "notificationclick")
