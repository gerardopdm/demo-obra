/* Simulación independiente de fotografías y detecciones. Todas las horas son de la obra. */
(() => {
  'use strict';
  const START = 390, END = 1140, STEP = 10;
  const anchors = [0, 0, 13, 16, 17, 18, 23, 9, 24, 24, 23, 15, 24, 24, 8, 16, 16, 23, 22, 22, 9, 8, 7, 5, 2, 0];
  const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const instant = (date, minute) => `${date}T${clock(minute)}:00-06:00`;
  const days = [], visits = [];
  const templates = [
    ['Volteo', 'Arena', 'Entrega', 465, 515, 'Carga visible', 'Aparentemente vacío'],
    ['Plataforma', 'Varilla', 'Entrega', 560, 665, 'Carga visible', 'Aparentemente vacío'],
    ['Revolvedora', 'Concreto', 'Entrega', 700, 745, 'No verificable', 'No verificable'],
    ['Volteo', 'Grava', 'Entrega', 850, 900, 'Carga visible', 'Carga parcial'],
    ['Plataforma', 'Block', 'Entrega', 920, 995, 'Carga visible', 'Carga parcial'],
    ['Volteo', 'Escombro', 'Retiro', 1010, 1065, 'Aparentemente vacío', 'Carga visible']
  ];
  for (let offset = 0; offset < 31; offset++) {
    const dateObject = new Date(Date.UTC(2026, 8, 2 + offset));
    const date = dateObject.toISOString().slice(0, 10), weekday = dateObject.getUTCDay();
    const type = weekday === 0 ? 'closed' : weekday === 6 ? 'short' : 'regular';
    const crews = type === 'closed' ? [] : type === 'short'
      ? [{name: 'Cuadrilla A', people: 14, start: 450, end: 810, breaks: [[600, 615, 'Pausa']]}]
      : [{name: 'Cuadrilla A', people: 18, start: 450, end: 990, breaks: [[600, 615, 'Pausa'], [795, 840, 'Comida']]},
         {name: 'Cuadrilla B', people: 10, start: 570, end: 1110, breaks: [[720, 735, 'Pausa'], [840, 885, 'Comida']]}];
    const samples = [];
    for (let m = START, i = 0; m < END; m += STEP, i++) {
      const a = Math.floor(i / 3), f = i % 3 / 3;
      let count = Math.round(anchors[a] * (1 - f) + anchors[a + 1] * f);
      if (m === 430) count = 4;
      if (m === 440) count = 9;
      if (m === 1120) count = 1;
      if (m >= 1130) count = 0;
      if (type === 'closed') count = 0;
      else if (type === 'short') count = m < 430 || m >= 820 ? 0 : Math.min(14, Math.round(count * .6));
      else if (date !== '2026-09-03') count = Math.max(0, Math.min(24, count + ((i + offset) % 5 === 0 ? -2 : 0)));
      // Include partial and complete gaps so missing coverage is never disguised as zero.
      const missing = date === '2026-09-04' && m >= 960 && m < 990
        || date === '2026-09-15' && m >= 900 && m < 960;
      samples.push({at: instant(date, m), minute: m, count: missing ? null : count,
        quality: missing ? 'missing' : 'valid', source: 'demo', zoneId: 'work-front', windowSeconds: 30});
    }
    days.push({date, type, crews, plannedClose: crews.length ? Math.max(...crews.map(c => c.end)) : null,
      confirmedClose: null, samples, source: 'demo'});
    const count = type === 'closed' ? 0 : type === 'short' ? 3 : date === '2026-09-03' ? 6 : 4 + offset % 3;
    templates.slice(0, count).forEach((t, i) => {
      const shift = date === '2026-09-03' || type === 'short' ? 0 : (offset % 3 - 1) * 5;
      visits.push({id: `${date}-T${String(i + 1).padStart(3, '0')}`, label: `T-${String(i + 1).padStart(3, '0')}`,
        vehicle: t[0], material: t[1], operation: t[2], entryDate: date, entryMinute: t[3] + shift,
        exitDate: date, exitMinute: t[4] + shift, entryAt: instant(date, t[3] + shift), exitAt: instant(date, t[4] + shift),
        entryLoad: t[5], exitLoad: t[6], loadNote: t[0] === 'Revolvedora' ? 'Tambor cerrado: no permite verificar el interior.' : 'Apariencia visual; no certifica peso ni descarga completa.',
        source: 'demo', materialSource: 'Remisión simulada', loadSource: 'Observación visual simulada', association: 'Referencia operativa simulada'});
    });
  }
  function special(date, id, material, entry, exitDate, exitMinute) {
    visits.push({id: `${date}-${id}`, label: id, vehicle: 'Plataforma', material, operation: 'Entrega',
      entryDate: date, entryMinute: entry, entryAt: instant(date, entry), exitDate, exitMinute,
      exitAt: exitDate ? instant(exitDate, exitMinute) : null, entryLoad: 'Carga visible',
      exitLoad: exitDate ? 'Aparentemente vacío' : 'Pendiente', loadNote: exitDate ? 'Salida registrada al día siguiente.' : 'Sin evento de salida al corte de la demostración.',
      source: 'demo', materialSource: 'Remisión simulada', loadSource: 'Observación visual simulada', association: 'Referencia operativa simulada'});
  }
  special('2026-09-09', 'T-007', 'Cimbra', 1095, '2026-09-10', 460);
  special('2026-10-02', 'T-007', 'Cimbra', 1040, null, null);
  window.CONSTRUCTION_DATA = {source: 'demo', timezone: 'America/Mexico_City', utcOffset: '-06:00',
    startMinute: START, endMinute: END, sampleMinutes: STEP, days, visits};
})();
