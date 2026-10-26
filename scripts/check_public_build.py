"""Reject data files and accidental credentials in the static deployment artifact."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1] / 'dist'
assert root.is_dir(), 'Build dist first'
for path in root.rglob('*'):
    if not path.is_file():
        continue
    assert path.suffix in {'.html', '.js', '.css'}, f'Unexpected public artifact: {path.name}'
    content = path.read_text()
    assert not re.search(r'"(?:access_token|refresh_token)"\s*:\s*"[A-Za-z0-9_-]{20,}"', content), f'Credential in {path.name}'
    assert not re.search(r'spotify:track:[A-Za-z0-9]{22}', content), f'Private track data in {path.name}'
print('PASS: dist contains application code only; no data files or token literals')
