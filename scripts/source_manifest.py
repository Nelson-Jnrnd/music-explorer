"""Record expected bytes of this implementation's changed source files."""
import hashlib
import json
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
paths = sorted(set(subprocess.check_output(['git', 'ls-files', '-m', '-o', '--exclude-standard'], cwd=root, text=True).splitlines()))
manifest = root / 'docs/verification/SOURCE_MANIFEST.json'
entries = []
for name in paths:
    path = root / name
    if not path.is_file() or path == manifest:
        continue
    data = path.read_bytes()
    entries.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'intendedRef': 'feat/music-explorer-mvp', 'publication': 'verify reachable commit in PR handoff'})
manifest.write_text(json.dumps({'files': entries}, indent=2) + '\n')
print(f'Recorded {len(entries)} changed source files')
