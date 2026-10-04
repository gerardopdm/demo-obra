from PIL import Image,ImageDraw
from pathlib import Path
import json
p=[p for d in json.loads(Path('assets/manifest.json').read_text())['days'] for p in d['photos']]
for page in range(4):
    group=p[page*56:(page+1)*56]
    im=Image.new('RGB',(840,((len(group)+1)//2)*65),'white');draw=ImageDraw.Draw(im)
    for i,r in enumerate(group):
        x=(i%2)*420;y=(i//2)*65
        im.paste(Image.open(Path('review/exact')/Path(r['src']).name).crop((955,25,1250,70)),(x+110,y))
        draw.text((x+3,y+5),Path(r['src']).name+'\n'+str(r['time']),fill='black')
    im.save('review/all-clocks-'+str(page)+'.png')
