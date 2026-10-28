import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_package', ROOT / 'scripts/build-release-package.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def source_tar(entries):
    data = io.BytesIO()
    with tarfile.open(fileobj=data, mode='w') as archive:
        for name, content in entries:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return data.getvalue()


class FakeGit:
    def __init__(self, entries, code=0):
        self.stdout = io.BytesIO(source_tar(entries))
        self.code = code

    def wait(self):
        return self.code


class ReleasePackageTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.output = Path(self.directory.name) / 'candidate.tar'

    def build(self, entries, code=0):
        with mock.patch.object(builder.subprocess, 'check_output', return_value='a' * 40 + '\n'), \
                mock.patch.object(builder.subprocess, 'Popen', return_value=FakeGit(entries, code)):
            return builder.make_package('reviewed', self.output)

    def test_excludes_evidence_and_preserves_runtime_bytes(self):
        result = self.build([
            ('Layers/docs/acceptance/evidence.zip', b'private evidence'),
            ('Layers/docs/history.md', b'See [archive](acceptance/evidence.zip).'),
            ('Layers/resources/example.js', b'unchanged runtime'),
        ])
        with tarfile.open(self.output) as archive:
            self.assertEqual(archive.getnames(), ['Layers/docs/history.md', 'Layers/resources/example.js'])
            self.assertEqual(archive.extractfile('Layers/resources/example.js').read(), b'unchanged runtime')
            self.assertIn(b'historical test evidence omitted from this package',
                          archive.extractfile('Layers/docs/history.md').read())
        self.assertEqual(result['rewritten_links'], {'docs/history.md': 1})
        self.assertEqual(len(result['omitted_evidence']), 1)

    def test_refuses_to_overwrite(self):
        self.output.write_bytes(b'original')
        with self.assertRaises(FileExistsError):
            self.build([])
        self.assertEqual(self.output.read_bytes(), b'original')

    def test_refuses_private_paths_and_removes_incomplete_output(self):
        with self.assertRaises(ValueError):
            self.build([('Layers/LocalSettings.php', b'configuration')])
        self.assertFalse(self.output.exists())

    def test_refuses_nested_temporary_data(self):
        with self.assertRaises(ValueError):
            self.build([('Layers/docs/tmp/fixture.log', b'local evidence')])
        self.assertFalse(self.output.exists())

    def test_refuses_archive_path_traversal(self):
        with self.assertRaises(ValueError):
            self.build([('Layers/../outside', b'data')])
        self.assertFalse(self.output.exists())

    def test_refuses_unhandled_evidence_links(self):
        with self.assertRaises(ValueError):
            self.build([('Layers/docs/sub/page.md', b'[evidence](../acceptance/evidence.zip)')])
        self.assertFalse(self.output.exists())

    def test_git_failure_does_not_leave_an_archive(self):
        with self.assertRaises(RuntimeError):
            self.build([('Layers/extension.json', b'{}')], code=1)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
