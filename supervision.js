/* Offline supervisor review. AI boxes are proposals; gate events require confirmation. */
const days = window.OBRA_DATA;
const proposals = window.OBRA_DETECTIONS.photos;
const byId = id => document.getElementById(id);
const storageKey = 'obra-supervision-2026-v1';
let saved = {photos:{},events:[]};
let storageAvailable = true;
try { saved = JSON.parse(localStorage.getItem(storageKey)) || saved; } catch { storageAvailable=false; }
if (!saved.photos || !Array.isArray(saved.events)) saved={photos:{},events:[]};
let dayIndex=Math.max(0,days.findIndex(d=>d.photos.length>1));
let photoIndex=days[dayIndex].photos.length-1, selected=null, timer=null, drawType=null, start=null;
const labelDate = date => new Date(date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
const photo = () => days[dayIndex].photos[photoIndex];
const record = () => saved.photos[photo().src];
const boxes = () => record()?.boxes ?? proposals[photo().src] ?? [];
const eventsToday = () => saved.events.filter(e=>e.date===days[dayIndex].date);
const names = {person:'Persona',truck:'Camión'};
function revealHorizontal(container,child){
  if(!child)return;
  const parent=container.getBoundingClientRect(),item=child.getBoundingClientRect();
  if(item.left<parent.left)container.scrollLeft-=parent.left-item.left+4;
  else if(item.right>parent.right)container.scrollLeft+=item.right-parent.right+4;
}
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify(saved)); storageAvailable=true; }
  catch { storageAvailable=false; }
  byId('saveStatus').textContent=storageAvailable?'Revisión guardada en este navegador':'No se puede guardar aquí. Exporta la revisión antes de cerrar.';
}
function editable() {
  if (!record()) saved.photos[photo().src]={boxes:structuredClone(boxes()),reviewed:false};
  return record();
}
function stop(){ clearInterval(timer);timer=null;byId('playSequence').textContent='▶ Reproducir'; }
function setPhoto(index){ photoIndex=index;selected=null;drawType=null;render(); }
function setDay(index){ stop();dayIndex=index;photoIndex=0;selected=null;drawType=null;render(); }
function visiblePhotos(){
  const filter=byId('activityFilter').value;
  return days[dayIndex].photos.map((p,i)=>({p,i})).filter(({p})=>{
    const detections=saved.photos[p.src]?.boxes??proposals[p.src]??[];
    if(filter==='person'||filter==='truck')return detections.some(b=>b.type===filter);
    if(filter==='events')return saved.events.some(e=>e.src===p.src);
    if(filter==='pending')return !saved.photos[p.src]?.reviewed;
    return true;
  });
}
function movePhoto(direction){
  const sequence=visiblePhotos().map(v=>v.i);
  const next=direction>0?sequence.find(i=>i>photoIndex):sequence.slice().reverse().find(i=>i<photoIndex);
  if(next!==undefined)setPhoto(next);else stop();
}
function drawBoxes(){
  const svg=byId('detectionOverlay');svg.replaceChildren();
  if(!byId('showOverlays').checked)return;
  const ns='http://www.w3.org/2000/svg';
  boxes().forEach((b,index)=>{
    if(b.type==='person'&&!byId('showPeople').checked || b.type==='truck'&&!byId('showTrucks').checked)return;
    const [x,y,w,h]=[b.box[0]*1280,b.box[1]*720,b.box[2]*1280,b.box[3]*720];
    const g=document.createElementNS(ns,'g');g.classList.add(b.type);if(selected===b.id)g.classList.add('selected');
    const rect=document.createElementNS(ns,'rect');
    for(const [k,v] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(k,v);
    const text=document.createElementNS(ns,'text');text.setAttribute('x',Math.min(x,1030));text.setAttribute('y',Math.max(y-7,20));
    text.textContent=names[b.type]+' '+(index+1)+(b.source==='ai'?' · '+Math.round(b.confidence*100)+'%':' · manual');
    g.append(rect,text);g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',text.textContent);
    const select=()=>{selected=b.id;renderSelection();drawBoxes();};
    g.onclick=e=>{if(drawType)return;e.stopPropagation();select();};
    g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};
    svg.append(g);
  });
}
function renderSelection(){
  const b=boxes().find(b=>b.id===selected);
  byId('selectedObject').textContent=b?names[b.type]+' seleccionado':'Selecciona un recuadro para revisarlo';
  byId('removeBox').disabled=!b;
  for(const kind of ['entry','exit'])byId(kind).disabled=!b||b.type!=='truck'||saved.events.some(e=>e.src===photo().src&&e.boxId===b.id&&e.kind===kind);
}
function render(){
  const day=days[dayIndex],p=photo(),currentBoxes=boxes(),events=eventsToday();
  byId('supervisionDate').textContent=labelDate(day.date);
  byId('supervisionTime').textContent=p.time??'Hora pendiente de revisión';
  byId('photoPosition').textContent=`Captura ${photoIndex+1} / ${day.photos.length}`;
  byId('supervisionPhoto').src=p.src;
  byId('supervisionPhoto').alt='Obra del '+labelDate(day.date)+' '+(p.time??'');
  byId('supervisionDay').value=day.date;
  byId('prevDay').disabled=dayIndex===0;byId('nextDay').disabled=dayIndex===days.length-1;
  const sequence=visiblePhotos();
  byId('prevCapture').disabled=!sequence.some(v=>v.i<photoIndex);byId('nextCapture').disabled=!sequence.some(v=>v.i>photoIndex);
  byId('captureSlider').max=Math.max(0,sequence.length-1);byId('captureSlider').value=Math.max(0,sequence.findIndex(v=>v.i===photoIndex));byId('captureSlider').disabled=sequence.length===0;
  byId('captureSlider').setAttribute('aria-valuetext',`Captura ${photoIndex+1}, ${p.time??'hora pendiente'}`);
  byId('entriesCount').textContent=events.filter(e=>e.kind==='entry').length;
  byId('exitsCount').textContent=events.filter(e=>e.kind==='exit').length;
  byId('peopleCount').textContent=currentBoxes.filter(b=>b.type==='person').length;
  byId('trucksCount').textContent=currentBoxes.filter(b=>b.type==='truck').length;
  byId('peopleStatus').textContent=record()?.reviewed?'Captura revisada por supervisor':'Propuesta automática · sin revisar';
  byId('reviewCoverage').textContent=day.photos.filter(p=>saved.photos[p.src]?.reviewed).length+' / '+day.photos.length+' capturas revisadas';
  byId('reviewPhoto').textContent=record()?.reviewed?'✓ Revisada · volver a pendiente':'Confirmar objetos de esta captura';
  byId('reviewBadge').textContent=record()?.reviewed?'Revisada':'Pendiente de revisión';
  byId('reviewBadge').className='badge '+(record()?.reviewed?'success':'warning');
  byId('dailyTimeline').replaceChildren();
  days.forEach((d,i)=>{
    const b=document.createElement('button');b.className='timeline-day'+(i===dayIndex?' active':'');
    b.textContent=new Date(d.date+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    b.setAttribute('aria-current',i===dayIndex?'date':'false');b.onclick=()=>setDay(i);byId('dailyTimeline').append(b);
  });
  revealHorizontal(byId('dailyTimeline'),byId('dailyTimeline').children[dayIndex]);
  byId('captureTimeline').replaceChildren();
  sequence.forEach(({p:q,i})=>{
    const b=document.createElement('button');b.className='capture-point'+(i===photoIndex?' active':'');b.setAttribute('aria-pressed',String(i===photoIndex));
    const img=document.createElement('img');img.src=q.src;img.alt='';img.loading='lazy';
    const span=document.createElement('span');span.textContent=q.time??`Captura ${i+1}`;
    const small=document.createElement('small');
    const count=(saved.photos[q.src]?.boxes??proposals[q.src]??[]).filter(b=>b.type==='person').length;
    small.textContent=`${count} personas · ${saved.photos[q.src]?.reviewed?'revisada':'propuesta'}`;
    b.append(img,span,small);b.onclick=()=>{stop();setPhoto(i);};byId('captureTimeline').append(b);
  });
  byId('noCaptures').hidden=sequence.length>0;
  revealHorizontal(byId('captureTimeline'),byId('captureTimeline').querySelector('.active'));
  byId('eventList').replaceChildren();
  events.slice().sort((a,b)=>a.second-b.second).forEach(e=>{
    const row=document.createElement('div');row.className='event-row';
    const button=document.createElement('button');button.className='event-jump';
    button.textContent=`${e.kind==='entry'?'↘ Entrada':'↗ Salida'} · ${e.time??'hora pendiente'} · ${e.note||'Camión confirmado'}`;
    button.onclick=()=>{stop();setPhoto(day.photos.findIndex(p=>p.src===e.src));selected=e.boxId;drawBoxes();renderSelection();};
    const del=document.createElement('button');del.className='text-button';del.textContent='Quitar';del.setAttribute('aria-label','Quitar movimiento '+button.textContent);
    del.onclick=()=>{saved.events=saved.events.filter(x=>x.id!==e.id);persist();render();};row.append(button,del);byId('eventList').append(row);
  });
  byId('noEvents').hidden=events.length>0;
  byId('drawHint').textContent=drawType?'Arrastra sobre la imagen para marcar '+names[drawType].toLowerCase()+'. Esc cancela.':'Los recuadros se dibujan aquí; no alteran las fotografías.';
  byId('detectionOverlay').classList.toggle('drawing',!!drawType);
  drawBoxes();renderSelection();
}
function addEvent(kind){
  const b=boxes().find(b=>b.id===selected);if(!b||b.type!=='truck')return;
  if(saved.events.some(e=>e.src===photo().src&&e.boxId===b.id&&e.kind===kind))return;
  const p=photo();
  editable();
  saved.events.push({id:crypto.randomUUID(),kind,boxId:b.id,date:days[dayIndex].date,time:p.time,second:p.second,src:p.src,note:byId('eventNote').value.trim(),source:'supervisor'});
  byId('eventNote').value='';persist();render();
}
function exportReview(){
  const file={schema:1,dataset:'obra-demo-2026',exportedAt:new Date().toISOString(),...saved};
  const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='revision-obra-2026.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
days.forEach(d=>{const o=document.createElement('option');o.value=d.date;o.textContent=labelDate(d.date);byId('supervisionDay').append(o);});
byId('supervisionDay').onchange=e=>setDay(days.findIndex(d=>d.date===e.target.value));
byId('prevDay').onclick=()=>setDay(dayIndex-1);byId('nextDay').onclick=()=>setDay(dayIndex+1);
byId('prevCapture').onclick=()=>{stop();movePhoto(-1);};byId('nextCapture').onclick=()=>{stop();movePhoto(1);};
byId('captureSlider').oninput=e=>{stop();const next=visiblePhotos()[Number(e.target.value)];if(next)setPhoto(next.i);};
byId('activityFilter').onchange=()=>{stop();const first=visiblePhotos()[0];if(first)photoIndex=first.i;render();};
byId('timelineZoom').oninput=e=>byId('captureTimeline').style.setProperty('--capture-width',e.target.value+'px');
byId('imageZoom').oninput=e=>{
  const viewport=byId('monitorViewport'),image=byId('monitorImage');
  const previous=parseFloat(image.style.width)||100,next=Number(e.target.value),ratio=next/previous;
  const left=(viewport.scrollLeft+viewport.clientWidth/2)*ratio-viewport.clientWidth/2;
  const top=(viewport.scrollTop+viewport.clientHeight/2)*ratio-viewport.clientHeight/2;
  image.style.width=next+'%';byId('zoomValue').textContent=next+'%';viewport.scrollLeft=left;viewport.scrollTop=top;
};
byId('playSequence').onclick=()=>{if(timer){stop();return;}if(!visiblePhotos().some(v=>v.i>photoIndex)){const first=visiblePhotos()[0];if(!first)return;setPhoto(first.i);}byId('playSequence').textContent='Ⅱ Pausar';timer=setInterval(()=>movePhoto(1),900);};
for(const id of ['showOverlays','showPeople','showTrucks'])byId(id).onchange=drawBoxes;
for(const [id,type] of [['addPerson','person'],['addTruck','truck']])byId(id).onclick=()=>{stop();drawType=type;byId('showOverlays').checked=true;byId(type==='person'?'showPeople':'showTrucks').checked=true;render();};
byId('removeBox').onclick=()=>{
  const r=editable();r.boxes=r.boxes.filter(b=>b.id!==selected);r.reviewed=false;
  saved.events=saved.events.filter(e=>!(e.src===photo().src&&e.boxId===selected));selected=null;persist();render();
};
byId('reviewPhoto').onclick=()=>{editable().reviewed=!record().reviewed;persist();render();};
byId('entry').onclick=()=>addEvent('entry');byId('exit').onclick=()=>addEvent('exit');
byId('exportReview').onclick=exportReview;
byId('importReview').onchange=async e=>{
  try{
    const parsed=JSON.parse(await e.target.files[0].text());
    const known=new Set(days.flatMap(d=>d.photos.map(p=>p.src)));
    if(parsed.schema!==1||parsed.dataset!=='obra-demo-2026'||!parsed.photos||!Array.isArray(parsed.events))throw Error('Formato de revisión incompatible.');
    for(const [src,r] of Object.entries(parsed.photos)){
      if(!known.has(src)||typeof r.reviewed!=='boolean'||!Array.isArray(r.boxes))throw Error('Captura incompatible.');
      for(const b of r.boxes)if(!names[b.type]||typeof b.id!=='string'||!Array.isArray(b.box)||b.box.length!==4||b.box.some(v=>!Number.isFinite(v)||v<0||v>1)||b.box[0]+b.box[2]>1.0001||b.box[1]+b.box[3]>1.0001)throw Error('Recuadro inválido.');
    }
    const ids=new Set(),movements=new Set();
    for(const evt of parsed.events){
      const day=days.find(d=>d.photos.some(p=>p.src===evt.src)),p=day?.photos.find(p=>p.src===evt.src);
      const key=evt.src+'|'+evt.boxId+'|'+evt.kind;
      if(!p||!['entry','exit'].includes(evt.kind)||evt.date!==day.date||evt.time!==p.time||evt.second!==p.second||typeof evt.id!=='string'||ids.has(evt.id)||movements.has(key)||typeof evt.note!=='string'||!parsed.photos[evt.src]?.boxes.some(b=>b.id===evt.boxId&&b.type==='truck'))throw Error('Movimiento incompatible.');
      ids.add(evt.id);movements.add(key);
    }
    saved={photos:parsed.photos,events:parsed.events};persist();render();byId('importStatus').textContent='Revisión importada.';
  }catch(err){byId('importStatus').textContent='No se pudo importar: '+err.message;}
  e.target.value='';
};
const svg=byId('detectionOverlay');
const point=e=>{const r=svg.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
svg.onpointerdown=e=>{if(!drawType)return;start=point(e);svg.setPointerCapture(e.pointerId);e.preventDefault();};
svg.onpointermove=e=>{
  if(!start)return;const p=point(e);let rect=byId('draftBox');
  if(!rect){rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.id='draftBox';svg.append(rect);}
  for(const [k,v] of Object.entries({x:Math.min(start[0],p[0])*1280,y:Math.min(start[1],p[1])*720,width:Math.abs(start[0]-p[0])*1280,height:Math.abs(start[1]-p[1])*720}))rect.setAttribute(k,v);
};
svg.onpointerup=e=>{
  if(!start)return;const p=point(e),box=[Math.min(start[0],p[0]),Math.min(start[1],p[1]),Math.abs(start[0]-p[0]),Math.abs(start[1]-p[1])];start=null;
  if(box[2]>.008&&box[3]>.008){const r=editable();selected=crypto.randomUUID();r.boxes.push({id:selected,type:drawType,box,source:'manual'});r.reviewed=false;persist();}
  drawType=null;render();
};
svg.onpointercancel=()=>{start=null;drawType=null;render();};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){drawType=null;start=null;render();return;}
  if(e.target.matches('input,select,textarea,button,[role="button"]'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stop();movePhoto(e.key==='ArrowRight'?1:-1);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
persist();render();
