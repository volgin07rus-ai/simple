// 4. Что делаем: шесть направлений, справа живая сцена выбранного.
// На ноутбуке направления сменяют друг друга сами, пока посетитель не выберет своё.
// На телефоне экран встаёт внутрь открытого пункта, и пункты сами не переключаются
(() => {
  const root = document.getElementById('services')
  if (!root) return
  const items = [...root.querySelectorAll('.svc-item')]
  const grid = root.querySelector('.svc-grid')
  const screen = document.getElementById('svc-screen')
  const stage = document.getElementById('svc-stage')
  const cap = document.getElementById('svc-cap')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const narrow = matchMedia('(max-width: 1024px)')
  const STOP = Symbol('stop')
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const on = (el, sel) => el.querySelectorAll(sel).forEach(n => n.classList.add('on'))
  const money = n => n.toLocaleString('ru-RU') + ' ₽'
  // Координаты узла внутри сцены: по раскладке, без учёта анимаций
  const em = (el, px) => (px / parseFloat(getComputedStyle(el).fontSize)).toFixed(3) + 'em'
  const pos = (node, ancestor) => {
    let x = 0, y = 0
    while (node && node !== ancestor) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent }
    return { x, y }
  }

  let visible = false, touched = false, started = false, current = -1, token = null

  /* ---------- Таймлайн сцены ---------- */
  // Паузы идут только пока блок на экране. Смена направления обрывает сцену.
  // В «сухом» прогоне паузы не ждут, а считают длительность: по ней идёт полоска под пунктом
  function timeline(dry = false) {
    const t = { alive: true, total: 0 }
    const check = () => { if (!t.alive) throw STOP }
    t.wait = async ms => {
      t.total += ms
      if (dry || reduce) return check()
      let left = ms
      while (left > 0) {
        check()
        if (!visible || document.hidden) { await sleep(200); continue }
        const step = Math.min(left, 100)
        await sleep(step)
        left -= step
      }
      check()
    }
    t.type = async (el, text, perChar = 34) => {
      if (reduce) { el.textContent = text; return }
      for (let i = 1; i <= text.length; i++) { el.textContent = text.slice(0, i); await t.wait(perChar) }
    }
    t.count = async (el, to, ms, fmt) => {
      const steps = Math.max(1, Math.round(ms / 40))
      if (reduce) { el.textContent = fmt(to); return }
      for (let i = 1; i <= steps; i++) {
        const e = 1 - Math.pow(1 - i / steps, 3)
        el.textContent = fmt(Math.round(to * e))
        await t.wait(40)
      }
    }
    return t
  }

  /* ---------- Сцены ---------- */
  const CURSOR = '<svg viewBox="0 0 16 20"><path d="M1.5 1.5v15.2l4.1-3.9 2.7 5.7 2.6-1.2-2.6-5.6h5.6z"/></svg>'
  const DEMOS = {
    site: {
      cap: 'Сайт: заявка сразу уходит менеджеру',
      html: `
        <div class="ds-win q">
          <div class="ds-bar"><i></i><i></i><i></i><span>ваш-сайт.ru</span></div>
          <div class="ds-page">
            <div class="ds-nav q"><b></b><span></span><span></span><span></span></div>
            <p class="ds-h q">Доставим груз по&nbsp;России за&nbsp;3&nbsp;дня</p>
            <p class="ds-sub q">Посчитаем стоимость за 10 минут</p>
            <span class="ds-btn q">Оставить заявку</span>
            <div class="ds-pic q"><i></i><i></i></div>
          </div>
        </div>
        <span class="ds-cursor">${CURSOR}</span>
        <div class="ds-toast dm-card q"><i></i><p><b>Новая заявка</b><span>ушла в CRM, менеджер получил уведомление</span></p></div>`,
      async play(el, t) {
        on(el, '.ds-win'); await t.wait(450)
        for (const s of ['.ds-nav', '.ds-h', '.ds-sub', '.ds-btn', '.ds-pic']) { on(el, s); await t.wait(300) }
        await t.wait(500)
        const btn = el.querySelector('.ds-btn'), p = pos(btn, el)
        el.querySelector('.ds-cursor').style.transform = `translate(${em(el, p.x + btn.offsetWidth * 0.62)}, ${em(el, p.y + btn.offsetHeight * 0.55)})`
        await t.wait(1150)
        el.classList.add('is-press'); await t.wait(200)
        el.classList.remove('is-press'); await t.wait(300)
        on(el, '.ds-toast'); await t.wait(2600)
      }
    },

    kp: {
      cap: 'Автоматизация: КП собирается по шаблону',
      html: `
        <div class="dk-src">
          <span class="dk-chip q"><i></i>Шаблон КП компании</span>
          <span class="dk-chip q"><i></i>Данные сделки из CRM</span>
        </div>
        <div class="dk-doc dm-card q">
          <p class="dk-top"><b>Коммерческое предложение</b><span>№&nbsp;1042</span></p>
          <p class="dk-client"><span>Клиент</span><b class="dk-name"></b></p>
          <ul class="dk-items">
            <li><span>Доставка, 20&nbsp;т</span><b>84&nbsp;000&nbsp;₽</b></li>
            <li><span>Страхование груза</span><b>6&nbsp;300&nbsp;₽</b></li>
            <li><span>Хранение, 5&nbsp;дней</span><b>12&nbsp;500&nbsp;₽</b></li>
          </ul>
          <p class="dk-total"><span>Итого</span><b class="dk-sum">0&nbsp;₽</b></p>
        </div>
        <div class="dm-done q"><i></i>PDF готов, осталось проверить и отправить</div>`,
      async play(el, t) {
        on(el, '.dk-doc'); await t.wait(500)
        const chips = el.querySelectorAll('.dk-chip')
        chips[0].classList.add('on'); await t.wait(500)
        chips[1].classList.add('on'); await t.wait(500)
        await t.type(el.querySelector('.dk-name'), 'ООО «Север»', 45)
        await t.wait(250)
        for (const li of el.querySelectorAll('.dk-items li')) { li.classList.add('on'); await t.wait(380) }
        await t.count(el.querySelector('.dk-sum'), 102800, 900, money)
        await t.wait(350)
        on(el, '.dm-done'); await t.wait(2600)
      }
    },

    docs: {
      cap: 'Документооборот: договор проходит согласование',
      html: `
        <div class="dd-doc dm-card q">
          <span class="dd-ico"><i></i><i></i><i></i></span>
          <b>Договор поставки №&nbsp;18</b>
          <span class="dd-status">На согласовании</span>
        </div>
        <ol class="dd-route q">
          <span class="dd-line"><i></i></span>
          <li><i></i><b>Менеджер</b><span data-done="создал, 10:02">ждёт</span></li>
          <li><i></i><b>Юрист</b><span data-done="согласовал, 11:40">ждёт</span><em class="dd-ai q">AI отметил 2 условия, которые отличаются от шаблона</em></li>
          <li><i></i><b>Бухгалтерия</b><span data-done="согласовала, 12:15">ждёт</span></li>
          <li><i></i><b>Директор</b><span data-done="подписал, 14:30">ждёт</span></li>
        </ol>`,
      async play(el, t) {
        on(el, '.dd-doc'); on(el, '.dd-route'); await t.wait(600)
        const steps = [...el.querySelectorAll('.dd-route li')]
        const line = el.querySelector('.dd-line i')
        // шаг с заметкой AI выше остальных, поэтому линия тянется до кружка следующего шага по его месту, а не равными долями.
        // В em, чтобы вместе со сценой масштабировалась под ширину экрана
        const reach = i => `${(steps[i].offsetTop - steps[0].offsetTop) / parseFloat(getComputedStyle(line).fontSize)}em`
        for (const [i, li] of steps.entries()) {
          li.classList.add('is-cur'); await t.wait(i === 1 ? 300 : 600)
          if (i === 1) { on(el, '.dd-ai'); await t.wait(1500) }
          li.classList.remove('is-cur'); li.classList.add('is-done')
          li.querySelector('span').textContent = li.querySelector('span').dataset.done
          if (i < steps.length - 1) line.style.height = reach(i + 1)
          await t.wait(450)
        }
        const st = el.querySelector('.dd-status')
        st.textContent = 'Подписан'; st.classList.add('is-ok')
        await t.wait(2400)
      }
    },

    sync: {
      cap: 'Интеграции: заказ сам доходит до склада и учёта',
      html: `
        <div class="dy-row">
          <div class="dy-sys dm-card q"><p class="dy-h">CRM</p>
            <p class="dy-li"><span>Заказ 5529</span><b>доставлен</b></p>
            <p class="dy-li"><span>Заказ 5530</span><b>оплачен</b></p>
            <p class="dy-li dy-new"><span>Заказ 5531</span><b>новый</b></p></div>
          <div class="dy-sys dm-card q"><p class="dy-h">Склад</p>
            <p class="dy-li"><span>Коробка 40×30</span><b class="dy-stock">48&nbsp;шт</b></p>
            <p class="dy-li"><span>Плёнка</span><b>120&nbsp;м</b></p>
            <p class="dy-li"><span>Скотч</span><b>64&nbsp;шт</b></p></div>
          <div class="dy-sys dm-card q"><p class="dy-h">1С: учёт</p>
            <p class="dy-li"><span>Счёт 770</span><b>оплачен</b></p>
            <p class="dy-li"><span>Счёт 771</span><b>проведён</b></p>
            <p class="dy-li dy-new"><span>Счёт 772</span><b>создан</b></p></div>
        </div>
        <span class="dy-pack">Заказ 5531 · 12&nbsp;шт</span>
        <ul class="dy-log">
          <li class="q"><i></i>заказ 5531 → склад: списано 12&nbsp;шт</li>
          <li class="q"><i></i>склад → 1С: счёт 772 создан</li>
        </ul>`,
      async play(el, t) {
        const sys = [...el.querySelectorAll('.dy-sys')]
        for (const s of sys) { s.classList.add('on'); await t.wait(220) }
        await t.wait(300)
        sys[0].querySelector('.dy-new').classList.add('on'); sys[0].classList.add('is-hot')
        await t.wait(700)
        const pack = el.querySelector('.dy-pack')
        const place = (s, instant) => {
          const p = pos(s, el)
          if (instant) pack.style.transition = 'none'
          pack.style.transform = `translate(${em(pack, p.x + s.offsetWidth / 2 - pack.offsetWidth / 2)}, ${em(pack, p.y + s.offsetHeight + 8)})`
          if (instant) { void pack.offsetWidth; pack.style.transition = '' }
        }
        place(sys[0], true); pack.classList.add('on'); await t.wait(400)
        sys[0].classList.remove('is-hot')
        place(sys[1]); await t.wait(900)
        sys[1].classList.add('is-hot')
        const stock = sys[1].querySelector('.dy-stock')
        stock.classList.add('is-flash'); stock.innerHTML = '36&nbsp;шт'
        on(el, '.dy-log li:first-child'); await t.wait(800)
        sys[1].classList.remove('is-hot')
        place(sys[2]); await t.wait(900)
        sys[2].classList.add('is-hot'); sys[2].querySelector('.dy-new').classList.add('on')
        on(el, '.dy-log li:last-child'); await t.wait(500)
        pack.classList.remove('on')
        await t.wait(2200)
      }
    },

    bot: {
      cap: 'Бот: отвечает клиенту и зовёт менеджера',
      html: `
        <div class="db-chat dm-card q">
          <p class="db-head"><i></i><b>Бот компании</b><span>онлайн</span></p>
          <div class="db-msgs">
            <p class="db-m db-in q">Добрый день! Где мой заказ 5531?</p>
            <p class="db-m db-out q"><span class="db-dots"><i></i><i></i><i></i></span><span class="db-text">Заказ передан в доставку, привезём завтра с 10 до 14</span></p>
            <p class="db-m db-in q">А можно перенести на субботу?</p>
            <p class="db-m db-out q"><span class="db-dots"><i></i><i></i><i></i></span><span class="db-text">Передаю менеджеру, он ответит в течение 15 минут</span></p>
            <p class="db-sys q">Анна, менеджер, подключилась к диалогу</p>
          </div>
        </div>`,
      async play(el, t) {
        on(el, '.db-chat'); await t.wait(500)
        const [q1, a1, q2, a2] = el.querySelectorAll('.db-m')
        const answer = async m => { m.classList.add('on', 'is-typing'); await t.wait(1000); m.classList.remove('is-typing'); await t.wait(900) }
        q1.classList.add('on'); await t.wait(700)
        await answer(a1)
        q2.classList.add('on'); await t.wait(700)
        await answer(a2)
        on(el, '.db-sys'); await t.wait(2400)
      }
    },

    call: {
      cap: 'AI-телефония: звонок превращается в задачу',
      html: `
        <div class="dc-call dm-card q">
          <span class="dc-ico"><svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.1 15.1 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg></span>
          <p class="dc-who"><b>Входящий звонок</b><span>+7 9•• •••-42-18</span></p>
          <span class="dc-wave">${'<i></i>'.repeat(26)}</span>
          <span class="dc-time">00:00</span>
        </div>
        <div class="dc-text">
          <p class="q"><b>Клиент</b><span class="dc-t1"></span></p>
          <p class="q"><b>Оператор</b><span class="dc-t2"></span></p>
          <p class="q"><b>Клиент</b><span class="dc-t3"></span></p>
        </div>
        <div class="dc-sum dm-card q">
          <p class="dc-sum-h">Итог звонка</p>
          <p class="dc-tags"><span class="q">Тема: сроки доставки</span><span class="q">Город: Казань</span><span class="q dc-task">Задача в CRM: подтвердить отгрузку завтра</span></p>
        </div>`,
      async play(el, t) {
        on(el, '.dc-call'); await t.wait(500)
        el.classList.add('is-talk')
        const time = el.querySelector('.dc-time')
        let sec = 0
        const tick = () => { sec += 3; time.textContent = `00:${String(Math.min(sec, 47)).padStart(2, '0')}` }
        const lines = el.querySelectorAll('.dc-text p')
        lines[0].classList.add('on')
        const t1 = el.querySelector('.dc-t1'), t2 = el.querySelector('.dc-t2'), t3 = el.querySelector('.dc-t3')
        const say = async (node, text) => {
          const words = text.split(' ')
          for (let i = 1; i <= words.length; i++) { node.textContent = words.slice(0, i).join(' '); tick(); await t.wait(150) }
        }
        await say(t1, 'Здравствуйте, хочу уточнить сроки доставки в Казань')
        await t.wait(300)
        lines[1].classList.add('on')
        await say(t2, 'Отправим завтра, у вас груз будет в пятницу')
        await t.wait(300)
        lines[2].classList.add('on')
        await say(t3, 'Хорошо, подтвердите, когда отгрузите')
        time.textContent = '00:47'
        el.classList.remove('is-talk'); await t.wait(400)
        on(el, '.dc-sum')
        for (const tag of el.querySelectorAll('.dc-tags span')) { await t.wait(350); tag.classList.add('on') }
        await t.wait(2600)
      }
    }
  }

  /* ---------- Переключение ---------- */
  const keys = items.map(it => it.dataset.demo)

  function placeScreen() {
    const i = current >= 0 ? current : items.findIndex(it => it.classList.contains('is-active'))
    if (narrow.matches && i >= 0) items[i].insertBefore(screen, items[i].querySelector('.svc-bar'))
    else if (screen.parentNode !== grid) grid.appendChild(screen)
  }

  let capTimer = 0, capText = cap.textContent
  function setCap(text) {
    if (text === capText) return
    capText = text
    clearTimeout(capTimer)
    if (reduce) { cap.textContent = text; return }
    cap.classList.add('is-exit')
    capTimer = setTimeout(() => {
      cap.textContent = text
      cap.classList.remove('is-exit'); cap.classList.add('is-enter')
      void cap.offsetHeight
      cap.classList.remove('is-enter')
    }, 180)
  }

  async function duration(key) {
    const t = timeline(true), el = document.createElement('div')
    el.innerHTML = DEMOS[key].html
    try { await DEMOS[key].play(el, t) } catch (e) { if (e !== STOP) throw e }
    return t.total
  }

  async function play(key) {
    if (token) token.alive = false
    const t = token = timeline()
    const old = stage.querySelector('.dm:not(.is-out)')
    if (old) { old.classList.add('is-out'); setTimeout(() => old.remove(), 600) }
    const el = document.createElement('div')
    el.className = `dm dm-${key} is-pre`
    el.innerHTML = DEMOS[key].html
    stage.appendChild(el)
    void el.offsetWidth
    el.classList.remove('is-pre')

    // Полоска под пунктом заполняется за время сцены
    const item = items[keys.indexOf(key)]
    const lead = reduce ? 0 : 350, tail = 900
    item.style.setProperty('--dur', (lead + await duration(key) + tail) + 'ms')
    items.forEach(it => it.classList.remove('is-running'))
    void item.offsetWidth
    if (!reduce) item.classList.add('is-running')

    try {
      await t.wait(lead)
      await DEMOS[key].play(el, t)
      if (reduce) return
      await t.wait(tail)
      if (!touched && !narrow.matches) show((current + 1) % items.length)
      else if (++replays <= 2) play(key)
    } catch (e) { if (e !== STOP) throw e }
  }

  let replays = 0
  function show(i) {
    if (i === current) return
    current = i
    replays = 0
    items.forEach((it, k) => {
      it.classList.toggle('is-active', k === i)
      it.querySelector('.svc-btn').setAttribute('aria-expanded', k === i ? 'true' : 'false')
    })
    placeScreen()
    setCap(DEMOS[keys[i]].cap)
    play(keys[i])
  }

  // На телефоне пункт раскрывается под кнопкой: описание, под ним окно со сценой. Камера плавно съезжает ровно
  // настолько, чтобы открытый пункт целиком встал на экран; если он выше экрана, кнопка встаёт под шапку.
  // Открытый пункт выше при этом схлопывается, но кнопка не прыгает: её путь по экрану плавный от места нажатия
  const hdr = document.getElementById('hdr')
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  let glide = 0
  const stopGlide = () => { cancelAnimationFrame(glide); glide = 0 }
  addEventListener('touchstart', stopGlide, { passive: true })
  addEventListener('wheel', stopGlide, { passive: true })

  function openOnPhone(i) {
    const it = items[i], btn = it.querySelector('.svc-btn')
    const prev = current >= 0 ? items[current] : null
    const before = btn.getBoundingClientRect().top
    // открытый пункт выше схлопнется целиком: кнопка поднимется на высоту его описания
    let fold = 0
    if (prev && items.indexOf(prev) < i) {
      const d = prev.querySelector('.svc-desc')
      fold = d.getBoundingClientRect().height + parseFloat(getComputedStyle(d).marginBottom)
    }
    show(i)
    if (!reduce) screen.animate([
      { opacity: 0, transform: 'translateY(-.75rem) scale(.985)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 650, easing: 'cubic-bezier(.25,1,.5,1)' })

    // Где окажутся кнопка и низ пункта, когда описания доедут (.svc-desc: высота за .6 с, отступ снизу 1.4rem).
    // Без анимаций описания уже на месте
    const desc = it.querySelector('.svc-desc')
    const grow = reduce ? 0 : desc.firstElementChild.scrollHeight + parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.4
    if (reduce) fold = 0
    const finalTop = btn.getBoundingClientRect().top + scrollY - fold
    const height = it.offsetHeight + grow
    const viewTop = hdr.offsetHeight + 12, viewBottom = innerHeight - 16
    let to = height <= viewBottom - viewTop ? Math.min(Math.max(before, viewTop), viewBottom - height) : viewTop
    const maxScroll = document.documentElement.scrollHeight - fold + grow - innerHeight
    to = Math.min(finalTop, Math.max(to, finalTop - maxScroll))

    stopGlide()
    if (reduce) { scrollBy({ top: btn.getBoundingClientRect().top - to, behavior: 'instant' }); return }
    const dur = Math.min(900, 500 + Math.abs(to - before) * 0.6), hold = Math.max(dur, 700), t0 = performance.now()
    const step = now => {
      const t = Math.min(1, (now - t0) / dur)
      const want = before + (to - before) * inOut(t)
      const shift = btn.getBoundingClientRect().top - want
      if (Math.abs(shift) > 0.5) scrollBy({ top: shift, behavior: 'instant' })
      // камера встала, но описание выше ещё может доезжать: кнопку держим, пока всё не успокоится
      glide = now - t0 < hold ? requestAnimationFrame(step) : 0
    }
    step(t0)
  }

  items.forEach((it, i) => {
    const btn = it.querySelector('.svc-btn')
    btn.addEventListener('click', () => {
      touched = true
      if (!narrow.matches || i === current) { show(i); return }
      openOnPhone(i)
    })
  })
  // Фокус с клавиатуры внутри списка останавливает автоматическую смену пунктов
  root.addEventListener('focusin', () => { touched = true })
  narrow.addEventListener('change', placeScreen)
  placeScreen()

  const syncPause = () => root.classList.toggle('is-paused', !visible || document.hidden)
  document.addEventListener('visibilitychange', syncPause)

  // Сцены идут, только пока блок на экране; первая стартует при первом появлении
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    syncPause()
    if (visible && !started) { started = true; if (current < 0) show(0) }
  }, { threshold: 0.2 }).observe(grid)
})()
