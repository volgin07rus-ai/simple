// Провод через весь сайт. Выходит из карточки Simple во втором блоке, идёт по свободным коридорам
// между колонками и по полю страницы и заходит сбоку в кассу с чеком. Тусклая трасса видна сразу,
// лаймовая часть дорисовывается при прокрутке, по ней пробегает импульс, как по схеме на первом экране
(() => {
  const main = document.getElementById('main')
  const hub = document.querySelector('.hub')
  const printer = document.querySelector('.receipt-printer')
  if (!main || !hub || !printer) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const NS = 'http://www.w3.org/2000/svg'
  const R = 28          // радиус поворотов
  const READ = 0.62     // голова провода держится на этой доле высоты экрана
  const PULSE = 1400    // импульс бежит к голове столько миллисекунд
  const EVERY = 3600    // и повторяется с таким шагом

  const make = (tag, cls) => { const el = document.createElementNS(NS, tag); el.setAttribute('class', cls); return el }
  const svg = make('svg', 'wire')
  svg.setAttribute('aria-hidden', 'true')
  const track = make('path', 'wire-track'), lit = make('path', 'wire-lit')
  const pulse = make('circle', 'wire-pulse'), head = make('circle', 'wire-head')
  pulse.setAttribute('r', 2.4)
  head.setAttribute('r', 3.4)
  svg.append(track, lit, pulse, head)
  main.prepend(svg)

  // Координаты внутри main по раскладке, без transform: блоки до появления ещё сдвинуты
  const box = el => {
    let x = 0, y = 0
    for (let e = el; e && e !== main; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop }
    return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight, cx: x + el.offsetWidth / 2, cy: y + el.offsetHeight / 2 }
  }
  const q = s => document.querySelector(s)

  function route() {
    const wrap = q('#fit > .wrap')
    const inner = box(wrap).l + parseFloat(getComputedStyle(wrap).paddingLeft)   // левый край содержимого
    const gutter = inner - Math.min(28, inner / 2)
    // Между колонками «Узнаёте ситуацию» и «Шесть направлений» общий свободный коридор, если колонки стоят рядом
    const a = box(q('.fit-aside')), b = box(q('.fit-main')), c = box(q('.svc-list')), d = box(q('.svc-stage'))
    const left = Math.max(a.r, c.r), right = Math.min(b.l, d.l)
    const channel = right - left > 48 ? (left + right) / 2 : gutter
    const h = box(hub), p = box(printer)
    const fitTop = box(q('#fit')).t, worksTop = box(q('#works')).t
    const raw = [
      [h.cx, h.b],              // из-под карточки Simple
      [h.cx, fitTop],           // по границам блоков провод переходит в другой коридор
      [channel, fitTop],
      [channel, worksTop],
      [gutter, worksTop],
      [gutter, p.cy],
      [p.l + 40, p.cy]          // конец прячется за кассой
    ].map(([x, y]) => [Math.round(x), Math.round(y)])
    // повторы и точки на одной прямой убираем, иначе скругление не построить
    const P = [raw[0]]
    for (const pt of raw.slice(1)) {
      const last = P[P.length - 1]
      if (pt[0] === last[0] && pt[1] === last[1]) continue
      const prev = P[P.length - 2]
      if (prev && ((prev[0] === last[0] && last[0] === pt[0]) || (prev[1] === last[1] && last[1] === pt[1]))) P.pop()
      P.push(pt)
    }
    return P
  }

  let K = [], L = [], total = 0, shown = 0, target = 0, raf = 0, top = 0
  let pulseAt = -1, delivered = false

  function build() {
    const P = route()
    const n = P.length
    const seg = i => Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
    const rad = P.map((_, i) => (i === 0 || i === n - 1) ? 0 : Math.min(R, seg(i) / 2, seg(i + 1) / 2))
    let d = `M${P[0][0]} ${P[0][1]}`
    for (let i = 1; i < n; i++) {
      const [x, y] = P[i], [px, py] = P[i - 1]
      const len = seg(i), ux = (x - px) / len, uy = (y - py) / len
      const r = rad[i]
      if (!r) { d += ` L${x} ${y}`; continue }
      const len2 = seg(i + 1), vx = (P[i + 1][0] - x) / len2, vy = (P[i + 1][1] - y) / len2
      d += ` L${x - ux * r} ${y - uy * r} A${r} ${r} 0 0 ${ux * vy - uy * vx > 0 ? 1 : 0} ${x + vx * r} ${y + vy * r}`
    }
    track.setAttribute('d', d)
    lit.setAttribute('d', d)
    svg.setAttribute('width', main.clientWidth)
    svg.setAttribute('height', main.offsetHeight)

    // длина пути в каждой точке (середина скругления), подгоняем под длину, которую считает браузер
    L = [0]
    for (let i = 1; i < n; i++) L.push(L[i - 1] + seg(i) - rad[i - 1] - rad[i] + Math.PI / 4 * (rad[i - 1] + rad[i]))
    total = lit.getTotalLength()
    const k = total / L[n - 1]
    L = L.map(v => v * k)

    // Ключ прокрутки для каждой точки: на вертикалях голова идёт вровень со страницей,
    // горизонтальный переход растянут на отрезок прокрутки вокруг своей высоты
    K = P.map(pt => pt[1])
    for (let i = 1; i < n; i++) {
      if (P[i][1] !== P[i - 1][1]) continue
      const s = Math.max(60, Math.min(260, seg(i) * 0.45))
      K[i - 1] = P[i][1] - s / 2
      K[i] = P[i][1] + s / 2
    }
    K[0] = Math.min(K[0], P[0][1])
    for (let i = 1; i < n; i++) K[i] = Math.max(K[i], K[i - 1] + seg(i) * 0.2)

    top = main.getBoundingClientRect().top + scrollY
    lit.style.strokeDasharray = `${total} ${total + 10}`
    shown = Math.min(shown, total)
    if (reduce) { shown = target = total; paint(); return }
    target = lengthAt(scrollY + innerHeight * READ - top)
    if (!raf) raf = requestAnimationFrame(frame)
  }

  function lengthAt(key) {
    if (key <= K[0]) return 0
    const n = K.length
    if (key >= K[n - 1]) return total
    let i = 1
    while (K[i] < key) i++
    return L[i - 1] + (key - K[i - 1]) / (K[i] - K[i - 1]) * (L[i] - L[i - 1])
  }

  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  function paint(now) {
    lit.style.strokeDashoffset = total - shown
    const live = shown > 1 && shown < total - 1
    head.classList.toggle('is-on', live)
    if (live) {
      const pt = lit.getPointAtLength(shown)
      head.setAttribute('cx', pt.x)
      head.setAttribute('cy', pt.y)
    }
    hub.classList.toggle('is-wired', shown > 1)
    const arrived = shown >= total - 1
    printer.classList.toggle('is-wired', arrived)
    // провод дошёл до кассы: она печатает чек (blocks.js)
    if (arrived && !delivered) { delivered = true; printer.closest('.receipt')?.dispatchEvent(new CustomEvent('wire')) }
    // импульс пробегает по уже горящему участку к голове
    let on = false
    if (pulseAt >= 0 && now) {
      const t = (now - pulseAt) / PULSE
      if (t >= 1) pulseAt = -1
      else {
        const from = Math.max(0, shown - 560)
        const pt = lit.getPointAtLength(from + (shown - from) * ease(t))
        pulse.setAttribute('cx', pt.x)
        pulse.setAttribute('cy', pt.y)
        pulse.style.opacity = Math.min(1, t / 0.15, (1 - t) / 0.25)
        on = true
      }
    }
    if (!on) pulse.style.opacity = 0
    return on
  }

  function frame(now) {
    raf = 0
    shown += (target - shown) * 0.14
    if (Math.abs(target - shown) < 0.5) shown = target
    const pulsing = paint(now)
    if (shown !== target || pulsing) raf = requestAnimationFrame(frame)
  }

  if (!reduce) {
    addEventListener('scroll', () => {
      target = lengthAt(scrollY + innerHeight * READ - top)
      if (!raf) raf = requestAnimationFrame(frame)
    }, { passive: true })
    // импульс запускаем, только когда голова провода на экране
    setInterval(() => {
      if (document.hidden || shown < 120 || shown >= total - 1) return
      const y = lit.getPointAtLength(shown).y + top - scrollY
      if (y < 0 || y > innerHeight) return
      pulseAt = performance.now()
      if (!raf) raf = requestAnimationFrame(frame)
    }, EVERY)
  }

  // трасса пересчитывается, когда меняется раскладка: ширина окна, раскрытые описания, догрузившиеся шрифты
  let queued = 0
  const rebuild = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; build() }) }
  new ResizeObserver(rebuild).observe(main)
  document.fonts.ready.then(rebuild)
  document.fonts.addEventListener('loadingdone', rebuild)
  addEventListener('load', rebuild)
})()
