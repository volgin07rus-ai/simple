import { createShapeWaves } from './shape-waves.js'

// Фон первого экрана: тусклое поле фигур, которое под курсором вспыхивает цветом логотипа.
// Пока поле загружается и в браузере без WebGPU первый экран просто тёмный.
// С экраном загрузки (common.js) поле собирается и рисует первые кадры за ним, целиком и без заставки:
// так видеокарта успевает прогреться. Заставка поля начинается, когда экран загрузки уходит (simple:revealed)
const hero = document.querySelector('.hero')
const root = document.getElementById('waves')

if (hero && root) {
  const html = document.documentElement
  const gated = html.classList.contains('is-loading')
  // экран загрузки ждёт первых кадров поля; если поле не запустилось, ждать нечего
  const ready = state => { html.dataset.bg = state; dispatchEvent(new Event('simple:bg-ready')) }
  const waves = createShapeWaves(root, {
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
    intro: !gated,
    introDuration: 1.8,
    onReady: () => ready('ready'),
    onError: error => { console.info('[фон] ' + error.message + ', первый экран остаётся тёмным'); ready('none') }
  })
  if (gated) addEventListener('simple:revealed', () => waves.update({ intro: true }), { once: true })
}
