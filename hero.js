(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches

  /* ---------- Старт: когда ушёл экран загрузки (common.js), а без него после загрузки шрифтов ---------- */
  const hero = document.querySelector('.hero')
  let started = false
  function start() {
    if (started) return
    started = true
    hero.classList.add('is-in')
    if (!reduce) playIntro()
    runFlow()
  }
  if (document.documentElement.classList.contains('is-loading')) {
    addEventListener('simple:revealed', start, { once: true })
    setTimeout(start, 10000)
  } else {
    document.fonts.ready.then(start)
    setTimeout(start, 3000)
  }

  /* ---------- 3D-наклон панели за курсором ---------- */
  // Наклон ставим прямо в transform, а блик двигаем сдвигом: так кадр не пересчитывает стили всей панели
  // и не перерисовывает её, работает только видеокарта. Цикл крутится, пока первый экран виден и панель
  // ещё движется; остановилась или ушла с экрана, и страница перестаёт тратить на неё кадры
  const tilt = document.getElementById('tilt')
  const panel = tilt.querySelector('.panel')
  const glare = document.createElement('i')
  panel.querySelector('.glare')?.append(glare)
  const narrow = innerWidth <= 640
  const base = narrow ? { rx: 5, ry: -8 } : { rx: 6, ry: -14 }
  const cur = { rx: 22, ry: -34, gx: 30, gy: 20 }   // стартовый разворот, панель «доворачивается» при появлении
  const target = { rx: base.rx, ry: base.ry, gx: 30, gy: 20 }
  let heroOn = true, raf = 0, lastTilt = '', lastGlare = '', panelW = 0, panelH = 0
  new ResizeObserver(() => { panelW = panel.offsetWidth; panelH = panel.offsetHeight; lastGlare = ''; wake() }).observe(panel)

  if (reduce) { cur.rx = base.rx; cur.ry = base.ry }

  if (finePointer && !reduce) {
    addEventListener('pointermove', e => {
      if (!heroOn) return
      const nx = e.clientX / innerWidth * 2 - 1   // -1..1
      const ny = e.clientY / innerHeight * 2 - 1
      // Курсор отталкивает панель: сторона, к которой он ближе, уходит вглубь
      target.ry = base.ry + nx * 11
      target.rx = base.rx - ny * 7
      target.gx = 50 + nx * 40
      target.gy = 40 + ny * 40
      wake()
    })
    document.addEventListener('pointerleave', () => {
      target.rx = base.rx; target.ry = base.ry
      wake()
    })
  }

  /* ---------- На телефоне панель наклоняется от поворота самого телефона ---------- */
  // Панель будто висит в воздухе: телефон поворачивают, а она сохраняет своё положение и видна под другим углом.
  // Ноль датчика плавно подстраивается под то, как держат телефон, поэтому в спокойной руке панель возвращается на место
  const gyro = { on: false, nx: 0, ny: 0 }
  if (!finePointer && !reduce && 'DeviceOrientationEvent' in window) {
    let zero = null, last = null, lastAt = 0
    addEventListener('deviceorientation', e => {
      if (e.beta == null || e.gamma == null) return
      // оси телефона переводим в оси экрана: в горизонтальном положении они меняются местами
      const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0
      let x = e.gamma, y = e.beta
      if (angle === 90) { x = e.beta; y = -e.gamma }
      else if (angle === -90 || angle === 270) { x = -e.beta; y = e.gamma }
      else if (angle === 180) { x = -e.gamma; y = -e.beta }
      const now = performance.now()
      // резкий скачок (телефон перевернули, ось перескочила через край) начинает отсчёт заново
      if (!zero || Math.abs(x - last.x) > 40 || Math.abs(y - last.y) > 40) zero = { x, y }
      else {
        const k = 1 - Math.exp(-(now - lastAt) / 2500)
        zero.x += (x - zero.x) * k
        zero.y += (y - zero.y) * k
      }
      last = { x, y }
      lastAt = now
      gyro.nx = Math.max(-1, Math.min(1, (x - zero.x) / 16))
      gyro.ny = Math.max(-1, Math.min(1, (y - zero.y) / 16))
      gyro.on = true
      wake()
    })
    // iPhone отдаёт датчики только с разрешения, а спросить его можно лишь в ответ на касание:
    // просим при первом касании первого экрана, мимо кнопок и ссылок
    const ask = DeviceOrientationEvent.requestPermission
    if (typeof ask === 'function') {
      const onTap = e => {
        if (gyro.on || e.target.closest('a, button')) return
        hero.removeEventListener('click', onTap)
        ask.call(DeviceOrientationEvent).catch(() => {})
      }
      hero.addEventListener('click', onTap)
    }
  }

  // На тач-устройствах курсора нет: панель медленно покачивается сама. Покачивание ведёт CSS-анимация
  // (класс is-sway): её двигает видеокарта, и основному потоку не нужно считать кадры. Раньше качал этот цикл,
  // и браузер каждый кадр заново собирал слои 3D-сцены. Если у телефона есть датчик, панель ведёт он:
  // телефон поворачивают, а панель сохраняет своё положение и видна под другим углом.
  // На слабом телефоне (облегчённый режим) панель сама не качается, только от датчика
  const swaying = !finePointer && !reduce
  function takeSway() {
    // покачивание сменяется датчиком: стартуем с того наклона, где панель сейчас, без скачка
    for (const a of tilt.getAnimations()) {
      const p = a.effect.getComputedTiming().progress ?? 0.5
      if (a.animationName === 'sway-x') cur.rx = base.rx - 3 + 6 * p
      if (a.animationName === 'sway-y') cur.ry = base.ry - 6 + 12 * p
    }
    tilt.classList.remove('is-sway')
  }
  function frame(now) {
    raf = 0
    if (!heroOn || document.hidden) return
    const lite = document.documentElement.classList.contains('lite')
    if (swaying && gyro.on) {
      if (tilt.classList.contains('is-sway')) takeSway()
      target.ry = base.ry - gyro.nx * 11
      target.rx = base.rx + gyro.ny * 7
      // свет скользит к краю, который поднялся навстречу
      target.gx = 50 + gyro.nx * 40
      target.gy = 40 + gyro.ny * 40
    }
    const k = started ? 0.05 : 0
    cur.rx += (target.rx - cur.rx) * k
    cur.ry += (target.ry - cur.ry) * k
    cur.gx += (target.gx - cur.gx) * 0.08
    cur.gy += (target.gy - cur.gy) * 0.08
    paintTilt()
    const settled = started && Math.abs(target.rx - cur.rx) + Math.abs(target.ry - cur.ry) <= 0.01 && Math.abs(target.gx - cur.gx) + Math.abs(target.gy - cur.gy) <= 0.05
    // панель встала после заставки, датчика нет: дальше её качает CSS
    if (swaying && settled && !gyro.on && !lite) tilt.classList.add('is-sway')
    else if (tilt.classList.contains('is-sway') && lite) tilt.classList.remove('is-sway')
    if ((swaying && gyro.on) || !settled) raf = requestAnimationFrame(frame)
  }
  function paintTilt() {
    const t = `rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`
    if (t !== lastTilt) { tilt.style.transform = t; lastTilt = t }
    // центр блика в точке (gx%, gy%) панели
    const g = `translate3d(${(cur.gx / 100 * panelW).toFixed(1)}px, ${(cur.gy / 100 * panelH).toFixed(1)}px, 0)`
    if (g !== lastGlare) { glare.style.transform = g; lastGlare = g }
  }
  function wake() { if (!raf && heroOn && !document.hidden) raf = requestAnimationFrame(frame) }
  new IntersectionObserver(([e]) => { heroOn = e.isIntersecting; wake() }).observe(hero)
  document.addEventListener('visibilitychange', wake)
  addEventListener('simple:lite', wake)
  paintTilt()
  wake()

  /* ---------- Заставка: логотип появляется над панелью и садится в её шапку ---------- */
  // Логотип всё время внутри панели: наклоняется и прокручивается вместе с ней, никуда не улетает
  function playIntro() {
    const ico = document.getElementById('p-ico')
    const show = () => { ico.style.opacity = 1 }
    const scene = document.querySelector('.hero-scene').getBoundingClientRect()
    // На телефоне панель ниже первого экрана: заставку не показываем, значок просто на месте
    if (!scene.width || scene.top + scene.height * 0.5 > innerHeight) { show(); return }

    // Путь от центра панели до гнезда в шапке в координатах самой панели: наклон на них не влияет
    const head = ico.parentElement
    const w = ico.offsetWidth
    const dx = panel.offsetWidth / 2 - (head.offsetLeft + ico.offsetLeft + w / 2)
    const dy = panel.offsetHeight * 0.46 - (head.offsetTop + ico.offsetTop + w / 2)
    const z = panel.offsetWidth * 0.09   // логотип парит над панелью, пока крупный

    // Крупный логотип — отдельная копия значка в полный размер. Раньше растягивали сам значок в 4 раза,
    // и браузер растягивал уже нарисованную маленькую картинку: крупный логотип выходил мыльным.
    // Копия нарисована сразу крупной, поэтому чёткая; она уменьшается и садится ровно в гнездо,
    // там её сменяет сам значок, а копия убирается
    const K = 4
    const fly = ico.cloneNode(true)
    fly.removeAttribute('id')
    fly.className = 'p-ico-fly'
    fly.style.cssText = `left:${ico.offsetLeft + w / 2 - w * K / 2}px; top:${ico.offsetTop + w / 2 - w * K / 2}px; width:${w * K}px; height:${w * K}px`
    head.append(fly)
    let landed = false
    const finish = () => { if (landed) return; landed = true; show(); fly.remove() }
    const big = `translate3d(${dx}px, ${dy}px, ${z}px) scale(1)`

    const pop = fly.animate([
      { transform: `translate3d(${dx}px, ${dy}px, ${z}px) scale(${3.5 / K})`, opacity: 0, filter: 'blur(8px)' },
      { transform: big, opacity: 1, filter: 'blur(0px)' }
    ], { duration: 900, delay: 450, easing: 'cubic-bezier(.25,1,.5,1)', fill: 'both' })

    pop.finished.then(() => {
      const land = fly.animate([
        { transform: big, opacity: 1 },
        { transform: `translate3d(0, 0, 0) scale(${1 / K})`, opacity: 1 }
      ], { duration: 1200, delay: 300, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
      return land.finished
    }).then(finish, finish)

    setTimeout(finish, 4500)   // страховка
  }

  /* ---------- Живая схема: импульс бежит по веткам ---------- */
  function runFlow() {
    const nodes = ['n1', 'n2', 'n3', 'n4'].map(id => document.getElementById(id))
    const chips = { w1: document.getElementById('c1'), w2: document.getElementById('c2') }
    const on = id => document.querySelector(`.w-on[data-for="${id}"]`)
    const pulse = document.getElementById('pulse')
    const log = document.getElementById('log')
    const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    document.querySelectorAll('.w-on').forEach(p => {
      const L = p.getTotalLength()
      p.style.strokeDasharray = L
      p.style.strokeDashoffset = L
      p.dataset.len = L
    })

    if (reduce) {
      nodes[0].classList.add('is-on'); nodes[1].classList.add('is-on'); nodes[3].classList.add('is-on')
      on('w1').style.opacity = 1; on('w1').style.strokeDashoffset = 0
      on('w3').style.opacity = 1; on('w3').style.strokeDashoffset = 0
      pulse.style.display = 'none'
      return
    }

    let visible = true
    new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(document.querySelector('.hero-scene'))

    const wait = ms => new Promise(r => setTimeout(r, ms))
    const whenVisible = async () => { while (!visible || document.hidden) await wait(400) }

    function travel(id, ms) {
      const path = document.getElementById(id)
      const lit = on(id)
      const L = +lit.dataset.len
      lit.style.transition = 'opacity .5s cubic-bezier(.25,1,.5,1)'
      lit.style.opacity = 1
      pulse.classList.add('is-on')
      return new Promise(res => {
        const s = performance.now()
        const step = now => {
          // первый экран ушёл с экрана: огонёк сразу в конце пути, без кадров, которых никто не увидит
          const p = visible && !document.hidden ? Math.min(1, (now - s) / ms) : 1
          const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
          const pt = path.getPointAtLength(e * L)
          pulse.setAttribute('cx', pt.x)
          pulse.setAttribute('cy', pt.y)
          lit.style.strokeDashoffset = L * (1 - e)
          p < 1 ? requestAnimationFrame(step) : res()
        }
        requestAnimationFrame(step)
      })
    }
    function fade(id) {
      const lit = on(id)
      lit.style.transition = 'opacity 1.2s cubic-bezier(.25,1,.5,1)'
      lit.style.opacity = 0
    }
    function addLog(text) {
      const li = document.createElement('li')
      li.className = 'is-enter'
      const sec = (0.4 + Math.random() * 1.8).toFixed(1).replace('.', ',')
      li.innerHTML = `<i></i><time>${fmt.format(new Date())}</time><span>${text}</span><em>${sec} с</em>`
      const rowH = log.firstElementChild.getBoundingClientRect().height ? log.firstElementChild.offsetHeight : 0
      log.prepend(li)
      // FLIP: ставим список на строку выше и плавно опускаем на место
      log.style.transition = 'none'
      log.style.transform = `translateY(${-rowH}px)`
      void log.offsetHeight
      log.style.transition = 'transform .9s cubic-bezier(.25,1,.5,1)'
      log.style.transform = 'translateY(0)'
      requestAnimationFrame(() => li.classList.remove('is-enter'))
      const extra = [...log.children].slice(3)
      extra.forEach(el => el.classList.add('is-leave'))
      setTimeout(() => extra.forEach(el => el.remove()), 950)
    }

    let branchNew = true
    ;(async function loop() {
      await wait(1600)
      for (;;) {
        await whenVisible()
        const [a, b] = branchNew ? ['w1', 'w3'] : ['w2', 'w4']
        const mid = branchNew ? nodes[1] : nodes[2]
        const chip = chips[a]

        nodes[0].classList.add('is-on')
        await wait(650)
        chip.classList.add('is-on')
        await travel(a, 900)
        nodes[0].classList.remove('is-on')
        mid.classList.add('is-on')
        await wait(700)
        fade(a); chip.classList.remove('is-on')
        await travel(b, 900)
        mid.classList.remove('is-on')
        nodes[3].classList.add('is-on')
        pulse.classList.remove('is-on')
        addLog(branchNew ? 'заявка → карточка в CRM' : 'заявка → счёт отправлен')
        await wait(900)
        fade(b)
        nodes[3].classList.remove('is-on')
        branchNew = !branchNew
        await wait(900)
      }
    })()
  }
})()
