(() => {
  'use strict';
  const data = window.CONSTRUCTION_DATA, $ = id => document.getElementById(id);
  const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const fmtDate = (date, long = false) => new Intl.DateTimeFormat('es-MX', {timeZone: 'UTC', day: 'numeric', month: long ? 'long' : 'short', ...(long ? {weekday: 'long', year: 'numeric'} : {})}).format(new Date(`${date}T12:00:00Z`));
  const typeLabel = d => d.type === 'closed' ? 'Sin actividad programada' : d.type === 'short' ? 'Turno reducido' : 'Dos cuadrillas';
  const median = values => {const v = [...values].sort((a,b) => a-b);return v.length ? (v[Math.floor((v.length-1)/2)] + v[Math.ceil((v.length-1)/2)]) / 2 : null;};
  const duration = v => v.exitAt ? (Date.parse(v.exitAt) - Date.parse(v.entryAt)) / 60000 : null;
  const params = new URLSearchParams(location.search);
  let selectedDate = data.days.find(d => d.date === params.get('date'))?.date || '2026-09-03';
  let view = params.get('view') === 'range' ? 'range' : 'day';
  let interval = [10,30,60].includes(Number(params.get('interval'))) ? Number(params.get('interval')) : 30;
  let selectedBin = 8, selectedVisit = null;
  $('rangeLength').value = [7,14,31].includes(Number(params.get('range'))) ? params.get('range') : '7';
  $('constructionDate').innerHTML = data.days.map(d => `<option value="${d.date}">${fmtDate(d.date)} 2026 · ${typeLabel(d)}</option>`).join('');
  const day = () => data.days.find(d => d.date === selectedDate);
  function aggregate(d, size, start = data.startMinute, end = data.endMinute) {
    const result = [];
    for (let m = start; m < end; m += size) {
      const stop = Math.min(m + size, end), expected = d.samples.filter(s => s.minute >= m && s.minute < stop);
      const valid = expected.filter(s => s.count !== null);
      result.push({start:m, end:stop, count:valid.length ? valid.reduce((a,s) => a+s.count,0)/valid.length : null,
        valid:valid.length, expected:expected.length});
    }
    return result;
  }
  function metrics(d) {
    const valid = d.samples.filter(s => s.count !== null), present = valid.filter(s => s.count > 0);
    const peak = valid.length ? Math.max(...valid.map(s => s.count)) : null;
    return {valid:valid.length, expected:d.samples.length, first:present[0]?.minute ?? null,
      last:present.at(-1)?.minute ?? null, peak, peakAt:valid.find(s => s.count === peak)?.minute ?? null};
  }
  function traffic(date) {
    const cutoff = Date.parse(`${date}T23:59:59${data.utcOffset}`);
    return {entries:data.visits.filter(v => v.entryDate === date), exits:data.visits.filter(v => v.exitDate === date),
      onsite:data.visits.filter(v => Date.parse(v.entryAt) <= cutoff && (!v.exitAt || Date.parse(v.exitAt) > cutoff))};
  }
  function kpis(target, items) {
    $(target).innerHTML = items.map(([label,value,note]) => `<article class="kpi-card"><span class="kpi-label">${label}</span><p class="kpi-value">${value}</p><span class="kpi-change">${note}</span></article>`).join('');
  }
  function updateURL() {
    const query = new URLSearchParams({date:selectedDate, view, interval:String(interval), range:$('rangeLength').value});
    try {history.replaceState(null, '', `${location.pathname}?${query}`);} catch (_) { /* file:// may restrict history */ }
  }
  function svgFrame(id, title, max, labels) {
    const svg = $(id), width = Math.max(200, svg.getBoundingClientRect().width), height = svg.getBoundingClientRect().height || 260;
    const frame = {svg,width,height,left:42,right:width-12,top:26,bottom:height-48};
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    frame.y = n => frame.bottom - n / max * (frame.bottom-frame.top);
    frame.html = `<title>${title}</title><desc>Datos ficticios. ${labels}</desc>`;
    [0, max/3, max*2/3, max].forEach(n => {frame.html += `<line class="chart-grid" x1="${frame.left}" x2="${frame.right}" y1="${frame.y(n)}" y2="${frame.y(n)}"/><text x="${frame.left-7}" y="${frame.y(n)+4}" text-anchor="end">${Number(n.toFixed(1))}</text>`;});
    return frame;
  }
  function presenceChart() {
    const d = day(), bins = aggregate(d,interval), f = svgFrame('presenceChart','Personas visibles durante la jornada',27,'Promedio por intervalo; pausas programadas y faltantes identificados.');
    const x = minute => f.left + (minute-data.startMinute)/(data.endMinute-data.startMinute)*(f.right-f.left);
    let background = '';
    d.crews.forEach(c => c.breaks.forEach(([a,b]) => {background += `<rect class="chart-break" x="${x(a)}" y="${f.top}" width="${x(b)-x(a)}" height="${f.bottom-f.top}"/>`;}));
    d.samples.filter(s => s.count === null).forEach(s => {background += `<rect class="chart-missing" x="${x(s.minute)}" y="${f.top}" width="${x(s.minute+10)-x(s.minute)}" height="${f.bottom-f.top}"/>`;});
    // Draw background before grid and marks. Missing bins break the series.
    f.html = background + f.html;
    const ticks = f.width < 450 ? [420,660,900,1140] : [420,540,660,780,900,1020,1140];
    ticks.forEach(m => {f.html += `<text x="${x(m)}" y="${f.bottom+23}" text-anchor="${m === 1140 ? 'end' : 'middle'}">${clock(m)}</text>`;});
    let previous = null;
    bins.forEach((b,i) => {
      if (b.count === null) {previous=null;return;}
      const xx=x((b.start+b.end)/2), yy=f.y(b.count);
      if (previous) f.html += `<line class="chart-line" x1="${previous.x}" y1="${previous.y}" x2="${xx}" y2="${yy}"/>`;
      f.html += `<circle class="chart-presence" cx="${xx}" cy="${yy}" r="3"/>`;
      previous={x:xx,y:yy};
    });
    const b = bins[selectedBin];
    if (b) f.html += `<line class="chart-selected" x1="${x((b.start+b.end)/2)}" x2="${x((b.start+b.end)/2)}" y1="${f.top}" y2="${f.bottom}"/>`;
    bins.forEach((b,i) => {f.html += `<rect data-bin="${i}" class="chart-hit" x="${x(b.start)}" y="${f.top}" width="${x(b.end)-x(b.start)}" height="${f.bottom-f.top}"><title>${clock(b.start)}–${clock(b.end)}: ${b.count === null ? 'sin datos' : b.count.toFixed(1)+' personas'} · ${b.valid}/${b.expected} muestras</title></rect>`;});
    f.html += `<text x="3" y="14">Personas</text><text x="${f.right}" y="${f.height-5}" text-anchor="end">Hora local</text>`;
    f.svg.innerHTML = f.html;
  }
  function intervalDetail() {
    const bins = aggregate(day(), interval), b = bins[selectedBin];
    $('selectedInterval').value = String(selectedBin);
    $('previousInterval').disabled = selectedBin === 0;
    $('nextInterval').disabled = selectedBin >= bins.length-1;
    const scheduled = day().crews.flatMap(c => c.breaks.filter(([a,z]) => a<b.end && z>b.start).map(([a,z,label]) => `${c.name}: ${label.toLowerCase()} ${clock(a)}–${clock(z)}`));
    $('intervalDetail').textContent = `${clock(b.start)}–${clock(b.end)} · ${b.count === null ? 'Sin datos' : b.count.toFixed(1)+' personas visibles en promedio'} · ${b.valid}/${b.expected} muestras válidas${b.valid<b.expected ? ' · cobertura incompleta' : ''}${scheduled.length ? ' · '+scheduled.join('; ') : ''}`;
    presenceChart();
  }
  function relevantVisits(date) {return data.visits.filter(v => v.entryDate <= date && (!v.exitDate || v.exitDate >= date));}
  function visitLabel(v) {return `${v.label} · ${v.vehicle} · ${v.material} (${v.operation.toLowerCase()})`;}
  function visitTime(v, which) {
    const date=v[which+'Date'], minute=v[which+'Minute'];
    return date ? `${date===selectedDate ? '' : fmtDate(date)+' · '}${clock(minute)}` : 'Pendiente';
  }
  function renderVisits() {
    const visits=relevantVisits(selectedDate);
    if (!visits.some(v => v.id === selectedVisit)) selectedVisit=null;
    $('truckTimeline').innerHTML = visits.length ? visits.map(v => {
      const start = v.entryDate < selectedDate ? data.startMinute : Math.max(data.startMinute,v.entryMinute);
      const end = !v.exitDate || v.exitDate > selectedDate ? data.endMinute : Math.min(data.endMinute,v.exitMinute);
      const left=(start-data.startMinute)/750*100, width=Math.max(0,(end-start)/750*100);
      return `<div class="truck-row ${v.id===selectedVisit?'selected':''}"><button type="button" class="truck-name" data-visit="${v.id}"><strong>${v.label} · ${v.material}</strong><small>${v.vehicle}${v.entryDate<selectedDate?' · desde '+fmtDate(v.entryDate):''}</small></button><div class="truck-track"><button type="button" data-visit="${v.id}" class="${!v.exitAt?'pending':''}" style="left:${left}%;width:${width}%" aria-label="${visitLabel(v)}, llegada ${visitTime(v,'entry')}, salida ${visitTime(v,'exit')}"></button></div></div>`;
    }).join('') : '<p class="construction-note">Sin visitas en esta fecha.</p>';
    $('visitsTable').innerHTML = visits.length ? visits.map(v => `<tr class="${v.id===selectedVisit?'selected':''}"><td><button type="button" data-visit="${v.id}">${v.label} · ${v.vehicle}</button></td><td>${v.material} · ${v.operation}</td><td>${visitTime(v,'entry')}</td><td>${visitTime(v,'exit')}</td><td>${duration(v)===null?'Abierta':duration(v)+' min'}</td><td>${v.exitLoad}</td><td>Ficticia · remisión / observación</td></tr>`).join('') : '<tr><td colspan="7">Sin visitas registradas en la simulación.</td></tr>';
    const v=visits.find(v => v.id===selectedVisit);
    $('truckDetail').textContent = v ? `${visitLabel(v)} · llegada ${visitTime(v,'entry')} · salida ${visitTime(v,'exit')} · ${duration(v)===null?'Visita abierta':duration(v)+' min de permanencia total'} · llegó: ${v.entryLoad} · salió: ${v.exitLoad}. ${v.loadNote} Material: ${v.materialSource}. Carga: ${v.loadSource}. Asociación: ${v.association}.` : 'Selecciona una visita. Las barras muestran la permanencia dentro del horario consultado; la tabla conserva la duración total, incluso entre fechas.';
  }
  function renderDay() {
    const d=day(), m=metrics(d), t=traffic(selectedDate);
    $('dailyTitle').textContent=fmtDate(selectedDate,true);
    $('scheduleSummary').textContent=`${typeLabel(d)}${d.crews.length?' · '+d.crews.reduce((a,c)=>a+c.people,0)+' personas programadas · cierre programado '+clock(d.plannedClose):''}`;
    kpis('dailyStats',[
      ['Primera presencia',m.first===null?'—':clock(m.first),'Primera muestra con personas'],
      ['Máximo visible',m.peak??'—',m.peak>0?`A las ${clock(m.peakAt)} · no es asistencia`:'Sin presencia observada'],
      ['Última presencia',m.last===null?'—':clock(m.last),'Cierre sin confirmar'],
      ['Camiones entraron / salieron',`${t.entries.length} / ${t.exits.length}`,`${t.onsite.length} sin salida al final de la fecha`]
    ]);
    const bins=aggregate(d,interval);
    selectedBin=Math.min(selectedBin,bins.length-1);
    $('selectedInterval').innerHTML=bins.map((b,i)=>`<option value="${i}">${clock(b.start)}–${clock(b.end)}</option>`).join('');
    intervalDetail();
    $('crewSchedule').innerHTML=d.crews.length?d.crews.map(c=>`<div class="schedule-row"><strong>${c.name} · ${c.people} personas · ${clock(c.start)}–${clock(c.end)}</strong><span>${c.breaks.map(([a,b,label])=>`${label}: ${clock(a)}–${clock(b)}`).join(' · ')}</span></div>`).join(''):'<p>Sin actividad programada para el frente de obra.</p>';
    const missing=d.samples.filter(s=>s.count===null);
    $('coveragePanel').innerHTML=`<p class="coverage-number">${m.valid} / ${m.expected} muestras</p><div class="coverage-track" role="progressbar" aria-label="Cobertura de muestras" aria-valuenow="${Math.round(m.valid/m.expected*100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${m.valid/m.expected*100}%"></span></div><p class="construction-note">${missing.length?'Faltan: '+missing.map(s=>clock(s.minute)).join(', '):'Sin ventanas faltantes en la simulación.'}</p><p class="construction-note">${t.onsite.length} visitas sin salida al cierre de esta fecha. Cierre de obra: sin confirmación.</p>`;
    renderVisits();
  }
  function rangeDays() {
    const end=data.days.findIndex(d=>d.date===selectedDate), length=Number($('rangeLength').value);
    return length===31?data.days:data.days.slice(Math.max(0,end-length+1),end+1);
  }
  function trendChart(id,days,trafficChart=false) {
    const values=days.map(d=>trafficChart?traffic(d.date):metrics(d)), largest=trafficChart?Math.max(...values.map(v=>Math.max(v.entries.length,v.exits.length))):Math.max(...values.map(v=>v.peak??0));
    const max=trafficChart?Math.max(3,Math.ceil(largest/3)*3):27;
    const f=svgFrame(id,trafficChart?'Entradas y salidas de camiones':'Máximo visible por día',max,'Selecciona un día para consultar su jornada.');
    const step=(f.right-f.left)/days.length, tickEvery=Math.max(1,Math.ceil(days.length/(f.width<400?3:6)));
    days.forEach((d,i)=>{
      const center=f.left+step*(i+.5), v=values[i];
      if(trafficChart){const bw=step*.3;[['entries','chart-presence',-.33],['exits','chart-exit',.03]].forEach(([key,cls,shift])=>{const n=v[key].length;f.html+=`<rect class="${cls}" x="${center+step*shift}" y="${f.y(n)}" width="${bw}" height="${f.bottom-f.y(n)}"/>`;});}
      else {const n=v.peak??0;f.html+=`<rect class="chart-presence" x="${center-step*.3}" y="${f.y(n)}" width="${step*.6}" height="${f.bottom-f.y(n)}"/>`;}
      if(i%tickEvery===0)f.html+=`<text x="${center}" y="${f.bottom+20}" text-anchor="middle">${d.date.slice(8)}${d.date.slice(5,7)==='10'?'/10':'/9'}</text>`;
      f.html+=`<rect class="chart-hit" data-open-date="${d.date}" x="${f.left+step*i}" y="${f.top}" width="${step}" height="${f.bottom-f.top}"><title>${fmtDate(d.date)}: ${trafficChart?v.entries.length+' entradas / '+v.exits.length+' salidas':v.peak+' personas visibles máximo'}</title></rect>`;
    });
    f.html+=`<text x="3" y="14">${trafficChart?'Camiones':'Personas'}</text><text x="${f.right}" y="${f.height-5}" text-anchor="end">Fecha</text>`;
    f.svg.innerHTML=f.html;
  }
  function renderRange() {
    const days=rangeDays(), first=days[0].date, last=days.at(-1).date, inRange=date=>date&&date>=first&&date<=last;
    const entries=data.visits.filter(v=>inRange(v.entryDate)), exits=data.visits.filter(v=>inRange(v.exitDate));
    const complete=entries.filter(v=>v.exitAt), med=median(complete.map(duration)), expected=days.reduce((a,d)=>a+d.samples.length,0), valid=days.reduce((a,d)=>a+metrics(d).valid,0);
    $('rangeTitle').textContent=`${fmtDate(first)} — ${fmtDate(last)} 2026`;
    kpis('rangeStats',[
      ['Jornadas consultadas',days.length,`${days.filter(d=>d.type==='closed').length} sin actividad programada`],
      ['Camiones entraron / salieron',`${entries.length} / ${exits.length}`,`${traffic(last).onsite.length} sin salida al final del período`],
      ['Permanencia mediana',med===null?'—':`${Math.round(med)} min`,`${complete.length} visitas completadas · día de entrada`],
      ['Cobertura de presencia',`${(valid/expected*100).toFixed(1)}%`,`${valid}/${expected} muestras válidas`]
    ]);
    $('presenceHeatmap').innerHTML='<table><thead><tr><th>Fecha / turno</th>'+Array.from({length:13},(_,i)=>`<th>${i+6}:00</th>`).join('')+'</tr></thead><tbody>'+days.map(d=>`<tr><th><button type="button" data-open-date="${d.date}">${fmtDate(d.date)} · ${typeLabel(d)}</button></th>`+aggregate(d,60,360,1140).map(b=>{
      const n=b.count===null?null:Math.round(b.count), partial=b.valid<b.expected;
      return `<td class="heat-cell"><button type="button" class="${n===null?'no-data':''} ${partial?'partial':''}" data-open-date="${d.date}" data-minute="${b.start}" style="background:rgba(2,132,199,${n===null?0:.04+n/24*.46})" aria-label="${fmtDate(d.date)}, ${clock(b.start)}: ${n===null?'sin datos':n+' personas en promedio'}; ${b.valid}/${b.expected} muestras; ${typeLabel(d)}">${n??'—'}${partial?'*':''}</button></td>`;
    }).join('')+'</tr>').join('')+'</tbody></table>';
    trendChart('peakChart',days);trendChart('visitsChart',days,true);
    const materials=[...new Set(entries.map(v=>v.material))];
    $('materialSummary').innerHTML=materials.length?materials.map(material=>{const relevant=entries.filter(v=>v.material===material), completed=relevant.filter(v=>v.exitAt), m=median(completed.map(duration));return`<tr><td>${material}</td><td>${relevant.length}</td><td>${m===null?'—':Math.round(m)+' min'}${completed.length<relevant.length?' · '+(relevant.length-completed.length)+' abiertas':''}</td></tr>`;}).join(''):'<tr><td colspan="3">Sin entradas en este período.</td></tr>';
    const loadTypes=['Aparentemente vacío','Carga parcial','Carga visible','No verificable'];
    $('loadSummary').innerHTML=loadTypes.map(label=>{const n=exits.filter(v=>v.exitLoad===label).length;return`<div class="load-row"><span>${label}</span><div class="load-track"><span style="width:${exits.length?n/exits.length*100:0}%"></span></div><strong>${n}</strong></div>`;}).join('');
    $('dailyComparison').innerHTML=days.map(d=>{const m=metrics(d),t=traffic(d.date);return`<tr><td><button type="button" data-open-date="${d.date}">${fmtDate(d.date)} · ${typeLabel(d)}</button></td><td>${m.peak??'—'}</td><td>${m.first===null?'—':clock(m.first)}</td><td>${m.last===null?'—':clock(m.last)}</td><td>${t.entries.length} / ${t.exits.length}</td><td>${m.valid}/${m.expected}</td></tr>`;}).join('');
  }
  function render() {
    $('constructionDate').value=selectedDate;$('interval').value=interval;
    $('dayView').setAttribute('aria-pressed',String(view==='day'));$('rangeView').setAttribute('aria-pressed',String(view==='range'));
    $('jornadaPanel').hidden=view!=='day';$('rangePanel').hidden=view!=='range';$('rangeControl').hidden=view!=='range';
    const i=data.days.findIndex(d=>d.date===selectedDate);$('previousDate').disabled=i===0;$('nextDate').disabled=i===data.days.length-1;
    if(view==='day')renderDay();else renderRange();
    updateURL();
  }
  function openDate(date,minute) {selectedDate=date;view='day';selectedVisit=null;if(minute!==undefined)selectedBin=Math.max(0,Math.floor((Number(minute)-data.startMinute)/interval));render();}
  $('dayView').addEventListener('click',()=>{view='day';render();});$('rangeView').addEventListener('click',()=>{view='range';render();});
  $('constructionDate').addEventListener('change',e=>{selectedDate=e.target.value;selectedVisit=null;render();});
  [['previousDate',-1],['nextDate',1]].forEach(([id,step])=>$(id).addEventListener('click',()=>{const i=data.days.findIndex(d=>d.date===selectedDate);const d=data.days[i+step];if(d){selectedDate=d.date;selectedVisit=null;render();}}));
  $('interval').addEventListener('change',e=>{const minute=aggregate(day(),interval)[selectedBin].start;interval=Number(e.target.value);selectedBin=Math.floor((minute-data.startMinute)/interval);render();});
  $('selectedInterval').addEventListener('change',e=>{selectedBin=Number(e.target.value);intervalDetail();});
  [['previousInterval',-1],['nextInterval',1]].forEach(([id,step])=>$(id).addEventListener('click',()=>{selectedBin=Math.max(0,Math.min(aggregate(day(),interval).length-1,selectedBin+step));intervalDetail();}));
  $('rangeLength').addEventListener('change',render);
  document.querySelector('.construction-main').addEventListener('click',e=>{
    const visit=e.target.closest('[data-visit]');if(visit){selectedVisit=visit.dataset.visit;renderVisits();}
    const bin=e.target.closest('[data-bin]');if(bin){selectedBin=Number(bin.dataset.bin);intervalDetail();}
    const open=e.target.closest('[data-open-date]');if(open)openDate(open.dataset.openDate,open.dataset.minute);
  });
  let resizeFrame;
  new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(view==='day')presenceChart();else{const days=rangeDays();trendChart('peakChart',days);trendChart('visitsChart',days,true);}});}).observe(document.querySelector('.construction-main'));
  // Pure calculations are shared by the UI and validation; no photo data is used.
  window.CONSTRUCTION_METRICS={aggregate,metrics,traffic,duration,median};
  render();
})();
