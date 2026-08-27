import { chromium } from 'playwright';
const secs = ['heroA','heroB','servicios','galeria','testimonio','contacto'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  proxy: { server: process.env.HTTPS_PROXY },
  args: ['--ignore-certificate-errors'] });
for (const [w,tag] of [[1440,'desk'],[390,'mob']]) {
  const p = await b.newPage({ viewport:{width:w,height:900}, deviceScaleFactor:1 });
  const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('file://'+process.cwd()+'/index.html', { waitUntil:'load' });
  await p.waitForTimeout(1500);
  const font = await p.evaluate(()=>{
    const h=document.querySelector('h1');
    return { usa: getComputedStyle(h).fontFamily, cargada: document.fonts.check('700 48px "Bricolage Grotesque"') };
  });
  console.log(tag, 'fuente:', font.cargada ? 'Bricolage OK' : 'NO CARGADA', '|', font.usa.split(',')[0]);
  if (errs.length) console.log(tag, 'errores consola:', errs.slice(0,3));
  for (const s of secs) await p.locator('#'+s).screenshot({ path:`${s}-${tag}.png` });
  await p.close();
}
await b.close();
