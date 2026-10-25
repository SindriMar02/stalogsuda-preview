/* Quote request: Cover svalalokun / glerhandrið. Validates locally and ends in a local "sent" state.
   Nothing leaves the browser; a real build would post to a Cloudflare Worker (Turnstile + rate limit). */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap;
  document.querySelectorAll('[data-quote]').forEach((root) => {
    const form = root.querySelector('form'), submit = form.querySelector('.qf__submit');
    const typeInput = form.querySelector('[name="tegund"]');
    const status = form.querySelector('.qf__status'), spin = status.querySelector('.qf__spin'), done = status.querySelector('.qf__done');
    const fileIn = form.querySelector('.qf__file'), drop = form.querySelector('.qf__drop'), thumbs = form.querySelector('.qf__thumbs');
    let files = [];

    /* type toggle (aria-pressed) */
    root.querySelectorAll('.qf__type').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('.qf__type').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      typeInput.value = b.dataset.type;
    }));

    /* field rules */
    const num = (v) => parseFloat(String(v).replace(',', '.'));
    const rules = {
      gerd: (v) => v ? '' : 'Veldu gerð svala.',
      breidd: (v) => !v ? 'Skráðu breidd í metrum.' : (num(v) > 0 && num(v) < 60 ? '' : 'Breidd þarf að vera tala, til dæmis 4,2.'),
      dypt: (v) => !v ? 'Skráðu dýpt í metrum.' : (num(v) > 0 && num(v) < 20 ? '' : 'Dýpt þarf að vera tala, til dæmis 1,6.'),
      lofthaed: (v) => !v || (num(v) > 0 && num(v) < 10) ? '' : 'Lofthæð þarf að vera tala, til dæmis 2,5.',
      heimilisfang: (v) => v.trim().length > 3 ? '' : 'Skráðu heimilisfang svalanna.',
      postnumer: (v) => /^\d{3}$/.test(v) && +v >= 101 && +v <= 902 ? '' : 'Póstnúmer er þrír tölustafir, til dæmis 220.',
      nafn: (v) => v.trim().length > 1 ? '' : 'Skráðu nafnið þitt.',
      simi: (v) => v.replace(/\D/g, '').replace(/^354/, '').length === 7 ? '' : 'Símanúmer er sjö tölustafir.',
      netfang: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Netfangið lítur ekki rétt út.',
    };
    const fields = Object.keys(rules).map((n) => form.elements[n]);
    const touched = new Set();
    const check = (el, show) => {
      const msg = rules[el.name](el.value); const wrap = el.closest('.qf__field'); const err = wrap.querySelector('.qf__err');
      if (show) {
        wrap.classList.toggle('is-invalid', !!msg); el.setAttribute('aria-invalid', String(!!msg));
        if (err) { err.textContent = msg; err.hidden = !msg; if (msg) el.setAttribute('aria-describedby', err.id || (err.id = el.id + '-err')); else el.removeAttribute('aria-describedby'); }
      }
      return !msg;
    };
    const validAll = () => fields.every((el) => check(el, false));
    const sync = () => { submit.disabled = !validAll(); };
    fields.forEach((el) => {
      el.addEventListener('blur', () => { touched.add(el.name); check(el, true); });
      el.addEventListener('input', () => { if (touched.has(el.name)) check(el, true); sync(); });
      el.addEventListener('change', sync);
    });
    form.querySelectorAll('select').forEach((s) => { const u = () => s.setAttribute('data-empty', String(!s.value)); s.addEventListener('change', u); u(); });

    /* phone mask: +354 XXX XXXX */
    const tel = form.elements.simi;
    tel.addEventListener('input', () => {
      let d = tel.value.replace(/\D/g, ''); if (d.startsWith('354')) d = d.slice(3); d = d.slice(0, 7);
      tel.value = d ? '+354 ' + d.slice(0, 3) + (d.length > 3 ? ' ' + d.slice(3) : '') : '';
    });
    form.elements.postnumer.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); });

    /* photos: previews, remove, drag and drop, max 6 */
    const renderThumbs = () => {
      thumbs.querySelectorAll('img').forEach((im) => URL.revokeObjectURL(im.src));
      thumbs.innerHTML = '';
      files.forEach((f, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<img alt="Mynd ${i + 1}: ${f.name.replace(/[<>"&]/g, '')}"><button type="button" aria-label="Fjarlægja mynd ${i + 1}"><svg aria-hidden="true"><use href="#i-x"/></svg></button>`;
        li.querySelector('img').src = URL.createObjectURL(f);
        li.querySelector('button').addEventListener('click', () => { files.splice(i, 1); renderThumbs(); fileIn.focus(); });
        thumbs.appendChild(li);
      });
      drop.querySelector('span').innerHTML = files.length ? `<strong>${files.length} ${files.length === 1 ? 'mynd valin' : 'myndir valdar'}</strong>, bættu við fleirum` : '<strong>Veldu myndir</strong> eða dragðu þær hingað';
    };
    const addFiles = (list) => { [...list].filter((f) => f.type.startsWith('image/')).forEach((f) => { if (files.length < 6) files.push(f); }); renderThumbs(); };
    fileIn.addEventListener('change', () => { addFiles(fileIn.files); fileIn.value = ''; });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });

    /* submit: spinner, then the success pop (spec 3.13). Local only. */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      fields.forEach((el) => { touched.add(el.name); check(el, true); });
      const bad = fields.find((el) => !check(el, false));
      if (bad) { bad.focus(); return; }
      const v = (n) => form.elements[n].value.trim();
      form.querySelector('[data-summary]').textContent =
        `${typeInput.value}, ${v('gerd').toLowerCase()}, ${v('breidd')} x ${v('dypt')} m, ${v('heimilisfang')}, ${v('postnumer')}. ${files.length ? files.length + (files.length === 1 ? ' mynd fylgir.' : ' myndir fylgja.') : 'Engar myndir.'} Við höfum samband í síma ${v('simi')} eða á ${v('netfang')}.`;
      status.hidden = false; spin.hidden = false; done.hidden = true;
      setTimeout(() => {
        spin.hidden = true; done.hidden = false;
        if (G && !reduce) {
          const badge = done.querySelector('.qf__badge'), ico = badge.querySelector('svg'), msg = done.querySelector('.qf__msg'), rings = done.querySelectorAll('.qf__ring');
          G.timeline()
            .fromTo(badge, { scale: 0, rotate: -20 }, { scale: 1, rotate: 0, duration: .55, ease: 'back.out(2.2)' })
            .fromTo(ico, { scale: 0 }, { scale: 1, duration: .35, ease: 'back.out(3)' }, '-=.25')
            .fromTo(msg, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'power2.out' }, '-=.1')
            .fromTo(rings, { scale: 1, opacity: .7 }, { scale: 2.6, opacity: 0, duration: 1, ease: 'power2.out', stagger: .18 }, 0);
        }
        done.querySelector('.qf__again').focus({ preventScroll: true });
      }, reduce ? 300 : 1200);
    });
    form.querySelector('.qf__again').addEventListener('click', () => {
      form.reset(); files = []; renderThumbs(); touched.clear();
      form.querySelectorAll('.qf__field').forEach((f) => f.classList.remove('is-invalid'));
      form.querySelectorAll('.qf__err').forEach((x) => { x.hidden = true; });
      form.querySelectorAll('select').forEach((s) => s.setAttribute('data-empty', 'true'));
      status.hidden = true; sync(); form.elements.gerd.focus({ preventScroll: true });
    });
    sync();
  });
})();
