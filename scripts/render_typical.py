"""Render the approved PDFs, preserving source originals and recording hashes."""
from pathlib import Path
import hashlib
import json
import shutil
import pymupdf
from PIL import Image

repo = Path(__file__).resolve().parents[1]
source_dir = repo.parent / 'Typical section'
target = repo / 'assets' / 'typical'
target.mkdir(parents=True, exist_ok=True)
sources = {
    'thachin': 'ท่าจีน.pdf',
    'prachinburi': 'บ้านบึงกาฬ ปราจีน.pdf',
    'angthong': 'อ่างทอง.pdf',
    'nan': 'เเม่นำ้น่าน พิษณุโลก.pdf',
    'buengkan': 'เเม่นำ้ฮี้ บึงกาฬ.pdf',
}
manifest = []
for asset, filename in sources.items():
    path = source_dir / filename
    shutil.copyfile(path, target / f'{asset}.pdf')
    doc = pymupdf.open(path)
    manifest.append({'asset': asset, 'originalFile': filename, 'pages': len(doc),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'reviewedAt': '2026-10-01'})
    for number, page in enumerate(doc, 1):
        page.set_rotation(90)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(4, 4), alpha=False)
        image = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        image.save(target / f'{asset}-page-{number}.jpg', quality=93)
    print(f'{asset}: {len(doc)} pages; SHA256 {manifest[-1]["sha256"]}')
(target / 'source_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
