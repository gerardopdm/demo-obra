"""Locate each day boundary around the original sampled date transition."""
from pathlib import Path
import sys,json,re,datetime,subprocess
sys.path.insert(0,str(Path(__file__).parent/'runtime'))
import cv2
from rapidocr_onnxruntime import RapidOCR
from build_media import ROOT,new_date
original=json.loads((ROOT/'review/original_manifest.json').read_text(encoding='utf-8'))
cap=cv2.VideoCapture(str(ROOT/original['source']));fps=cap.get(cv2.CAP_PROP_FPS)
ocr=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
segments=[{'start':0,'date':new_date(original['days'][0]['date'])}]
for day in original['days'][1:]:
    center=day['photos'][0]['second'];found=None
    start=max(0,int((center-.5)*fps))
    stop=int((center+.6)*fps)
    for frame_n in range(start,stop,3):
        cap.set(cv2.CAP_PROP_POS_FRAMES,frame_n);ok,frame=cap.read()
        if not ok:break
        result,_=ocr(frame[28:66,960:1118],use_det=False,use_cls=False,use_rec=True)
        raw=''.join(r[0] for r in result).replace(' ','') if result else ''
        match=re.search(r'(\d{2})[-:.]?(\d{2})[-:.]?(20\d{2})',raw)
        if match and f'{match[3]}-{match[2]}-{match[1]}'==day['date']:
            found=frame_n;break
    if found is None:raise RuntimeError('Cannot read date boundary '+day['date'])
    for n in range(max(0,found-2),found):
        cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,frame=cap.read()
        result,_=ocr(frame[28:66,960:1118],use_det=False,use_cls=False,use_rec=True)
        raw=''.join(r[0] for r in result).replace(' ','') if result else ''
        match=re.search(r'(\d{2})[-:.]?(\d{2})[-:.]?(20\d{2})',raw)
        if match and f'{match[3]}-{match[2]}-{match[1]}'==day['date']:found=n;break
    segments.append({'start':found/fps,'date':new_date(day['date'])});print(segments[-1],flush=True)
cap.release()
filters=['drawbox=x=950:y=25:w=168:h=44:color=0x102034:t=fill']
for i,s in enumerate(segments):
    end=segments[i+1]['start'] if i+1<len(segments) else 110
    label=datetime.date.fromisoformat(s['date']).strftime('%d-%m-%Y')
    filters.append(f"drawtext=fontfile='C\\:/Windows/Fonts/consola.ttf':text='{label}':x=961:y=34:fontsize=23:fontcolor=white:enable='gte(t,{s['start']})*lt(t,{end})'")
previous=json.loads((ROOT/'review/video_dates.json').read_text(encoding='utf-8'))
if previous==segments and (ROOT/'obra-demo-2026.mp4').exists():
    print('All exact day boundaries reconfirmed; existing export is current',flush=True)
    sys.exit(0)
(ROOT/'review/video_dates.json').write_text(json.dumps(segments,indent=2),encoding='utf-8')
(ROOT/'review/video_filter.txt').write_text(','.join(filters),encoding='utf-8')
subprocess.run(['ffmpeg','-y','-i',str(ROOT/original['source']),'-filter_script:v',str(ROOT/'review/video_filter.txt'),'-c:v','libx264','-crf','19','-preset','fast','-c:a','copy','-movflags','+faststart',str(ROOT/'obra-demo-2026.mp4')],check=True,stdout=subprocess.DEVNULL,stderr=open(ROOT/'review/video_encode.log','w'))
print('Video boundaries and export complete',flush=True)
