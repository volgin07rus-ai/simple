// Фон «FaultyTerminal» из React Bits: поле светящихся символов, как на старом терминале, с полосами развёртки
// и лёгкими помехами; под курсором символы вспыхивают и расходятся кругами. Перенесён без React и ogl.
// В оригинале тяжёлый шум считается для каждой точки экрана, да ещё десять раз на точку. Здесь он считается
// один раз на клетку сетки в маленькую текстуру (примерно 60 на 30), а экран только берёт из неё готовое:
// картинка та же, работы видеокарте в сотни раз меньше. Цвет лаймовый, фон прозрачный, помехи спокойнее.
// FaultyTerminal: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause
(() => {
  const hosts = document.querySelectorAll('[data-terminal]')
  if (!hosts.length) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  // Экран загрузки (common.js) ждёт первого кадра фона, а символы проявляются, только когда он ушёл.
  // До этого фон рисуется за экраном пустым: шейдеры собраны, видеокарта прогрета
  const html = document.documentElement
  let revealed = !html.classList.contains('is-loading')
  const ready = state => { if (html.dataset.bg) return; html.dataset.bg = state; dispatchEvent(new Event('simple:bg-ready')) }
  const touch = matchMedia('(pointer: coarse)').matches
  const PAD = 2   // запас клеток по краям: помехи сдвигают строки, свечение заглядывает к соседям

  const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`

  // Проход 1: яркость каждой клетки. Шум, мышь и проявление при загрузке как в оригинале
  const CELLS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float iTime;
uniform vec2  uScale;
uniform vec2  uGridMul;
uniform float uNoiseAmp;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
float time;
float noise(vec2 p){ return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; }
mat2 rotate(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float fbm(vec2 p){
  p *= 1.1;
  float f = 0.0, amp = 0.5 * uNoiseAmp;
  f += amp * noise(p); p = rotate(time * 0.02) * p * 2.0; amp *= 0.454545;
  f += amp * noise(p); p = rotate(time * 0.02) * p * 2.0; amp *= 0.454545;
  f += amp * noise(p);
  return f;
}
float pattern(vec2 p){
  vec2 q = vec2(fbm(p + vec2(1.0)), fbm(rotate(0.1 * time) * p + vec2(1.0)));
  vec2 r = vec2(fbm(rotate(0.1) * q), fbm(q));
  return fbm(p + r);
}
void main(){
  time = iTime * 0.333333;
  vec2 grid = uGridMul * 15.0;
  vec2 s = (floor(gl_FragCoord.xy) - ${PAD.toFixed(1)}) / grid;
  float intensity = pattern(s * 0.1) * 1.3 - 0.03;
  if (uUseMouse > 0.5){
    float d = distance(s, uMouse * uScale);
    float m = exp(-d * 8.0) * uMouseStrength * 10.0;
    intensity += m + sin(d * 20.0 - iTime * 5.0) * 0.1 * m;
  }
  float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
  intensity *= smoothstep(0.0, 1.0, clamp((uPageLoadProgress - cellRandom * 0.8) / 0.2, 0.0, 1.0));
  gl_FragColor = vec4(clamp(intensity, 0.0, 1.0), 0.0, 0.0, 1.0);
}`

  // Проход 2: символы на экране. Форма символа, развёртка, помехи и свечение как в оригинале, яркость клетки из текстуры
  const SCREEN = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uCells;
uniform vec2  uCellsSize;
uniform float iTime;
uniform vec2  uScale;
uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform vec3  uTint;
uniform float uBrightness;
float time;
float digit(vec2 p){
  vec2 grid = uGridMul * 15.0;
  vec2 cell = floor(p * grid);
  float intensity = texture2D(uCells, (cell + ${PAD.toFixed(1)} + 0.5) / uCellsSize).r;
  p = fract(p * grid) * uDigitSize;
  float px5 = p.x * 5.0, py5 = (1.0 - p.y) * 5.0;
  float x = fract(px5), y = fract(py5);
  float i = floor(py5) - 2.0, j = floor(px5) - 2.0;
  float isOn = step(0.1, intensity - (i * i + j * j) * 0.0625);
  float b = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * b;
}
float onOff(float a, float b, float c){ return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount; }
float displace(vec2 look){
  float y = look.y - mod(iTime * 0.25, 1.0);
  float window = 1.0 / (1.0 + 50.0 * y * y);
  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}
void main(){
  time = iTime * 0.333333;
  vec2 p = vUv * uScale;
  float bar = (step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0) * uScanlineIntensity;
  p.x += displace(p) * uGlitchAmount;
  float middle = digit(p);
  const float off = 0.002;
  float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
              digit(p + vec2(-off, 0.0)) + middle + digit(p + vec2(off, 0.0)) +
              digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));
  float v = (0.9 * middle + sum * 0.1 * bar) * uBrightness;
  vec3 col = uTint * v;
  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
}`

  const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }

  function mount(host) {
    const d = host.dataset
    const o = {
      cell: +(d.cell || 24), gridMul: [2, 1], digitSize: +(d.digit || 1.2), timeScale: +(d.speed || 0.5),
      scanline: +(d.scanline || 0.6), glitch: +(d.glitch || 0.6), flicker: +(d.flicker || 0.6), noiseAmp: 1,
      tint: hex(d.tint || '#D8FF32'), brightness: +(d.brightness || 0.36), mouseStrength: +(d.mouse || 0.25),
    }
    const canvas = document.createElement('canvas')
    canvas.className = 'bt-term-canvas'
    host.append(canvas)
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' })
    if (!gl) { canvas.remove(); ready('none'); return }

    const program = (fs) => {
      const p = gl.createProgram()
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type)
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
        gl.attachShader(p, s)
      }
      gl.bindAttribLocation(p, 0, 'position')
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
      const u = {}
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name) }
      return { p, u }
    }
    let cells, screen
    try { cells = program(CELLS); screen = program(SCREEN) } catch (e) { console.info('[терминал] ' + e.message); canvas.remove(); ready('none'); return }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // маленькая текстура с яркостью клеток: одна точка текстуры на одну клетку сетки символов
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    ;[[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v))
    const fbo = gl.createFramebuffer()
    let cellsSize = [0, 0]

    gl.useProgram(cells.p)
    gl.uniform2fv(cells.u.uGridMul, o.gridMul)
    gl.uniform1f(cells.u.uNoiseAmp, o.noiseAmp)
    gl.uniform1f(cells.u.uMouseStrength, o.mouseStrength)
    gl.uniform1f(cells.u.uUseMouse, reduce ? 0 : 1)
    gl.useProgram(screen.p)
    gl.uniform1i(screen.u.uCells, 0)
    gl.uniform2fv(screen.u.uGridMul, o.gridMul)
    gl.uniform1f(screen.u.uDigitSize, o.digitSize)
    gl.uniform1f(screen.u.uScanlineIntensity, o.scanline)
    gl.uniform1f(screen.u.uGlitchAmount, reduce ? 0 : o.glitch)
    gl.uniform1f(screen.u.uFlickerAmount, o.flicker)
    gl.uniform3fv(screen.u.uTint, o.tint)
    gl.uniform1f(screen.u.uBrightness, o.brightness)

    const mouse = { x: 0.5, y: 0.5 }, smooth = { x: 0.5, y: 0.5 }
    const offset = Math.random() * 100
    let raf = 0, timer = 0, visible = false, lastMove = 0, loadStart = 0, drawnAt = -1e9
    const lite = () => document.documentElement.classList.contains('lite')
    const calm = () => document.documentElement.classList.contains('calm')

    function resize() {
      // символы крупные и светятся: плотности полтора хватает, а точек втрое меньше, чем на ретине в полную силу
      const dpr = Math.min(devicePixelRatio || 1, lite() ? 1 : 1.5)
      canvas.width = Math.max(1, Math.round(host.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(host.clientHeight * dpr))
      // Клетка символа одного размера на любом экране (24 пикселя): в оригинале сетка всегда 45 клеток
      // в ширину, и на телефоне символы вытягивались в тонкие полоски. Поэтому масштаб свой по каждой оси
      // на телефоне клетка мельче, иначе в ширину помещается мало символов
      const cell = host.clientWidth < 640 ? o.cell * 0.75 : o.cell
      const scale = [Math.max(8, host.clientWidth / cell) / (o.gridMul[0] * 15), Math.max(6, host.clientHeight / cell) / (o.gridMul[1] * 15)]
      const size = [Math.ceil(scale[0] * o.gridMul[0] * 15) + PAD * 2 + 1, Math.ceil(scale[1] * o.gridMul[1] * 15) + PAD * 2 + 1]
      if (size[0] !== cellsSize[0] || size[1] !== cellsSize[1]) {
        cellsSize = size
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size[0], size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }
      gl.useProgram(cells.p)
      gl.uniform2fv(cells.u.uScale, scale)
      gl.useProgram(screen.p)
      gl.uniform2fv(screen.u.uScale, scale)
      gl.uniform2fv(screen.u.uCellsSize, cellsSize)
      if (!raf) draw(performance.now())
    }

    function draw(now) {
      const t = reduce ? offset * o.timeScale : (now * 0.001 + offset) * o.timeScale
      if (revealed && !loadStart) loadStart = now
      const load = reduce ? 1 : revealed ? Math.min(1, (now - loadStart) / 2000) : 0
      smooth.x += (mouse.x - smooth.x) * 0.08
      smooth.y += (mouse.y - smooth.y) * 0.08
      // проход 1: яркость клеток в маленькую текстуру
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, cellsSize[0], cellsSize[1])
      gl.useProgram(cells.p)
      gl.uniform1f(cells.u.iTime, t)
      gl.uniform2f(cells.u.uMouse, smooth.x, smooth.y)
      gl.uniform1f(cells.u.uPageLoadProgress, load)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // проход 2: символы на экран
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(screen.p)
      gl.uniform1f(screen.u.iTime, t)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      ready('ready')
    }

    function tick(now) {
      raf = 0
      if (!visible || document.hidden || reduce) return
      // Мышь стоит или это телефон: узор меняется медленно, хватает 30 кадров в секунду (на слабом компьютере 20).
      // Следующий такой кадр заказываем таймером: страница не просыпается на каждом обновлении экрана
      const loading = now - loadStart < 2100
      const idle = !loading && (touch || now - lastMove > 1500)
      // спокойный режим на совсем слабом компьютере (common.js): без движения мыши символы стоят и кадров нет
      if (idle && calm()) return
      const gap = idle ? (lite() ? 1000 / 20 : 1000 / 30) : 1000 / 60
      if (now - drawnAt >= gap * 0.7) { drawnAt = now; draw(now) }
      if (idle) timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(tick) }, gap - 8)
      else raf = requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!visible || reduce) return
      if (timer) { clearTimeout(timer); timer = 0 }
      if (!raf) raf = requestAnimationFrame(tick)
    }

    resize()
    new ResizeObserver(resize).observe(host)
    addEventListener('simple:lite', resize)
    addEventListener('simple:revealed', () => { revealed = true; loadStart = 0; kick() }, { once: true })
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick() }).observe(host)
    document.addEventListener('visibilitychange', kick)
    addEventListener('mousemove', e => {
      const r = host.getBoundingClientRect()
      mouse.x = (e.clientX - r.left) / r.width
      mouse.y = 1 - (e.clientY - r.top) / r.height
      // мышь двинулась после паузы: сразу полная частота кадров
      if (performance.now() - lastMove > 1500) kick()
      lastMove = performance.now()
    }, { passive: true })
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); visible = false })
  }

  hosts.forEach(mount)
})()
