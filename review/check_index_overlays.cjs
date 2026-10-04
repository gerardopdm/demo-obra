const {chromium}=require('C:/Users/gerardo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/index.html');await page.waitForSelector('#days button');
 await page.evaluate(()=>localStorage.removeItem('obra-supervision-2026-v1'));
 await page.locator('#days button').nth(1).click();await page.locator('#thumbs button').last().click();
 const expected=await page.evaluate(()=>window.OBRA_DETECTIONS.photos[document.getElementById('hero').getAttribute('src')].length);
 assert(await page.locator('#heroOverlay rect.truck').count()===1,'truck on 3-sep-2026 13:00');
 assert(expected>0,'positive fixture');assert(await page.locator('#heroOverlay rect').count()===expected,'daily people');
 await page.locator('#heroButton').click();assert(await page.locator('#fullOverlay rect').count()===expected,'enlarged people');await page.locator('#close').click();
 await page.locator('#showIndexPeople').uncheck();assert(await page.locator('#heroOverlay rect').count()===0,'toggle off');await page.locator('#showIndexPeople').check();
 await page.evaluate(()=>{const src=document.getElementById('hero').getAttribute('src');localStorage.setItem('obra-supervision-2026-v1',JSON.stringify({photos:{[src]:{boxes:[],reviewed:true}},events:[]}));document.getElementById('showIndexPeople').dispatchEvent(new Event('change'));});
 assert(await page.locator('#heroOverlay rect').count()===0,'respect supervisor correction');
 await page.evaluate(()=>localStorage.removeItem('obra-supervision-2026-v1'));await page.locator('#showIndexPeople').dispatchEvent('change');
 await page.locator('#compare').click();await page.locator('#from').selectOption('1');await page.locator('#to').selectOption('2');
 for(const id of ['before','after']){const count=await page.evaluate(id=>window.OBRA_DETECTIONS.photos[document.getElementById(id).getAttribute('src')].length,id);assert(await page.locator('#'+id+'Overlay rect').count()===count,'comparison '+id);}
 await page.locator('#daily').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'review/index-people-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');await page.screenshot({path:'review/index-people-mobile.png',fullPage:true});
 await page.locator('#heroButton').click();assert(await page.locator('#fullOverlay rect').count()===expected,'mobile enlargement');
 assert(errors.length===0,errors.join(';'));await browser.close();console.log('PASS: people overlays in daily, enlargement and comparison; toggle, saved corrections, desktop/mobile, no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
