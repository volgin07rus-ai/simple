import { createDriftWall } from './drift-wall.js'

// Блок «Сайты и приложения»: работы на наклонной стене, колонки плывут навстречу друг другу.
// Плитка ведёт на живую работу, все работы с описаниями лежат на works.html
const root = document.getElementById('works-wall')
const WORKS = window.WORKS || []
const KINDS = window.WORK_KINDS || {}
const openLabel = window.workOpenLabel || (() => 'Открыть')

if (root && WORKS.length) {
  createDriftWall(root, {
    items: WORKS.map(w => ({
      image: `assets/works/${w.slug}.jpg`,
      title: w.title,
      caption: KINDS[w.kind] || '',
      href: w.live,
      label: `${openLabel(w)} ${w.title}, откроется в новой вкладке`
    })),
    label: 'Работы Simple',
    tilt: 16,
    variance: 0.45,
    fade: 0.6,
    overlayColor: '#070807',
    // Размеры в rem сайта: стена растёт и сжимается вместе с остальной вёрсткой.
    // Обложки 16 : 10, плитка тех же пропорций
    responsive: ({ width }) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const phone = innerWidth <= 640, tablet = innerWidth <= 1024
      const tileWidth = rem * (phone ? 10.5 : tablet ? 19 : 17)
      const gap = rem * (phone ? 0.75 : 1.1)
      return {
        tileWidth,
        tileHeight: tileWidth / 1.6,
        gap,
        radius: rem * (phone ? 0.7 : 0.9),
        // На широких экранах дальний левый край уходит вглубь и сужается: запасная колонка закрывает его
        columns: Math.min(9, Math.max(3, Math.ceil(width / (tileWidth + gap)) + (innerWidth > 1024 ? 1 : 0))),
        turn: phone ? -10 : -14,
        perspective: rem * 75,
        depth: rem * 7.5,
        lift: rem * (phone ? 2.5 : 4),
        speed: rem * 2,
        // на телефоне нет наведения, поэтому плитки в покое светлее
        dim: phone ? 0.72 : 0.55,
        parallax: phone ? 0 : 0.6
      }
    }
  })
}
