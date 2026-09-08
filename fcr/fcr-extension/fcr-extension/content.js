(() => {
  'use strict';

  const CODE_LEN = 5;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);

  // ---------- value setting that jQuery Validate actually notices ----------
  function setVal(el, val) {
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    const proto = el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(el, val) : (el.value = val);
    ['input', 'keyup', 'change', 'blur'].forEach(t =>
      el.dispatchEvent(new Event(t, { bubbles: true })));
    return true;
  }

  const fill = (id, v) => setVal($(id), v);

  // ---------- wizard state ----------
  // All panels live in the DOM; the visible one carries .current
  function stepIndex() {
    const s = document.querySelector('section.body.current');
    const m = s && s.id.match(/feedbackForm-p-(\d+)/);
    return m ? Number(m[1]) : -1;
  }

  const visible = el => el && el.offsetParent !== null;

  async function waitStep(n, ms = 15000) {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (stepIndex() === n) return true;
      await sleep(250);
    }
    return false;
  }

  // Each step's button stays disabled until jQuery Validate is satisfied.
  async function clickWhenReady(id, ms = 10000) {
    const t = Date.now();
    while (Date.now() - t < ms) {
      const b = $(id);
      if (b && visible(b) && !b.disabled) { b.click(); return true; }
      await sleep(250);
    }
    return false;
  }

  // ---------- HUD ----------
  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;bottom:18px;right:18px;z-index:2147483647;background:#111827;' +
    'color:#e8eaed;font:13px/1.45 system-ui;padding:11px 14px;border-radius:9px;' +
    'max-width:260px;box-shadow:0 8px 28px rgba(0,0,0,.45);border:1px solid #263041';
  const VERSION = 'v2.1';
  const say = t => { hud.textContent = `[${VERSION}] ` + t; };

  function spotlight(el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => el.focus({ preventScroll: true }), 300);
    el.style.outline = '3px solid #5b7cfa';
    el.style.outlineOffset = '2px';
    el.style.boxShadow = '0 0 0 6px rgba(91,124,250,.18)';
  }

  // ---------- per-step filling ----------
  function fillHome(c) {
    fill('enterprise_contact_verification_email', c.email);
  }

  function fillForm1(c) {
    fill('enterprise_company_name', c.companyName);
    fill('enterprise_company_address_line_1', c.addr1);
    fill('enterprise_company_address_line_2', c.addr2 || '');
    fill('enterprise_company_address_city', c.city);
    fill('enterprise_company_address_state', c.state);   // <select>
    fill('enterprise_company_address_zip', c.zip);
    fill('enterprise_company_url', c.url);
    fill('enterprise_contact_name', c.contactName);
    fill('enterprise_contact_phone', c.phone);
    // enterprise_contact_email is readonly — site fills it from the verified address
    fill('enterprise_category', c.category);             // <select>
    fill('call_count', c.callCount);                     // <select>
    fill('additional_feedback', c.feedback || '');
  }

  function fillForm2(c) {
    const list = (c.phones && c.phones.length) ? c.phones : [c.phone];
    list.slice(0, 20).forEach((num, i) => fill('enterprise_phone_' + i, num));
    return list.length;
  }

  function acceptTerms() {
    const cb = $('enableCheckbox');
    if (cb && !cb.checked) cb.click(); // click, not .checked — the handler enables Submit
  }

  function armCaptcha() {
    const el = $('captcha');
    if (!el || el.dataset.fcrArmed) return;
    el.dataset.fcrArmed = '1';
    spotlight(el);
    say(`Type the ${CODE_LEN}-digit code from your email`);

    const check = async () => {
      const v = (el.value || '').replace(/\D/g, '');
      if (v.length !== CODE_LEN) return;
      say('Verifying…');
      await sleep(250);
      await clickWhenReady('verifyAndContinue', 8000);
    };
    el.addEventListener('input', check);
    el.addEventListener('paste', () => setTimeout(check, 60));
  }

  // ---------- driver ----------
  async function drive(c) {
    for (let guard = 0; guard < 40; guard++) {
      const step = stepIndex();

      if (step === 0) {
        say('Sending verification code…');
        fillHome(c);
        await sleep(300);
        const btn = $('new-send-verification-code');
        if (btn && visible(btn)) btn.click();
        if (!await waitStep(1, 15000)) {
          say('Code request did not go through — check the email address');
          return;
        }
        continue;
      }

      if (step === 1) {
        armCaptcha();
        if (!await waitStep(2, 600000)) return; // waits on you, up to 10 min
        continue;
      }

      if (step === 2) {
        say('Filling business details…');
        fillForm1(c);
        await sleep(600);
        if (!await clickWhenReady('nextButton1', 12000)) {
          say('Step 1 blocked — a field is red, or the address check needs confirming');
          return;
        }
        if (!await waitStep(3, 20000)) {
          say('Address verification popup open — confirm it and I continue');
          if (!await waitStep(3, 120000)) return;
        }
        continue;
      }

      if (step === 3) {
        const n = fillForm2(c);
        say(`Adding ${n} number${n > 1 ? 's' : ''}…`);
        await sleep(500);
        if (!await clickWhenReady('nextButton2', 12000)) {
          say('Phone number rejected — must be 10 digits');
          return;
        }
        await waitStep(4, 15000);
        continue;
      }

      if (step === 4) {
        say('Accepting terms…');
        acceptTerms();
        await sleep(400);
        if (!await clickWhenReady('submitButton', 12000)) {
          say('Submit stayed disabled — tick the box manually');
          return;
        }
        await waitStep(5, 25000);
        continue;
      }

      if (step === 5) {
        const idEl = document.querySelector('.feedback-id');
        const id = idEl ? idEl.textContent.replace(/[\[\]\s]/g, '') : '';
        say('✓ Registered' + (id ? ' — ID ' + id : ''));
        return;
      }

      await sleep(400);
    }
    say('Gave up — wizard stopped advancing');
  }

  // ---------- entry ----------
  chrome.runtime.sendMessage({ type: 'cfg' }, c => {
    if (!c || !c.setupDone) return;
    document.documentElement.appendChild(hud);

    if (!c.armed) {
      hud.textContent = '[v2.1] FCR AIL — click to start';
      hud.style.cursor = 'pointer';
      hud.onclick = () => { hud.onclick = null; hud.style.cursor = ''; drive(c); };
      return;
    }
    hud.textContent = '[v2.1] Starting…';
    chrome.runtime.sendMessage({ type: 'disarm' }, () => drive(c));
  });
})();
