#!/usr/bin/env python3
"""Build a Layers source package from an explicitly selected Git commit.

This is a release-engineering tool, not an extension runtime dependency. It
omits historical acceptance evidence and makes its old documentation links
readable without linking to files absent from the package.
"""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = 'Layers/docs/acceptance/'
EVIDENCE_LINK = re.compile(rb'\[([^\]\n]+)\]\(acceptance/[^)\n]+\)')
UNHANDLED_LINK = re.compile(rb'\]\((?:\.\./)*acceptance/[^)\n]+\)')
OMITTED_NOTICE = rb'\1 (historical test evidence omitted from this package)'
PRIVATE_DIRS = frozenset({'tmp', 'acceptance', 'vendor', 'node_modules', '.git', '.codex', '.agents'})
PRIVATE_FILES = frozenset({'localsettings.php', 'nativesettings.php', 'generatedsettings.php',
                           'layers.log', 'database.env', '.env'})


def make_package(commit, output):
    """Write one archive, refusing to overwrite files or include unsafe paths."""
    resolved = subprocess.check_output(
        ['git', '-c', 'core.fsmonitor=false', 'rev-parse', '--verify', commit + '^{commit}'],
        cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()
    git_root = subprocess.check_output(
        ['git', '-c', 'core.fsmonitor=false', 'rev-parse', '--show-toplevel'],
        cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()
    output = Path(output).resolve()
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    process = None
    omitted, rewritten, included = [], {}, 0
    try:
        process = subprocess.Popen(
            ['git', '-c', 'core.fsmonitor=false', 'archive', '--format=tar', '--prefix=Layers/', resolved],
            cwd=git_root, stdout=subprocess.PIPE)
        with os.fdopen(fd, 'wb') as destination:
            fd = None
            with tarfile.open(fileobj=process.stdout, mode='r|') as source, \
                    tarfile.open(fileobj=destination, mode='w') as target:
                for item in source:
                    parts = PurePosixPath(item.name).parts
                    if not parts or parts[0] != 'Layers' or '..' in parts:
                        raise ValueError('Unexpected archive path: ' + item.name)
                    if item.name == EVIDENCE.rstrip('/') or item.name.startswith(EVIDENCE):
                        if item.isfile():
                            omitted.append(item.name)
                        continue
                    relative = parts[1:]
                    directories = relative if item.isdir() else relative[:-1]
                    if relative and (any(part.lower() in PRIVATE_DIRS for part in directories) or
                                     relative[-1].lower() in PRIVATE_FILES):
                        raise ValueError('Local or generated file in source commit: ' + item.name)
                    if item.isdir():
                        target.addfile(item)
                        continue
                    if not item.isfile():
                        raise ValueError('Non-regular source file: ' + item.name)
                    content = source.extractfile(item).read()
                    if len(relative) == 2 and relative[0] == 'docs' and relative[1].endswith('.md'):
                        content, count = EVIDENCE_LINK.subn(OMITTED_NOTICE, content)
                        if count:
                            rewritten['/'.join(relative)] = count
                    if relative and relative[-1].endswith('.md') and UNHANDLED_LINK.search(content):
                        raise ValueError('Unresolved evidence link in ' + item.name)
                    item.size = len(content)
                    target.addfile(item, io.BytesIO(content))
                    included += 1
            # tarfile may stop at the end markers before Git finishes its padding.
            while process.stdout.read(65536):
                pass
        process.stdout.close()
        if process.wait() != 0:
            raise RuntimeError('git archive failed')
        if included == 0:
            raise ValueError('Refusing to publish an empty source package')
    except BaseException:
        if fd is not None:
            os.close(fd)
        if process is not None:
            process.stdout.close()
            process.wait()
        output.unlink(missing_ok=True)
        raise
    digest = hashlib.sha256()
    with output.open('rb') as package:
        for block in iter(lambda: package.read(1024 * 1024), b''):
            digest.update(block)
    return {'commit': resolved, 'archive': str(output), 'sha256': digest.hexdigest(),
            'included_files': included, 'omitted_evidence': omitted, 'rewritten_links': rewritten}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True, help='Reviewed Git commit or tag')
    parser.add_argument('--output', required=True, help='New tar archive path; never overwritten')
    args = parser.parse_args()
    try:
        print(json.dumps(make_package(args.commit, args.output), indent=2))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print('Release package refused: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
