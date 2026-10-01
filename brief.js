// Бриф Simple: логика формы. Как на старой странице tz.simplemind.ru: ответы всех типов лежат в одном объекте
// под своими ключами (site_*, bot_*, ...), в заявку уходят только ответы выбранного типа, при ошибке сети форма
// не очищается. Добавлено: ответы сохраняются в браузере и возвращаются после перезагрузки, шаги слева показывают,
// где человек и что уже заполнено, поля растут по тексту
(() => {
  const form = document.getElementById('brief')
  if (!form || !window.BRIEF) return
  const { PROJECT_TYPES, QUESTIONS, CLOSING, CONTACT_METHODS, REVISION_RULES, ACCEPTED_FILES } = window.BRIEF
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]

  // Приёмник заявок — служба брифа на сервере Simple. На simplemind.ru и tz.simplemind.ru nginx отдаёт её
  // по адресу /api/brief на том же домене, поэтому браузер спокойно читает ответ. С других адресов (копия
  // на volgin.site) запрос уходит на tz.simplemind.ru: заявка сохранится, но прочитать ответ браузер не даст
  const SAME_SITE = ['simplemind.ru', 'www.simplemind.ru', 'tz.simplemind.ru'].includes(location.hostname)
  const ENDPOINT = SAME_SITE ? '/api/brief' : 'https://tz.simplemind.ru/api/brief'
  const MAX_FILE_MB = 50
  const SAVE_KEY = 'simple-brief-v1'

  const state = { type: 'site', answers: {}, files: [], more: false, sent: false }

  const els = {
    types: $('[data-types]'), heading: $('[data-q-heading]'), lead: $('[data-q-lead]'),
    main: $('[data-main]'), extra: $('[data-extra]'), more: $('[data-more]'), moreToggle: $('[data-more-toggle]'),
    highlight: $('[data-files-highlight]'), chips: $('[data-files-items]'), privacyNote: $('[data-files-privacy]'),
    dropzone: $('[data-dropzone]'), fileInput: $('[data-file-input]'), filelist: $('[data-filelist]'),
    closing: $('[data-closing]'), methods: $('[data-methods]'), contact: $('[data-contact]'),
    rules: $('[data-rules]'), consent: $('[data-consent]'), privacy: $('[data-privacy]'),
    submit: $('[data-submit]'), note: $('[data-note]'), done: $('[data-done]'), doneId: $('[data-done-id]'),
    restored: $('[data-restored]'),
    fallback: $('[data-fallback]'), copy: $('[data-copy]'), mail: $('[data-mail]'), tg: $('[data-tg]'),
  }

  /* ---------- Сохранение ответов в браузере ---------- */
  // Длинную форму легко потерять: закрыли вкладку, обновили страницу. Файлы не сохраняются, их браузер не хранит
  let saveTimer = 0
  function save() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ type: state.type, answers: state.answers, more: state.more, files: state.files.length })) } catch {}
    }, 300)
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
      if (!data || !data.answers) return false
      const filled = Object.entries(data.answers).some(([k, v]) => k !== 'contact_method' && String(v).trim())
      if (!filled) return false
      if (QUESTIONS[data.type]) state.type = data.type
      state.answers = data.answers
      state.more = !!data.more
      return { files: data.files || 0 }
    } catch { return false }
  }
  function forget() { try { localStorage.removeItem(SAVE_KEY) } catch {} }

  /* ---------- Переключение без рывков ---------- */
  // Плашка способа связи одна на всю группу и при выборе переезжает к новой кнопке. Это слой во всю ширину
  // с тёмными подписями, из него видна только часть над выбранной кнопкой: подпись темнеет ровно там,
  // где под неё заехала плашка. Место берём у самой кнопки, поэтому работает и в строку, и сеткой два на два
  function slideHl(hl, target, instant) {
    if (!hl || !target) return
    hl.classList.toggle('is-instant', instant)
    const r = hl.offsetWidth - target.offsetLeft - target.offsetWidth, b = hl.offsetHeight - target.offsetTop - target.offsetHeight
    hl.style.clipPath = `inset(${target.offsetTop}px ${r}px ${b}px ${target.offsetLeft}px round ${hl.dataset.clip})`
    if (instant) { void hl.offsetWidth; hl.classList.remove('is-instant') }
  }
  // текст, который сменился по выбору (заголовок вопросов, подпись поля), проявляется заново, а не подменяется молча
  function swap(...list) {
    if (reduce) return
    list.forEach(el => {
      if (!el) return
      el.classList.remove('is-swap')
      void el.offsetWidth
      el.classList.add('is-swap')
    })
  }

  /* ---------- Тип задачи ---------- */
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" /></svg>'
  function renderTypes() {
    els.types.innerHTML = ''
    PROJECT_TYPES.forEach(t => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'bt-type'
      b.dataset.type = t.id
      b.innerHTML = `<b>${t.title}</b><span>${t.note}</span><i class="bt-check">${CHECK}</i>`
      b.addEventListener('click', e => {
        // нажатие мышью или пальцем: свет расходится от этой точки; с клавиатуры от кружка с галочкой
        const r = b.getBoundingClientRect()
        selectType(t.id, e.detail ? [e.clientX - r.left + 1, e.clientY - r.top + 1] : null)
      })
      els.types.append(b)
    })
    markType(true)
  }
  // Выбранная карточка заливается лаймовым светом: круг расходится от места нажатия до дальнего угла.
  // У прежней свет сжимается и стекает в её кружок с галочкой. Круг рисует ::before, центр и радиус задаём тут
  const checkPoint = b => { const c = $('.bt-check', b); return [c.offsetLeft + c.offsetWidth / 2 + 1, c.offsetTop + c.offsetHeight / 2 + 1] }
  function aim(b, [x, y], instant) {
    const w = b.offsetWidth, h = b.offsetHeight
    if (instant) b.classList.add('is-aim')
    b.style.setProperty('--x', x + 'px')
    b.style.setProperty('--y', y + 'px')
    b.style.setProperty('--r', Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 2 + 'px')
    if (instant) { void b.offsetWidth; b.classList.remove('is-aim') }
  }
  // кнопки не пересоздаются: иначе свету не из чего стекать, а фокус клавиатуры терялся бы после выбора
  function markType(instant = false, point = null) {
    const still = instant || reduce
    $$('.bt-type', els.types).forEach(b => {
      const on = b.dataset.type === state.type, was = b.getAttribute('aria-pressed') === 'true'
      if (on === was) { b.setAttribute('aria-pressed', String(on)); return }
      // новой карточке центр ставим сразу, без анимации, иначе круг приехал бы из прошлой точки;
      // у прежней центр едет к галочке вместе со сжатием круга
      aim(b, on ? point || checkPoint(b) : checkPoint(b), on || still)
      if (still) b.classList.add('is-aim')
      b.setAttribute('aria-pressed', String(on))
      if (still) { void b.offsetWidth; b.classList.remove('is-aim') }
    })
  }
  // ширина поменялась: свет выбранной карточки заново от галочки, чтобы круг закрывал её целиком
  function refitType() {
    const b = $('.bt-type[aria-pressed="true"]', els.types)
    if (b) aim(b, checkPoint(b), true)
  }
  function selectType(id, point = null) {
    if (id === state.type) return
    state.type = id
    setMore(false)   // дополнительные вопросы относились к прошлому типу
    markType(false, point)
    renderQuestions(true)
    update()
    save()
  }

  /* ---------- Вопросы ---------- */
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px' }
  function field(q, i = 0) {
    const wrap = document.createElement('div')
    wrap.className = 'bt-field' + (q.rows >= 3 ? ' bt-wide' : '')
    wrap.dataset.for = q.id
    wrap.style.setProperty('--i', i)
    wrap.innerHTML = `
      <label for="f_${q.id}">${q.label}</label>
      ${q.hint ? `<span class="bt-hint" id="h_${q.id}">${q.hint}</span>` : ''}
      <textarea id="f_${q.id}" name="${q.id}" rows="${q.rows}" placeholder="Своими словами"${q.hint ? ` aria-describedby="h_${q.id}"` : ''}></textarea>
      <span class="bt-error" role="alert">Здесь нужен ответ</span>`
    const ta = wrap.querySelector('textarea')
    ta.value = state.answers[q.id] ?? ''
    ta.addEventListener('input', () => {
      state.answers[q.id] = ta.value
      wrap.classList.remove('is-invalid')
      grow(ta)
      update()
      save()
    })
    requestAnimationFrame(() => grow(ta))
    return wrap
  }
  // при смене типа вопросы проявляются по очереди, а не прыгают разом
  function enter(list) {
    if (reduce) return
    list.forEach(el => el.classList.add('is-entering'))
    requestAnimationFrame(() => requestAnimationFrame(() => list.forEach(el => el.classList.remove('is-entering'))))
  }
  function renderQuestions(animate = false) {
    const type = PROJECT_TYPES.find(t => t.id === state.type)
    const bank = QUESTIONS[state.type]
    els.heading.textContent = type.heading
    els.lead.textContent = type.lead
    els.main.innerHTML = ''
    bank.main.forEach((q, i) => els.main.append(field(q, i)))
    els.extra.innerHTML = ''
    bank.extra.forEach((q, i) => els.extra.append(field(q, i)))
    renderFileHints(bank.files)
    if (animate) {
      enter([...els.main.children])
      swap(els.heading, els.lead, els.chips, els.highlight.hidden ? null : els.highlight)
    }
  }
  function setMore(open) {
    const label = els.moreToggle.querySelector('[data-more-label]')
    const text = open ? 'Свернуть детали' : 'Уточнить детали'
    state.more = open
    els.more.classList.toggle('is-open', open)
    els.moreToggle.setAttribute('aria-expanded', String(open))
    if (label.textContent !== text) { label.textContent = text; swap(label) }
    if (open) requestAnimationFrame(() => $$('textarea', els.extra).forEach(grow))
  }

  /* ---------- Материалы ---------- */
  function renderFileHints(files) {
    els.highlight.hidden = !files.highlight
    els.highlight.querySelector('p').textContent = files.highlight || ''
    els.chips.innerHTML = files.items.map(i => `<li>${i}</li>`).join('')
    els.privacyNote.hidden = !files.privacy
    els.privacyNote.textContent = files.privacy || ''
  }
  const size = b => (b < 1024 ? `${b} Б` : b < 1048576 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1048576).toFixed(1).replace('.', ',')} МБ`)
  function addFiles(list) {
    const rejected = []
    for (const file of list) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
      if (!ACCEPTED_FILES.includes(ext)) { rejected.push(`${file.name}: такой формат не принимаем`); continue }
      if (file.size > MAX_FILE_MB * 1048576) { rejected.push(`${file.name}: больше ${MAX_FILE_MB} МБ`); continue }
      if (!state.files.some(f => f.name === file.name && f.size === file.size)) state.files.push(file)
    }
    renderFiles()
    update()
    if (rejected.length) note(rejected.join('; '), true, 'files')
    else if (els.note.dataset.kind === 'files') note('')
  }
  function renderFiles() {
    els.filelist.innerHTML = ''
    state.files.forEach((file, i) => {
      const ext = (file.name.split('.').pop() || '?').toLowerCase()
      const li = document.createElement('li')
      li.className = 'bt-file'
      li.innerHTML = `<span class="bt-ext">${ext}</span><span class="bt-fmeta"><span class="bt-fname"></span><span class="bt-fsize">${size(file.size)}</span></span><button type="button" class="bt-fremove" aria-label="Убрать файл ${file.name.replace(/"/g, '')}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>`
      li.querySelector('.bt-fname').textContent = file.name
      li.querySelector('button').addEventListener('click', () => { state.files.splice(i, 1); renderFiles(); update() })
      els.filelist.append(li)
    })
  }

  /* ---------- Сроки и контакт ---------- */
  const method = () => CONTACT_METHODS.find(m => m.id === state.answers.contact_method) ?? CONTACT_METHODS[0]
  let contactInput, methodPill
  function renderClosing() {
    els.closing.innerHTML = ''
    CLOSING.forEach(q => els.closing.append(field(q)))
    // способ связи кнопками: все четыре видны сразу, выбрать можно одним нажатием.
    // Последний слой повторяет подписи тёмным на лаймовом, из него видна только плашка над выбранной кнопкой
    els.methods.innerHTML = CONTACT_METHODS.map(m => `
      <label class="bt-method"><input type="radio" name="contact_method" value="${m.id}"${m.id === method().id ? ' checked' : ''} /><span>${m.title}</span></label>`).join('')
      + `<span class="bt-methods-hl" data-clip=".65rem" aria-hidden="true">${CONTACT_METHODS.map(m => `<span>${m.title}</span>`).join('')}</span>`
    methodPill = $('.bt-methods-hl', els.methods)
    state.answers.contact_method = method().id
    markMethod(true)
    els.contact.innerHTML = `
      <label for="f_contact"></label>
      <span class="bt-hint" id="h_contact"></span>
      <input id="f_contact" name="contact" aria-describedby="h_contact" />
      <span class="bt-error" role="alert"></span>`
    contactInput = els.contact.querySelector('input')
    contactInput.value = state.answers.contact ?? ''
    contactInput.addEventListener('input', () => {
      state.answers.contact = contactInput.value
      els.contact.classList.remove('is-invalid')
      update()
      save()
    })
    applyMethod()
    els.rules.innerHTML = REVISION_RULES.map(r => `<li>${r}</li>`).join('')
  }
  function applyMethod() {
    const m = method()
    els.contact.querySelector('label').textContent = m.label
    els.contact.querySelector('.bt-hint').textContent = m.hint
    els.contact.querySelector('.bt-error').textContent = m.error
    Object.assign(contactInput, { placeholder: m.placeholder, type: m.type, inputMode: m.inputmode, autocomplete: m.autocomplete })
    els.contact.classList.remove('is-invalid')
  }
  function markMethod(instant = false) {
    const input = $('input:checked', els.methods)
    slideHl(methodPill, input && input.parentElement, instant || reduce)
  }

  /* ---------- Прогресс и шаги ---------- */
  // Считаем по обязательному минимуму, как раньше: основные вопросы, контакт и файлы.
  // Дополнительные вопросы в расчёт не идут, иначе честно заполненный бриф всегда показывал бы половину
  const filledText = id => (state.answers[id] ?? '').trim().length > 1
  function update() {
    const bank = QUESTIONS[state.type]
    const required = [...bank.main.map(q => q.id), 'contact']
    const filled = required.filter(filledText).length
    const percent = Math.min(100, Math.round(((filled + (state.files.length ? 1 : 0)) / (required.length + 1)) * 100))
    $$('[data-progress]').forEach(el => { el.textContent = percent + '%' })
    $$('[data-progress-fill]').forEach(el => { el.style.transform = `scaleX(${percent / 100})` })
    const contactOk = method().check((state.answers.contact ?? '').trim())
    const done = {
      type: true,
      questions: bank.main.every(q => filledText(q.id)),
      files: state.files.length > 0,
      contacts: contactOk,
      rules: els.consent.checked && els.privacy.checked,
    }
    Object.entries(done).forEach(([k, v]) => $(`[data-step-link="${k}"]`)?.classList.toggle('is-done', v))
  }
  // шаг, который сейчас на экране, подсвечивается слева
  function watchSteps() {
    const links = $$('[data-step-link]')
    if (!links.length) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id))
      })
    }, { rootMargin: '-35% 0px -60% 0px' })
    $$('.bt-step').forEach(s => io.observe(s))
  }

  /* ---------- Проверка и отправка ---------- */
  function note(text, isError = false, kind = '') {
    els.note.textContent = text
    els.note.classList.toggle('is-error', isError)
    els.note.dataset.kind = kind
  }
  function markInvalid(id) {
    const wrap = $(`[data-for="${id}"]`)
    wrap?.classList.add('is-invalid')
    return wrap
  }
  function validate() {
    $$('.is-invalid', form).forEach(el => el.classList.remove('is-invalid'))
    let message = ''
    const bank = QUESTIONS[state.type]
    // совсем пустой бриф отправлять бессмысленно: нужен хотя бы один ответ или файл
    if (!bank.main.some(q => (state.answers[q.id] ?? '').trim()) && !state.files.length) {
      markInvalid(bank.main[0].id)
      message ||= 'Расскажите хотя бы в двух словах, что нужно сделать'
    }
    const value = (state.answers.contact ?? '').trim()
    if (!value || !method().check(value)) {
      els.contact.classList.add('is-invalid')
      message ||= value ? method().error : 'Оставьте контакт: без него мы не сможем ответить'
    }
    if (!els.consent.checked) {
      els.consent.closest('.bt-check-row').classList.add('is-invalid')
      message ||= 'Подтвердите, что правила по правкам понятны'
    }
    // согласие на обработку данных отдельное и конкретное, так требует закон
    if (!els.privacy.checked) {
      els.privacy.closest('.bt-check-row').classList.add('is-invalid')
      message ||= 'Без согласия на обработку данных мы не сможем принять заявку'
    }
    if (message) {
      note(message, true)
      $('.is-invalid', form)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
      return false
    }
    return true
  }

  // Заявка в том же виде, что со старой страницы: только выбранный тип, ответы разложены по разделам
  function payload() {
    const bank = QUESTIONS[state.type]
    const pick = list => list.reduce((acc, q) => {
      const v = (state.answers[q.id] ?? '').trim()
      if (v) acc[q.id] = { question: q.label, answer: v }
      return acc
    }, {})
    return {
      project_type: state.type,
      project_type_title: PROJECT_TYPES.find(t => t.id === state.type).title,
      main: pick(bank.main),
      extra: pick(bank.extra),
      timeline: pick(CLOSING),
      contact: { value: (state.answers.contact ?? '').trim(), method: method().id, method_title: method().title },
      source: source().host,
      consent_revisions: els.consent.checked,
      consent_personal_data: els.privacy.checked,
      files: state.files.map(f => ({ name: f.name, size: f.size })),
    }
  }

  // Откуда пришёл человек: параметр ?from= или прошлая страница. Только наши домены, иначе выйдет открытый редирект
  function source() {
    for (const raw of [new URLSearchParams(location.search).get('from'), document.referrer]) {
      if (!raw) continue
      let host
      try { host = new URL(raw, location.origin).hostname } catch { continue }
      if (!host || host === location.hostname || !(host === 'simplemind.ru' || host.endsWith('.simplemind.ru'))) continue
      return { url: `https://${host}/`, host }
    }
    return { url: 'https://simplemind.ru/', host: 'simplemind.ru' }
  }

  /* ---------- Запасной путь: анкета одним текстом ---------- */
  // Если сервер не ответил или не принял заявку, человек отправляет ответы сам: в Telegram или письмом.
  // Текст собирается в момент нажатия, поэтому в нём всё, что поправили после ошибки
  function asText() {
    const p = payload()
    const block = (title, part) => {
      const rows = Object.values(part).map(({ question, answer }) => `• ${question}\n${answer}`)
      return rows.length ? `${title}\n${rows.join('\n\n')}` : ''
    }
    return [
      `Анкета с сайта Simple: ${p.project_type_title}`,
      block('Задача', p.main),
      block('Подробности', p.extra),
      block('Сроки', p.timeline),
      `Контакт: ${p.contact.method_title}, ${p.contact.value}`,
      p.files.length ? `Файлы: ${p.files.map(f => f.name).join(', ')} (приложите их к сообщению)` : ''
    ].filter(Boolean).join('\n\n')
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true } catch {}
    // старые браузеры и страницы без https: через скрытое поле
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed; left:-9999px; opacity:0'
    document.body.append(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    area.remove()
    return ok
  }
  let copiedTimer = 0
  function copied(ok) {
    clearTimeout(copiedTimer)
    els.copy.textContent = ok ? 'Скопировано' : 'Не получилось скопировать'
    copiedTimer = setTimeout(() => { els.copy.textContent = 'Скопировать ответы' }, 2400)
  }
  // в письмо текст кладётся целиком, если адрес письма не выходит слишком длинным; иначе он уже скопирован
  function mailHref(text) {
    const head = 'mailto:info@simplemind.ru?subject=' + encodeURIComponent('Анкета с сайта Simple') + '&body='
    const full = head + encodeURIComponent(text)
    return full.length < 1900 ? full : head + encodeURIComponent('Ответы анкеты скопированы, вставьте их сюда')
  }
  els.copy?.addEventListener('click', () => copyText(asText()).then(copied))
  // ссылки на Telegram и почту сразу копируют ответы: в чате их остаётся только вставить
  els.tg?.addEventListener('click', () => { copyText(asText()).then(copied) })
  els.mail?.addEventListener('click', () => { const text = asText(); els.mail.href = mailHref(text); copyText(text).then(copied) })

  async function submit(e) {
    e.preventDefault()
    if (state.sent || !validate()) return
    els.submit.disabled = true
    form.classList.add('is-sending')
    note('Отправляем…')
    const body = new FormData()
    body.append('payload', JSON.stringify(payload()))
    state.files.forEach(f => body.append('files', f, f.name))
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || `сервер ответил ${res.status}`), { server: true })
      // успех показываем только после настоящего сохранения на сервере
      state.sent = true
      forget()
      if (els.fallback) els.fallback.hidden = true
      form.hidden = true
      if (els.restored) els.restored.hidden = true
      els.doneId.textContent = data.id ? `Номер заявки: ${data.id}` : ''
      els.done.hidden = false
      requestAnimationFrame(() => els.done.classList.add('is-shown'))
      els.done.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    } catch (error) {
      els.submit.disabled = false
      // сеть или сервер, который не принимает запросы с этого адреса, дают только «Failed to fetch»: человеку это ничего не говорит
      note(error.server ? `Не получилось отправить анкету: ${error.message}` : 'Не получилось отправить анкету', true)
      if (els.fallback) {
        els.mail.href = mailHref(asText())
        els.fallback.hidden = false
      }
    } finally {
      form.classList.remove('is-sending')
    }
  }

  /* ---------- Запуск ---------- */
  const restored = load()
  renderTypes()
  renderQuestions()
  renderClosing()
  setMore(state.more)
  update()
  watchSteps()
  if (restored && els.restored) {
    // файлы браузер не сохраняет: если их прикладывали, просим добавить ещё раз
    if (restored.files) els.restored.querySelector('[data-restored-text]').textContent = 'Вернули ответы, которые вы начали заполнять. Файлы добавьте ещё раз'
    els.restored.hidden = false
    els.restored.querySelector('button').addEventListener('click', () => {
      forget()
      state.answers = {}
      state.type = 'site'
      markType()
      renderQuestions(true)
      renderClosing()
      setMore(false)
      update()
      els.restored.hidden = true
    }, { once: true })
  }

  // рамка и плашка ездят за кнопками, когда меняется ширина страницы или догружается шрифт
  new ResizeObserver(refitType).observe(els.types)
  new ResizeObserver(() => markMethod(true)).observe(els.methods)
  els.methods.addEventListener('change', e => {
    state.answers.contact_method = e.target.value
    applyMethod()
    markMethod()
    swap(els.contact.querySelector('label'), els.contact.querySelector('.bt-hint'))
    update()
    save()
  })
  els.moreToggle.addEventListener('click', () => { setMore(!state.more); save() })
  els.fileInput.accept = ACCEPTED_FILES.join(',')
  els.fileInput.addEventListener('change', () => { addFiles(els.fileInput.files); els.fileInput.value = '' })
  ;['dragenter', 'dragover'].forEach(t => els.dropzone.addEventListener(t, e => { e.preventDefault(); els.dropzone.classList.add('is-drag') }))
  ;['dragleave', 'drop'].forEach(t => els.dropzone.addEventListener(t, e => { e.preventDefault(); els.dropzone.classList.remove('is-drag') }))
  els.dropzone.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files) })
  // файл, брошенный мимо зоны, браузер открыл бы вместо страницы
  addEventListener('dragover', e => e.preventDefault())
  addEventListener('drop', e => e.preventDefault())
  ;[els.consent, els.privacy].forEach(c => c.addEventListener('change', () => { c.closest('.bt-check-row').classList.remove('is-invalid'); update() }))
  form.addEventListener('submit', submit)
})()
