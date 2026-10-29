"""Exercise npm's real production-audit gate against a synthetic advisory."""

import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class AdvisoryRegistry(BaseHTTPRequestHandler):
    advisory = False
    requests = []

    def do_GET(self):
        payload = json.dumps({
            "name": "pdfjs-dist",
            "versions": {
                "4.10.38": {"name": "pdfjs-dist", "version": "4.10.38"},
                "5.0.0": {"name": "pdfjs-dist", "version": "5.0.0"},
            },
            "dist-tags": {"latest": "5.0.0"},
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length)
        if self.headers.get("Content-Encoding") == "gzip":
            payload = gzip.decompress(payload)
        body = json.loads(payload)
        self.requests.append((self.path, body))
        result = {}
        if self.advisory and "pdfjs-dist" in body:
            result["pdfjs-dist"] = [{
                "id": 987654,
                "name": "pdfjs-dist",
                "title": "Synthetic test advisory",
                "url": "https://example.invalid/advisory",
                "severity": "high",
                "vulnerable_versions": "<5.0.0",
            }]
        payload = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass


class ShippedPdfAuditTest(unittest.TestCase):
    def test_high_advisory_blocks_the_production_audit(self):
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        self.assertIsNotNone(npm, "npm is required for the shipped-dependency gate")
        with tempfile.TemporaryDirectory(prefix="layers-audit-policy-") as folder:
            root = Path(folder)
            manifest = {"name": "layers-audit-fixture", "version": "1.0.0",
                        "dependencies": {"pdfjs-dist": "4.10.38"}}
            lock = {"name": manifest["name"], "version": "1.0.0", "lockfileVersion": 3,
                    "requires": True, "packages": {
                        "": manifest,
                        "node_modules/pdfjs-dist": {"version": "4.10.38"},
                    }}
            (root / "package.json").write_text(json.dumps(manifest), encoding="utf-8")
            (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")
            server = ThreadingHTTPServer(("127.0.0.1", 0), AdvisoryRegistry)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                registry = "http://127.0.0.1:" + str(server.server_port)
                command = [npm, "audit", "--omit=dev", "--audit-level=high", "--json",
                           "--registry=" + registry, "--ignore-scripts", "--fetch-retries=0",
                           "--cache=" + str(root / "cache")]
                AdvisoryRegistry.requests = []
                AdvisoryRegistry.advisory = False
                clean = subprocess.run(command, cwd=root, capture_output=True, text=True,
                                       timeout=45, shell=os.name == "nt")
                self.assertEqual(0, clean.returncode, clean.stderr + clean.stdout)
                self.assertTrue(any("pdfjs-dist" in body for _, body in AdvisoryRegistry.requests))

                AdvisoryRegistry.advisory = True
                blocked = subprocess.run(command, cwd=root, capture_output=True, text=True,
                                         timeout=45, shell=os.name == "nt")
                self.assertNotEqual(0, blocked.returncode, blocked.stderr + blocked.stdout)
                report = json.loads(blocked.stdout)
                self.assertEqual("high", report["vulnerabilities"]["pdfjs-dist"]["severity"])
            finally:
                server.shutdown()
                thread.join(timeout=5)
                server.server_close()


if __name__ == "__main__":
    unittest.main()
