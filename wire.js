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
  // Лаймовая часть собрана из отдельных отрезков трассы. При прокрутке меняется только отрезок, по которому
  // идёт голова, и браузер перерисовывает узкую полосу вокруг него. Одним путём на всю трассу провод занимал
  // почти всю страницу, и каждый кадр прокрутки перерисовывался весь экран под ним: на слабых ноутбуках это рывки
  const track = make('path', 'wire-track'), lit = make('g', 'wire-lit-g')
  const pulse = make('circle', 'wire-pulse'), head = make('circle', 'wire-head')
  pulse.setAttribute('r', 2.4)
  head.setAttribute('r', 3.4)
  svg.append(track, lit, pulse, head)
  let legs = []   // { el, start, len, mode }
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
    // К кассе провод подходит слева и заходит в порт на её боку. На телефоне касса стоит почти вплотную
    // к коридору, поворот к порту прятался за её корпусом, и видимая линия обрывалась выше порта.
    // Если места на поворот нет, провод спускается прямо в порт, а порт встаёт точно под провод
    const side = p.l - gutter >= R + 12
    // сдвиг порта считаем по точному положению кассы: сумма округлённых offsetLeft расходится с ним на полпикселя
    const exact = printer.getBoundingClientRect().left - main.getBoundingClientRect().left
    printer.style.setProperty('--port-x', side ? '' : `${(Math.round(gutter) - exact - 1).toFixed(2)}px`)
    const raw = [
      [h.cx, h.b],              // из-под карточки Simple
      [h.cx, fitTop],           // по границам блоков провод переходит в другой коридор
      [channel, fitTop],
      [channel, worksTop],
      [gutter, worksTop],
      [gutter, p.cy],
      ...(side ? [[p.l + 40, p.cy]] : [])   // конец прячется за кассой
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

  let K = [], L = [], total = 0, shown = 0, target = 0, raf = 0, top = 0, sent = -1
  let pulseAt = -1, delivered = false

  function build() {
    const P = route()
    const n = P.length
    const seg = i => Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
    const rad = P.map((_, i) => (i === 0 || i === n - 1) ? 0 : Math.min(R, seg(i) / 2, seg(i + 1) / 2))
    let d = `M${P[0][0]} ${P[0][1]}`, part = d
    const parts = []
    for (let i = 1; i < n; i++) {
      const [x, y] = P[i], [px, py] = P[i - 1]
      const len = seg(i), ux = (x - px) / len, uy = (y - py) / len
      const r = rad[i]
      if (!r) { d += ` L${x} ${y}`; parts.push(part + ` L${x} ${y}`); continue }
      const len2 = seg(i + 1), vx = (P[i + 1][0] - x) / len2, vy = (P[i + 1][1] - y) / len2
      const ex = x + vx * r, ey = y + vy * r
      const piece = ` L${x - ux * r} ${y - uy * r} A${r} ${r} 0 0 ${ux * vy - uy * vx > 0 ? 1 : 0} ${ex} ${ey}`
      d += piece
      parts.push(part + piece)   // отрезок кончается сразу за скруглением, следующий начинается там же
      part = `M${ex} ${ey}`
    }
    track.setAttribute('d', d)
    svg.setAttribute('width', main.clientWidth)
    svg.setAttribute('height', main.offsetHeight)
    while (legs.length < parts.length) { const el = make('path', 'wire-lit'); lit.append(el); legs.push({ el }) }
    while (legs.length > parts.length) legs.pop().el.remove()
    let acc = 0
    legs.forEach((leg, i) => {
      leg.el.setAttribute('d', parts[i])
      leg.len = leg.el.getTotalLength()
      leg.start = acc
      leg.mode = ''
      acc += leg.len
    })

    // длина пути в каждой точке (середина скругления), подгоняем под длину, которую считает браузер
    L = [0]
    for (let i = 1; i < n; i++) L.push(L[i - 1] + seg(i) - rad[i - 1] - rad[i] + Math.PI / 4 * (rad[i - 1] + rad[i]))
    total = acc
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
    shown = Math.min(shown, total)
    sent = -1
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
  // отрезок целиком горит, целиком спрятан или горит частично; стиль меняем, только когда состояние сменилось
  function setMode(leg, mode) {
    if (leg.mode === mode) return
    leg.mode = mode
    leg.el.style.visibility = mode === 'none' ? 'hidden' : ''
    leg.el.style.strokeDasharray = mode === 'part' ? `${leg.len} ${leg.len + 10}` : ''
    if (mode !== 'part') leg.el.style.strokeDashoffset = ''
  }
  function pointAt(len) {
    const leg = legs.find(l => len <= l.start + l.len) || legs[legs.length - 1]
    return leg.el.getPointAtLength(Math.max(0, Math.min(leg.len, len - leg.start)))
  }
  function paint(now) {
    for (const leg of legs) {
      const local = shown - leg.start
      if (local >= leg.len - 0.01) setMode(leg, 'full')
      else if (local <= 0) setMode(leg, 'none')
      else { setMode(leg, 'part'); leg.el.style.strokeDashoffset = leg.len - local }
    }
    const live = shown > 1 && shown < total - 1
    head.classList.toggle('is-on', live)
    if (shown !== sent) {
      sent = shown
      const pt = pointAt(shown)
      if (live) {
        head.setAttribute('cx', pt.x)
        head.setAttribute('cy', pt.y)
      }
      // где сейчас голова провода на странице: по ней на телефоне загораются шаги «Что происходит с вашей задачей»
      document.dispatchEvent(new CustomEvent('wirehead', { detail: top + pt.y }))
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
        const pt = pointAt(from + (shown - from) * ease(t))
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
    // импульс запускаем, только когда голова провода на экране. На слабом компьютере (класс lite) импульса нет:
    // пока он бежит, страница перерисовывается каждый кадр
    setInterval(() => {
      if (document.hidden || shown < 120 || shown >= total - 1 || document.documentElement.classList.contains('lite')) return
      const y = pointAt(shown).y + top - scrollY
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
