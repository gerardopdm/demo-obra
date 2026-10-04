from PIL import Image,ImageDraw
from pathlib import Path
files=sorted(Path('review').glob('frame_*.jpg'))
for start in range(0,len(files),50):
 sheet=Image.new('RGB',(1000,50*44),'#20252b'); d=ImageDraw.Draw(sheet)
 for row,p in enumerate(files[start:start+50]):
  im=Image.open(p); crop=im.crop((925,0,1280,50)).resize((710,100))
  crop=im.crop((960,30,1240,63)).resize((560,44))
  sheet.paste(crop,(130,row*44));d.text((5,row*44+10),f'{p.stem} {(int(p.stem[-4:])-1)*.5:.1f}s',fill='white')
 sheet.save(f'review/stamps_{start//50}.jpg')

