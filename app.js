const data=window.OBRA_DATA;
const $=id=>document.getElementById(id);
let dayIndex=data.length-1, photoIndex=data[dayIndex].cover;
const requestedView=new URLSearchParams(location.search),requestedDay=data.findIndex(d=>d.date===requestedView.get('date'));
if(requestedDay>=0){dayIndex=requestedDay;const requestedPhoto=Number(requestedView.get('capture'))-1;photoIndex=Number.isInteger(requestedPhoto)&&requestedPhoto>=0&&requestedPhoto<data[dayIndex].photos.length?requestedPhoto:data[dayIndex].cover;}
const totalPhotos=data.reduce((s,d)=>s+d.photos.length,0);
function tickClock(){const el=$('headerClock');if(!el)return;const now=new Date();el.textContent=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});el.dateTime=now.toISOString();}
function initStats(){const d=$('kpiDays'),p=$('kpiPhotos'),c=$('dayCount');if(d)d.textContent=data.length;if(p)p.textContent=totalPhotos;if(c)c.textContent=data.length;}
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
const shortDate=date=>new Date(date+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
function photoPeople(p){
  let proposals=window.OBRA_DETECTIONS?.photos[p.src]||[];
  try{const review=JSON.parse(localStorage.getItem('obra-supervision-2026-v1'));proposals=review?.photos?.[p.src]?.boxes??proposals;}catch{}
  return proposals.filter(b=>b.type==='person'||b.type==='truck');
}
function drawPeople(id,p){
  const svg=$(id);svg.replaceChildren();if(!$('showIndexPeople').checked)return;
  const ns='http://www.w3.org/2000/svg';
  photoPeople(p).forEach((b,i)=>{
    const [x,y,w,h]=[b.box[0]*1280,b.box[1]*720,b.box[2]*1280,b.box[3]*720];
    const rect=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(k,v);
    rect.classList.toggle('truck',b.type==='truck');
    const label=document.createElementNS(ns,'text');label.setAttribute('x',Math.min(x,1040));label.setAttribute('y',Math.max(20,y-7));label.textContent=(b.type==='truck'?'Camión ':'Persona ')+(i+1);
    svg.append(rect,label);
  });
}
function refreshPeople(){const p=data[dayIndex].photos[photoIndex],boxes=photoPeople(p);drawPeople('heroOverlay',p);$('indexPeopleCount').textContent='· '+boxes.filter(b=>b.type==='person').length+' personas · '+boxes.filter(b=>b.type==='truck').length+' camiones · detecciones revisables';if($('lightbox').open)drawPeople('fullOverlay',p);if(!$('compareView').hidden)renderComparison();}
$('showIndexPeople').onchange=refreshPeople;
window.addEventListener('storage',e=>{if(e.key==='obra-supervision-2026-v1')refreshPeople();});
function renderDays(){const filter=$('dateFilter').value; $('days').replaceChildren(); let matches=0; data.forEach((d,i)=>{if(filter&&filter!==d.date)return;matches++;const b=document.createElement('button');b.className=i===dayIndex?'selected':'';b.setAttribute('aria-current',i===dayIndex?'date':'false');b.innerHTML=`<img src="${d.photos[d.cover].src}" alt="" loading="lazy"><span><b>${shortDate(d.date)} ${d.date.slice(0,4)}</b><small>${d.photos.length} fotografías</small></span>`;b.onclick=()=>selectDay(i);$('days').append(b)});$('empty').hidden=matches>0}
function selectDay(i){dayIndex=i;photoIndex=data[i].cover;render();}
function renderPhoto(){const d=data[dayIndex],p=d.photos[photoIndex];$('hero').src=p.src;$('hero').alt=`Avance de obra del ${dateLabel(d.date)}, fotografía ${photoIndex+1}`;$('photoCaption').textContent=`${p.time || 'Hora pendiente'} · Foto ${photoIndex+1} de ${d.photos.length} · Video: ${p.second.toFixed(1)} s`;$('download').href=p.src;$('download').download=`obra-${d.date}-${photoIndex+1}.jpg`;Array.from($('thumbs').children).forEach((b,i)=>{b.classList.toggle('selected',i===photoIndex);b.setAttribute('aria-pressed',String(i===photoIndex))});refreshPeople();}
function render(){const d=data[dayIndex];$('selectedDate').textContent=dateLabel(d.date);$('dayNumber').textContent=`REGISTRO ${String(dayIndex+1).padStart(2,'0')} / ${data.length}`;$('count').textContent=`${d.photos.length} capturas disponibles`;$('prev').disabled=dayIndex===0;$('next').disabled=dayIndex===data.length-1;$('thumbs').replaceChildren();d.photos.forEach((p,i)=>{const b=document.createElement('button');b.setAttribute('aria-label',`Ver fotografía ${i+1}`);b.innerHTML=`<img src="${p.src}" loading="lazy" alt=""><span>Captura ${String(i+1).padStart(2,'0')}</span>`;b.onclick=()=>{photoIndex=i;renderPhoto()};$('thumbs').append(b)});renderPhoto();renderDays()}
$('prev').onclick=()=>selectDay(dayIndex-1);$('next').onclick=()=>selectDay(dayIndex+1);$('dateFilter').onchange=()=>{const i=data.findIndex(d=>d.date===$('dateFilter').value);if(i>=0)selectDay(i);else renderDays()};$('clearFilter').onclick=()=>{$('dateFilter').value='';renderDays()};
function expand(){const d=data[dayIndex],p=d.photos[photoIndex];$('fullPhoto').src=p.src;$('fullLabel').textContent=`${dateLabel(d.date)} · ${p.time || 'Hora pendiente'} · Captura ${photoIndex+1}`;drawPeople('fullOverlay',p);$('lightbox').showModal()}
$('expand').onclick=expand;$('heroButton').onclick=expand;$('close').onclick=()=>$('lightbox').close();$('lightbox').onclick=e=>{if(e.target===$('lightbox'))$('lightbox').close()};
for(const id of ['from','to']){data.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=dateLabel(d.date);$(id).append(o)});$(id).onchange=renderComparison}$('to').value=data.length-1;
function renderComparison(){for(const [selector,img,label] of [['from','before','beforeLabel'],['to','after','afterLabel']]){const d=data[Number($(selector).value)],p=d.photos[d.cover];$(img).src=p.src;$(label).textContent=dateLabel(d.date)+' · '+(p.time || 'Hora pendiente');drawPeople(img+'Overlay',p);}}
function switchView(compare){$('dailyView').hidden=compare;$('compareView').hidden=!compare;$('daily').classList.toggle('active',!compare);$('compare').classList.toggle('active',compare);$('daily').setAttribute('aria-selected',String(!compare));$('compare').setAttribute('aria-selected',String(compare));if(compare)renderComparison()}
$('daily').onclick=()=>switchView(false);$('compare').onclick=()=>switchView(true);document.addEventListener('keydown',e=>{if(e.target.matches('input,select')||$('lightbox').open||$('dailyView').hidden)return;if(e.key==='ArrowLeft'&&dayIndex>0)selectDay(dayIndex-1);if(e.key==='ArrowRight'&&dayIndex<data.length-1)selectDay(dayIndex+1)});initStats();tickClock();setInterval(tickClock,1000);render();
