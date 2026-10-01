(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const SVG = 'http://www.w3.org/2000/svg'

  /* ---------- Стекло: наклон за курсором, как у карточки первого экрана ---------- */
  // Курсор отталкивает сторону, к которой ближе, блик бежит за ним. После ухода карточка плавно выпрямляется
  function glassTilt(card, glass, max = 8) {
    if (!document.body.classList.contains('hoverable') || reduce) return
    const cur = { rx: 0, ry: 0, gx: 30, gy: 20 }, target = { rx: 0, ry: 0, gx: 30, gy: 20 }
    let raf = 0
    const tick = () => {
      cur.rx += (target.rx - cur.rx) * 0.08
      cur.ry += (target.ry - cur.ry) * 0.08
      cur.gx += (target.gx - cur.gx) * 0.1
      cur.gy += (target.gy - cur.gy) * 0.1
      glass.style.setProperty('--rx', cur.rx.toFixed(3) + 'deg')
      glass.style.setProperty('--ry', cur.ry.toFixed(3) + 'deg')
      glass.style.setProperty('--gx', cur.gx.toFixed(1) + '%')
      glass.style.setProperty('--gy', cur.gy.toFixed(1) + '%')
      const moving = Math.abs(target.rx - cur.rx) + Math.abs(target.ry - cur.ry) + Math.abs(target.gx - cur.gx) / 20 > 0.01
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1
      target.ry = nx * max
      target.rx = -ny * max
      target.gx = 50 + nx * 45
      target.gy = 50 + ny * 45
      kick()
    })
    card.addEventListener('pointerleave', () => {
      target.rx = 0; target.ry = 0; target.gx = 30; target.gy = 20
      kick()
    })
  }

  /* ---------- Появление секций при прокрутке ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      e.target.dispatchEvent(new CustomEvent('reveal'))
      io.unobserve(e.target)
    })
  }, { threshold: 0, rootMargin: '0px 0px -14% 0px' })
  // за экраном загрузки блоки не появляются: заставка проиграла бы невидимой
  const watchReveal = () => document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))
  if (document.documentElement.classList.contains('is-loading')) addEventListener('simple:revealed', watchReveal, { once: true })
  else watchReveal()

  /* ---------- 2. Три позиции стекаются в одну подписку ---------- */
  const merge = document.getElementById('merge')
  if (merge) {
    const svg = document.getElementById('merge-wires')
    const roles = [...merge.querySelectorAll('.role')]
    const hub = merge.querySelector('.hub')
    const SEG = 38   // длина светящегося «сгустка» в px

    function build() {
      const box = merge.getBoundingClientRect()
      if (!box.width) return
      const h = hub.getBoundingClientRect()
      const hubL = h.left - box.left
      const hubCy = h.top - box.top + h.height / 2
      const vertical = h.top > roles[roles.length - 1].getBoundingClientRect().bottom
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
      svg.innerHTML = ''

      roles.forEach((role, i) => {
        const r = role.getBoundingClientRect()
        let d
        if (!vertical) {
          // Кривая от правого края роли к левому краю подписки; входы чуть разнесены
          const x1 = r.right - box.left, y1 = r.top - box.top + r.height / 2
          const x2 = hubL, y2 = hubCy + (i - 1) * 16
          const dx = (x2 - x1) * 0.55
          d = `M${x1} ${y1} C${x1 + dx} ${y1},${x2 - dx} ${y2},${x2} ${y2}`
        } else {
          // Телефон: из роли влево на общую линию, по ней вниз и в подписку
          const trunk = 18 - i * 0   // все три потока идут по одной линии
          const x1 = r.left - box.left, y1 = r.top - box.top + r.height / 2
          const rad = 10
          d = `M${x1} ${y1} H${trunk + rad} Q${trunk} ${y1} ${trunk} ${y1 + rad} V${hubCy - rad} Q${trunk} ${hubCy} ${trunk + rad} ${hubCy} H${hubL}`
        }
        const mk = cls => {
          const p = document.createElementNS(SVG, 'path')
          p.setAttribute('d', d)
          p.setAttribute('class', cls)
          p.dataset.i = i
          svg.appendChild(p)
          return p
        }
        const base = mk('base')
        const len = base.getTotalLength()
        const draw = mk('draw')
        const comet = mk('comet')
        ;[draw, comet].forEach(p => {
          p.style.setProperty('--len', len + 'px')
          p.style.setProperty('--seg', SEG + 'px')
        })
        draw.style.transitionDelay = (0.15 + i * 0.12) + 's'
        comet.style.setProperty('--delay', (i * 0.45) + 's')
      })
    }

    build()
    new ResizeObserver(build).observe(merge)
    addEventListener('resize', build)
    document.fonts?.ready.then(build)

    const section = merge.closest('[data-reveal]')
    section.addEventListener('reveal', () => {
      if (reduce) { merge.classList.add('is-drawn'); return }
      setTimeout(() => merge.classList.add('is-drawn'), 650)
      setTimeout(() => merge.classList.add('is-flowing'), 1900)
    })

    // Наведение на роль подсвечивает её поток
    roles.forEach(role => {
      role.addEventListener('pointerenter', () => { merge.dataset.active = role.dataset.i })
      role.addEventListener('pointerleave', () => { delete merge.dataset.active })
    })
  }

  /* ---------- 3. Узнаёте свою ситуацию: проблема зачёркивается, под ней проявляется решение ---------- */
  // Ничего нажимать не нужно: строка доходит до середины экрана и «решается», обратно не откатывается
  const fitRows = [...document.querySelectorAll('.fit-row[data-fit]')]
  if (reduce) fitRows.forEach(r => r.classList.add('is-done'))
  else if (fitRows.length) {
    const solve = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-done')
      solve.unobserve(e.target)
    }), { rootMargin: '0px 0px -42% 0px' })
    fitRows.forEach(r => solve.observe(r))
  }
  /* ---------- 6. Как устроен месяц: шаги по кругу и наклон карточек за курсором ---------- */
  // На компьютере с мышью шаги загораются по кругу сами, наведение делает карточку текущей и ставит круг на паузу.
  // На телефоне и планшете шаги ведёт прокрутка: карточка загорается, когда до неё доходит голова провода
  // через весь сайт (wire.js), полоска внизу карточки идёт вместе с головой. Касания ничего не запускают
  // и не останавливают: раньше палец, случайно задевший карточку при прокрутке, то включал её, то выключал
  const howBoard = document.getElementById('how-board')
  if (howBoard) {
    const cards = [...howBoard.querySelectorAll('.how-card')]
    const bars = cards.map(c => c.querySelector('.how-progress i'))
    const loopNote = howBoard.querySelector('.how-loop')
    const STEP = 2600, LOOP = 1900, RESUME = 1200
    const READ = 0.62   // без провода голова стоит на этой доле высоты экрана, как в wire.js
    const narrow = matchMedia('(max-width: 1024px)')
    let mode = ''       // 'timer' — по кругу, 'scroll' — за прокруткой, 'still' — без движения
    let step = -1, timer = 0, hovered = false, seen = false, visible = false

    function setStep(k) {
      step = k
      cards.forEach((c, i) => {
        c.classList.toggle('is-past', i < k)
        c.classList.remove('is-on')
      })
      howBoard.classList.remove('is-loop')
      if (k < 0 || k >= cards.length) return
      const card = cards[k]
      card.style.setProperty('--dur', STEP + 'ms')
      void card.offsetWidth          // перезапуск полоски и сцены
      card.classList.add('is-on')
    }
    function next() {
      clearTimeout(timer)
      if (mode !== 'timer') return
      if (hovered || !visible || document.hidden) { timer = setTimeout(next, 400); return }
      if (step >= cards.length - 1) {
        // месяц пройден: загорается петля, потом всё сначала
        cards.forEach(c => { c.classList.remove('is-on'); c.classList.add('is-past') })
        howBoard.classList.add('is-loop')
        step = cards.length
        timer = setTimeout(() => { setStep(-1); timer = setTimeout(next, 700) }, LOOP)
        return
      }
      setStep(step + 1)
      timer = setTimeout(next, STEP)
    }

    /* За прокруткой. Карточки в одном ряду (планшет) делят ряд между собой по порядку */
    let ranges = [], loopTop = Infinity, headY = -Infinity, fromWire = false, cur = null
    const docTop = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y }
    function measure() {
      const rows = []
      cards.forEach((c, i) => {
        const t = docTop(c), b = t + c.offsetHeight
        const row = rows.find(r => Math.abs(r.top - t) < 4)
        if (row) { row.items.push(i); row.bottom = Math.max(row.bottom, b) }
        else rows.push({ top: t, bottom: b, items: [i] })
      })
      ranges = []
      rows.forEach((r, n) => {
        const end = n + 1 < rows.length ? rows[n + 1].top : r.bottom
        const span = (end - r.top) / r.items.length
        r.items.forEach((i, j) => { ranges[i] = [r.top + j * span, r.top + (j + 1) * span] })
      })
      loopTop = docTop(loopNote)
      follow()
    }
    function follow() {
      if (mode !== 'scroll' || !ranges.length) return
      const y = headY
      let on = ranges.findIndex(([a, b]) => y >= a && y < b)
      if (on < 0) on = y < ranges[0][0] ? -1 : cards.length
      if (on !== cur) {
        // шаг сменился: у новой карточки проигрывается сцена, прошлые остаются в итоговом виде
        cur = on
        cards.forEach((c, i) => {
          c.classList.toggle('is-past', i < on)
          c.classList.toggle('is-on', i === on)
          if (i !== on) bars[i].style.transform = ''
        })
      }
      if (on >= 0 && on < cards.length) {
        const [a, b] = ranges[on]
        bars[on].style.transform = `scaleX(${Math.min(1, (y - a) / (b - a)).toFixed(3)})`
      }
      howBoard.classList.toggle('is-loop', y >= loopTop)
    }
    const readLine = () => scrollY + innerHeight * READ
    document.addEventListener('wirehead', e => { fromWire = true; headY = e.detail; follow() })
    addEventListener('scroll', () => { if (!fromWire && mode === 'scroll') { headY = readLine(); follow() } }, { passive: true })

    function setMode() {
      const m = reduce ? 'still' : narrow.matches || !document.body.classList.contains('hoverable') ? 'scroll' : 'timer'
      if (m === mode) return
      mode = m
      clearTimeout(timer)
      step = -1; cur = null; hovered = false
      cards.forEach((c, i) => { c.classList.remove('is-on', 'is-past'); bars[i].style.transform = '' })
      howBoard.classList.remove('is-loop')
      howBoard.classList.toggle('is-scroll', m === 'scroll')
      if (m === 'still') cards.forEach(c => c.classList.add('is-past'))
      else if (m === 'scroll') { if (!fromWire) headY = readLine(); measure() }
      else if (visible) { seen = true; timer = setTimeout(next, 500) }
      else seen = false
    }

    if (!reduce) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting
        if (visible && !seen && mode === 'timer') { seen = true; timer = setTimeout(next, 500) }
      }, { threshold: 0.3 }).observe(howBoard)
      // карточки сдвигаются и когда меняется что-то выше (раскрытый пункт услуг): следим за высотой всей страницы
      new ResizeObserver(() => { if (mode === 'scroll') measure() }).observe(document.getElementById('main') || howBoard)
      document.fonts?.ready.then(() => { if (mode === 'scroll') measure() })
      narrow.addEventListener('change', setMode)

      // Наведение мышью делает карточку текущей. Касания не считаются: на телефоне шаги ведёт прокрутка
      cards.forEach((card, k) => {
        card.addEventListener('pointerenter', e => {
          if (mode !== 'timer' || e.pointerType === 'touch') return
          hovered = true
          clearTimeout(timer)
          if (step !== k) setStep(k)
        })
        card.addEventListener('pointerleave', e => {
          if (mode !== 'timer' || e.pointerType === 'touch') return
          hovered = false
          clearTimeout(timer)
          timer = setTimeout(next, RESUME)
        })
      })
    }
    setMode()

    cards.forEach(card => glassTilt(card, card.querySelector('.glass')))
  }

  /* ---------- 7. Цена: чек печатается; его отрывают вбок по перфорации, бросают, и касса печатает новый ---------- */
  const receipt = document.getElementById('receipt')
  if (receipt) {
    const win = receipt.querySelector('.receipt-window')
    // Лента без состояния: печать и итог задаются классами на #receipt, поэтому новую ленту берём из этой копии
    const PAPER = win.querySelector('.receipt-paper').outerHTML
    let printTimer = 0

    function print(fromStub) {
      clearTimeout(printTimer)
      if (fromStub) {
        // после отрыва в щели корешок: новая лента выходит прямо из него, а не из глубины кассы
        receipt.style.setProperty('--from', 'calc(-100% + var(--stub))')
        win.querySelector('.receipt-paper')?.remove()
        win.insertAdjacentHTML('beforeend', PAPER)
        receipt.style.minHeight = ''   // лента снова целая, высота блока прежняя
      }
      receipt.classList.remove('is-printed', 'is-printing', 'is-torn')
      void receipt.offsetWidth
      receipt.classList.add('is-printing')
      // после печати фиксируем итог, чтобы переходы не срабатывали повторно
      printTimer = setTimeout(() => { receipt.classList.add('is-printed'); receipt.classList.remove('is-printing') }, 3700)
    }

    if (reduce) receipt.classList.add('is-printed')
    else {
      // Касса печатает, когда до неё доходит провод через весь сайт (wire.js).
      // Если человек остановился раньше или провода нет, печать начнётся сама вскоре после появления блока
      let started = false
      const start = () => { if (!started) { started = true; print(false) } }
      receipt.addEventListener('wire', start, { once: true })
      receipt.closest('[data-reveal]').addEventListener('reveal', () => setTimeout(start, 3000), { once: true })
      tearable()
    }

    function tearable() {
      const clamp = (v, a) => Math.max(-a, Math.min(a, v))
      const TEAR = 11   // на таком повороте перфорация рвётся до конца
      let drag = null

      win.addEventListener('pointerdown', e => {
        if (drag || e.button !== 0 || !receipt.classList.contains('is-printed')) return
        const sheet = e.target.closest('.receipt-sheet')
        // на телефоне тянем только за низ чека, остальное остаётся для прокрутки страницы
        if (!sheet || (e.pointerType !== 'mouse' && !e.target.closest('.receipt-grip'))) return
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, sheet, torn: false, side: 0, angle: 0, sag: 0, samples: [] }
        win.setPointerCapture(e.pointerId)
        sheet.style.transition = 'none'
        receipt.classList.add('is-grabbing')
        document.documentElement.classList.add('is-grabbing')
        e.preventDefault()
      })

      win.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return
        const now = performance.now()
        drag.samples.push([e.clientX, e.clientY, now])
        while (drag.samples.length > 2 && now - drag.samples[0][2] > 90) drag.samples.shift()
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0
        if (!drag.torn) {
          // Лист держится на перфорации. Вниз он только чуть провисает, а в сторону поворачивается вокруг угла,
          // который ещё держится: у противоположного угла зубцы расходятся, и щель растёт, пока лист не оторвётся
          const side = dx >= 0 ? 1 : -1
          if (side !== drag.side) {
            drag.side = side
            drag.sheet.style.transformOrigin = side > 0 ? '100% 0' : '0 0'
          }
          const angle = Math.min(TEAR, Math.abs(dx) * 0.075 * (1 + Math.max(0, dy) / 500))
          drag.sag = Math.min(10, Math.max(0, dy) * 0.05)
          drag.angle = -side * angle
          drag.sheet.style.transform = `translateY(${drag.sag}px) rotate(${drag.angle}deg)`
          if (angle >= TEAR) detach(e)
        } else {
          // оторванный лист идёт за рукой один в один
          const mx = e.clientX - drag.tx, my = e.clientY - drag.ty
          drag.pos = { x: mx, y: drag.sag + my, r: drag.angle + clamp(mx * 0.04, 20) }
          drag.sheet.style.transform = `translate(${drag.pos.x}px, ${drag.pos.y}px) rotate(${drag.pos.r}deg)`
        }
      })

      function detach(e) {
        const sheet = drag.sheet
        const box = sheet.parentElement.getBoundingClientRect()   // напечатанная лента стоит без сдвига
        // пока в кассе только корешок, блок держит прежнюю высоту: заголовок рядом и страница ниже не прыгают
        receipt.style.minHeight = receipt.offsetHeight + 'px'
        // лист переезжает в отдельный слой поверх страницы, классы сохраняют его вид
        const fly = document.createElement('div')
        fly.className = 'receipt is-printed receipt-flying'
        fly.setAttribute('aria-hidden', 'true')
        fly.style.left = box.left + 'px'
        fly.style.top = box.top + sheet.offsetTop + 'px'
        fly.style.width = sheet.offsetWidth + 'px'
        document.body.appendChild(fly)
        fly.appendChild(sheet)
        requestAnimationFrame(() => fly.classList.add('is-lifted'))
        // в щели остаётся корешок с рваным краем
        receipt.classList.add('is-torn')
        receipt.classList.remove('is-printed')
        Object.assign(drag, { fly, torn: true, tx: e.clientX, ty: e.clientY, pos: { x: 0, y: drag.sag, r: drag.angle } })
      }

      function release(e) {
        if (!drag || e.pointerId !== drag.id) return
        const d = drag
        drag = null
        receipt.classList.remove('is-grabbing')
        document.documentElement.classList.remove('is-grabbing')
        if (!d.torn) {
          // не дорвали: лист плавно повисает обратно, без отскока
          d.sheet.style.transition = 'transform .6s cubic-bezier(.25,1,.5,1)'
          d.sheet.style.transform = ''
          setTimeout(() => { if (!d.sheet.style.transform) d.sheet.style.transition = '' }, 650)
          return
        }
        // скорость броска по последним движениям руки
        const s = d.samples, a = s[0] || [0, 0, 0], b = s[s.length - 1] || a
        const dt = Math.max(16, b[2] - a[2])
        const vx = clamp((b[0] - a[0]) / dt * 1000, 3200), vy = clamp((b[1] - a[1]) / dt * 1000, 3200)
        throwAway(d.fly, d.sheet, d.pos, vx, vy)
        setTimeout(() => print(true), 420)
      }
      win.addEventListener('pointerup', release)
      win.addEventListener('pointercancel', release)

      // Полёт: лист сохраняет скорость броска, его тянет вниз, он поворачивается и тает
      function throwAway(fly, sheet, pos, vx, vy) {
        let { x, y, r } = pos, t = 0, last = performance.now()
        const vr = clamp(vx * 0.06, 220)
        const step = now => {
          const dt = Math.min(0.05, (now - last) / 1000)
          last = now
          t += dt
          vy += 2200 * dt
          x += vx * dt
          y += vy * dt
          r += vr * dt
          sheet.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`
          const op = t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.55)
          fly.style.opacity = op
          if (op > 0) requestAnimationFrame(step)
          else fly.remove()
        }
        requestAnimationFrame(step)
      }
    }
  }
})()
