"""Extract source frames at their true video times and regroup by real date transitions."""
from pathlib import Path
import sys,json,datetime,re
sys.path.insert(0,str(Path(__file__).parent/'runtime'))
from build_media import ROOT, DELTA, detector, detect_with_tiles
from rapidocr_onnxruntime import RapidOCR
import cv2
from PIL import Image,ImageDraw,ImageFont

original=json.loads((ROOT/'review/original_manifest.json').read_text(encoding='utf-8'))
segments=json.loads((ROOT/'review/video_dates.json').read_text(encoding='utf-8'))
session=detector();ocr=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',23)
cap=cv2.VideoCapture(str(ROOT/original['source']));fps=cap.get(cv2.CAP_PROP_FPS)
groups={s['date']:[] for s in segments};detections={};uncertain=[];readings=[]
for index,p in enumerate([p for d in original['days'] for p in d['photos']]):
    second=p['second'];frame_n=round(second*fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES,frame_n);ok,bgr=cap.read()
    if not ok:raise RuntimeError(f'Missing source frame {frame_n}')
    date=[s['date'] for s in segments if s['start']<=second+1e-6][-1]
    old=(datetime.date.fromisoformat(date)-DELTA).isoformat()
    result,_=ocr(bgr[28:66,1120:1245],use_det=False,use_cls=False,use_rec=True)
    raw=' '.join(r[0] for r in result) if result else ''
    match=re.search(r'(\d{2})[:：.\-](\d{2})[:：.\-](\d{2})$',raw.replace(' ',''))
    time=':'.join(match.groups()) if match else None
    if time and not(int(time[:2])<24 and int(time[3:5])<60 and int(time[6:])<60):time=None
    if not time:
        result,_=ocr(cv2.resize(bgr[28:66,1120:1245],None,fx=3,fy=3),use_det=False,use_cls=False,use_rec=True)
        retry=' '.join(r[0] for r in result) if result else ''
        match=re.search(r'(\d{2})[:：.\-](\d{2})[:：.\-](\d{2})$',retry.replace(' ',''))
        time=':'.join(match.groups()) if match else None
        raw+=' | '+retry
    name=Path(p['src']).name
    if not time:uncertain.append({'frame':name,'second':second,'ocr':raw})
    readings.append({'frame':name,'date':date,'second':second,'time':time,'ocr':raw})
    exact=ROOT/'review/exact';exact.mkdir(exist_ok=True)
    cv2.imwrite(str(exact/name),bgr,[cv2.IMWRITE_JPEG_QUALITY,97])
    folder=ROOT/'assets'/date;folder.mkdir(exist_ok=True)
    img=Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB));draw=ImageDraw.Draw(img)
    # Keep the original time pixels, exactly as in the adapted video.
    draw.rectangle((950,25,1117,68),fill='#102034')
    draw.text((961,34),datetime.date.fromisoformat(date).strftime('%d-%m-%Y'),font=font,fill='white')
    img.save(folder/name,quality=94)
    photo={'src':f'assets/{date}/{name}','second':second,'time':time,'timestamp':date+'T'+time if time else None,'originalDate':old,'sourceFrame':frame_n}
    groups[date].append(photo);detections[photo['src']]=detect_with_tiles(session,bgr)
    if index%15==0:print(index+1,'/ 218',date,time,flush=True)
cap.release()
days=[]
for date,photos in groups.items():
    if not photos:raise RuntimeError('Missing date '+date)
    old=(datetime.date.fromisoformat(date)-DELTA).isoformat()
    previous=next(d for d in original['days'] if d['date']==old)
    covername=Path(previous['photos'][previous['cover']]['src']).name
    cover=next((i for i,p in enumerate(photos) if Path(p['src']).name==covername),int((len(photos)-1)*.7))
    days.append({'date':date,'cover':cover,'photos':photos})
(ROOT/'data.js').write_text('window.OBRA_DATA = '+json.dumps(days,ensure_ascii=False)+';\n',encoding='utf-8')
(ROOT/'detections.js').write_text('window.OBRA_DETECTIONS = '+json.dumps({'model':'YOLOX-s COCO','threshold':.35,'status':'proposals','photos':detections},ensure_ascii=False)+';\n',encoding='utf-8')
(ROOT/'assets/manifest.json').write_text(json.dumps({'source':'obra-demo-2026.mp4','originalSource':original['source'],'adapted':True,'dateOffsetDays':DELTA.days,'method':'Capturas exactas cada 0.5 s de video, agrupadas por las transiciones de fecha originales; fechas adaptadas para demo, horas originales de cámara.','days':days},ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'review/ocr_uncertain.json').write_text(json.dumps(uncertain,indent=2),encoding='utf-8')
(ROOT/'review/ocr_readings.json').write_text(json.dumps(readings,indent=2),encoding='utf-8')
print('DONE:',len(days),'days;',sum(len(p) for p in groups.values()),'photos;',len(uncertain),'uncertain hours;',sum(len(b) for b in detections.values()),'proposals',flush=True)
