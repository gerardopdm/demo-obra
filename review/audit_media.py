"""Audit image/video references against exact source frames and original camera dates."""
from pathlib import Path
import sys,json,re
sys.path.insert(0,str(Path(__file__).parent/'runtime'))
import cv2,numpy as np
from rapidocr_onnxruntime import RapidOCR
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
ocr=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
cap=cv2.VideoCapture(str(root/manifest['source']));fps=cap.get(cv2.CAP_PROP_FPS)
errors=[];unreadable=[];photo_count=0
for d in manifest['days']:
    assert d['date'].startswith('2026-')
    assert 0<=d['cover']<len(d['photos'])
    for p in d['photos']:
        photo_count+=1
        bgr=cv2.imread(str(root/'review/exact'/Path(p['src']).name))
        if bgr is None:raise RuntimeError('Missing exact source '+p['src'])
        result,_=ocr(bgr[28:66,960:1118],use_det=False,use_cls=False,use_rec=True)
        raw=' '.join(r[0] for r in result) if result else ''
        match=re.search(r'(\d{2})[-:.]?(\d{2})[-:.]?(20\d{2})',raw.replace(' ',''))
        if not match:unreadable.append({'src':p['src'],'raw':raw})
        else:
            date=f'{match[3]}-{match[2]}-{match[1]}'
            if date!=p['originalDate']:errors.append({'src':p['src'],'expected':p['originalDate'],'cameraDate':date,'raw':raw})
        cap.set(cv2.CAP_PROP_POS_FRAMES,round(p['second']*fps));ok,frame=cap.read()
        if not ok:raise RuntimeError('Video frame missing')
        # Adapted source video and exact JPEG should show the same scene and camera time.
        for name,region in [('scene',(slice(100,700),slice(0,1280))),('clock',(slice(28,66),slice(1120,1245)))]:
            if name=='clock' and manifest.get('timestampPlate')=='full-date-time':continue
            difference=np.abs(frame[region].astype(float)-bgr[region].astype(float)).mean()
            if difference>12:errors.append({'src':p['src'],'region':name,'difference':float(difference)})
    print(d['date'],'audited',len(d['photos']),flush=True)
cap.release()
report={'photos':photo_count,'days':len(manifest['days']),'errors':errors,'unreadableDates':unreadable}
(root/'review/media_audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
if errors:raise RuntimeError(json.dumps(errors))
print('PASS:',photo_count,'image/video references;',len(unreadable),'date OCR readings need visual review',flush=True)
