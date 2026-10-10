import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const origin='https://fox-referrals.pages.dev';
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({bypassCSP:true});
const page=await context.newPage();
const consoleErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text().slice(0,160))});

try {
  await page.goto(`${origin}/api/admin/dashboard`,{waitUntil:'domcontentloaded'});
  const deadline=Date.now()+10*60_000;
  while(Date.now()<deadline){
    if(page.url()===`${origin}/api/admin/dashboard` && await page.locator('#lead-list').count()) break;
    await page.waitForTimeout(1000);
  }
  if(page.url()!==`${origin}/api/admin/dashboard` || !await page.locator('#lead-list').count()){
    throw new Error('Owner Access login did not complete within ten minutes.');
  }
  await page.addScriptTag({content:readFileSync(new URL('../node_modules/jsqr/dist/jsQR.js',import.meta.url),'utf8')});
  const result=await page.evaluate(async()=>{
    const read=async path=>{
      const response=await fetch(path,{headers:{Accept:'application/json'}});
      const data=await response.json().catch(()=>({}));
      return {response,data};
    };
    const overview=await read('/api/admin/overview');
    const partners=await read('/api/admin/partners?limit=100&page=1');
    const leads=await read('/api/admin/leads?limit=25&page=1');
    const completed=await read('/api/admin/leads?limit=25&page=1&status=COMPLETED');
    const commissions=await read('/api/admin/commissions?limit=25&page=1&status=PENDING');
    const invalid=await read('/api/admin/leads?status=PAID');
    const partner=partners.data.partners?.[0];
    if(!partner) throw new Error('No partner is available for QR validation.');
    const qrPath=`/api/admin/partners/${partner.id}/qr.svg`;
    const qrResponse=await fetch(qrPath);
    const qrBlob=await qrResponse.blob();
    const image=new Image();
    const imageUrl=URL.createObjectURL(qrBlob);
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=imageUrl});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=800;
    const drawing=canvas.getContext('2d');drawing.drawImage(image,0,0,800,800);
    const decoded=window.jsQR(drawing.getImageData(0,0,800,800).data,800,800)?.data;
    URL.revokeObjectURL(imageUrl);
    const download=await fetch(`${qrPath}?download=1`);
    return {
      dashboard:{title:document.title,lead_heading:document.querySelector('#leads-title')?.textContent,
        commission_heading:document.querySelector('#commissions-title')?.textContent},
      overview:{status:overview.response.status,cache:overview.response.headers.get('cache-control'),
        partners:overview.data.overview?.partners,open_leads:overview.data.overview?.open_leads,
        pending_reward_cents:overview.data.overview?.pending_reward_cents},
      partners:{status:partners.response.status,total:partners.data.total},
      leads:{status:leads.response.status,total:leads.data.total,page_rows:leads.data.leads?.length,
        completed_filter_total:completed.data.total},
      commissions:{status:commissions.response.status,total:commissions.data.total,
        page_rows:commissions.data.commissions?.length,reward_cents:commissions.data.totals?.reward_amount_cents},
      filters:{invalid_status:invalid.response.status,invalid_error:invalid.data.error},
      qr:{status:qrResponse.status,type:qrResponse.headers.get('content-type'),
        decoded_matches_claim_url:decoded===partner.claim_url,
        download_disposition:download.headers.get('content-disposition')?.startsWith('attachment;')===true}
    };
  });
  console.log(JSON.stringify({success:true,...result,console_errors:consoleErrors}));
} finally {
  await browser.close();
}
