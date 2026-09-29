// DriftWall: наклонная стена из колонок, колонки плывут навстречу друг другу с разной скоростью.
// Порт компонента DriftWall из React Bits без React. Колонку под курсором стена останавливает,
// плитка под курсором приподнимается к зрителю и показывает подпись
// DriftWall: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause
const DEFAULTS = {
  items: [], columns: 5, tileWidth: 200, tileHeight: 132, gap: 18, radius: 14,
  tilt: 16, turn: -14, roll: 0, perspective: 1200, depth: 120,
  speed: 42, direction: 'up', variance: 0.45, parallax: 0.6, pauseOnHover: false,
  lift: 64, fade: 0.6, dim: 0.55, grayscale: false, overlayColor: '#060010',
  label: 'Стена работ',
  // ({ width, height }) => часть параметров под текущий размер стены
  responsive: null
}

// Разброс скоростей: шаг золотого сечения даёт непохожие соседние колонки без случайности
const columnFactor = (index, variance) => 1 + variance * (((index * 0.6180339887 + 0.35) % 1) * 2 - 1)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function createDriftWall(container, options = {}) {
  const base = { ...DEFAULTS, ...options }
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motion.matches

  let o = base
  let size = { w: 0, h: 0 }, planeH = 0
  let plane = null, tracks = [], meta = [], offsets = [], velocities = [], baseVel = []
  let pointer = { x: 0, y: 0 }, damped = { x: 0, y: 0 }, client = null
  let inside = false, active = null, hoveredCol = -1, focus = null
  let raf = 0, last = null, lastHit = 0, visible = false, pointerType = 'mouse', resizeTimer = 0
  let shift = { cur: 0, target: 0 }, tabY = 0, tabAt = -1e9
  let anims = []   // колонки в покое плывут анимациями браузера (drift), без кадров в JavaScript

  container.classList.add('drift-wall')
  container.classList.toggle('drift-wall--reduced', reduced)
  container.setAttribute('role', 'group')
  container.setAttribute('aria-label', base.label)

  /* ---------- Раскладка ---------- */
  function build() {
    const w = container.clientWidth, h = container.clientHeight || 600
    size = { w, h }
    o = { ...base, ...(base.responsive ? base.responsive({ width: w, height: h }) : null) }
    const { items, columns, tileWidth, tileHeight, gap } = o
    const unit = tileHeight + gap

    // Запоминаем работу в фокусе: после перестройки фокус вернётся на неё же
    const was = container.contains(document.activeElement) ? document.activeElement.closest('.drift-wall__tile')?.dataset.i : null

    const cols = Array.from({ length: columns }, () => [])
    items.forEach((item, i) => cols[i % columns].push({ item, i }))
    // Колонка без своих работ повторяет первую, но без фокуса: одна доступная копия на работу
    const colItems = cols.map(col => (col.length ? col : [{ item: items[0], i: 0, filler: true }]))

    // Плоскость в 1,6 раза выше стены. Копий колонки хватает, чтобы закрыть её при любом сдвиге,
    // в том числе когда колонка подводит к центру плитку, на которой фокус с клавиатуры
    planeH = h * 1.6
    const half = planeH / 2
    meta = colItems.map(col => {
      const copyHeight = Math.max(unit, col.length * unit)
      const focusCopy = Math.ceil(half / copyHeight)
      const copies = Math.max(2, Math.ceil(planeH / copyHeight) + 1, focusCopy + 1 + Math.ceil((half + unit) / copyHeight))
      return { copyHeight, copies, focusCopy, length: col.length, unit, maxOffset: copies * copyHeight - planeH }
    })

    const dirSign = o.direction === 'up' ? 1 : -1
    baseVel = colItems.map((_, c) => o.speed * columnFactor(c, o.variance) * dirSign * (c % 2 === 0 ? 1 : -1))
    offsets = meta.map((m, c) => m.copyHeight * ((c * 0.37) % 1))
    velocities = meta.map(() => 0)

    const s = container.style
    s.setProperty('--dw-tile-w', tileWidth + 'px')
    s.setProperty('--dw-tile-h', tileHeight + 'px')
    s.setProperty('--dw-gap', gap + 'px')
    s.setProperty('--dw-radius', o.radius + 'px')
    s.setProperty('--dw-perspective', o.perspective + 'px')
    s.setProperty('--dw-lift', o.lift + 'px')
    s.setProperty('--dw-dim', o.dim)
    s.setProperty('--dw-gray', o.grayscale ? 1 : 0)
    s.setProperty('--dw-overlay', o.overlayColor)
    s.setProperty('--dw-edge', Math.max(0, (1 - o.fade) * 100) + '%')

    // Доступна с клавиатуры и читалкам одна копия каждой работы, остальные копии только для глаз
    const tile = ({ item, i }, c, row, focusable) => {
      const attrs = `class="drift-wall__tile" data-col="${c}" data-row="${row}" data-i="${i}"` +
        (focusable ? ` aria-label="${esc(item.label || item.title)}"` : ' tabindex="-1" aria-hidden="true"')
      const inner = `<span class="drift-wall__inner">
          <img src="${esc(item.image)}" alt="" loading="lazy" decoding="async" draggable="false" />
          <span class="drift-wall__overlay"></span>
          ${item.title ? `<span class="drift-wall__cap"><b>${esc(item.title)}</b>${item.caption ? `<span>${esc(item.caption)}</span>` : ''}</span>` : ''}
        </span>`
      return item.href
        ? `<a ${attrs} href="${esc(item.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div ${attrs}${focusable ? ' tabindex="0"' : ''}>${inner}</div>`
    }

    anims.forEach(a => a.cancel())
    anims = []
    container.innerHTML = `<div class="drift-wall__plane" style="width:${columns * (tileWidth + gap)}px;height:${planeH}px">${
      colItems.map((col, c) => {
        const m = meta[c]
        let html = ''
        for (let copy = 0; copy < m.copies; copy++) {
          col.forEach((entry, j) => { html += tile(entry, c, copy * m.length + j, copy === m.focusCopy && !entry.filler) })
        }
        return `<div class="drift-wall__col"><div class="drift-wall__track">${html}</div></div>`
      }).join('')
    }</div>`

    plane = container.firstElementChild
    tracks = [...plane.querySelectorAll('.drift-wall__track')]
    active = null; hoveredCol = -1; focus = null; shift = { cur: 0, target: 0 }
    applyPlane()
    tracks.forEach((t, c) => { t.style.transform = `translate3d(0, ${-offsets[c]}px, 0)` })
    if (was != null) {
      const t = container.querySelector(`.drift-wall__tile[data-i="${was}"]:not([tabindex="-1"])`)
      if (t) { t.focus({ preventScroll: true }); activate(t); centerOn(t) }
    }
    start()
  }

  function applyPlane() {
    plane.style.transform =
      `translate(calc(-50% + ${shift.cur}px), -50%) scale(1.18) ` +
      `rotateX(${o.tilt + damped.y}deg) rotateY(${o.turn + damped.x}deg) rotateZ(${o.roll}deg) ` +
      `translateZ(${-o.depth}px)`
  }

  /* ---------- Активная плитка ---------- */
  function activate(tile) {
    if (!tile || tile === active) return
    wake()
    active?.classList.remove('is-active')
    active = tile
    tile.classList.add('is-active')
    hoveredCol = Number(tile.dataset.col)
  }
  function release() {
    wake()
    active?.classList.remove('is-active')
    active = null
    hoveredCol = -1
  }
  // Поднятая плитка видна крупнее и чуть в стороне от своей рамки на плоскости:
  // пока курсор на видимой плитке, она остаётся активной и получает щелчок
  function inVisual(tile, x, y) {
    const r = tile.querySelector('.drift-wall__inner').getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
  // Верх и низ стены почти растворены в фоне: там плитки не поднимаются и не открываются
  function inDeadBand(y) {
    const r = container.getBoundingClientRect()
    return y - r.top < r.height * 0.1 || r.bottom - y < r.height * 0.04
  }
  function open(tile) {
    if (tile.href) window.open(tile.href, '_blank', 'noopener,noreferrer')
  }
  function hitTest() {
    if (!client) return
    if (active && inVisual(active, client.x, client.y)) return
    if (inDeadBand(client.y)) return
    const hit = document.elementFromPoint(client.x, client.y)
    const tile = hit?.closest?.('.drift-wall__tile')
    if (tile && container.contains(tile)) activate(tile)
  }

  // Фокус с клавиатуры: колонка останавливается и плавно подводит плитку к центру стены.
  // Сдвиг заранее переносим на целое число копий, это незаметно глазу и сокращает путь
  function centerOn(tile) {
    const c = Number(tile.dataset.col), row = Number(tile.dataset.row), m = meta[c]
    if (!m) return
    wake()
    const target = row * m.unit + m.unit / 2 - planeH / 2
    let best = offsets[c], dist = Infinity
    for (let n = -m.copies; n <= m.copies; n++) {
      const v = offsets[c] + n * m.copyHeight
      if (v < 0 || v > m.maxOffset) continue
      if (Math.abs(v - target) < dist) { dist = Math.abs(v - target); best = v }
    }
    offsets[c] = best
    focus = { col: c, target: Math.min(Math.max(target, 0), m.maxOffset), tile }
    // Крайняя колонка частично за краем: стена сдвигается вбок ровно настолько, чтобы плитка была видна целиком
    const colW = o.tileWidth + o.gap, planeW = o.columns * colW
    const x = ((c + 0.5) * colW - planeW / 2) * 1.18, room = size.w / 2 - colW * 0.75
    shift.target = Math.abs(x) > room ? -(x - Math.sign(x) * room) : 0
  }

  /* ---------- Кадр ---------- */
  function frame(ts) {
    raf = 0
    if (!visible || !plane) return
    if (last === null) last = ts
    const dt = Math.min(0.05, Math.max(0, ts - last) / 1000)
    last = ts

    const maxTilt = o.parallax * 8
    const damp = 1 - Math.exp(-dt / 0.25)
    damped.x += (pointer.x * maxTilt - damped.x) * damp
    damped.y += (-pointer.y * maxTilt - damped.y) * damp
    // Перспектива растягивает края неравномерно: сдвиг под плитку в фокусе уточняем по её настоящему положению
    if (focus?.tile) {
      const r = focus.tile.querySelector('.drift-wall__inner').getBoundingClientRect(), box = container.getBoundingClientRect()
      const over = r.right - (box.right - 16), under = box.left + 16 - r.left
      if (over > 0) shift.target -= over * 0.15
      else if (under > 0) shift.target += under * 0.15
    }
    shift.cur += (shift.target - shift.cur) * (reduced ? 1 : 1 - Math.exp(-dt / 0.3))
    applyPlane()

    // Колонки движутся и под неподвижным курсором: раз в 120 мс проверяем, что под ним
    if (client && ts - lastHit > 120) { lastHit = ts; hitTest() }

    for (let c = 0; c < tracks.length; c++) {
      const m = meta[c]
      let off = offsets[c]
      if (focus && focus.col === c) {
        off += (focus.target - off) * (reduced ? 1 : 1 - Math.exp(-dt / 0.22))
        velocities[c] = 0
      } else {
        if (!reduced) {
          const paused = (inside && o.pauseOnHover) || hoveredCol === c
          const target = paused ? 0 : baseVel[c]
          const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28))
          velocities[c] += (target - velocities[c]) * ease
          off += velocities[c] * dt
        }
        off = ((off % m.copyHeight) + m.copyHeight) % m.copyHeight
      }
      offsets[c] = off
      tracks[c].style.transform = `translate3d(0, ${-off}px, 0)`
    }
    if (resting()) { drift(); return }
    raf = requestAnimationFrame(frame)
  }
  // Пока курсора на стене нет и всё успокоилось, колонки плывут анимациями браузера: их двигает видеокарта,
  // а основной поток кадры не считает. Раньше стена каждый кадр ставила колонкам сдвиг из JavaScript,
  // и браузер каждый кадр заново собирал слои всей страницы; на слабых ноутбуках это заметная доля кадра.
  // Курсор на стене, фокус, касание: колонки забирает прежний цикл, с наклоном и остановкой под курсором
  const period = c => meta[c].copyHeight / Math.abs(baseVel[c]) * 1000
  function resting() {
    if (inside || focus || hoveredCol >= 0 || !tracks.length) return false
    if (reduced) return true   // без движения стене в покое кадры не нужны вовсе
    if (Math.abs(damped.x) + Math.abs(damped.y) > 0.02 || Math.abs(shift.cur) > 0.5 || shift.target) return false
    return velocities.every((v, c) => Math.abs(v - baseVel[c]) < 0.5)
  }
  function drift() {
    if (anims.length || !visible || reduced || !tracks.length) return
    damped = { x: 0, y: 0 }; shift.cur = 0
    applyPlane()
    anims = tracks.map((t, c) => {
      const h = meta[c].copyHeight, up = baseVel[c] > 0
      const a = t.animate([{ transform: `translate3d(0, ${up ? 0 : -h}px, 0)` }, { transform: `translate3d(0, ${up ? -h : 0}px, 0)` }],
        { duration: period(c), iterations: Infinity, easing: 'linear' })
      const frac = offsets[c] / h
      a.currentTime = (up ? frac : 1 - frac) * period(c)
      return a
    })
  }
  // обратно в цикл: сдвиг каждой колонки берём у её анимации, скорость та же, рывка нет
  function hold() {
    if (!anims.length) return
    anims.forEach((a, c) => {
      const h = meta[c].copyHeight, dur = period(c)
      const frac = (((a.currentTime ?? 0) % dur) + dur) % dur / dur
      offsets[c] = (baseVel[c] > 0 ? frac : 1 - frac) * h
      velocities[c] = baseVel[c]
      tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`
      a.cancel()
    })
    anims = []
  }
  function wake() {
    hold()
    if (raf || !visible) return
    last = null
    raf = requestAnimationFrame(frame)
  }
  function start() {
    if (!visible || raf) return
    if (resting()) drift()
    else wake()
  }

  /* ---------- События ---------- */
  function onPointerMove(e) {
    pointerType = e.pointerType
    if (e.pointerType === 'touch') return
    inside = true
    wake()
    client = { x: e.clientX, y: e.clientY }
    if (o.parallax > 0 && !reduced) {
      const r = container.getBoundingClientRect()
      pointer = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
    }
    hitTest()
    container.classList.toggle('is-dead', inDeadBand(e.clientY) && !(active && inVisual(active, e.clientX, e.clientY)))
  }
  function onPointerLeave(e) {
    if (e.pointerType === 'touch') return
    inside = false
    client = null
    pointer = { x: 0, y: 0 }
    // С фокусом на плитке поднятой остаётся она, а не та, что была под курсором
    const f = focus ? document.activeElement?.closest?.('.drift-wall__tile') : null
    release()
    if (f && container.contains(f)) activate(f)
  }
  // Щелчок по видимой поднятой плитке открывает её, даже если под курсором рамка соседней.
  // На телефоне первое касание поднимает плитку и показывает подпись, второе открывает работу
  function onClick(e) {
    if (e.detail === 0) return   // Enter с клавиатуры: ссылка срабатывает как обычно
    const hit = e.target.closest('.drift-wall__tile')
    if (active && inVisual(active, e.clientX, e.clientY)) {
      if (hit !== active) { e.preventDefault(); open(active) }
      return
    }
    if (inDeadBand(e.clientY)) { e.preventDefault(); return }
    if (pointerType === 'touch' && hit) { e.preventDefault(); activate(hit) }
  }
  function onDocPointerDown(e) {
    pointerType = e.pointerType
    // Ноутбук с тач-экраном: после касания старое положение мыши больше не считается
    if (e.pointerType === 'touch') { client = null; inside = false; pointer = { x: 0, y: 0 } }
    if (e.pointerType === 'touch' && active && !container.contains(e.target)) release()
  }
  function onFocusIn(e) {
    const tile = e.target.closest('.drift-wall__tile')
    if (!tile || !tile.matches(':focus-visible')) return
    activate(tile)
    centerOn(tile)
    if (reduced) start()
    // Браузер прокручивает страницу к плитке там, где она была до сдвига колонки.
    // Возвращаем прокрутку и двигаем её, только если центр стены, куда встанет плитка, вне экрана
    const base = performance.now() - tabAt < 1000 ? tabY : scrollY
    const keep = () => {
      const r = container.getBoundingClientRect(), mid = r.top + scrollY + r.height / 2
      const half = o.tileHeight * 0.7 + o.lift
      let y = base
      if (mid - half < y + 90 || mid + half > y + innerHeight) y = mid - innerHeight / 2
      if (Math.abs(scrollY - y) > 1) scrollTo({ top: y, behavior: 'instant' })
    }
    keep()
    requestAnimationFrame(keep)
  }
  function onKeyDown(e) { if (e.key === 'Tab') { tabY = scrollY; tabAt = performance.now() } }
  // Копии плиток скрыты от читалок: щелчок по ним не должен уводить туда фокус
  function onMouseDown(e) {
    if (e.target.closest?.('.drift-wall__tile')?.getAttribute('aria-hidden') === 'true') e.preventDefault()
  }
  function onFocusOut(e) {
    if (!focus) return
    const next = e.relatedTarget?.closest?.('.drift-wall__tile')
    focus = null
    shift.target = 0
    if (!next || !container.contains(next)) release()
  }
  // Фокус внутри контейнера с overflow:hidden может прокрутить его самого: возвращаем на место
  function onScroll() { container.scrollTop = 0; container.scrollLeft = 0 }
  function onMotionChange(e) {
    reduced = e.matches
    container.classList.toggle('drift-wall--reduced', reduced)
    if (reduced) { pointer = { x: 0, y: 0 }; damped = { x: 0, y: 0 } }
  }
  function onResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (Math.abs(container.clientWidth - size.w) > 1 || Math.abs(container.clientHeight - size.h) > 1) build()
    }, 150)
  }

  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerleave', onPointerLeave)
  container.addEventListener('click', onClick)
  container.addEventListener('focusin', onFocusIn)
  container.addEventListener('focusout', onFocusOut)
  container.addEventListener('mousedown', onMouseDown)
  document.addEventListener('keydown', onKeyDown, true)
  container.addEventListener('scroll', onScroll)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  motion.addEventListener('change', onMotionChange)
  addEventListener('resize', onResize)
  const ro = new ResizeObserver(onResize)
  ro.observe(container)

  // Вне экрана стена не считает кадры
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    anims.forEach(a => (visible ? a.play() : a.pause()))
    if (visible) start()
    else if (pointerType === 'touch') release()
  }, { rootMargin: '120px 0px' })
  io.observe(container)

  build()

  return {
    rebuild: build,
    destroy() {
      cancelAnimationFrame(raf)
      anims.forEach(a => a.cancel())
      clearTimeout(resizeTimer)
      io.disconnect(); ro.disconnect()
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('click', onClick)
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('focusout', onFocusOut)
      container.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown, true)
      container.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      motion.removeEventListener('change', onMotionChange)
      removeEventListener('resize', onResize)
      container.innerHTML = ''
    }
  }
}
