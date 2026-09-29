import { createShapeWaves } from './shape-waves.js'

// Фон первого экрана: тусклое поле фигур, которое под курсором вспыхивает цветом логотипа.
// Пока поле загружается и в браузере без WebGPU первый экран просто тёмный.
const hero = document.querySelector('.hero')
const root = document.getElementById('waves')

if (hero && root) {
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
    onError: error => console.info('[фон] ' + error.message + ', первый экран остаётся тёмным')
  })
}
