"""Boundary regressions for the HTTP harness; no wiki or server required."""
import importlib.util
from pathlib import Path
import unittest
import urllib.request

spec = importlib.util.spec_from_file_location(
    "layers_http", Path(__file__).with_name("test-page-owned-http.py"))
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)


class HttpHarnessBoundaries(unittest.TestCase):
    def test_exact_bootstrap_value(self):
        self.assertEqual(harness.parse_bootstrap_config(
            '{"wgLayersEditorInit": {"owner":"世界"},"other":{}}'), {"owner": "世界"})
        self.assertIsNone(harness.parse_bootstrap_config('{"other":{}}'))
        for value in ('null,"other":{}', '[],"other":{}', 'broken,"other":{}',
                      '{}junk', '{', '{},"wgLayersEditorInit":{}'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                harness.parse_bootstrap_config('{"wgLayersEditorInit":' + value + '}')

    def test_confinement_and_redacted_errors(self):
        host = '127.0.0.1:12345'
        harness.require_loopback_url('http://' + host + '/index.php', host)
        for url in ('https://' + host, 'http://localhost:12345',
                    'http://127.0.0.1:12346', 'file:///private',
                    'http://credential@' + host + '/?token=secret'):
            with self.subTest(url=url), self.assertRaisesRegex(
                    RuntimeError, '^Request or redirect escaped disposable loopback server$'):
                harness.require_loopback_url(url, host)

    def test_redirect_checked_before_dispatch(self):
        handler = harness.LoopbackRedirectHandler('127.0.0.1:12345')
        request = urllib.request.Request('http://127.0.0.1:12345/index.php')
        redirected = handler.redirect_request(request, None, 302, '', {}, '/safe')
        self.assertEqual(redirected.full_url, 'http://127.0.0.1:12345/safe')
        with self.assertRaises(RuntimeError):
            handler.redirect_request(request, None, 302, '', {}, 'https://127.0.0.1:12345/')


if __name__ == '__main__':
    unittest.main()
