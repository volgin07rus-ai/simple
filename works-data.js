// Работы: сайты, приложения и письма, которые спроектировали и собрали целиком (дизайн и разработка).
// Источник: портфолио volgin.site и публичные репозитории github.com/volgin07rus-ai
// Обложки 1000×625 лежат в assets/works/<slug>.jpg
window.WORKS = [
  {
    slug: 'nook', kind: 'app', year: '2026',
    title: 'Nook',
    desc: 'Личный менеджер задач для Windows и Android: подзадачи и повторы, напоминания, блокнот и виджет на рабочем столе. Всё хранится локально, без аккаунтов и облака',
    tech: ['Tauri', 'Rust', 'React', 'TypeScript'],
    live: 'https://github.com/volgin07rus-ai/nook/releases/latest',
    cta: 'Скачать'
  },
  {
    slug: 'partner-group', kind: 'site',
    title: 'Партнер Групп',
    desc: 'Корпоративный сайт консалтинговой компании: стратегия и управление изменениями, реструктуризация бизнеса, привлечение инвестиций. Строгая типографика и сдержанная палитра',
    tech: ['React'],
    live: 'https://prgr.pro'
  },
  {
    slug: 'domik-cafe', kind: 'site', year: '2026',
    title: 'Домик',
    desc: 'Сайт городской кофейни в центре Москвы: меню, галерея интерьеров и тёплая фактура. Кирпич, дерево и приглушённый свет',
    tech: ['HTML', 'CSS', 'GSAP'],
    live: 'https://domicafe.ru/'
  },
  {
    slug: 'lumora', kind: 'site', year: '2026',
    title: 'Lumora',
    desc: 'Сайт студии рекламной съёмки: плавный скролл, галерея кадров с перелистыванием, живые часы и форма заявки',
    tech: ['HTML', 'CSS', 'Lenis'],
    live: 'https://volgin.site/demo/lumora/index.html'
  },
  {
    slug: 'baseline', kind: 'site', year: '2026',
    title: 'Baseline',
    desc: 'Сайт теннисного клуба и академии: корты, тренеры с переключением карточек, расписание и контакты',
    tech: ['HTML', 'CSS', 'Lenis'],
    live: 'https://volgin.site/demo/baseline/index.html'
  },
  {
    slug: 'raketa', kind: 'email', year: '2026',
    title: 'Ракета',
    desc: 'Письмо-лендинг для рассылки о курсе по внедрению AI: формат письма шириной 640 px, видео вместо статичных баннеров',
    tech: ['React', 'TypeScript', 'Tailwind'],
    live: 'https://volgin.site/demo/raketa/index.html'
  },
  {
    slug: 'mesta', kind: 'app', year: '2026',
    title: 'Места',
    desc: 'Два экрана мобильного приложения: онбординг и подписка. Корпуса iPhone свёрстаны вручную, фон из видео, блоки появляются по очереди',
    tech: ['HTML', 'CSS', 'JavaScript'],
    live: 'https://volgin.site/demo/mesta/index.html',
    cta: 'Открыть прототип'
  },
  {
    slug: 'synapsex', kind: 'site', year: '2026',
    title: 'SynapseX',
    desc: 'Лендинг об эволюции интерфейсов: скролл-анимации, эффект расшифровки текста и крупный типографический водяной знак',
    tech: ['React', 'TypeScript', 'Framer Motion'],
    live: 'https://volgin.site/demo/synapsex/index.html'
  },
  {
    slug: 'studio-agency', kind: 'site', year: '2026',
    title: 'Дом',
    desc: 'Сайт парфюмерного дома: эффект жидкого стекла, кинематографичный видеофон и появление текста по буквам',
    tech: ['React', 'Tailwind', 'Framer Motion'],
    live: 'https://volgin.site/demo/studio-agency/index.html'
  },
  {
    slug: 'asme', kind: 'site', year: '2026',
    title: 'Asme',
    desc: 'Медиа-лендинг с полноэкранным видео без пауз и стеклянными карточками поверх движущегося фона',
    tech: ['React', 'Vite', 'Framer Motion'],
    live: 'https://volgin.site/demo/asme/index.html'
  },
  {
    slug: 'mindloop', kind: 'site', year: '2026',
    title: 'Mindloop',
    desc: 'Лендинг сервиса рассылок в тёмной монохромной гамме: текст проявляется по словам при прокрутке, на фоне идёт видео',
    tech: ['React', 'hls.js', 'Framer Motion'],
    live: 'https://volgin.site/demo/mindloop/index.html'
  },
  {
    slug: 'linkflow', kind: 'site', year: '2026',
    title: 'LinkFlow',
    desc: 'Сайт сервиса автоматизации процессов: видео на фоне плавно играет вперёд и назад без видимой склейки',
    tech: ['React', 'Canvas', 'Tailwind'],
    live: 'https://volgin.site/demo/linkflow/index.html'
  },
  {
    slug: 'veldara', kind: 'site', year: '2026',
    title: 'Veldara',
    desc: 'Промо-страница движка для 3D-миров в вебе: скролл-сцены, видеофон и последовательное раскрытие карточек',
    tech: ['Vite', 'CSS Animations'],
    live: 'https://volgin.site/demo/veldara/index.html'
  },
  {
    slug: 'terraelix', kind: 'site', year: '2026',
    title: 'TerraElix',
    desc: 'Лендинг велнес-бренда: заголовок плавно проявляется по словам, спокойная выверенная типографика',
    tech: ['React', 'Tailwind'],
    live: 'https://volgin.site/demo/terraelix/index.html'
  },
  {
    slug: 'creative-studio', kind: 'site', year: '2026',
    title: 'Кубики',
    desc: 'Сайт инди-игровой студии: воксельный герой на весь экран, крупная типографика и аккуратные микровзаимодействия',
    tech: ['HTML', 'CSS', 'Vite'],
    live: 'https://volgin.site/demo/creative-studio/index.html'
  },
  {
    slug: 'vetmir', kind: 'site', year: '2026',
    title: 'Ветмир',
    desc: 'Сайт ветклиники в Москве с круглосуточной скорой помощью: заголовок раскрывается через маску, карточки трёх адресов со ссылкой на Яндекс Карты, счётчики и форма записи на приём',
    tech: ['React', 'TypeScript', 'Tailwind', 'Lenis'],
    live: 'https://volgin.site/vetmir/'
  },
  {
    slug: 'uplift', kind: 'site', year: '2026',
    title: 'Uplift',
    desc: 'Сайт агентства перформанс-маркетинга с двумя сторонами, холодной и тёплой: горы в снегопаде оживают при прокрутке, а при переходе метель превращает снег в листья',
    tech: ['React', 'TypeScript', 'three.js', 'Tailwind'],
    live: 'https://volgin.site/uplift/'
  }
]

;(() => {
  const ORDER = ['partner-group', 'domik-cafe', 'vetmir', 'uplift', 'nook', 'lumora', 'baseline',
    'studio-agency', 'synapsex', 'asme', 'mindloop', 'linkflow', 'veldara', 'terraelix', 'creative-studio',
    'mesta', 'raketa']
  window.WORKS.sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug))
})()

window.WORK_KINDS = {
  site: 'Сайт',
  app: 'Приложение',
  email: 'Письмо для рассылки',
  presentation: 'Презентация',
  logo: 'Логотип'
}
