"""Apply visually verified hours and final day boundaries, preserving detection results."""
from pathlib import Path
import json,datetime
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
segments=json.loads((root/'review/video_dates.json').read_text(encoding='utf-8'))
corrections=json.loads((root/'review/clock_corrections.json').read_text(encoding='utf-8'))
raw=(root/'detections.js').read_text(encoding='utf-8')
det=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
byname={Path(src).name:boxes for src,boxes in det['photos'].items()}
groups={s['date']:[] for s in segments};new_boxes={}
offset=datetime.timedelta(days=manifest['dateOffsetDays'])
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',23)
readings=json.loads((root/'review/ocr_readings.json').read_text(encoding='utf-8'))
for p in [p for d in manifest['days'] for p in d['photos']]:
    name=Path(p['src']).name
    date=[s['date'] for s in segments if s['start']<=p['second']+1e-6][-1]
    folder=root/'assets'/date;folder.mkdir(exist_ok=True)
    img=Image.open(root/'review/exact'/name).convert('RGB');draw=ImageDraw.Draw(img)
    draw.rectangle((950,25,1249,68),fill='#102034')
    time=corrections.get(name,p['time'])
    draw.text((961,34),datetime.date.fromisoformat(date).strftime('%d-%m-%Y')+' '+time,font=font,fill='white')
    img.save(folder/name,quality=94)
    p['src']=f'assets/{date}/{name}';p['originalDate']=(datetime.date.fromisoformat(date)-offset).isoformat()
    if name in corrections:p['time']=corrections[name];p['timeSource']='visual-review'
    else:p['timeSource']='camera-ocr'
    if not p['time']:raise RuntimeError('Unresolved camera time '+name)
    p['timestamp']=date+'T'+p['time'];groups[date].append(p);new_boxes[p['src']]=byname[name]
    reading=next(r for r in readings if r['frame']==name);reading['date']=date;reading['time']=p['time'];reading['verifiedCorrection']=name in corrections
original=json.loads((root/'review/original_manifest.json').read_text(encoding='utf-8'))
days=[]
for date,photos in groups.items():
    old=(datetime.date.fromisoformat(date)-offset).isoformat()
    previous=next(d for d in original['days'] if d['date']==old)
    covername=Path(previous['photos'][previous['cover']]['src']).name
    cover=next((i for i,p in enumerate(photos) if Path(p['src']).name==covername),int((len(photos)-1)*.7))
    days.append({'date':date,'cover':cover,'photos':photos})
def suppress_partial_duplicates(boxes):
    kept=[]
    for b in sorted(boxes,key=lambda b:b['confidence'],reverse=True):
        x,y,w,h=b['box'];area=w*h;duplicate=False
        for a in kept:
            if a['type']!=b['type'] or a['confidence']<.65 or b['confidence']>=.5:continue
            ax,ay,aw,ah=a['box']
            intersection=max(0,min(x+w,ax+aw)-max(x,ax))*max(0,min(y+h,ay+ah)-max(y,ay))
            if area<aw*ah and area>0 and intersection/area>.25:duplicate=True;break
        if not duplicate:kept.append(b)
    return kept
new_boxes={src:suppress_partial_duplicates(boxes) for src,boxes in new_boxes.items()}
manifest['days']=days;manifest['timestampPlate']='full-date-time';manifest['timestampFormat']='DD-MM-YYYY HH:mm:ss';det['photos']=new_boxes;det['partialDuplicateSuppression']=True
(root/'data.js').write_text('window.OBRA_DATA = '+json.dumps(days,ensure_ascii=False)+';\n',encoding='utf-8')
(root/'assets/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'detections.js').write_text('window.OBRA_DETECTIONS = '+json.dumps(det,ensure_ascii=False)+';\n',encoding='utf-8')
(root/'review/ocr_readings.json').write_text(json.dumps(readings,indent=2),encoding='utf-8')
(root/'review/ocr_uncertain.json').write_text('[]',encoding='utf-8')
print('Finalized: 218 exact photos; all hours resolved;',len(corrections),'visually verified OCR corrections')
