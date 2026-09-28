// 9. Вопросы. На компьютере вопрос из списка уходит в чат справа: Simple печатает и отвечает.
// На планшете и телефоне ответ раскрывается прямо под вопросом. Без скрипта все ответы открыты
(() => {
  const faq = document.getElementById('faq')
  if (!faq) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const wide = matchMedia('(min-width: 1025px)')
  const items = [...faq.querySelectorAll('.faq-item')]
  const thread = faq.querySelector('.faq-thread')
  const status = faq.querySelector('.faq-status')
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms))
  const AVA = '<span class="msg-ava" aria-hidden="true"><svg viewBox="0 0 719 719"><use href="#logo" /></svg></span>'
  faq.classList.add('is-live')

  /* ---------- Планшет и телефон: ответ раскрывается под вопросом ---------- */
  function toggle(item) {
    const open = !item.classList.contains('is-open')
    item.classList.toggle('is-open', open)
    item.querySelector('.faq-q').setAttribute('aria-expanded', open)
  }

  // Атрибуты для экранного диктора зависят от режима: раскрывающийся список или чат
  function mode() {
    items.forEach(item => {
      const q = item.querySelector('.faq-q')
      if (wide.matches) {
        q.removeAttribute('aria-expanded')
        q.setAttribute('aria-controls', thread.id)
      } else {
        q.setAttribute('aria-expanded', item.classList.contains('is-open'))
        q.setAttribute('aria-controls', item.querySelector('.faq-a').id)
      }
    })
  }
  mode()
  wide.addEventListener('change', mode)

  items.forEach((item, i) => item.querySelector('.faq-q').addEventListener('click', () => (wide.matches ? ask(i) : toggle(item))))

  /* ---------- Компьютер: чат ---------- */
  const asked = new Map()   // номер вопроса → его сообщение в чате
  const queue = []
  let busy = false, closed = false

  // новое сообщение прокручивает только чат, страница остаётся на месте
  function post(el) {
    thread.append(el)
    thread.scrollTo({ top: thread.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
    return el
  }
  function incoming(html) {
    const el = document.createElement('div')
    el.className = 'msg msg-in'
    el.innerHTML = `${AVA}<p class="msg-b">${html}</p>`
    return el
  }

  function ask(i) {
    if (asked.has(i)) { recall(i); return }
    asked.set(i, null)
    items[i].classList.add('is-asked')
    queue.push(i)
    if (!busy) run()
  }

  // Вопросы идут по очереди: вопрос, «печатает», ответ. Пока Simple отвечает, следующий вопрос ждёт
  async function run() {
    busy = true
    while (queue.length) {
      const i = queue.shift()
      const q = document.createElement('div')
      q.className = 'msg msg-out'
      const text = document.createElement('p')
      text.className = 'msg-b'
      text.textContent = items[i].querySelector('.faq-text').textContent
      q.append(text)
      asked.set(i, post(q))
      await wait(450)
      const answer = items[i].querySelector('.faq-a .msg').cloneNode(true)
      if (!reduce) {
        const typing = post(incoming('<i></i><i></i><i></i>'))
        typing.classList.add('msg-typing')
        typing.setAttribute('aria-hidden', 'true')
        status.classList.add('is-on')
        await wait(Math.min(1500, 450 + answer.textContent.length * 5))
        typing.remove()
        status.classList.remove('is-on')
      }
      post(answer)
      await wait(350)
    }
    busy = false
    // на все вопросы ответили: подсказываем, куда писать дальше
    if (asked.size === items.length && !closed) {
      closed = true
      await wait(700)
      post(incoming('Если остались вопросы, напишите в Telegram <a href="https://t.me/simple_ai_team" target="_blank" rel="noopener">@simple_ai_team</a> или на <a href="mailto:info@simplemind.ru">info@simplemind.ru</a>'))
    }
  }

  // Вопрос уже задавали: чат возвращается к нему и ненадолго подсвечивает вопрос и ответ
  function recall(i) {
    const q = asked.get(i)
    if (!q) return
    thread.scrollTo({ top: q.offsetTop - 16, behavior: reduce ? 'auto' : 'smooth' })
    ;[q, q.nextElementSibling].forEach(m => {
      if (!m) return
      m.classList.remove('is-flash')
      void m.offsetWidth
      m.classList.add('is-flash')
    })
  }

  // Когда чат показался на экране, первый вопрос задаётся сам: сразу видно, как это работает
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting || !wide.matches) return
    io.disconnect()
    setTimeout(() => { if (!asked.size) ask(0) }, reduce ? 0 : 700)
  }, { threshold: 0.55 }).observe(thread)
})()
