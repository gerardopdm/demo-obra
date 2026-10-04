from pathlib import Path
import json,zipfile
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
files=['index.html','supervision.html','construction.html','styles.css','supervision.css','construction.css','app.js','supervision.js','construction.js','construction-data.js','data.js','detections.js','README.md','assets/manifest.json','obra-demo-2026.mp4']
files += [p['src'] for d in manifest['days'] for p in d['photos']]
with zipfile.ZipFile(root/'bitacora-obra.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in files: archive.write(root/file,file)
with zipfile.ZipFile(root/'bitacora-obra.zip') as archive:
    assert archive.testzip() is None
    assert len([n for n in archive.namelist() if n.endswith('.jpg')])==218
print('Updated demo package:',len(files),'files;',round((root/'bitacora-obra.zip').stat().st_size/1024/1024,1),'MB')
