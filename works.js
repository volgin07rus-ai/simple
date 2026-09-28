// Работы: число и подписи для стены на главной, сетка с фильтром на странице works.html
(() => {
  const WORKS = window.WORKS || []
  const KINDS = window.WORK_KINDS || {}
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const cover = w => `assets/works/${w.slug}.jpg`
  const openLabel = w => w.cta || (w.kind === 'app' ? 'Открыть приложение' : w.kind === 'email' ? 'Открыть письмо' : 'Открыть сайт')

  /* ---------- Главная: подпись для плиток стены ---------- */
  window.workOpenLabel = openLabel

  /* ---------- Страница работ: фильтр и сетка ---------- */
  const grid = document.getElementById('works-grid')
  if (!grid) return

  const total = document.getElementById('works-total')
  if (total) total.textContent = WORKS.length

  grid.innerHTML = WORKS.map((w, i) => `
    <li class="work" data-kind="${w.kind}" style="--i:${i % 2}">
      <a class="work-link" href="${esc(w.live)}" target="_blank" rel="noopener" aria-describedby="newtab-note">
        <span class="work-cover"><img src="${cover(w)}" alt="" width="1000" height="625" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" /></span>
        <span class="work-body">
          <span class="work-meta">${esc(KINDS[w.kind] || '')}${w.year ? ' · ' + w.year : ''}</span>
          <span class="work-title">${esc(w.title)}</span>
          <span class="work-desc">${esc(w.desc)}</span>
          <span class="work-tech">${w.tech.map(esc).join(' · ')}</span>
          <span class="work-open">${openLabel(w)}</span>
        </span>
      </a>
    </li>`).join('')

  const cards = [...grid.children]

  // Появление карточек при прокрутке
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      e.target.classList.add('is-in')
      io.unobserve(e.target)
    })
  }, { rootMargin: '0px 0px -8% 0px' })
  cards.forEach(c => io.observe(c))

  // Вкладки: все типы, которые реально есть в работах
  const tabs = document.getElementById('works-tabs')
  const pill = tabs.querySelector('.tabs-pill')
  const counts = WORKS.reduce((m, w) => (m[w.kind] = (m[w.kind] || 0) + 1, m), {})
  const PLURAL = { site: 'Сайты', app: 'Приложения', email: 'Письма', presentation: 'Презентации', logo: 'Логотипы' }
  const filters = [['all', 'Все', WORKS.length], ...Object.keys(PLURAL).filter(k => counts[k]).map(k => [k, PLURAL[k], counts[k]])]
  filters.forEach(([key, label, n], i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tab'
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false')
    b.setAttribute('aria-controls', 'works-grid')
    b.tabIndex = i === 0 ? 0 : -1
    b.dataset.kind = key
    b.innerHTML = `${label} <span class="n">${n}</span>`
    tabs.appendChild(b)
  })
  const buttons = [...tabs.querySelectorAll('.tab')]

  // Координаты внутри самой полосы вкладок: прокрутка полосы на телефоне их не сбивает
  function movePill(btn, instant) {
    if (!btn || !btn.offsetWidth) return
    if (instant) pill.style.transition = 'none'
    pill.style.width = btn.offsetWidth + 'px'
    pill.style.transform = `translateX(${btn.offsetLeft}px)`
    if (instant) { void pill.offsetWidth; pill.style.transition = '' }
  }
  requestAnimationFrame(() => movePill(buttons[0], true))
  document.fonts?.ready.then(() => movePill(buttons.find(b => b.getAttribute('aria-selected') === 'true'), true))
  addEventListener('resize', () => movePill(buttons.find(b => b.getAttribute('aria-selected') === 'true'), true))

  let current = 'all', busy = 0
  function apply(kind) {
    if (kind === current) return
    current = kind
    // Быстрые щелчки: незавершённый прошлый переход сбрасываем, иначе карточки застрянут погасшими
    cards.forEach(c => {
      c.classList.remove('is-leaving', 'is-entering')
      c.style.transform = ''
      c.style.transition = ''
      c.style.transitionDelay = ''
    })
    const match = c => kind === 'all' || c.dataset.kind === kind
    const shown = cards.filter(c => !c.hidden)
    const leaving = shown.filter(c => !match(c))
    const staying = shown.filter(match)
    const entering = cards.filter(c => c.hidden && match(c))

    if (reduce) {
      cards.forEach(c => { c.hidden = !match(c) })
      return
    }

    const run = ++busy
    // 1. Лишние карточки гаснут на месте
    const first = new Map(staying.map(c => [c, c.getBoundingClientRect()]))
    leaving.forEach(c => c.classList.add('is-leaving'))

    setTimeout(() => {
      if (run !== busy) return
      leaving.forEach(c => { c.hidden = true; c.classList.remove('is-leaving') })
      entering.forEach(c => { c.hidden = false; c.classList.add('is-in', 'is-entering') })

      // 2. Оставшиеся плавно переезжают на новые места (FLIP)
      staying.forEach(c => {
        const a = first.get(c), b = c.getBoundingClientRect()
        const dx = a.left - b.left, dy = a.top - b.top
        if (!dx && !dy) return
        c.style.transition = 'none'
        c.style.transform = `translate(${dx}px, ${dy}px)`
      })
      void grid.offsetHeight
      staying.forEach(c => {
        c.style.transition = 'transform .7s cubic-bezier(.25,1,.5,1)'
        c.style.transform = ''
      })
      // 3. Новые проявляются по очереди
      entering.forEach((c, i) => {
        c.style.transitionDelay = (i * 60) + 'ms'
        c.classList.remove('is-entering')   // стартовое состояние уже применено перерасчётом выше
        setTimeout(() => { c.style.transitionDelay = '' }, 900 + i * 60)
      })
      setTimeout(() => staying.forEach(c => { c.style.transition = '' }), 750)
    }, 230)
  }

  function select(btn, focus) {
    buttons.forEach(b => {
      const on = b === btn
      b.setAttribute('aria-selected', on ? 'true' : 'false')
      b.tabIndex = on ? 0 : -1
    })
    if (focus) btn.focus()
    btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    movePill(btn)
    apply(btn.dataset.kind)
  }

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => select(b))
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]
      select(next, true)
    })
  })
})()
