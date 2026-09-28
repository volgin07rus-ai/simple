// Общее для всех страниц: мышь или тач, нож на кнопках и в логотипе, маркер на пунктах меню, подложка шапки
(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches
  if (finePointer) document.body.classList.add('hoverable')

  /* ---------- Нож в кнопках: части отдельно, чтобы раскрывать их при наведении ---------- */
  const KNIFE = `<svg viewBox="150 158 470 409"><g fill="currentColor">
    <g class="k k-neck"><path d="M348.737 437.896H392.282V350.808H348.737V437.896Z"/></g>
    <g class="k k-doc"><path fill-rule="evenodd" clip-rule="evenodd" d="M311 183.026C311 179.041 312.865 175.219 316.186 172.401C319.506 169.583 324.009 168 328.705 168H377.885L431 213.078V344.974C431 348.959 429.135 352.781 425.814 355.599C422.494 358.417 417.991 360 413.295 360H328.705C324.009 360 319.506 358.417 316.186 355.599C312.865 352.781 311 348.959 311 344.974V183.026ZM338.541 239.791H403.459V254.817H338.541V239.791ZM338.541 276.522H403.459V291.548H338.541V276.522ZM338.541 313.252H377.885V328.278H338.541V313.252Z"/></g>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M233.001 428.729H508.018C525.037 428.729 541.359 435.49 553.394 447.524C565.428 459.559 572.189 475.881 572.189 492.9C572.189 509.919 565.428 526.241 553.394 538.276C541.359 550.31 525.037 557.071 508.018 557.071H233.001C215.982 557.071 199.66 550.31 187.625 538.276C175.591 526.241 168.83 509.919 168.83 492.9C168.83 475.881 175.591 459.559 187.625 447.524C199.66 435.49 215.982 428.729 233.001 428.729ZM301.755 492.9C301.755 487.733 299.703 482.779 296.05 479.125C292.396 475.472 287.441 473.42 282.275 473.42C277.108 473.42 272.153 475.472 268.5 479.125C264.847 482.779 262.794 487.733 262.794 492.9C262.794 498.067 264.847 503.021 268.5 506.675C272.153 510.328 277.108 512.38 282.275 512.38C287.441 512.38 292.396 510.328 296.05 506.675C299.703 503.021 301.755 498.067 301.755 492.9ZM478.225 492.9C478.225 487.733 476.172 482.779 472.519 479.125C468.866 475.472 463.911 473.42 458.744 473.42C453.578 473.42 448.623 475.472 444.97 479.125C441.316 482.779 439.264 487.733 439.264 492.9C439.264 498.067 441.316 503.021 444.97 506.675C448.623 510.328 453.578 512.38 458.744 512.38C463.911 512.38 468.866 510.328 472.519 506.675C476.172 503.021 478.225 498.067 478.225 492.9Z"/>
    <g class="k k-l"><rect width="248.32" height="37.8786" rx="18.9393" transform="matrix(-0.707107 -0.707107 -0.707107 0.707107 362.091 443.342)"/></g>
    <g class="k k-r"><rect x="392" y="429.945" width="147" height="35" transform="rotate(-45 392 429.945)"/><g class="k k-sp"><path d="M540 238C549.2 274.8 572.2 297.8 609 307C572.2 316.2 549.2 339.2 540 376C530.8 339.2 507.8 316.2 471 307C507.8 297.8 530.8 274.8 540 238Z"/></g></g>
  </g></svg>`
  document.querySelectorAll('[data-knife]').forEach(el => { el.innerHTML = KNIFE })

  /* ---------- Наведение на пункты меню: лаймовый маркер ---------- */
  // Маркер проводится под словом слева направо, как под суммой в чеке, слово на нём тёмное.
  // Когда курсор уходит, маркер уезжает вправо. Слово на маркере рисует ::after из data-text,
  // поэтому имя ссылки для экранного диктора задаём в aria-label, иначе он прочтёт слово дважды
  if (finePointer) document.querySelectorAll('.nav a, .ftr-nav a').forEach(a => {
    const text = a.textContent.trim()
    a.dataset.text = text
    if (!a.hasAttribute('aria-label')) a.setAttribute('aria-label', text)
    a.classList.add('mk')
    a.addEventListener('pointerenter', () => {
      if (a.classList.contains('mk-out')) {
        // маркер ушёл вправо: без анимации возвращаем его к левому краю, чтобы снова вести слева
        a.classList.add('mk-reset')
        a.classList.remove('mk-out')
        void a.offsetWidth
        a.classList.remove('mk-reset')
      }
      a.classList.add('mk-in')
    })
    a.addEventListener('pointerleave', () => {
      a.classList.remove('mk-in')
      a.classList.add('mk-out')
    })
  })

  /* ---------- Шапка: подложка после прокрутки ---------- */
  const hdr = document.getElementById('hdr')
  const onScroll = () => hdr.classList.toggle('is-scrolled', scrollY > 20)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  /* ---------- Плавный переезд к блоку по ссылкам меню и якорям ---------- */
  // Вместо рывка страница плавно едет к блоку: медленно трогается, разгоняется и мягко встаёт, без отскока.
  // Время зависит от расстояния. Блок встаёт под шапку, а не за неё. Колесо и тачпад остаются обычными,
  // а если человек сам крутит страницу во время переезда, управление сразу возвращается к нему
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const inOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  let glide = 0
  function glideTo(y) {
    cancelAnimationFrame(glide)
    const from = scrollY, dist = y - from
    if (reduceMotion || Math.abs(dist) < 2) { scrollTo(0, y); return }
    const dur = Math.min(1800, 550 + Math.abs(dist) * 0.2)
    const t0 = performance.now()
    const step = now => {
      const t = Math.min(1, (now - t0) / dur)
      scrollTo(0, from + dist * inOutCubic(t))
      if (t < 1) glide = requestAnimationFrame(step)
    }
    glide = requestAnimationFrame(step)
  }
  const stopGlide = () => cancelAnimationFrame(glide)
  addEventListener('wheel', stopGlide, { passive: true })
  addEventListener('touchstart', stopGlide, { passive: true })
  addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) stopGlide() })

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = e.target.closest('a[href*="#"]')
    if (!a) return
    const url = new URL(a.href, location.href)
    // ссылка на якорь другой страницы открывается как обычно
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return
    const id = decodeURIComponent(url.hash.slice(1))
    const target = id === 'top' ? null : document.getElementById(id)
    if (id !== 'top' && !target) return
    e.preventDefault()
    const max = document.documentElement.scrollHeight - innerHeight
    const y = target ? target.getBoundingClientRect().top + scrollY - hdr.offsetHeight : 0
    glideTo(Math.max(0, Math.min(max, y)))
    history.pushState(null, '', url.hash)
    // клавиатура и экранный диктор продолжают с нового блока
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }
  })

  /* ---------- Свой бегунок прокрутки, как на volgin.site/uplift ---------- */
  // Тонкая дорожка справа: проявляется при прокрутке и гаснет через 0,9 с.
  // Ползунок можно тянуть, щелчок по дорожке переносит к месту. На тач-экранах не нужен
  if (!matchMedia('(pointer: coarse)').matches) {
    const bar = document.createElement('div')
    const thumb = document.createElement('div')
    bar.className = 'scrollbar'
    bar.dataset.visible = '0'
    bar.setAttribute('aria-hidden', 'true')
    thumb.className = 'scrollbar-thumb'
    bar.appendChild(thumb)
    document.body.appendChild(bar)

    const MIN = 28, HIDE = 900, REMEASURE = 500
    let vh = 0, track = 0, full = 0, measured = 0, shown = '0'
    let dragging = false, grab = 0, hideTimer = 0, lastY = -1, lastH = -1
    const setVisible = v => { if (v !== shown) { shown = v; bar.dataset.visible = v } }

    function paint() {
      const max = full - vh
      if (max <= 0 || track <= 0) { setVisible('0'); return }
      const h = Math.max(MIN, vh / full * track)
      const y = Math.min(1, Math.max(0, scrollY / max)) * (track - h)
      if (Math.abs(h - lastH) > 0.5) { lastH = h; thumb.style.height = h + 'px' }
      if (Math.abs(y - lastY) > 0.25) { lastY = y; thumb.style.transform = `translate3d(0, ${y}px, 0)` }
    }
    function measure() {
      measured = performance.now()
      vh = innerHeight
      track = bar.clientHeight
      full = document.documentElement.scrollHeight
      paint()
    }
    function wake() {
      setVisible('1')
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => { if (!dragging) setVisible('0') }, HIDE)
    }
    // Высота страницы меняется (раскрытые пункты, картинки), поэтому при прокрутке она перемеряется
    addEventListener('scroll', () => { performance.now() - measured > REMEASURE ? measure() : paint(); wake() }, { passive: true })
    addEventListener('resize', measure)
    new ResizeObserver(measure).observe(document.body)
    measure()

    function jump(clientY) {
      const r = bar.getBoundingClientRect(), room = r.height - thumb.offsetHeight
      if (room <= 0) return
      const y = Math.min(room, Math.max(0, clientY - r.top - grab))
      full = document.documentElement.scrollHeight
      scrollTo({ top: y / room * (full - innerHeight), behavior: 'instant' })
    }
    bar.addEventListener('pointerdown', e => {
      const t = thumb.getBoundingClientRect()
      // За ползунок держим там, где схватили; щелчок по дорожке ставит его серединой под курсор
      grab = e.clientY >= t.top && e.clientY <= t.bottom ? e.clientY - t.top : t.height / 2
      dragging = true
      wake()
      bar.setPointerCapture(e.pointerId)
      jump(e.clientY)
      e.preventDefault()
    })
    bar.addEventListener('pointermove', e => { if (dragging) { wake(); jump(e.clientY) } })
    const stop = () => { dragging = false; wake() }
    bar.addEventListener('pointerup', stop)
    bar.addEventListener('pointercancel', stop)
  }
})()
