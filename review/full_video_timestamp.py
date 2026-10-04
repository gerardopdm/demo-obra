"""Replace the entire camera timestamp with a consistent date-and-time plate."""
from pathlib import Path
import sys,json,re,datetime,subprocess
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'review/runtime'))
import cv2
from rapidocr_onnxruntime import RapidOCR
from PIL import Image,ImageDraw
manifest=json.loads((ROOT/'assets/manifest.json').read_text(encoding='utf-8'))
segments=json.loads((ROOT/'review/video_dates.json').read_text(encoding='utf-8'))
photos=[p for d in manifest['days'] for p in d['photos']]
known={p['sourceFrame']:p['time'] for p in photos}
def seconds(t):return sum(int(n)*v for n,v in zip(t.split(':'),[3600,60,1]))
def parse(text):
    m=re.search(r'(\d{2})[:.\-](\d{2})[:.\-](\d{2})$',text.replace(' ',''))
    if not m:return None
    h,mn,s=map(int,m.groups())
    return ':'.join(m.groups()) if h<24 and mn<60 and s<60 else None

cache=ROOT/'review/video_clocks.json'
if '--encode' not in sys.argv:
    cap=cv2.VideoCapture(str(ROOT/manifest['originalSource']));fps=cap.get(cv2.CAP_PROP_FPS)
    ocr=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
    records=[];uncertain=[];n=0
    while True:
        ok,bgr=cap.read()
        if not ok:break
        if n%3!=0:n+=1;continue
        at=n/fps;date=[s['date'] for s in segments if s['start']<=at+1e-6][-1]
        anchors=[p for p in photos if p['timestamp'].startswith(date)]
        left=[p for p in anchors if p['sourceFrame']<=n];right=[p for p in anchors if p['sourceFrame']>=n]
        lower=seconds(left[-1]['time']) if left else 5*3600
        upper=seconds(right[0]['time']) if right else 16*3600
        previous=seconds(records[-1]['time']) if records and records[-1]['date']==date and records[-1]['time'] else None
        time=known.get(n);raw=[]
        def acceptable(t):
            if not t:return False
            v=seconds(t)
            return lower-1<=v<=upper+1 and (previous is None or 0<=v-previous<=1801)
        if not time:
            crops=[bgr[28:66,1120:1245],bgr[28:66,960:1245],cv2.resize(bgr[28:66,1120:1245],None,fx=3,fy=3)]
            for crop in crops:
                result,_=ocr(crop,use_det=False,use_cls=False,use_rec=True)
                text=' '.join(r[0] for r in result) if result else '';raw.append(text)
                candidate=parse(text)
                if acceptable(candidate):time=candidate;break
        record={'frame':n,'second':at,'date':date,'time':time,'raw':raw,'verifiedAnchor':n in known}
        records.append(record)
        if not time:
            uncertain.append(record)
            cv2.imwrite(str(ROOT/'review'/f'video-clock-{n}.jpg'),bgr[25:70,955:1250])
        if len(records)%100==0:print('Read',len(records),'video timestamps;',len(uncertain),'pending',flush=True)
        n+=1
    cap.release();cache.write_text(json.dumps(records,indent=2),encoding='utf-8')
    (ROOT/'review/video_clock_uncertain.json').write_text(json.dumps(uncertain,indent=2),encoding='utf-8')
    if uncertain:
        sheet=Image.new('RGB',(420,len(uncertain)*60),'white');draw=ImageDraw.Draw(sheet)
        for i,r in enumerate(uncertain):
            sheet.paste(Image.open(ROOT/'review'/f"video-clock-{r['frame']}.jpg"),(110,i*60))
            draw.text((4,i*60+5),str(r['frame'])+'\n'+str(r['second']),fill='black')
        sheet.save(ROOT/'review/video-clock-pending.png')
        print('Visual review required:',len(uncertain),'timestamps',flush=True)
        sys.exit(2)
records=json.loads(cache.read_text(encoding='utf-8'))
correction_file=ROOT/'review/video_clock_corrections.json'
if correction_file.exists():
    corrections=json.loads(correction_file.read_text(encoding='utf-8'))
    for r in records:
        if str(r['frame']) in corrections:
            r['time']=corrections[str(r['frame'])];r['visuallyReviewed']=True
        if r['frame']==912:r['date']='2026-09-11'
    cache.write_text(json.dumps(records,indent=2),encoding='utf-8')
if any(not r['time'] for r in records):raise RuntimeError('Resolve pending timestamps before encoding')
def ass_time(t):
    cs=round(t*100);h,cs=divmod(cs,360000);m,cs=divmod(cs,6000);s,cs=divmod(cs,100)
    return f'{h}:{m:02}:{s:02}.{cs:02}'
header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Clock,Consolas,23,&H00FFFFFF,&H00FFFFFF,&H00102034,&H00102034,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
lines=[]
for i,r in enumerate(records):
    end=records[i+1]['second'] if i+1<len(records) else 110
    label=datetime.date.fromisoformat(r['date']).strftime('%d-%m-%Y')+' '+r['time']
    lines.append(f"Dialogue: 0,{ass_time(r['second'])},{ass_time(end)},Clock,,0,0,0,,{{\\pos(961,32)}}{label}")
(ROOT/'review/full_timestamp.ass').write_text(header+'\n'.join(lines),encoding='utf-8')
subprocess.run(['ffmpeg','-y','-i',str(ROOT/manifest['originalSource']),'-vf',"drawbox=x=950:y=25:w=300:h=44:color=0x102034:t=fill,ass=review/full_timestamp.ass",'-c:v','libx264','-crf','19','-preset','fast','-c:a','copy','-movflags','+faststart',str(ROOT/'review/obra-full-timestamp.mp4')],check=True,stdout=subprocess.DEVNULL,stderr=open(ROOT/'review/full_timestamp_encode.log','w'))
(ROOT/'review/obra-full-timestamp.mp4').replace(ROOT/'obra-demo-2026.mp4')
print('Complete timestamp plate exported;',len(records),'time changes',flush=True)
