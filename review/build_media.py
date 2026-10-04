"""Build adapted demonstration media and per-photo AI proposals from the original."""
from pathlib import Path
import sys, json, re, datetime, subprocess
sys.path.insert(0, str(Path(__file__).parent / 'runtime'))
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFont
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
DELTA = datetime.date(2026,9,2) - datetime.date(2020,12,2)
def new_date(old):
    return (datetime.date.fromisoformat(old)+DELTA).isoformat()

def detector():
    opts=ort.SessionOptions(); opts.intra_op_num_threads=2
    return ort.InferenceSession(str(ROOT/'review/yolox_s.onnx'), sess_options=opts, providers=['CPUExecutionProvider'])

def detect(session, bgr):
    h,w=bgr.shape[:2]; size=session.get_inputs()[0].shape[-1]; ratio=min(size/h,size/w)
    resized=cv2.resize(bgr,(int(w*ratio),int(h*ratio)))
    padded=np.full((size,size,3),114,dtype=np.uint8);padded[:resized.shape[0],:resized.shape[1]]=resized
    pred=session.run(None,{session.get_inputs()[0].name:padded.transpose(2,0,1)[None].astype(np.float32)})[0][0]
    grids=[];steps=[]
    for stride in [8,16,32]:
        y,x=np.meshgrid(np.arange(size//stride),np.arange(size//stride),indexing='ij')
        grids.append(np.stack([x,y],axis=-1).reshape(-1,2));steps.append(np.full((x.size,1),stride))
    grid=np.concatenate(grids);step=np.concatenate(steps)
    pred[:,:2]=(pred[:,:2]+grid)*step;pred[:,2:4]=np.exp(pred[:,2:4])*step
    results=[]
    for cls,label in [(0,'person'),(7,'truck')]:
        scores=pred[:,4]*pred[:,5+cls]; idx=np.where(scores>=.35)[0]
        boxes=[];conf=[]
        for i in idx:
            cx,cy,bw,bh=pred[i,:4]/ratio
            x1=max(0,float(cx-bw/2));y1=max(0,float(cy-bh/2))
            x2=min(w,float(cx+bw/2));y2=min(h,float(cy+bh/2))
            boxes.append([x1,y1,max(0,x2-x1),max(0,y2-y1)]);conf.append(float(scores[i]))
        if boxes:
            for j in np.array(cv2.dnn.NMSBoxes(boxes,conf,.35,.45)).flatten():
                box=boxes[j]
                results.append({'id':f'{label}-{len(results)+1}','type':label,'confidence':round(conf[j],3),'box':[round(box[0]/w,5),round(box[1]/h,5),round(box[2]/w,5),round(box[3]/h,5)],'source':'ai'})
    return results

def detect_with_tiles(session,bgr):
    results=detect(session,bgr)
    h,w=bgr.shape[:2]
    for x0,x1 in [(0,800),(480,1280)]:
        y0=180
        for box in detect(session,bgr[y0:h,x0:x1]):
            x,y,bw,bh=box['box']
            box['box']=[(x0+x*(x1-x0))/w,(y0+y*(h-y0))/h,bw*(x1-x0)/w,bh*(h-y0)/h]
            results.append(box)
    filtered=[]
    for type in ['person','truck']:
        group=[r for r in results if r['type']==type]
        if not group: continue
        xywh=[r['box'] for r in group];scores=[r['confidence'] for r in group]
        # Pixel coordinates avoid integer truncation in OpenCV NMS.
        indices=np.array(cv2.dnn.NMSBoxes([[b[0]*w,b[1]*h,b[2]*w,b[3]*h] for b in xywh],scores,.35,.45)).flatten()
        for i in indices:
            r=group[i];r['id']=f'{type}-{len(filtered)+1}';r['box']=[round(v,5) for v in r['box']];filtered.append(r)
    return filtered

def main():
    manifest=json.loads((ROOT/'assets/manifest.json').read_text(encoding='utf-8'))
    if manifest.get('adapted'):
        manifest=json.loads((ROOT/'review/original_manifest.json').read_text(encoding='utf-8'))
    else:
        (ROOT/'review/original_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    session=detector();ocr=RapidOCR(det_use_cuda=False,rec_use_cuda=False,intra_op_num_threads=2,inter_op_num_threads=2)
    font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',23)
    all_detections={};days=[];uncertain=[]
    for day in manifest['days']:
        date=new_date(day['date']);folder=ROOT/'assets'/date;folder.mkdir(exist_ok=True)
        photos=[]
        for p in day['photos']:
            name=Path(p['src']).name
            original=ROOT/'review'/name
            bgr=cv2.imread(str(original))
            result,_=ocr(bgr[28:66,960:1245],use_det=False,use_cls=False,use_rec=True)
            raw=' '.join(r[0] for r in result) if result else ''
            match=re.search(r'(\d{2})[:：.\-](\d{2})[:：.\-](\d{2})$',raw.replace(' ',''))
            time=':'.join(match.groups()) if match else None
            # Visually verified against the original frame after OCR failed.
            if name=='frame_0102.jpg': time='13:09:44'
            if time and not (int(time[:2])<24 and int(time[3:5])<60 and int(time[6:])<60): time=None
            if not time: uncertain.append({'frame':name,'ocr':raw})
            img=Image.open(original).convert('RGB');draw=ImageDraw.Draw(img)
            # Date is adapted; original camera time stays visible if OCR is uncertain.
            draw.rectangle((950,25,1246 if time else 1117,69),fill='#102034')
            label=datetime.date.fromisoformat(date).strftime('%d-%m-%Y')+((' '+time) if time else '')
            draw.text((961,34),label,font=font,fill='white')
            img.save(folder/name,quality=94)
            photo={**p,'src':f'assets/{date}/{name}','time':time,'timestamp':date+'T'+time if time else None,'originalDate':day['date']}
            photos.append(photo)
            all_detections[photo['src']]=detect_with_tiles(session,bgr)
        days.append({'date':date,'cover':day['cover'],'photos':photos})
        print(date,'processed',len(photos),flush=True)
    (ROOT/'review/ocr_uncertain.json').write_text(json.dumps(uncertain,indent=2),encoding='utf-8')
    (ROOT/'data.js').write_text('window.OBRA_DATA = '+json.dumps(days,ensure_ascii=False)+';\n',encoding='utf-8')
    (ROOT/'detections.js').write_text('window.OBRA_DETECTIONS = '+json.dumps({'model':'YOLOX-s COCO','threshold':.35,'status':'proposals','photos':all_detections},ensure_ascii=False)+';\n',encoding='utf-8')
    adapted={**manifest,'source':'obra-demo-2026.mp4','originalSource':manifest['source'],'adapted':True,'dateOffsetDays':DELTA.days,'method':'Fechas adaptadas para demostración. Hora original de cámara leída con OCR; tiempos no legibles se indican como pendientes. Muestreo cada 0.5 s de video.','days':days}
    (ROOT/'assets/manifest.json').write_text(json.dumps(adapted,ensure_ascii=False,indent=2),encoding='utf-8')
    if '--photos-only' in sys.argv:
        print('Photos and detections complete;',len(uncertain),'uncertain hours',flush=True)
        return
    # Change only the date in the video: the source time remains exact on every frame.
    # Determine actual date transitions rather than assuming half-second sample boundaries.
    cap=cv2.VideoCapture(str(ROOT/manifest['source']));fps=cap.get(cv2.CAP_PROP_FPS)
    segments=[];last=None;n=0
    expected=[d['date'] for d in manifest['days']]
    while True:
        ok,frame=cap.read()
        if not ok:break
        # Camera dates are fixed-width: OCR the date region at 10 samples / video second.
        if n%3==0:
            result,_=ocr(frame[28:66,960:1118],use_det=False,use_cls=False,use_rec=True)
            raw=' '.join(r[0] for r in result) if result else ''
            m=re.search(r'(\d{2})[-.](\d{2})[-.](20\d{2})',raw)
            old=f'{m[3]}-{m[2]}-{m[1]}' if m else None
            # Only accept the next chronological date: OCR can confuse a digit.
            next_expected=expected[len(segments)] if len(segments)<len(expected) else None
            if old and old==next_expected:
                segments.append({'start':n/fps,'date':new_date(old)});last=old
        n+=1
    cap.release()
    if not segments or len(segments)!=len(days):
        raise RuntimeError(f'Expected {len(days)} date segments, found {len(segments)}. Review video OCR before export.')
    # Refine transition to an individual frame using original timestamp OCR.
    for i in range(1,len(segments)):
        cap=cv2.VideoCapture(str(ROOT/manifest['source']));end=round(segments[i]['start']*fps)
        for frame_n in range(max(0,end-2),end+1):
            cap.set(cv2.CAP_PROP_POS_FRAMES,frame_n);ok,frame=cap.read()
            if not ok:continue
            result,_=ocr(frame[28:66,960:1118],use_det=False,use_cls=False,use_rec=True)
            raw=' '.join(r[0] for r in result) if result else ''
            m=re.search(r'(\d{2})[-.](\d{2})[-.](20\d{2})',raw)
            if m and new_date(f'{m[3]}-{m[2]}-{m[1]}')==segments[i]['date']:
                segments[i]['start']=frame_n/fps;break
        cap.release()
    segments[0]['start']=0
    filters=['drawbox=x=950:y=25:w=168:h=44:color=0x102034:t=fill']
    for i,s in enumerate(segments):
        end=segments[i+1]['start'] if i+1<len(segments) else n/fps+1
        label=datetime.date.fromisoformat(s['date']).strftime('%d-%m-%Y')
        filters.append(f"drawtext=fontfile='C\\:/Windows/Fonts/consola.ttf':text='{label}':x=961:y=34:fontsize=23:fontcolor=white:enable='gte(t,{s['start']})*lt(t,{end})'")
    (ROOT/'review/video_dates.json').write_text(json.dumps(segments,indent=2),encoding='utf-8')
    (ROOT/'review/video_filter.txt').write_text(','.join(filters),encoding='utf-8')
    subprocess.run(['ffmpeg','-y','-i',str(ROOT/manifest['source']),'-filter_script:v',str(ROOT/'review/video_filter.txt'),'-c:v','libx264','-crf','19','-preset','fast','-c:a','copy','-movflags','+faststart',str(ROOT/'obra-demo-2026.mp4')],check=True,stdout=subprocess.DEVNULL,stderr=open(ROOT/'review/video_encode.log','w'))
    print('DONE',sum(len(d['photos']) for d in days),'photos;',len(uncertain),'uncertain times;',sum(len(v) for v in all_detections.values()),'proposals',flush=True)

if __name__=='__main__':main()
