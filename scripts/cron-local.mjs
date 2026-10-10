// Local emulation only. Never expose the API/debug port through a public tunnel.
const watch=process.argv.includes('--watch');
do {
  try {
    const url=new URL('http://127.0.0.1:8787/__scheduled');
    url.searchParams.set('cron','* * * * *');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
    await response.body?.cancel();
    if(!response.ok)throw new Error('not_ok');
    console.log('Local scheduled handler invoked; inspect jobs/connection to verify the outcome.');
  } catch {
    console.error('Could not invoke local scheduler. Start npm.cmd run dev:api first.');
    if(!watch)process.exitCode=1;
  }
  if(watch)await new Promise(resolve=>setTimeout(resolve,60000));
} while(watch);
