// 11. Финальный призыв. Под заголовком «Покажите процесс, мы упростим его» линия процесса идёт в два действия:
// сначала серым прорисовывается запутанный росчерк, потом он распрямляется слева направо, прямая часть
// становится лаймовой и приходит в кнопку, и нож на кнопке раскрывается. Потом при наведении на кнопку
// по прямой к ней пробегает импульс
(() => {
  const row = document.querySelector('.final-row')
  if (!row) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const svg = row.querySelector('.final-line')
  const path = svg.querySelector('.final-path')
  const pulse = svg.querySelector('.final-pulse')
  const grad = svg.querySelector('linearGradient')
  const stops = grad.querySelectorAll('stop')
  const btn = row.querySelector('.final-btn')
  const N = 700          // точек на линии
  const BAND = 0.22      // ширина зоны, где росчерк переходит в прямую
  const DRAW = 1400      // прорисовка росчерка
  const PAUSE = 400
  const UNTANGLE = 2600  // распрямление
  let W = 0, H = 0
  path.setAttribute('pathLength', 1)
  let p = reduce ? 1 : 0          // 0 росчерк, 1 прямая
  let shown = reduce ? 1 : 0      // какая доля росчерка уже прорисована
  let done = reduce

  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const out = t => 1 - Math.pow(1 - t, 3)
  // петли живут в середине линии: в начале и у кнопки она прямая
  const envelope = u => smooth(u / 0.06) * (1 - smooth((u - 0.7) / 0.18))

  // Точка линии: прямая плюс петли из нескольких синусоид разной частоты. k = 0 прямая, k = 1 росчерк
  function point(u, k) {
    const a = H * 0.36 * envelope(u) * k
    const t = u * 2 * Math.PI
    const dx = a * 1.6 * (0.55 * Math.sin(t * 5.1 + 0.7) + 0.3 * Math.sin(t * 11.3 + 2.1) + 0.18 * Math.sin(t * 23.7 + 1.3))
    const dy = a * (0.6 * Math.cos(t * 4.3 + 1.1) + 0.3 * Math.sin(t * 12.9 + 0.4) + 0.16 * Math.cos(t * 26.1 + 2.7))
    return [u * W + dx, H / 2 + dy]
  }

  function draw() {
    if (!W) return
    const front = -BAND + p * (1 + BAND)
    let d = ''
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      const [x, y] = point(u, smooth((u - front) / BAND))   // левее фронта уже прямая, правее ещё петли
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
    }
    path.setAttribute('d', d)
    // пока росчерк прорисовывается, он открывается штрихом от начала линии. Длина линии задана как 1 (pathLength),
    // поэтому браузеру не нужно каждый кадр заново мерить линию из сотен точек
    if (shown < 1) {
      path.style.strokeDasharray = '1 1'
      path.style.strokeDashoffset = 1 - shown
    } else path.style.strokeDasharray = 'none'
    // распрямлённая часть лаймовая, петли серые
    stops[1].setAttribute('offset', Math.max(0, Math.min(1, front)))
    stops[2].setAttribute('offset', Math.max(0, Math.min(1, front + BAND * 0.5)))
  }

  function measure() {
    W = svg.clientWidth
    H = svg.clientHeight
    grad.setAttribute('x2', W)
    draw()
  }
  new ResizeObserver(measure).observe(svg)

  const tween = (ms, ease, set) => new Promise(res => {
    const start = performance.now()
    const step = now => {
      const t = Math.min(1, (now - start) / ms)
      set(ease(t))
      draw()
      t < 1 ? requestAnimationFrame(step) : res()
    }
    requestAnimationFrame(step)
  })
  const wait = ms => new Promise(r => setTimeout(r, ms))

  async function play() {
    await tween(DRAW, out, v => { shown = v })
    await wait(PAUSE)
    await tween(UNTANGLE, inOut, v => { p = v })
    done = true
    // линия пришла в кнопку: нож на ней раскрывается и складывается обратно
    btn.classList.add('is-open')
    setTimeout(() => btn.classList.remove('is-open'), 1300)
  }

  if (!reduce) {
    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      setTimeout(play, 450)
    }, { threshold: 0.6 }).observe(row)

    // импульс по прямой линии к кнопке, когда на неё навели
    let pulsing = false
    const run = () => {
      if (!done || pulsing || !W) return
      pulsing = true
      const start = performance.now()
      const step = now => {
        const t = Math.min(1, (now - start) / 850)
        pulse.setAttribute('cx', inOut(t) * W)
        pulse.setAttribute('cy', H / 2)
        pulse.style.opacity = Math.min(1, t / 0.15, (1 - t) / 0.2)
        if (t < 1) requestAnimationFrame(step)
        else { pulse.style.opacity = 0; pulsing = false }
      }
      requestAnimationFrame(step)
    }
    btn.addEventListener('pointerenter', run)
    btn.addEventListener('focus', run)
  }
})()
