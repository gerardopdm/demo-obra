from pathlib import Path
import json,shutil
ranges=[(2,1,1,1),(3,2,10,9),(4,11,21,19),(7,22,31,28),(8,32,41,38),(9,42,52,49),(10,53,61,59),(11,62,71,69),(14,72,82,79),(15,83,92,90),(16,93,103,100),(17,104,114,111),(18,115,124,122),(21,125,135,132),(22,136,145,143),(23,146,156,153),(24,157,163,163),(25,164,173,171),(28,174,184,181),(29,185,194,192),(30,195,205,202),(31,206,215,213),(1,216,218,218)]
data=[]
for day,start,end,cover in ranges:
 date=f'2020-12-{day:02d}' if day!=1 else '2021-01-01'
 folder=Path('assets')/date;folder.mkdir(exist_ok=True)
 photos=[]
 for n in range(start,end+1):
  name=f'frame_{n:04d}.jpg';shutil.copyfile(Path('review')/name,folder/name)
  photos.append({'src':f'assets/{date}/{name}','second':(n-1)*.5})
 data.append({'date':date,'cover':cover-start,'photos':photos})
Path('data.js').write_text('window.OBRA_DATA = '+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
Path('assets/manifest.json').write_text(json.dumps({'source':'Site-Unit-Build_001_720p.mp4','method':'Muestreo a 2 imágenes por segundo de video. Fechas revisadas visualmente en timestamp DD-MM-AAAA. No se infieren días ausentes.','days':data},indent=2,ensure_ascii=False),encoding='utf-8')
print(len(data),'días',sum(len(d['photos']) for d in data),'fotografías')
