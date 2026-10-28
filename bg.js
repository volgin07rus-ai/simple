// Фон первого экрана на главной и на брифе. Какой фон, решает атрибут data-hero-bg у первого экрана:
//   ascii — свет из символов (GradientASCII, gradient-ascii.js), с 28 октября проба на главной;
//   waves — поле фигур (ShapeWaves, shape-waves.js), раньше стояло на главной, теперь на брифе.
// Сравнить без правки файлов: дописать к адресу ?bg=waves или ?bg=ascii. Вернуть главной поле фигур:
// в index.html поставить data-hero-bg="waves" (и подсказки modulepreload в начале файла поменять обратно).
// Пока фон загружается и в браузере без WebGL2 или WebGPU первый экран просто тёмный.
// Фон начинает собираться сразу: при запуске видеокарта ненадолго занята, и пусть это будет до того,
// как поедет заголовок (у него задержка 0,62 с), а не посреди его выезда
const scene = document.querySelector('[data-hero-bg]')
const root = scene?.querySelector('.waves')

// Свет из символов в цветах Simple: от тёмной оливы через лайм логотипа к светлому лайму.
// Свет поднимается снизу (rise) на всех экранах, верх с заголовком остаётся тёмным. Пробовали затмение
// (тёмный диск в кольце за панелью со схемой), горизонт и полосу: владелец выбрал свет снизу
// На телефоне и планшете (первый экран в одну колонку) свет поднят на десятую часть высоты экрана,
// на компьютере стоит ниже, как было
const narrow = matchMedia('(max-width: 1024px)')
const asciiLift = () => ({ lift: narrow.matches ? 0.1 : 0 })
const ASCII = {
  shape: 'rise',
  scale: 1,
  colors: ['#1d2409', '#5d7410', '#a8cc1d', '#D8FF32', '#efffc4'],
  characters: ' =+xX0S8#@',
  cellSize: 16,
  density: 0.8,
  glyphOpacity: 0.85,
  gradientOpacity: 0.5,
  glow: 0.2,
  flicker: 0.2,
  softness: 0.55,
  flow: 0.5,
  speed: 0.8,
  grain: 0.06,
  scrambleRadius: 0.1,
  clickEffect: 'wave',
  intro: true
}

// Поле фигур: тусклое, под курсором вспыхивает цветом логотипа
const WAVES = {
  shapes: 'mixed',
  cellSize: 10,
  dotSize: 0.72,
  color: '#1e2119',          // чуть светлее фона, чтобы поле почти сливалось с ним
  hoverColor: '#D8FF32',     // цвет логотипа
  backgroundColor: '#070807',
  speed: 0.8,
  scale: 1.1,
  contrast: 1,
  brightness: 0.4,
  fade: 0.3,
  interactive: true,
  splashRadius: 32,
  splashStrength: 0.3,
  glow: 0.3,
  intro: true,
  introDuration: 1.8
}

if (scene && root) {
  const html = document.documentElement
  // common.js ждёт первых кадров фона, чтобы потом подключить фоны ниже; если фон не запустился, ждать нечего
  const ready = state => { if (html.dataset.bg) return; html.dataset.bg = state; dispatchEvent(new Event('simple:bg-ready')) }
  const fail = error => { console.info('[фон] ' + error.message + ', первый экран остаётся тёмным'); ready('none') }
  const asked = new URLSearchParams(location.search).get('bg')
  const mode = asked === 'ascii' || asked === 'waves' ? asked : scene.dataset.heroBg
  scene.dataset.heroBgMode = mode
  const hooks = { onReady: () => ready('ready'), onError: fail }
  if (mode === 'ascii') import('./gradient-ascii.js').then(m => {
    const bg = m.createGradientAscii(root, { ...ASCII, ...asciiLift(), ...hooks })
    narrow.addEventListener('change', () => bg.update(asciiLift()))
  }, fail)
  else import('./shape-waves.js').then(m => m.createShapeWaves(root, { ...WAVES, ...hooks }), fail)
}
