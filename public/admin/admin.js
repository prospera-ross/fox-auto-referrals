const overview=document.querySelector('#overview');
const list=document.querySelector('#partner-list');
const message=document.querySelector('#page-message');
const dialog=document.querySelector('#partner-dialog');
const form=document.querySelector('#partner-form');
const formError=document.querySelector('#form-error');
const qrDialog=document.querySelector('#qr-dialog');
const leadForm=document.querySelector('#lead-filters');
const commissionForm=document.querySelector('#commission-filters');
const validViews=new Set(['partners','leads','commissions']);
let partners=[];
const pages={leads:1,commissions:1};

const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const phone=value=>value?.startsWith('+1')?`(${value.slice(2,5)}) ${value.slice(5,8)}-${value.slice(8)}`:value;
const date=value=>value?new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(value.length===10?`${value}T12:00:00Z`:value)):'—';
const el=(name,className,text)=>{const node=document.createElement(name);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
const records=value=>`${value} record${value===1?'':'s'}`;

async function api(path,options={}){
  const response=await fetch(`/api/admin/${path}`,{headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||'The dashboard could not complete that action.');
  return data;
}
function setMessage(text,error=false,node=message){node.textContent=text;node.classList.toggle('error',error)}
function setCount(kind,value){
  const count=document.querySelector(`#${kind}-count`),nav=document.querySelector(`#${kind}-nav-count`);
  if(count)count.textContent=records(value);if(nav)nav.textContent=String(value);
}
function setView(name,{updateHash=false,focus=false}={}){
  const view=validViews.has(name)?name:'partners';
  document.querySelectorAll('[data-view]').forEach(panel=>panel.hidden=panel.dataset.view!==view);
  document.querySelectorAll('[data-view-link]').forEach(link=>{
    if(link.dataset.viewLink===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
  if(updateHash)history.replaceState(null,'',`#${view}`);
  if(focus)document.querySelector(`#${view} h2`)?.focus({preventScroll:true});
}
function contactCell(record){
  const cell=el('td','contact');cell.append(el('strong','',record.customer_name),el('span','',phone(record.customer_phone)));
  if(record.customer_email)cell.append(el('span','',record.customer_email));return cell;
}
function statusCell(value){const cell=el('td');cell.append(el('span',`status status-${value.toLowerCase()}`,value));return cell}
function query(form,page){const params=new URLSearchParams();for(const [key,value] of new FormData(form))if(value)params.set(key,value);params.set('page',String(page));params.set('limit','25');return params}
function renderPagination(node,kind,data,loader){
  node.replaceChildren();const totalPages=Math.max(1,Math.ceil(data.total/data.limit));
  const label=el('span','',`${records(data.total)} · Page ${data.page} of ${totalPages}`);
  const controls=el('div');const previous=el('button','quiet','Previous'),next=el('button','quiet','Next');
  previous.type=next.type='button';previous.disabled=data.page<=1;next.disabled=data.page>=totalPages;
  previous.addEventListener('click',()=>{pages[kind]-=1;loader()});next.addEventListener('click',()=>{pages[kind]+=1;loader()});
  controls.append(previous,next);node.append(label,controls);
}
async function loadOverview(){
  const {overview:data}=await api('overview');
  const values=[data.partners,data.open_leads,data.pending_commissions,money(data.pending_reward_cents)];
  [...overview.querySelectorAll('dd')].forEach((node,index)=>node.textContent=values[index]);
}
function openQr(partner){
  const src=`/api/admin/partners/${partner.id}/qr.svg`;
  const image=document.querySelector('#qr-image');image.src=src;image.alt=`QR code for ${partner.name}'s claim page`;
  document.querySelector('#qr-partner').textContent=partner.name;document.querySelector('#qr-code').textContent=partner.referral_code;
  document.querySelector('#qr-url').textContent=partner.claim_url;const download=document.querySelector('#qr-download');download.href=`${src}?download=1`;download.download=`fox-referral-${partner.referral_code}.svg`;
  qrDialog.showModal();
}
function renderPartner(partner){
  const row=el('article','partner-row');row.dataset.active=String(partner.active);
  const identity=el('div','partner-name');identity.append(el('span','status-mark'));
  const identityCopy=el('div');identityCopy.append(el('strong','',partner.name),el('span','code',partner.referral_code));identity.append(identityCopy);
  const meta=el('div','partner-meta');meta.append(el('span','',phone(partner.phone)),el('small','',partner.active?'Accepting new claims':'Inactive'));
  const reward=el('div','money',money(partner.reward_amount_cents));
  const created=el('div','partner-phone',date(partner.created_at));
  const actions=el('div','row-actions');
  const qr=el('button','','QR card');qr.type='button';qr.addEventListener('click',()=>openQr(partner));
  const copy=el('button','','Copy link');copy.type='button';copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(partner.claim_url);setMessage(`Copied ${partner.name}'s claim link.`)}
    catch{setMessage('The link could not be copied. Open the QR card to read it.',true)}
  });
  const toggle=el('button','',partner.active?'Deactivate':'Activate');toggle.type='button';toggle.addEventListener('click',()=>togglePartner(partner));actions.append(qr,copy,toggle);
  row.append(identity,meta,reward,created,actions);return row;
}
function partnerOptions(){
  document.querySelectorAll('.filters select[name=partner_id]').forEach(select=>{
    const selected=select.value;select.replaceChildren(new Option('All partners',''),...partners.map(partner=>new Option(partner.name,partner.id)));select.value=selected;
  });
}
async function loadPartners(){
  list.setAttribute('aria-busy','true');
  try{
    const data=await api('partners?limit=100&page=1');partners=data.partners;setCount('partner',data.total);partnerOptions();
    list.replaceChildren(...(partners.length?partners.map(renderPartner):[el('p','empty','No referral partners yet. Register the first partner to create a claim link.')]));
  }finally{list.setAttribute('aria-busy','false')}
}
async function loadLeads(){
  const target=document.querySelector('#lead-list'),notice=document.querySelector('#lead-message');target.setAttribute('aria-busy','true');setMessage('',false,notice);
  try{
    const data=await api(`leads?${query(leadForm,pages.leads)}`);setCount('lead',data.total);
    const rows=data.leads.map(lead=>{const row=document.createElement('tr');row.append(el('td','nowrap',date(lead.created_at)),contactCell(lead),el('td','',lead.partner_name),statusCell(lead.status),el('td','money',money(lead.commission_amount_cents??lead.reward_amount_cents)));return row});
    target.replaceChildren(...rows);if(!rows.length){const row=document.createElement('tr'),cell=el('td','empty','No leads match these filters.');cell.colSpan=5;row.append(cell);target.append(row)}renderPagination(document.querySelector('#lead-pagination'),'leads',data,loadLeads);
  }catch(error){setMessage(error.message,true,notice)}finally{target.removeAttribute('aria-busy')}
}
async function loadCommissions(){
  const target=document.querySelector('#commission-list'),notice=document.querySelector('#commission-message');target.setAttribute('aria-busy','true');setMessage('',false,notice);
  try{
    const data=await api(`commissions?${query(commissionForm,pages.commissions)}`);setCount('commission',data.total);
    const rows=data.commissions.map(item=>{const row=document.createElement('tr');row.append(el('td','nowrap',date(item.created_at)),el('td','nowrap',date(item.payment_date)),contactCell(item),el('td','',item.partner_name),el('td','code',item.invoice_id),el('td','money',money(item.amount_paid_cents)),el('td','money',money(item.reward_amount_cents)),statusCell(item.status));return row});
    target.replaceChildren(...rows);if(!rows.length){const row=document.createElement('tr'),cell=el('td','empty','No commissions match these filters.');cell.colSpan=8;row.append(cell);target.append(row)}
    const totals=document.querySelector('#commission-totals');totals.replaceChildren();[['Filtered sales',money(data.totals.amount_paid_cents)],['Recorded rewards',money(data.totals.reward_amount_cents)]].forEach(([label,value])=>{const block=document.createElement('div');block.append(el('span','',label),el('strong','',value));totals.append(block)});
    renderPagination(document.querySelector('#commission-pagination'),'commissions',data,loadCommissions);
  }catch(error){setMessage(error.message,true,notice)}finally{target.removeAttribute('aria-busy')}
}
async function togglePartner(partner){
  setMessage('Saving partner status…');
  try{await api(`partners/${partner.id}`,{method:'PATCH',body:JSON.stringify({version:partner.version,active:!partner.active})});await Promise.all([loadPartners(),loadOverview()]);setMessage(`${partner.name} is now ${partner.active?'inactive':'active'}.`)}
  catch(error){setMessage(error.message,true)}
}

document.querySelector('#today').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
setView(location.hash.slice(1));
document.querySelectorAll('[data-view-link]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();setView(link.dataset.viewLink,{updateHash:true,focus:true})}));
addEventListener('hashchange',()=>setView(location.hash.slice(1)));
document.querySelector('#new-partner').addEventListener('click',()=>{form.reset();formError.hidden=true;dialog.showModal()});
dialog.querySelectorAll('[formmethod=dialog]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();dialog.close()}));
qrDialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>qrDialog.close()));
for(const [filterForm,kind,loader] of [[leadForm,'leads',loadLeads],[commissionForm,'commissions',loadCommissions]]){
  filterForm.addEventListener('submit',event=>{event.preventDefault();pages[kind]=1;loader()});
  filterForm.addEventListener('reset',()=>setTimeout(()=>{pages[kind]=1;loader()}));
}
form.addEventListener('submit',async event=>{
  event.preventDefault();formError.hidden=true;
  const values=new FormData(form),amount=String(values.get('reward_dollars')??'');
  if(!/^\d+(?:\.\d{1,2})?$/.test(amount)){formError.textContent='Enter the reward as dollars and cents.';formError.hidden=false;return}
  const [whole,fraction='']=amount.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  const payload={name:values.get('name'),phone:values.get('phone'),referral_code:values.get('referral_code'),reward_amount_cents:cents};
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{const data=await api('partners',{method:'POST',body:JSON.stringify(payload)});dialog.close();await Promise.all([loadPartners(),loadOverview()]);setMessage(`${data.partner.name} is ready. Open the QR card to download it.`)}
  catch(error){formError.textContent=error.message;formError.hidden=false}
  finally{submit.disabled=false}
});
Promise.all([loadOverview(),loadPartners(),loadLeads(),loadCommissions()]).catch(error=>setMessage(error.message,true));
