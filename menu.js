// Меню на телефоне и планшете. Бургер в шапке открывает панель во весь экран: справа по очереди выезжают
// лаймовый и оливковый слои, за ними тёмная панель, пункты поднимаются снизу с лёгким поворотом, номера
// и контакты проявляются следом. Закрывается одним движением вправо. Порт StaggeredMenu без React и GSAP.
// Пункты берём из меню шапки, контакты из подвала: на всех страницах меню одинаковое и правится в одном месте
// StaggeredMenu: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause
(() => {
  const hdr = document.getElementById('hdr')
  const burger = hdr && hdr.querySelector('.burger')
  if (!burger) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const knife = document.querySelector('[data-knife]')?.innerHTML || ''   // нож на кнопку, уже собранный common.js
  const onBrief = document.body.classList.contains('page-brief')
  const contacts = [...document.querySelectorAll('.ftr-contacts a')]
  const find = test => contacts.find(a => test(a.getAttribute('href') || ''))
  const phone = find(h => h.startsWith('tel:')), mail = find(h => h.startsWith('mailto:')), tg = find(h => h.includes('t.me/'))

  const menu = document.createElement('div')
  menu.className = 'menu'
  menu.id = 'menu'
  menu.hidden = true
  menu.innerHTML = `
    <span class="menu-layer" style="--l:0"></span>
    <span class="menu-layer" style="--l:1"></span>
    <div class="menu-panel">
      <nav class="menu-nav" aria-label="Разделы">
        <ol>${[...hdr.querySelectorAll('.nav a')].map((a, i) => `
          <li style="--i:${i}"><a href="${a.getAttribute('href')}"${a.hasAttribute('aria-current') ? ' aria-current="page"' : ''}><span class="menu-clip"><span class="menu-word">${a.textContent.trim()}</span></span><sup aria-hidden="true">${String(i + 1).padStart(2, '0')}</sup></a></li>`).join('')}
        </ol>
      </nav>
      <div class="menu-foot">
        <div class="menu-row" style="--j:0">
          <a class="btn btn-lime" href="${onBrief ? '#brief' : 'brief.html'}"><span class="btn-knife" data-knife aria-hidden="true">${knife}</span>Обсудить задачу</a>
        </div>
        <div class="menu-row menu-contacts" style="--j:1">
          <span class="menu-label">Связаться</span>
          ${phone ? `<a class="menu-phone" href="${phone.getAttribute('href')}">${phone.innerHTML}</a>` : ''}
          <span class="menu-social">${tg ? `<a href="${tg.getAttribute('href')}" target="_blank" rel="noopener">Telegram</a>` : ''}${mail ? `<a href="${mail.getAttribute('href')}">${mail.textContent.trim()}</a>` : ''}</span>
        </div>
      </div>
    </div>`
  document.body.append(menu)

  let open = false, hideTimer = 0
  // пока меню открыто, страница под ним не прокручивается и не ловит фокус: клавиатура ходит по шапке и меню
  const rest = () => [...document.body.children].filter(el => el !== hdr && el !== menu && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName))
  function mark(v) {
    burger.setAttribute('aria-expanded', String(v))
    burger.setAttribute('aria-label', v ? 'Закрыть меню' : 'Открыть меню')
    hdr.classList.toggle('is-menu', v)
    document.documentElement.classList.toggle('menu-open', v)
    rest().forEach(el => { el.inert = v })
  }
  function show() {
    open = true
    clearTimeout(hideTimer)
    menu.classList.remove('is-instant')
    menu.hidden = false
    void menu.offsetWidth
    menu.classList.add('is-open')
    mark(true)
  }
  function close({ instant = false, focus = true } = {}) {
    if (!open) return
    open = false
    const inside = menu.contains(document.activeElement)
    menu.classList.toggle('is-instant', instant)
    menu.classList.remove('is-open')
    mark(false)
    hideTimer = setTimeout(() => { menu.hidden = true }, instant || reduce ? 0 : 450)
    if (focus && inside) burger.focus({ preventScroll: true })
  }

  burger.addEventListener('click', () => (open ? close() : show()))
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) { close(); burger.focus({ preventScroll: true }) } })
  // Пункт этой же страницы: меню уезжает вправо, а страница в это время плавно едет к блоку (common.js).
  // Ссылка на другую страницу просто открывается, меню остаётся до её загрузки
  menu.addEventListener('click', e => {
    const a = e.target.closest('a')
    if (!a) return
    const url = new URL(a.href, location.href)
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) close({ focus: false })
  })
  hdr.querySelector('.brand')?.addEventListener('click', () => close({ focus: false }))
  // окно растянули до ширины, где меню в шапке видно целиком, или вернулись на страницу кнопкой «Назад»
  matchMedia('(min-width: 1025px)').addEventListener('change', e => { if (e.matches) close({ instant: true, focus: false }) })
  addEventListener('pageshow', e => { if (e.persisted) close({ instant: true, focus: false }) })
})()
