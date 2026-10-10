import { test, expect } from '@playwright/test';
import { oauthRoute } from '../src/quickbooks/oauth.ts';
import { database } from './helpers.mjs';

test('connect form preserves Origin through real OAuth checks and permits the Intuit redirect', async ({ page }) => {
  const origin='https://fox-referrals.pages.dev';
  const db=database();
  const env={DB:db,APP_ENV:'staging',PUBLIC_ORIGIN:origin,QB_ENABLED:'true',QB_CLIENT_ID:'synthetic',
    QB_CLIENT_SECRET:'synthetic',QB_TOKEN_KEY:'synthetic',QB_REALM_ID:'12345',QB_MINOR_VERSION:'75',
    QB_REDIRECT_URI:`${origin}/api/quickbooks/callback`};
  const response=await oauthRoute(new Request(`${origin}/api/quickbooks/connect`),env,fetch,async()=>'fixture-owner');
  const body=await response.text();
  let submittedOrigin;
  const externalReferrers=[];
  // CDP interception handles every redirect hop; Playwright URL routing can
  // handle only the first URL in a redirected request chain.
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  cdp.on('Fetch.requestPaused',async ({requestId,request})=>{
    let status=418,headers={'Content-Type':'text/plain'},content='Unexpected request blocked';
    if(request.url===`${origin}/api/quickbooks/connect`) {
      if(request.method==='POST') {
        submittedOrigin=new Headers(request.headers).get('Origin');
        try {
          const submitted=await oauthRoute(new Request(request.url,{method:'POST',headers:request.headers}),env,
            async()=>{throw new Error('Provider requests must be intercepted');},async()=>'fixture-owner');
          status=submitted.status;headers=Object.fromEntries(submitted.headers);content=await submitted.text();
        } catch(error) {status=error.status??500;headers={'Content-Type':'text/plain'};content=error.code??'Unexpected test failure';}
      }
      else {status=response.status;headers=Object.fromEntries(response.headers);content=body;}
    } else if(request.url.startsWith('https://appcenter.intuit.com/')) {
      externalReferrers.push(new Headers(request.headers).get('Referer'));
      status=302;headers={Location:'https://accounts.intuit.com/synthetic-login'};content='';
    } else if(request.url==='https://accounts.intuit.com/synthetic-login') {
      externalReferrers.push(new Headers(request.headers).get('Referer'));
      status=200;headers={'Content-Type':'text/html'};content='<h1>Intuit redirect intercepted</h1>';
    }
    await cdp.send('Fetch.fulfillRequest',{requestId,responseCode:status,
      responseHeaders:Object.entries(headers).map(([name,value])=>({name,value})),body:Buffer.from(content).toString('base64')});
  });
  try {
    await page.goto(`${origin}/api/quickbooks/connect`);
    const submitted=page.waitForResponse(r=>r.url()===`${origin}/api/quickbooks/connect`&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Authorize sandbox company'}).click();
    expect((await submitted).status()).toBe(303);
    expect(submittedOrigin).toBe(origin);
    await expect(page.getByRole('heading')).toHaveText('Intuit redirect intercepted');
    expect(externalReferrers).toEqual([null,null]);
    expect(db.sqlite.prepare('SELECT count(*) n FROM qb_oauth_states').get().n).toBe(1);
  } finally {db.sqlite.close();}
});

test('responsive claim page, durable API save and fixed booking redirect', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Never send fixture details to the external booking provider.
  await page.route('https://booking.shopgenie.io/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Booking destination intercepted</h1>' }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/claim?ref=restaurant-x');
  await expect(page).toHaveURL(/\/claim$/);
  await expect(page.getByRole('img',{name:'Fox Auto Services'})).toBeVisible();
  await expect.poll(()=>page.getByRole('img',{name:'Fox Auto Services'}).evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("You've unlocked 50% OFF");
  await expect(page.getByRole('button', { name: /Claim Discount/ })).toBeEnabled();
  await page.screenshot({ path: 'test-results/claim-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/claim-mobile.png', fullPage: true });
  await page.getByLabel('Full name').fill('Browser Fixture');
  await page.getByLabel('Phone number').fill('(202) 555-0177');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/claim') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Claim Discount/ }).click();
  const claimResponse = await saved;
  expect(claimResponse.status()).toBe(200);
  expect(claimResponse.request().postDataJSON()).toEqual({
    ref: 'restaurant-x', customer_name: 'Browser Fixture', customer_phone: '(202) 555-0177'
  });
  await expect(page).toHaveURL('https://booking.shopgenie.io/?shop=fox-auto-services-4101880591&preselect_account=fox-auto-services-4101880316');
  expect(errors).toEqual([]);
});

test('valid referral is removed from the shareable URL and survives a same-tab refresh', async ({ page }) => {
  await page.goto('/claim?ref=restaurant-x');
  await expect(page).toHaveURL(/\/claim$/);
  await expect(page.getByRole('button', { name: /Claim Discount/ })).toBeEnabled();
  await page.reload();
  await expect(page).toHaveURL(/\/claim$/);
  await expect(page.getByRole('button', { name: /Claim Discount/ })).toBeEnabled();
});

test('missing referral and failed save never redirect; retry keeps same intent', async ({ page }) => {
  expect((await page.request.get('/api/quickbooks/connect')).status()).toBe(503);
  await page.goto('/claim');
  await expect(page.getByRole('button', { name: /Claim Discount/ })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('offer card');
  const keys = [];
  await page.route('**/api/claim', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Please try again.' }) });
  });
  await page.goto('/claim?ref=restaurant-x');
  await expect(page).toHaveURL(/\/claim$/);
  await page.getByLabel('Full name').fill('Retry Fixture');
  await page.getByLabel('Phone number').fill('2025550178');
  await page.getByRole('button', { name: /Claim Discount/ }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again.');
  await expect(page).toHaveURL(/\/claim$/);
  await page.getByRole('button', { name: /Claim Discount/ }).click();
  await expect(page.getByRole('button', { name: /Claim Discount/ })).toBeEnabled();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
});
