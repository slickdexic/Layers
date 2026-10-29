"""Run actual independent PHP processes against one PDF cache target."""

from pathlib import Path
import subprocess
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "tests" / "release" / "fixtures" / "atomic_pdf_worker.php"


class AtomicPdfConcurrencyTest(unittest.TestCase):
    def test_failed_overlapping_render_cannot_expose_or_replace_partial_pdf(self):
        with tempfile.TemporaryDirectory(prefix="layers-pdf-concurrent-") as folder:
            root = Path(folder)
            target = root / "export.pdf"
            workers = []
            try:
                for name, outcome in (("good", "success"), ("bad", "failure")):
                    workers.append(subprocess.Popen(
                        ["php", str(WORKER), str(ROOT), folder, name, outcome],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                    ))
                deadline = time.monotonic() + 15
                while not all((root / ("ready-" + name)).is_file() for name in ("good", "bad")):
                    if any(worker.poll() is not None for worker in workers):
                        self.fail("A renderer stopped before both partial files were ready")
                    if time.monotonic() >= deadline:
                        self.fail("Timed out waiting for concurrent renderers")
                    time.sleep(0.01)

                self.assertFalse(target.exists(), "Partial renders must not be exposed")
                (root / "go-good").touch()
                stdout, stderr = workers[0].communicate(timeout=15)
                self.assertEqual((0, "published"), (workers[0].returncode, stdout), stderr)
                expected = b"%PDF-1.7\ncomplete-good\n%%EOF\n"
                self.assertEqual(expected, target.read_bytes())

                (root / "go-bad").touch()
                stdout, stderr = workers[1].communicate(timeout=15)
                self.assertEqual((0, "refused"), (workers[1].returncode, stdout), stderr)
                self.assertEqual(expected, target.read_bytes())
                self.assertEqual([], list(root.glob(".layers-pdf-*")))
            finally:
                for worker in workers:
                    if worker.poll() is None:
                        worker.kill()
                        worker.communicate(timeout=5)

    def test_overlapping_successful_renders_expose_only_complete_output(self):
        with tempfile.TemporaryDirectory(prefix="layers-pdf-concurrent-") as folder:
            root = Path(folder)
            target = root / "export.pdf"
            valid = {b"%PDF-1.7\ncomplete-one\n%%EOF\n", b"%PDF-1.7\ncomplete-two\n%%EOF\n"}
            workers = []
            try:
                for name in ("one", "two"):
                    workers.append(subprocess.Popen(
                        ["php", str(WORKER), str(ROOT), folder, name, "success"],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                    ))
                deadline = time.monotonic() + 15
                while not all((root / ("ready-" + name)).is_file() for name in ("one", "two")):
                    if any(worker.poll() is not None for worker in workers):
                        self.fail("A renderer stopped before both partial files were ready")
                    if time.monotonic() >= deadline:
                        self.fail("Timed out waiting for concurrent renderers")
                    time.sleep(0.01)
                self.assertFalse(target.exists())
                for name in ("one", "two"):
                    (root / ("go-" + name)).touch()
                while any(worker.poll() is None for worker in workers):
                    if target.is_file():
                        self.assertIn(target.read_bytes(), valid)
                    if time.monotonic() >= deadline:
                        self.fail("Timed out waiting for concurrent publication")
                    time.sleep(0.001)
                outcomes = []
                for worker in workers:
                    stdout, stderr = worker.communicate(timeout=5)
                    self.assertEqual(0, worker.returncode, stderr)
                    self.assertIn(stdout, {"published", "refused"})
                    outcomes.append(stdout)
                self.assertIn("published", outcomes)
                self.assertIn(target.read_bytes(), valid)
                self.assertEqual([], list(root.glob(".layers-pdf-*")))
            finally:
                for worker in workers:
                    if worker.poll() is None:
                        worker.kill()
                        worker.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main()
