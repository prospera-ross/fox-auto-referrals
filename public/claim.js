const form = document.querySelector('#claim-form');
const button = document.querySelector('#claim-button');
const errorBox = document.querySelector('#form-error');
const status = document.querySelector('#form-status');
const queryRef = new URLSearchParams(location.search).get('ref');
const historyRef = typeof history.state?.referral === 'string' ? history.state.referral : null;
const ref = queryRef || historyRef;
const validRef = typeof ref === 'string' && /^[a-z0-9-]{1,64}$/.test(ref);
const booking = 'https://booking.shopgenie.io/?shop=fox-auto-services-4101880591&preselect_account=fox-auto-services-4101880316';
let busy = false;
let previousPayload = '';
let requestKey = '';

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.focus();
}

if (!validRef) {
  showError('Open the link from your offer card to claim your discount.');
} else {
  if (queryRef) history.replaceState({ ...history.state, referral: ref }, '', location.pathname);
  button.disabled = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !validRef || !form.reportValidity()) return;
  const payload = JSON.stringify({
    ref, customer_name: form.elements.customer_name.value.trim(),
    customer_phone: form.elements.customer_phone.value.trim()
  });
  // Keep PII and the retry key only in this tab's memory, never browser storage.
  if (payload !== previousPayload) { requestKey = crypto.randomUUID(); previousPayload = payload; }
  busy = true;
  button.disabled = true;
  errorBox.hidden = true;
  status.textContent = 'Saving your offer…';
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
      body: payload, credentials: 'omit', signal: AbortSignal.timeout(12000)
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      if (response.status === 409) { requestKey = crypto.randomUUID(); }
      throw new Error(result.message || 'We could not save your details. Please try again.');
    }
    if (result.redirect_url !== booking) throw new Error('We could not open booking. Please try again.');
    status.textContent = 'Offer saved. Opening appointments…';
    location.assign(booking);
  } catch (error) {
    status.textContent = '';
    showError(error.name === 'TimeoutError' || error.name === 'TypeError'
      ? 'Check your connection and try again. Your details will not be submitted twice.'
      : error.message);
    busy = false;
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
