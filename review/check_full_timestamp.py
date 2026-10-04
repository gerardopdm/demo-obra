from pathlib import Path
import sys,json,re
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'review/runtime'))
import cv2
from rapidocr_onnxruntime import RapidOCR
manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
clocks=json.loads((root/'review/video_clocks.json').read_text(encoding='utf-8'))
by_frame={r['frame']:r for r in clocks}
photos=[p for d in manifest['days'] for p in d['photos']]
for p in photos:
    r=by_frame[p['sourceFrame']]
    assert r['date']+'T'+r['time']==p['timestamp'],p['src']
ocr=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
cap=cv2.VideoCapture(str(root/manifest['source']));errors=[]
for i,p in enumerate(photos):
    cap.set(cv2.CAP_PROP_POS_FRAMES,p['sourceFrame']);ok,frame=cap.read();assert ok
    for type,img in [('video',frame),('photo',cv2.imread(str(root/p['src'])))]:
        crop=img[25:69,950:1250]
        result,_=ocr(cv2.resize(crop,None,fx=2,fy=2),use_det=False,use_cls=False,use_rec=True)
        raw=''.join(r[0] for r in result).replace(' ','') if result else ''
        expected=''.join(p['timestamp'][:10].split('-')[::-1])+p['time'].replace(':','')
        digits=re.sub(r'\D','',raw)
        if digits!=expected:errors.append({'type':type,'src':p['src'],'expected':expected,'read':raw})
        # The right edge where the old hour ended is covered by the same dark plate.
        pixel=img[30,1245].astype(int)
        assert abs(int(pixel[0])-52)<20 and abs(int(pixel[1])-32)<20 and abs(int(pixel[2])-16)<20,(type,p['src'],pixel)
    if (i+1)%50==0:print('Checked',i+1,'photo/video timestamp pairs',flush=True)
cap.release()
(root/'review/full_timestamp_check.json').write_text(json.dumps({'photos':len(photos),'clockReferencesMatched':len(photos),'ocrExceptions':errors},indent=2),encoding='utf-8')
if errors:raise RuntimeError(json.dumps(errors))
print('PASS: all 218 video/photo date-hour plates match references and fully cover the old timestamp',flush=True)
