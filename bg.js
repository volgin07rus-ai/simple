import { createShapeWaves } from './shape-waves.js'

// Фон первого экрана: тусклое поле фигур, которое под курсором вспыхивает цветом логотипа.
// Пока поле загружается и в браузере без WebGPU первый экран просто тёмный.
// Поле начинает собираться сразу. При запуске WebGPU видеокарта создаёт устройство, и около 0,4 секунды все кадры
// страницы стоят на любом железе. Сразу при загрузке это незаметно: заголовок ещё не поехал (у него задержка 0,62 с),
// панель и логотип появляются позже замирания. Запуск через 1,2 секунды попадал ровно на выезд заголовка.
// Заставка поля (проявление волной) начинается с его первого кадра
const hero = document.querySelector('.hero')
const root = document.getElementById('waves')

if (hero && root) {
  const html = document.documentElement
  // common.js ждёт первых кадров поля, чтобы потом подключить фоны ниже; если поле не запустилось, ждать нечего
  const ready = state => { html.dataset.bg = state; dispatchEvent(new Event('simple:bg-ready')) }
  createShapeWaves(root, {
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
    introDuration: 1.8,
    onReady: () => ready('ready'),
    onError: error => { console.info('[фон] ' + error.message + ', первый экран остаётся тёмным'); ready('none') }
  })
}
