/* Stál og suða prototype: motion + interaction. Clean-room implementation of the Superlógica motion spec
   (SUPERLOGICA-REBUILD-SPEC.md §3). Under prefers-reduced-motion every scrubbed or pinned piece renders its
   final state (spec §3.15, the deliberate departure). */
(() => {
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ready = () => html.classList.add('is-ready');
  const hasGsap = typeof window.gsap !== 'undefined';
  if (!hasGsap) { ready(); return; }
  gsap.registerPlugin(ScrollTrigger, Flip, Draggable, InertiaPlugin);

  /* ---------- 3.0 smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }
  const lockScroll = (on) => { html.style.overflow = on ? 'hidden' : ''; if (lenis) on ? lenis.stop() : lenis.start(); };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = document.getElementById(id.slice(1)); if (!t) return;
    e.preventDefault(); closeMobileNav();
    if (lenis) lenis.scrollTo(t, { offset: 0 }); else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  }));

  /* ---------- header: mega menu (desktop) + phone panel. Opens highlight nothing (focus-guard rule) ---------- */
  const header = $('[data-header]');
  const megaLi = $('[data-mega]');
  if (megaLi) {
    const btn = $('.hdr__link', megaLi), panel = $('.mega', megaLi);
    // CSS transitions (interruptible): drop in from under the bar, links stagger; close is a quicker fade
    let hideT, intentT;
    const isOpen = () => panel.classList.contains('is-open');
    const set = (open, viaKey) => {
      clearTimeout(hideT); clearTimeout(intentT);
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        panel.hidden = false; void panel.offsetWidth; panel.classList.add('is-open');
        if (viaKey) $('a', panel).focus({ preventScroll: true });
      } else {
        panel.classList.remove('is-open');
        hideT = setTimeout(() => { if (!isOpen()) panel.hidden = true; }, reduce ? 0 : 200);
      }
    };
    megaLi.addEventListener('mouseenter', () => { if (innerWidth < 993) return; clearTimeout(intentT); intentT = setTimeout(() => set(true), isOpen() ? 0 : 70); });
    megaLi.addEventListener('mouseleave', () => { if (innerWidth < 993) return; clearTimeout(intentT); intentT = setTimeout(() => set(false), 120); });
    btn.addEventListener('click', (e) => set(!isOpen(), e.detail === 0));
    megaLi.addEventListener('focusout', (e) => { if (!megaLi.contains(e.relatedTarget)) set(false); });
    megaLi.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { set(false); btn.focus(); } });
  }
  const burger = $('.burger'), mnav = $('#mnav');
  let navOpen = false;
  function closeMobileNav(returnFocus) {
    if (!navOpen) return; navOpen = false;
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Valmynd');
    mnav.classList.remove('is-open'); lockScroll(false);
    setTimeout(() => { if (!navOpen) mnav.hidden = true; }, reduce ? 0 : 320);
    if (returnFocus) burger.focus({ preventScroll: true });
  }
  if (burger && mnav) {
    burger.addEventListener('click', (e) => {
      if (navOpen) return closeMobileNav(e.detail === 0);
      navOpen = true; mnav.hidden = false;
      burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Loka valmynd');
      void mnav.offsetWidth; mnav.classList.add('is-open'); lockScroll(true);
      (e.detail === 0 ? $('.mnav__row', mnav) : mnav).focus({ preventScroll: true });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobileNav(true); });
    $$('a', mnav).forEach((a) => a.addEventListener('click', () => closeMobileNav()));
    $$('.mnav__group', mnav).forEach((g) => {
      const b = $('.mnav__row', g), sub = $('.mnav__sub', g);
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open));
        if (open) { sub.hidden = false; if (!reduce) gsap.fromTo(sub, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .3, ease: 'power1.out' }); }
        else if (reduce) sub.hidden = true;
        else gsap.to(sub, { height: 0, opacity: 0, duration: .3, ease: 'power1.in', onComplete: () => { sub.hidden = true; gsap.set(sub, { clearProps: 'all' }); } });
      });
    });
    addEventListener('resize', () => { if (innerWidth >= 992) closeMobileNav(); });
  }
  /* header: in flow at the top (1:1), then hides on scroll down and returns on scroll up, so nav + quote stay reachable */
  if (header) {
    const menuOpen = () => navOpen || header.querySelector('.hdr__link[aria-expanded="true"]');
    let last = 0;
    const onScroll = (y) => {
      const stuck = y > 140;
      header.classList.toggle('is-stuck', stuck);
      if (!stuck) header.classList.remove('is-hidden');
      else if (!menuOpen() && Math.abs(y - last) > 4) header.classList.toggle('is-hidden', y > last);
      last = y;
    };
    // real scroll position: Lenis's animated value does not follow native touch scrolling on iOS
    let ticking = false;
    addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(scrollY); }); }, { passive: true });
    // iOS 26 Safari tints its bottom toolbar from <body>: dark while a dark full-width section sits at the bottom edge
    const darks = $$('.lead, .ftr');
    if ('IntersectionObserver' in window && darks.length) {
      const seen = new Set();
      const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); document.body.classList.toggle('tint-dark', seen.size > 0); }, { rootMargin: '-82% 0px 0px 0px' });
      darks.forEach((d) => io.observe(d));
    }
    onScroll(scrollY);
    // logo: home and the very top, also when already home; closes the phone menu first
    const logo = $('.hdr__logo', header);
    const onHome = /\/(index\.html)?$/.test(location.pathname);
    if (logo && onHome) logo.addEventListener('click', (e) => {
      e.preventDefault(); closeMobileNav();
      if (lenis) lenis.scrollTo(0, { immediate: reduce }); else scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', location.pathname);
    });
    // current page in the nav
    const page = location.pathname.replace(/^.*\//, '') || 'index.html';
    if (page === 'thjonusta.html') $('[data-mega] .hdr__link', header)?.setAttribute('data-current', 'true');
    if (page === 'tilbod.html') $$('.hdr__cta, .mnav__row--cta', header).forEach((a) => a.setAttribute('aria-current', 'page'));
  }
  const revealHeader = () => { if (!header || header.classList.contains('is-revealed')) return; header.classList.add('is-revealed'); setTimeout(() => header.classList.add('is-settled'), reduce ? 0 : 750); };
  document.addEventListener('home-hero-header-reveal', revealHeader);
  if (header && header.classList.contains('hdr-wrap--home')) setTimeout(revealHeader, reduce ? 0 : 5000);

  /* ---------- accordions (first open, one at a time, clicking the open one closes it) ---------- */
  $$('[data-acc]').forEach((acc) => {
    const items = $$('.acc__item', acc);
    const setOpen = (idx) => items.forEach((it, i) => {
      const open = i === idx; it.classList.toggle('is-open', open);
      $('.acc__btn', it).setAttribute('aria-expanded', String(open));
      $('.acc__panel', it).setAttribute('aria-hidden', String(!open));
    });
    items.forEach((it, i) => $('.acc__btn', it).addEventListener('click', () => setOpen(it.classList.contains('is-open') ? -1 : i)));
  });
  $$('[data-facc]').forEach((col) => {
    const b = $('.ftr__h button', col);
    b.addEventListener('click', () => { const o = !col.classList.contains('is-open'); col.classList.toggle('is-open', o); b.setAttribute('aria-expanded', String(o)); });
  });

  /* ---------- ring cards: seven segments, one per service ---------- */
  const segCols = ['#1034F2', '#526DFF', '#566FF6', '#8698F9', '#1034F2', '#526DFF', '#2BE3FF'];
  $$('.gring__seg').forEach((g) => {
    const r = 40, c = 2 * Math.PI * r, n = 7, gap = 5, len = c / n - gap;
    g.innerHTML = Array.from({ length: n }, (_, i) =>
      `<circle cx="49" cy="49" r="${r}" fill="none" stroke="${segCols[i]}" stroke-width="10" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-i * (c / n)}"/>`).join('');
  });

  /* ---------- 3.3 split-line reveal (word masks grouped by measured line) ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) {
          const parts = ch.textContent.split(/(\s+)/); const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const o = document.createElement('span'); o.className = 'sw';
            const i = document.createElement('span'); i.className = 'sw__i'; i.textContent = p;
            o.appendChild(i); frag.appendChild(o);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
      });
    };
    walk(el); el.dataset.splitDone = '1';
  }
  function linesOf(el) {
    const words = $$('.sw', el); const lines = []; let top = null;
    words.forEach((w) => { const t = w.offsetTop; if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; } lines[lines.length - 1].push($('.sw__i', w)); });
    return lines;
  }
  const splitEls = $$('[data-split]');
  if (!reduce) {
    splitEls.forEach((el) => {
      splitWords(el);
      gsap.set($$('.sw__i', el), { yPercent: 100, opacity: 0 });
      ScrollTrigger.create({
        trigger: el.parentElement, start: 'top 85%', once: true,
        onEnter: () => {
          const lines = linesOf(el); const tl = gsap.timeline();
          lines.forEach((l, i) => tl.to(l, { yPercent: 0, opacity: 1, duration: .7, ease: 'power3.out' }, i * .15));
        },
      });
    });
  }

  /* ---------- 3.9 fade-up batch reveal ---------- */
  const revealEls = $$('[data-reveal]');
  if (!reduce && revealEls.length) {
    gsap.set(revealEls, { y: 16, opacity: 0 });
    ScrollTrigger.batch(revealEls, { start: 'top 90%', once: true, onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: .4, ease: 'power2.out', stagger: .1, clearProps: 'transform' }) });
  }

  /* ---------- 3.1 hero entrance + 3.2 parallax ---------- */
  const hero = $('[data-hero]');
  const settled = () => document.dispatchEvent(new Event('hero-metric-cards-settled'));
  if (hero) {
    const sweep = $('[data-sweep]', hero), text = $('[data-hero-text]', hero), frame = $('.hero__frame', hero);
    const hLines = $$('[data-hl="h"]', hero), eLines = $$('[data-hl="e"]', hero);
    const award = $('.hero__award', hero), ring = $('.hero__ring', hero);
    const collapse = () => { hero.classList.remove('is-expanded'); setTimeout(() => ScrollTrigger.refresh(), reduce ? 0 : 520); };
    if (reduce) {
      collapse(); revealHeader(); ready(); setTimeout(settled, 0);
    } else {
      gsap.set(hLines, { yPercent: 260, opacity: 0 });
      gsap.set(eLines, { yPercent: 100, opacity: 0 });
      gsap.set(sweep, { x: 0, xPercent: -50, scale: .9, width: 0 });
      gsap.set([award, ring], { opacity: 0, y: 16 });
      ready();
      const tl = gsap.timeline({ paused: true });
      tl.add(collapse, .2)
        .add(() => document.dispatchEvent(new Event('home-hero-header-reveal')), .7)
        .to([...hLines, ...eLines], { yPercent: 0, opacity: 1, duration: .9, ease: 'power3.out', stagger: .25 }, .7)
        .to(award, { opacity: 1, y: 0, duration: .6, ease: 'power2.out', clearProps: 'transform' }, .7)
        .to(sweep, { width: () => frame.clientWidth, scale: 1, duration: 1.2, ease: 'power2.out', onComplete: () => gsap.set(sweep, { width: '100%' }) }, .9)
        .to(ring, { opacity: 1, y: 0, duration: .6, ease: 'power2.out', clearProps: 'transform', onComplete: settled }, .95);
      let started = false;
      const start = () => { if (started) return; started = true; tl.play(); };
      const imgs = $$('[data-hero-img]', hero);
      Promise.all(imgs.map((im) => im.complete ? Promise.resolve() : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }))).then(start);
      setTimeout(start, 4000);
      // first scroll during the entrance jumps to the end state
      addEventListener('scroll', () => { if (tl.progress() < 1) { started = true; tl.progress(1); } }, { once: true, passive: true });
      gsap.to([text, sweep], { y: 80, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
  } else { ready(); }

  /* ---------- 3.4 hero -> intro card transfer (Flip), desktop >= 1025 only ---------- */
  const nx = $('[data-nx]');
  const mm = gsap.matchMedia();
  if (hero && nx && !reduce) {
    const pairs = [
      { key: 'award', z: [{ p: 0, z: 3 }, { p: .19, z: 7 }, { p: .6, z: 9 }], blur: true },
      { key: 'ring', z: [{ p: 0, z: 7 }, { p: .6, z: 9 }] },
    ];
    let built = [];
    const teardown = () => { built.forEach((b) => { b.st && b.st.kill(); b.tl && b.tl.kill(); b.clone.remove(); gsap.set([b.src, b.target], { clearProps: 'opacity' }); }); built = []; document.body.classList.remove('flip-on'); };
    const build = () => {
      teardown();
      if (innerWidth < 1025) return;
      document.body.classList.add('flip-on');
      pairs.forEach((pr) => {
        const src = $(`[data-flip-src="${pr.key}"]`), target = $(`[data-flip-target="${pr.key}"]`);
        const r = src.getBoundingClientRect();
        const clone = src.cloneNode(true); clone.removeAttribute('data-flip-src'); clone.classList.add('flip-clone');
        Object.assign(clone.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px', right: 'auto', zIndex: pr.z[0].z, opacity: 0 });
        document.body.appendChild(clone);
        let zi = 0;
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: nx, start: () => Math.max(0, nx.getBoundingClientRect().top + scrollY - innerHeight), end: 'center center', scrub: true, invalidateOnRefresh: true,
            onUpdate: (s) => {
              const p = s.progress; let k = zi;
              while (k < pr.z.length - 1 && p >= pr.z[k + 1].p + .015) k++;
              while (k > 0 && p < pr.z[k].p - .015) k--;
              if (k !== zi) { zi = k; clone.style.zIndex = pr.z[k].z; }
            },
          },
        });
        tl.set(src, { opacity: 1 }, 0).set(clone, { opacity: 0 }, 0).set(target, { opacity: 0 }, 0)
          .set(src, { opacity: 0 }, .001).set(clone, { opacity: 1 }, .001)
          .add(Flip.fit(clone, target, { scale: true, absolute: true, duration: 1, ease: 'none', force3D: true }), 0);
        if (pr.blur) tl.fromTo(clone, { filter: 'blur(2px)' }, { filter: 'blur(0px)', duration: 1, ease: 'none' }, 0);
        tl.set(clone, { opacity: 0 }, .999).set(target, { opacity: 1 }, .999);
        built.push({ src, target, clone, tl, st: tl.scrollTrigger });
      });
    };
    let armed = false;
    const arm = () => { if (armed) return; armed = true; document.fonts.ready.then(build); };
    document.addEventListener('hero-metric-cards-settled', arm, { once: true });
    setTimeout(arm, 6000);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (armed) { const y = scrollY; window.scrollTo(0, 0); build(); ScrollTrigger.refresh(); window.scrollTo(0, y); } }, 200); });
  }

  /* ---------- 3.5 scrubbed chart card ---------- */
  const chart = $('[data-chart]');
  if (chart && !reduce) {
    const bars = $$('.chart__bars i', chart), num = $('[data-chart-n]', chart);
    gsap.set(bars, { scaleY: 0 }); num.textContent = '0';
    const tl = gsap.timeline({ paused: true });
    bars.forEach((b, i) => tl.to(b, { scaleY: 1, duration: 1, ease: 'power2.out' }, i * .7));
    ScrollTrigger.create({ trigger: chart, start: 'bottom bottom', end: () => '+=' + 1.5 * innerHeight, scrub: true, invalidateOnRefresh: true,
      onUpdate: (s) => { tl.progress(s.progress); num.textContent = String(Math.min(7, Math.round(s.progress * 7.4))); } });
  }

  /* ---------- 3.6 counters ---------- */
  const stats = $('[data-stats]');
  if (stats && !reduce) {
    const fmt = new Intl.NumberFormat('is-IS', { maximumFractionDigits: 0 });
    const els = $$('[data-count]', stats);
    els.forEach((el) => { el.textContent = '0' + (el.dataset.suffix || ''); });
    ScrollTrigger.create({ trigger: stats, start: 'top 80%', once: true, onEnter: () => els.forEach((el, i) => {
      const o = { v: 0 }, to = +el.dataset.count, suf = el.dataset.suffix || '';
      gsap.to(o, { v: to, duration: 2 + .5 * i, ease: 'power1.out', onUpdate: () => { el.textContent = fmt.format(o.v) + suf; } });
    }) });
  }

  /* ---------- 3.7 echo-trail vectors ---------- */
  const F = [.1, .2, .3, .4, .6, .8, 1], X0 = 126.4483, Y0 = -197.8211, X1 = 85, Y1 = -50;
  $$('[data-echo]').forEach((svg) => {
    const base = $('.echo__p', svg); const g = base.parentNode;
    const paths = F.map((f) => { const p = f === 1 ? base : base.cloneNode(); p.style.opacity = f; if (f !== 1) g.insertBefore(p, base); return p; });
    if (reduce) { paths.forEach((p, i) => gsap.set(p, { x: F[i] * X1, y: F[i] * Y1 })); return; }
    paths.forEach((p, i) => gsap.set(p, { x: F[i] * X0, y: F[i] * Y0 }));
    const qx = paths.map((p) => gsap.quickTo(p, 'x', { duration: .6, ease: 'power3.out' }));
    const qy = paths.map((p) => gsap.quickTo(p, 'y', { duration: .6, ease: 'power3.out' }));
    ScrollTrigger.create({ trigger: svg.closest('[data-echo-section]'), start: 'top bottom', end: 'bottom 15%', scrub: true,
      onUpdate: (s) => { const X = X0 + (X1 - X0) * s.progress, Y = Y0 + (Y1 - Y0) * s.progress; F.forEach((f, i) => { qx[i](f * X); qy[i](f * Y); }); } });
  });

  /* ---------- 3.8 comparison (desktop >= 1025). Sindri 10-25: no 4000 px pin; the same sequence plays once, timed,
     when the section comes into view, and the section scrolls like any other ---------- */
  const cmp = $('[data-cmp]');
  if (cmp && !reduce) {
    mm.add('(min-width: 1025px)', () => {
      const h2 = $('[data-cmp-h2]', cmp), p = $('[data-cmp-p]', cmp), illo = $('[data-cmp-illo]', cmp), row = $('[data-cmp-row]', cmp);
      const cards = $('[data-cmp-cards]', cmp), panel = $('[data-cmp-panel]', cmp), track = $('[data-cmp-track]', cmp), items = $$('[data-cmp-card]', cmp);
      const illoW = innerWidth <= 1220 ? 323 : 373;
      const tc = track.offsetWidth / 2, blue = items[2].offsetWidth + 8;
      gsap.set([h2, p], { opacity: 0, y: 40 });
      gsap.set(illo, { width: 0 });
      gsap.set(row, { y: 120 });
      gsap.set(cards, { opacity: 0, y: 140 });
      gsap.set(panel, { left: tc - blue / 2, width: blue });
      items.forEach((c) => gsap.set(c, { x: tc - (c.offsetLeft + c.offsetWidth / 2) }));
      const ease = 'power3.out';
      const tl = gsap.timeline({ paused: true });
      tl.to(h2, { opacity: 1, y: 0, duration: .7, ease }, 0)
        .to(p, { opacity: 1, y: 0, duration: .7, ease }, .2)
        .to(illo, { width: illoW, duration: .8, ease }, .35)
        .to(row, { y: 0, duration: .8, ease }, .7)
        .to(cards, { opacity: 1, y: 0, duration: .8, ease }, .7)
        .to(h2, { y: -84, duration: .7, ease: 'power2.inOut' }, .85)
        .to(p, { y: 84, duration: .7, ease: 'power2.inOut' }, .85)
        .to(panel, { left: 0, width: '100%', duration: .9, ease }, 1.1)
        .to(items, { x: 0, duration: .9, ease, stagger: .04 }, 1.1);
      const st = ScrollTrigger.create({ trigger: cmp, start: 'top 70%', once: true, onEnter: () => tl.play() });
      return () => { st.kill(); tl.kill(); gsap.set([illo, row, cards, panel, h2, p, ...items], { clearProps: 'all' }); };
    });
    mm.add('(max-width: 1024px)', () => {
      const parts = [$('[data-cmp-illo]', cmp), $('[data-cmp-h2]', cmp), $('[data-cmp-p]', cmp), ...$$('[data-cmp-card]', cmp)];
      gsap.set(parts, { y: 16, opacity: 0 });
      const b = ScrollTrigger.batch(parts, { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: .4, ease: 'power2.out', stagger: .1, clearProps: 'transform' }) });
      return () => { b.forEach((s) => s.kill()); gsap.set(parts, { clearProps: 'all' }); };
    });
  }

  /* ---------- 3.10 card stack (solutions, desktop) ---------- */
  const s1 = $('[data-sol="1"]'), s2 = $('[data-sol="2"]');
  if (s1 && s2 && !reduce) {
    mm.add('(min-width: 1025px)', () => {
      const fits = s1.offsetHeight <= innerHeight;
      const st = fits ? { trigger: s1, start: 'top top+=24', end: 'bottom top', scrub: true, pin: s1, pinSpacing: false }
        : { trigger: s2, start: 'top bottom', end: 'top top', scrub: true, pin: s1, pinSpacing: false };
      gsap.fromTo(s1, { scale: 1 }, { scale: .8, ease: 'none', scrollTrigger: st });
    });
  }

  /* ---------- 3.12 photo slab: scale, line wipes, headline ---------- */
  const ctl = $('[data-ctl]');
  if (ctl && !reduce) {
    gsap.fromTo($$('[data-ctl-scale]', ctl), { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: ctl, start: 'top bottom', end: 'bottom 15%', scrub: 1 } });
    const l1 = $('[data-ctl-line="1"]', ctl), l2 = $('[data-ctl-line="2"]', ctl);
    const plines = innerWidth < 768 ? [$('[data-ctl-p]', ctl)] : $$('[data-ctl-p] .line', ctl), hlines = $$('[data-ctl-h2] .line', ctl);
    const arm = () => { gsap.set(l1, { clipPath: 'inset(0% 100% 0% 0%)' }); gsap.set(l2, { clipPath: 'inset(0% 0% 0% 100%)' }); gsap.set(plines, plines.length > 1 ? { yPercent: 100, opacity: 0 } : { y: 24, opacity: 0 }); };
    arm();
    let wipe;
    ScrollTrigger.create({ trigger: ctl, start: 'top 20%', onEnter: () => {
      wipe && wipe.kill();
      wipe = gsap.timeline()
        .to(l1, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power2.out' }, 0)
        .to(l2, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power2.out' }, .6)
        .to(plines, { yPercent: 0, y: 0, opacity: 1, duration: plines.length > 1 ? .9 : .7, ease: 'power3.out', stagger: .25 }, 0);
    } });
    ScrollTrigger.create({ trigger: ctl, start: 'top bottom', onLeaveBack: () => { wipe && wipe.kill(); arm(); } });
    const htl = gsap.timeline({ scrollTrigger: { trigger: ctl, start: 'top 85%', end: 'top 45%', scrub: 1 } });
    hlines.forEach((l, i) => htl.fromTo(l, { yPercent: 150, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'power2.out' }, i));
  }

  /* ---------- lead line wipe ---------- */
  $$('[data-lead-line]').forEach((line) => {
    if (reduce) return;
    gsap.set(line, { clipPath: 'inset(0% 0% 0% 100%)' });
    ScrollTrigger.create({ trigger: line.parentElement, start: 'top 50%', once: true, onEnter: () => gsap.to(line, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, delay: .3, ease: 'power2.out' }) });
  });

  /* ---------- 3.11 marquee (two rows, opposite directions, drag with inertia) ---------- */
  const mq = $('[data-mq]');
  if (mq) {
    const speed = 3356 / 90 * 1.3;
    const loops = [];
    $$('[data-mq-row]', mq).forEach((row) => {
      const track = $('.mq__track', row); const orig = [...track.children];
      const rowW = Math.max(row.offsetWidth, 1920);
      while (track.scrollWidth < rowW + 200) orig.forEach((li) => track.appendChild(li.cloneNode(true)));
      [...track.children].forEach((li) => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
      [...track.children].slice(orig.length).forEach((li) => { li.setAttribute('aria-hidden', 'true'); $$('img', li).forEach((im) => { im.alt = ''; }); });
      if (reduce) return;
      const half = track.scrollWidth / 2, wrap = gsap.utils.wrap(-half, 0), dir = row.dataset.mqRow === '1' ? -1 : 1;
      const make = (from) => gsap.fromTo(track, { x: from }, { x: from + dir * half, duration: half / speed, ease: 'none', repeat: -1, modifiers: { x: (v) => wrap(parseFloat(v)) + 'px' } });
      const L = { tw: make(dir === -1 ? 0 : -half) }; loops.push(L);
      const proxy = document.createElement('div');
      const upd = () => gsap.set(track, { x: wrap(gsap.getProperty(proxy, 'x')) });
      Draggable.create(proxy, { type: 'x', trigger: track, inertia: true, allowContextMenu: true,
        onPress() { L.tw.kill(); gsap.set(proxy, { x: gsap.getProperty(track, 'x') }); this.update(); },
        onDrag: upd, onThrowUpdate: upd,
        onRelease() { if (!this.tween || !this.tween.isActive()) { L.tw = make(gsap.getProperty(track, 'x')); } },
        onThrowComplete() { L.tw = make(gsap.getProperty(track, 'x')); } });
      row.addEventListener('mouseenter', () => loops.forEach((l) => gsap.to(l.tw, { timeScale: 0, duration: .6, ease: 'power2.out', overwrite: true })));
      row.addEventListener('mouseleave', () => loops.forEach((l) => gsap.to(l.tw, { timeScale: 1, duration: .6, ease: 'power2.out', overwrite: true })));
    });
  }

  /* ---------- service carousel (the press carousel system) ---------- */
  const press = $('[data-press]');
  if (press) {
    const items = [
      ['stalsmidi', 'Stálsmíði', 'Fyrir byggingaverktaka, stóriðju og orkufyrirtæki.', 'svalir-verk.webp'],
      ['stalstigar', 'Stálstigar', 'Innanhúss og utan, fyrir heimili og stærri byggingar.', 'stalstigi-uti.webp'],
      ['glervinna', 'Glervinna', 'Glerhandrið, glerskálar og gler í stáli.', 'glerskali.webp'],
      ['sudavinna', 'Almenn suðuvinna', 'Á verkstæði og á verkstað.', 'sudavinna.webp'],
      ['kranabill', 'Kranabíll', 'Hífingar á verkstað.', 'kranabill-2.webp'],
      ['duftmalun', 'Duftmálun', 'Duftmálun á stáli.', 'suda-teikning.png'],
      ['laserskurdur', 'Laserskurður', 'Laserskurður á stáli.', 'suda-teikning.png'],
    ];
    const card = $('[data-press-card]', press), img = $('[data-press-img]', press), q = $('[data-press-q]', press);
    const t = $('[data-press-t]', press), d = $('[data-press-d]', press), next = $('[data-press-next]', press), prev = $('[data-press-prev]', press);
    let i = 0, timer = null, paused = false, graceT = null;
    const paint = () => { const it = items[i]; card.href = 'thjonusta.html#' + it[0]; t.textContent = it[1]; d.textContent = it[2]; img.src = 'assets/img/' + it[3]; img.parentNode.classList.toggle('is-art', it[3].endsWith('.png')); };
    const go = (to) => {
      i = (to + items.length) % items.length;
      if (reduce) { paint(); return restart(); }
      gsap.timeline().to([q, img], { y: -16, opacity: 0, duration: .25, ease: 'power1.in' }).add(paint).fromTo([q, img], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .3, ease: 'power1.out' });
      restart();
    };
    const restart = () => {
      clearTimeout(timer); next.classList.remove('is-running');
      if (reduce || paused) return;
      void next.offsetWidth; next.classList.add('is-running');
      timer = setTimeout(() => go(i + 1), 8000);
    };
    const pause = () => { paused = true; clearTimeout(graceT); clearTimeout(timer); next.classList.remove('is-running'); };
    const resume = () => { clearTimeout(graceT); graceT = setTimeout(() => { paused = false; restart(); }, 1000); };
    [card, $('[data-press-nav]', press)].forEach((el) => {
      el.addEventListener('pointerenter', pause); el.addEventListener('pointerleave', resume);
      el.addEventListener('focusin', pause); el.addEventListener('focusout', resume);
    });
    next.addEventListener('click', () => go(i + 1)); prev.addEventListener('click', () => go(i - 1));
    if (!reduce) ScrollTrigger.create({ trigger: press, start: 'top bottom', once: true, onEnter: restart });
  }

  /* ---------- refresh after fonts and load (two refreshes, spec 3.0) ---------- */
  requestAnimationFrame(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
