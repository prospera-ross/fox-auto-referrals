import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { adminRoute } from '../src/admin/route.ts';
import { database, localEnv } from './helpers.mjs';
import QRCode from 'qrcode';

test('admin dashboard renders its ledger and responsive registration flow',async({page})=>{
  const db=database(),env=localEnv(db);
  const response=await adminRoute(new Request('http://localhost:8788/api/admin/dashboard'),env,async()=> 'operator');
  const markup=await response.text();
  const partners=[{
    id:'11111111-1111-4111-8111-111111111111',name:'Main Street Cafe',phone:'+12025550188',
    referral_code:'main-street-cafe',reward_amount_cents:1000,active:true,created_at:'2026-10-10T12:00:00.000Z',
    updated_at:'2026-10-10T12:00:00.000Z',version:1,claim_url:'http://localhost:8788/claim?ref=main-street-cafe'
  }];
  const qrTarget='http://localhost:8788/claim?ref=main-street-cafe';
  const qrSvg=await QRCode.toString(qrTarget,{type:'svg',errorCorrectionLevel:'H',margin:4,color:{dark:'#16334aff',light:'#ffffffff'}});
  await page.route('http://localhost:8788/api/admin/dashboard',route=>route.fulfill({contentType:'text/html',body:markup}));
  await page.route('**/admin/admin.css',route=>route.fulfill({contentType:'text/css',body:readFileSync(new URL('../public/admin/admin.css',import.meta.url),'utf8')}));
  await page.route('**/admin/admin.js',route=>route.fulfill({contentType:'application/javascript',body:readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8')}));
  await page.route('**/fox-logo.png',route=>route.fulfill({contentType:'image/png',body:readFileSync(new URL('../public/fox-logo.png',import.meta.url))}));
  await page.route('**/api/admin/overview',route=>route.fulfill({json:{overview:{partners:1,active_partners:1,open_leads:3,pending_commissions:1,pending_reward_cents:1000}}}));
  await page.route(/\/api\/admin\/partners(?:\?.*)?$/,route=>route.fulfill({json:{partners,page:1,limit:100,total:1}}));
  await page.route(/\/api\/admin\/leads(?:\?.*)?$/,route=>route.fulfill({json:{leads:[{
    id:'lead-1',customer_name:'Sample Customer',customer_phone:'+12025550124',customer_email:'sample@example.test',
    status:'CLAIMED',created_at:'2026-10-10T13:00:00.000Z',reward_amount_cents:1000,partner_id:partners[0].id,
    partner_name:partners[0].name,referral_code:partners[0].referral_code,commission_status:null,commission_amount_cents:null,
    invoice_id:null,payment_date:null
  }],page:1,limit:25,total:1}}));
  await page.route(/\/api\/admin\/commissions(?:\?.*)?$/,route=>route.fulfill({json:{commissions:[{
    id:'commission-1',lead_id:'lead-1',customer_name:'Sample Customer',customer_phone:'+12025550124',
    customer_email:'sample@example.test',partner_id:partners[0].id,partner_name:partners[0].name,
    referral_code:partners[0].referral_code,invoice_id:'1039',amount_paid_cents:22500,reward_amount_cents:1000,
    status:'PENDING',payment_date:'2026-10-10',created_at:'2026-10-10T14:00:00.000Z'
  }],page:1,limit:25,total:1,totals:{amount_paid_cents:22500,reward_amount_cents:1000}}}));
  await page.route(/\/api\/admin\/partners\/[^/]+\/qr\.svg(?:\?.*)?$/,route=>route.fulfill({contentType:'image/svg+xml',body:qrSvg}));
  await page.goto('http://localhost:8788/api/admin/dashboard',{waitUntil:'networkidle'});
  await page.addScriptTag({content:readFileSync(new URL('../node_modules/jsqr/dist/jsQR.js',import.meta.url),'utf8')});
  await expect(page.getByRole('heading',{name:'Referral operations'})).toBeVisible();
  await expect(page.locator('#partner-list').getByText('Main Street Cafe')).toBeVisible();
  await expect(page.locator('#partner-list .money')).toHaveText('$10.00');
  await expect(page.locator('#partners')).toBeVisible();
  await expect(page.locator('#leads')).toBeHidden();
  await expect(page.locator('[data-view-link="partners"]')).toHaveAttribute('aria-current','page');
  await page.getByRole('link',{name:/Leads/}).click();
  await expect(page.locator('#leads')).toBeVisible();
  await expect(page.locator('[data-view-link="leads"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('[data-view-link="partners"]')).not.toHaveAttribute('aria-current','page');
  await expect(page.locator('#lead-list')).toContainText('Sample Customer');
  await page.screenshot({path:'test-results/admin-dashboard-leads.png',fullPage:true});
  await page.getByRole('link',{name:/Commissions/}).click();
  await expect(page.locator('#commissions')).toBeVisible();
  await expect(page.locator('[data-view-link="commissions"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#commission-list')).toContainText('1039');
  await expect(page.locator('#commission-totals')).toContainText('$225.00');
  await page.screenshot({path:'test-results/admin-dashboard-commissions.png',fullPage:true});
  await page.getByRole('link',{name:/Partners/}).click();
  await page.getByRole('button',{name:'QR card'}).click();
  await expect(page.locator('#qr-dialog')).toBeVisible();
  await expect(page.locator('#qr-code')).toHaveText('main-street-cafe');
  const decoded=await page.locator('#qr-image').evaluate(async image=>{
    await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=600;
    const context=canvas.getContext('2d');context.drawImage(image,0,0,600,600);
    return window.jsQR(context.getImageData(0,0,600,600).data,600,600)?.data;
  });
  expect(decoded).toBe(qrTarget);
  await page.screenshot({path:'test-results/admin-dashboard-qr.png',fullPage:true});
  await page.getByRole('button',{name:'Close'}).last().click();
  await page.screenshot({path:'test-results/admin-dashboard.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/admin-dashboard-mobile.png',fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('link',{name:/Leads/}).click();
  await expect(page.locator('[data-view-link="leads"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('[data-view-link="leads"]')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.mouse.move(380,840);
  await page.screenshot({path:'test-results/admin-dashboard-leads-mobile.png',fullPage:true});
  await page.getByRole('link',{name:/Partners/}).click();
  await page.getByRole('button',{name:'Register partner'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:'test-results/admin-dashboard-dialog-mobile.png',fullPage:true});
  db.sqlite.close();
});
