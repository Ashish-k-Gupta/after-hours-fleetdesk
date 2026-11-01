export const INQUIRY_ENDPOINT = '/';
const FORM_NAME = 'after-hours-inquiry';
const SUBJECT = 'After Hours - weekend and after-hours coverage inquiry';
const PREVIEW_NOTE = 'Preview only: this page does not send inquiries. Please use the direct email link below.';
const UNAVAILABLE_NOTE = 'The form is temporarily unavailable. Please email us directly below.';
const FAILED_NOTE = 'Your inquiry could not be sent. Your details are still here; please try again or email us directly below.';

export function setupInquiryForm(form, environment = globalThis) {
  const button = form.querySelector('[data-inquiry-submit]');
  const fields = form.querySelector('[data-inquiry-fields]');
  const status = form.querySelector('[data-inquiry-status]');
  const field = name => form.elements.namedItem(name);
  const names = ['name', 'email', 'fleet-size', 'message'];
  const hostname = environment.location.hostname.toLowerCase();
  const local = !hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1' || hostname === '[::1]' || /^(127|10)\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  // Netlify removes these registration attributes when it processes the HTML.
  // Leave unprocessed previews disabled so a static host cannot report false success.
  const registered = !form.hasAttribute('data-netlify') && !form.hasAttribute('netlify');
  const available = registered && !local && environment.location.protocol === 'https:';
  let sending = false;

  function show(message, state = '') {
    status.textContent = message; status.dataset.state = state; status.hidden = !message;
  }
  for (const name of names) field(name).addEventListener('input', () => {
    field(name).setCustomValidity('');
    if (available && !sending && status.dataset.state === 'success') show('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    if (!available) {show(local ? PREVIEW_NOTE : UNAVAILABLE_NOTE, 'info'); return;}
    if (field('bot-field').value.trim()) {show(UNAVAILABLE_NOTE, 'error'); return;}

    const data = {};
    for (const name of names) {
      const input = field(name), value = input.value.trim(); input.value = value;
      input.setCustomValidity(''); data[name] = value;
      if (name !== 'fleet-size' && !value) input.setCustomValidity(name === 'name' ? 'Please enter your name.' : name === 'email' ? 'Please enter your email address.' : 'Please describe the coverage you need.');
    }
    if (field('name').value.length > 80) field('name').setCustomValidity('Please keep your name to 80 characters.');
    if (field('email').value.length > 254) field('email').setCustomValidity('Please enter a shorter email address.');
    if (field('message').value.length > 3000) field('message').setCustomValidity('Please keep your message to 3,000 characters.');
    const size = data['fleet-size'];
    if (size && (!/^\d+$/.test(size) || Number(size) < 1 || Number(size) > 999)) field('fleet-size').setCustomValidity('Enter a whole number of trucks from 1 to 999, or leave this empty.');
    if (!form.reportValidity()) {show('Please check the highlighted fields.', 'error'); return;}
    const captcha = field('g-recaptcha-response')?.value.trim();
    if (!captcha) {
      show('Please complete the “I’m not a robot” check before sending. If it does not load, use the direct email link below.', 'error');
      return;
    }

    data['form-name'] = FORM_NAME;
    data.subject = SUBJECT;
    data['bot-field'] = '';
    data['g-recaptcha-response'] = captcha;
    sending = true; button.disabled = true; fields.disabled = true;
    button.textContent = 'Sending…'; form.setAttribute('aria-busy', 'true');
    show('Sending your inquiry…');
    const controller = new environment.AbortController();
    const timer = environment.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await environment.fetch(INQUIRY_ENDPOINT, {
        method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(data).toString(), signal: controller.signal,
      });
      if (!response.ok) {
        show(response.status === 429
          ? 'Too many attempts. Please wait before trying again, or email us directly below.'
          : FAILED_NOTE, 'error');
        return;
      }
      // Netlify returns an HTML success response, not a JSON provider envelope.
      form.reset();
      show('Thanks! Your inquiry has been submitted. We’ll reply to the email address you provided.', 'success');
    } catch {
      show('We couldn’t confirm your submission. Your details are still here; please try again or email us directly below.', 'error');
    } finally {
      environment.clearTimeout(timer);
      // Tokens expire and can only be verified once. Require a fresh check on retry.
      try { environment.grecaptcha?.reset(); } catch { /* Keep the email fallback usable if the widget failed. */ }
      sending = false; button.disabled = false; fields.disabled = false;
      button.textContent = 'Send inquiry'; form.setAttribute('aria-busy', 'false');
    }
  });
  button.disabled = !available;
  show(available ? '' : local ? PREVIEW_NOTE : UNAVAILABLE_NOTE, available ? '' : 'info');
  return {available};
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('[data-inquiry-form]');
  if (form) setupInquiryForm(form);
}
