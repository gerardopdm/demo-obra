const {chromium}=require('C:/Users/gerardo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/construction.html');
 await page.waitForSelector('#dailyStats .kpi-value');
 assert((await page.locator('#dailyStats').innerText()).includes('6 / 6'),'six arrivals and departures');
 assert(await page.locator('#visitsTable tr').count()===6,'six coherent visits');
 const before=await page.locator('#dailyStats').innerText();
 await page.locator('#interval').selectOption('10');
 assert(await page.locator('#selectedInterval option').count()===75,'10min observations');
 await page.locator('#interval').selectOption('60');
 assert(await page.locator('#selectedInterval option').count()===13,'hourly bins');
 assert(await page.locator('#dailyStats').innerText()===before,'aggregation preserves counts and peak');
 await page.locator('#visitsTable [data-visit]').nth(2).click();
 assert((await page.locator('#truckDetail').innerText()).includes('Tambor cerrado'),'closed mixer stays unverifiable');
 const calculations=await page.evaluate(()=>{
  const D=CONSTRUCTION_DATA,M=CONSTRUCTION_METRICS;
  const a=D.days.find(d=>d.date==='2026-09-03'), m=M.metrics(a);
  const med=M.median(D.visits.filter(v=>v.entryDate===a.date).map(M.duration));
  const gaps=D.days.find(d=>d.date==='2026-09-15');
  return {m,med,gap:M.aggregate(gaps,60,360,1140).find(b=>b.start===900),
   sep9:M.traffic('2026-09-09').onsite.length,sep10:M.traffic('2026-09-10').exits.length,
   final:M.traffic('2026-10-02').onsite.length,
   bad:D.visits.filter(v=>v.exitAt&&M.duration(v)<=0).length,
   invalidSamples:D.days.flatMap(d=>d.samples).filter(s=>s.count!==null&&s.count<0).length};
 });
 assert(calculations.m.first===430&&calculations.m.last===1120&&calculations.m.peak===24,'first last and peak');
 assert(calculations.med===52.5,'median from visit events');
 assert(calculations.gap.count===null&&calculations.gap.valid===0,'complete missing hour is null');
 assert(calculations.sep9===1&&calculations.sep10>=5&&calculations.final===1,'overnight and open visits');
 assert(calculations.bad===0&&calculations.invalidSamples===0,'nonnegative meaningful records');
 await page.locator('#constructionDate').selectOption('2026-09-15');
 await page.locator('#interval').selectOption('10');
 await page.locator('#selectedInterval').selectOption('51');
 assert((await page.locator('#intervalDetail').innerText()).includes('Sin datos'),'missing data detail');
 await page.locator('#rangeView').click();
 await page.locator('#rangeLength').selectOption('31');
 assert(await page.locator('#dailyComparison tr').count()===31,'whole period daily comparison');
 assert(await page.locator('#presenceHeatmap .no-data').count()>=1,'missing heatmap separate from zero');
 await page.locator('#presenceHeatmap [data-open-date="2026-09-06"]').first().click();
 assert(await page.locator('#jornadaPanel').isVisible(),'heatmap opens daily');
 assert((await page.locator('#scheduleSummary').innerText()).includes('Sin actividad programada'),'Sunday schedule');
 await page.locator('#constructionDate').selectOption('2026-09-03');
 await page.locator('#interval').selectOption('30');
 await page.screenshot({path:'review/construction-desktop.png',fullPage:true});
 for(const width of [1024,736,390,320]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'daily overflow '+width);
  await page.locator('#rangeView').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'range overflow '+width);
  await page.locator('#dayView').click();
 }
 await page.screenshot({path:'review/construction-mobile.png',fullPage:true});
 await page.reload();assert(await page.locator('#constructionDate').inputValue()==='2026-09-03','URL state restored');
 for(const file of ['index.html','supervision.html']){await page.goto('http://127.0.0.1:8765/'+file);assert(await page.locator('.mobile-nav a[href="construction.html"]').count()===1,'mobile menu '+file);assert(await page.locator('.sidebar a[href="construction.html"]').count()===1,'desktop menu '+file);}
 assert(errors.length===0,errors.join('; '));
 await browser.close();console.log('PASS: dates, intervals, coherent events, missing data, overnight visits, comparison, menu, responsive layout and no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
