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
  let scrolled = null
  const onScroll = () => { const v = scrollY > 20; if (v !== scrolled) hdr.classList.toggle('is-scrolled', scrolled = v) }
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  /* ---------- Слабое железо: облегчённый и спокойный режимы ---------- */
  // Три уровня, содержимое на всех одно и то же: схемы, сцены, чек, шаги.
  // Полный: всё как задумано.
  // Облегчённый (класс lite на html, событие simple:lite): фоны на холстах в плотности 1 и 20 кадров в секунду,
  // у поля фигур нет свечения, линза надписи стоит, шапка и появления блоков без размытия, по проводу не бегает импульс.
  // Спокойный (вдобавок класс calm, событие simple:tier): фона из пикселей нет вовсе, поле фигур на первом экране,
  // стена работ и символы в брифе стоят, пока их не трогают курсором, огоньки по линиям второго блока не бегают.
  //
  // Уровень выбирается сам. Сразу при загрузке: по видеокарте, если браузер её называет (встроенная Intel
  // старых поколений на экране с большой плотностью — облегчённый, рисование без видеокарты — спокойный),
  // по просьбе браузера экономить трафик и по уровню, уже выбранному на этом компьютере за последние три дня.
  // Потом по замерам: после загрузки, при первой прокрутке и при появлении блоков по 2,5–3 секунды считаем кадры.
  // Опоздало больше 6% кадров (дольше 25 мс, или в полтора раза дольше обычного на экранах, где кадр и так длинный):
  // на экране 60 Гц это уже заметные рывки. Уровень поднимается на ступень, через полторы секунды замер повторяется.
  // На быстром компьютере опаздывает не больше 2% кадров, и то во время загрузки
  // Обычный кадр дольше 24 мс (меньше 40 кадров в секунду) — облегчённый. Вниз уровень сам не возвращается.
  // Посмотреть режим вручную: адрес с ?quality=full, ?quality=lite или ?quality=calm (держится до конца визита),
  // ?quality=auto снова включает автоматический выбор
  const root = document.documentElement
  const KEY = 'simple-quality', LEVELS = { full: 0, lite: 1, calm: 2 }
  // хранилища браузера могут быть недоступны (приватный режим, запрет сайта): тогда просто не запоминаем
  const store = (s, k, v) => { try { v === undefined ? window[s].removeItem(k) : window[s].setItem(k, v) } catch {} }
  const read = (s, k) => { try { return window[s].getItem(k) } catch { return null } }
  let tier = 0, pinned = false

  function apply(t) {
    const was = tier
    tier = t
    root.classList.toggle('lite', tier >= 1)
    root.classList.toggle('calm', tier >= 2)
    if (was < 1 && tier >= 1) dispatchEvent(new Event('simple:lite'))
    dispatchEvent(new CustomEvent('simple:tier', { detail: tier }))
  }
  // уровень по замеру: запоминаем на визит и на три дня для этого компьютера
  function raise(t) {
    t = Math.min(2, t)
    if (pinned || t <= tier) return false
    apply(t)
    store('sessionStorage', KEY, String(tier))
    store('localStorage', KEY, JSON.stringify({ tier, at: Date.now() }))
    return true
  }

  // Видеокарта по имени. Safari имя не называет, там решают замеры
  function gpuHint() {
    try {
      const canvas = document.createElement('canvas')
      if (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true })) {
        const gl = canvas.getContext('webgl')
        let name = gl.getParameter(gl.RENDERER) || ''
        if (/^(WebKit WebGL|Mozilla)$/i.test(name)) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info')
          if (ext) name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || name
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        const pixels = innerWidth * innerHeight * devicePixelRatio ** 2
        // встроенная Intel до Iris Xe (HD, UHD, Iris Plus и Pro, как в MacBook 2015–2020), слабые мобильные и старые AMD
        const weak = /Intel.*(HD Graphics|UHD Graphics|Iris(\((TM|R)\))? (Plus|Pro|Graphics \d))|Mali-(T\d+|G[1-5]\d)\b|Adreno\D*[1-5]\d\d\b|PowerVR|Radeon R[2-7]\b/i.test(name)
        return weak && pixels > 2.2e6 ? 1 : 0
      }
      // WebGL есть, но только без видеокарты, программно: такой компьютер не потянет даже облегчённый режим
      const soft = canvas.getContext('webgl')
      soft?.getExtension('WEBGL_lose_context')?.loseContext()
      return soft ? 2 : 0
    } catch { return 0 }
  }

  const asked = new URLSearchParams(location.search).get('quality')
  if (asked === 'auto') { store('sessionStorage', KEY + '-pin'); store('sessionStorage', KEY); store('localStorage', KEY) }
  else if (asked in LEVELS) store('sessionStorage', KEY + '-pin', String(LEVELS[asked]))
  const pin = read('sessionStorage', KEY + '-pin')
  if (pin !== null) { pinned = true; if (+pin) apply(+pin) }
  else {
    let start = +read('sessionStorage', KEY) || 0
    try {
      const saved = JSON.parse(read('localStorage', KEY) || 'null')
      if (saved && Date.now() - saved.at < 3 * 864e5) start = Math.max(start, saved.tier)
    } catch {}
    if (navigator.connection && navigator.connection.saveData) start = Math.max(start, 1)
    if (start < 2) start = Math.max(start, gpuHint())
    if (start) apply(Math.min(2, start))
  }

  let sampling = false, lastSample = -1e9, samples = 0
  function sample(ms = 2500, again = false) {
    if (pinned || tier >= 2 || sampling || document.hidden || samples >= 12) return
    if (!again && performance.now() - lastSample < 4000) return
    sampling = true
    const gaps = []
    let prev = 0, t0 = 0, hidden = false
    const step = now => {
      if (document.hidden) hidden = true
      if (prev) gaps.push(now - prev)
      prev = now
      t0 ||= now
      if (!hidden && now - t0 < ms) { requestAnimationFrame(step); return }
      sampling = false
      lastSample = performance.now()
      samples++
      if (hidden || gaps.length < 20) return
      gaps.sort((a, b) => a - b)
      const base = gaps[Math.floor(gaps.length * 0.1)], median = gaps[gaps.length >> 1]
      const late = gaps.filter(g => g > Math.max(25, base * 1.5)).length / gaps.length
      dispatchEvent(new CustomEvent('simple:frames', { detail: { late, median, base, n: gaps.length } }))   // для проверок
      const raised = late > 0.06 ? raise(tier + 1) : median > 24 && tier < 1 ? raise(1) : false
      // после перехода меряем ещё раз: вдруг и этого мало
      if (raised && tier < 2) setTimeout(() => sample(2500, true), 1500)
    }
    requestAnimationFrame(step)
  }
  // за экраном загрузки первый замер ждёт, пока он уйдёт: мерить нужно открытый сайт, а не его сборку
  if (root.classList.contains('is-loading')) addEventListener('simple:revealed', () => setTimeout(() => sample(3000), 600), { once: true })
  else addEventListener('load', () => setTimeout(() => sample(3000), 1200))

  /* ---------- Экран загрузки (главная и бриф) ---------- */
  // Пока экран закрывает страницу, за ним собирается фон первого экрана: видеокарта готовит шейдеры и рисует
  // первые кадры, грузятся шрифты, строятся блоки ниже. Раньше это шло одновременно с заставками первого экрана,
  // и они подтормаживали. Полоска идёт по настоящим шагам: шрифты, потом первые кадры фона (событие simple:bg-ready
  // из bg.js или terminal.js). Когда всё готово, экран плавно уходит, и звучит simple:revealed: по нему стартуют
  // заставки (hero.js, bg.js, blocks.js, terminal.js), а фоны ниже по странице подключаются ещё позже (pixels.js).
  // Фон не ждём, если первого экрана не видно (переход по якорю) или поле не запустилось; дольше 6 секунд не ждём вовсе.
  // Первый раз за визит экран держится не меньше 0,8 секунды, чтобы не мелькнуть, дальше уходит сразу, как всё готово
  const loader = document.getElementById('loader')
  if (loader && root.classList.contains('is-loading')) {
    const fill = loader.querySelector('.loader-line i')
    const progress = p => fill && fill.style.setProperty('--p', p)
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = read('sessionStorage', 'simple-loaded')
    const minShow = still ? 0 : seen ? 250 : 800
    const t0 = performance.now()
    requestAnimationFrame(() => progress(0.3))

    const scene = document.querySelector('[data-loader-bg]')
    const onScreen = () => { const r = scene.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight }
    const needBg = !!scene && (!location.hash || location.hash === '#top') && onScreen()
    const bgReady = new Promise(done => {
      if (!needBg || root.dataset.bg) return done()
      const finish = () => { removeEventListener('scroll', away); done() }
      // страницу прокрутили, пока она грузилась: фон первого экрана уже не нужен
      const away = () => { if (!onScreen()) finish() }
      addEventListener('simple:bg-ready', finish, { once: true })
      addEventListener('scroll', away, { passive: true })
    })
    const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => progress(needBg ? 0.62 : 0.9))
    // после первых кадров фона ещё два кадра: видеокарта уже прогрета, когда начнутся заставки
    const settled = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
    Promise.race([Promise.all([fontsReady, bgReady]).then(settled), new Promise(done => setTimeout(done, 6000))]).then(() => {
      progress(1)
      setTimeout(reveal, Math.max(still ? 0 : 380, minShow - (performance.now() - t0)))
    })
    function reveal() {
      if (root.classList.contains('is-loaded')) return
      root.classList.add('is-loaded')
      root.classList.remove('is-loading')
      store('sessionStorage', 'simple-loaded', '1')
      dispatchEvent(new Event('simple:revealed'))
    }
  }
  addEventListener('scroll', function first() {
    removeEventListener('scroll', first)
    setTimeout(() => sample(3000), 200)
  }, { passive: true })

  /* ---------- Анимации по кругу за пределами экрана стоят ---------- */
  // Мигающие точки, огоньки по линиям схем, «печатает…» в чате: браузер крутит такие анимации всё время,
  // даже когда блок далеко за экраном, а огоньки по линиям ещё и пересчитывает основным потоком каждый кадр.
  // Блок ушёл с экрана, и его анимации замирают; вернулся, и они идут дальше с того же места.
  // Когда блок показывается впервые, заодно меряем кадры: у каждого блока своя нагрузка
  const met = new WeakSet()
  const sleeper = new IntersectionObserver(entries => entries.forEach(e => {
    e.target.classList.toggle('is-offscreen', !e.isIntersecting)
    if (e.isIntersecting && !met.has(e.target)) { met.add(e.target); setTimeout(() => sample(), 600) }
  }), { rootMargin: '150px 0px' })
  document.querySelectorAll('main > section').forEach(s => sleeper.observe(s))

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
