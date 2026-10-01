// Фон из пикселей: PixelBlast из React Bits, перенесён без React и three.js, на чистом WebGL2.
// Шум складывается в пятна из точек, которые медленно перетекают. Как поле на первом экране: точки
// приглушённого лайма, под курсором и в волне от клика загораются ярким лаймом. Пятна лежат в пустых местах страницы,
// под всем содержимым, и гаснут к краям. Настройки берутся из data-атрибутов у [data-pixels].
// Чтобы не нагружать видеокарту: узор меняется от точки к точке, а не от пикселя к пикселю. Поэтому тяжёлый шум,
// след курсора и волны считаются один раз на точку узора в маленькую текстуру (проход 1), а холст только рисует
// кружки по готовым значениям (проход 2): вид тот же, работы видеокарте примерно в 20 раз меньше.
// Шейдеры собираются в фоне и заранее, пока человек смотрит первый экран. Раньше пятно собирало шейдер в момент
// появления, и страница на это время замирала: на MacBook это и были рывки на «Узнаёте ситуацию», услугах и чеке
// PixelBlast: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause
(() => {
  const hosts = [...document.querySelectorAll('[data-pixels]')]
  if (!hosts.length || !window.WebGL2RenderingContext) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const lite = () => document.documentElement.classList.contains('lite')
  const calm = () => document.documentElement.classList.contains('calm')
  const SHAPES = { square: 0, circle: 1, triangle: 2, diamond: 3 }
  const MAX_CLICKS = 10, MAX_TRAIL = 16
  const TRAIL_LIFE = 1.4     // сколько секунд горит след курсора
  const RIPPLE_LIFE = 4      // и волна от клика

  const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }

  const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

  // Проход 1: одна точка текстуры на одну точку узора. Шум, след курсора и волны как в оригинальном PixelBlast,
  // посчитанные в центре точки. Добавлено: лаймовый след курсора (uTrail), лаймовые волны и мягкое затухание
  // пятна к краям вместо прямоугольного. На выходе: заполнение точки, доля лайма и затухание к краю
  const CELLS = `#version 300 es
precision highp float;
uniform vec2  uResolution;
uniform vec2  uOrigin;
uniform float uTime;
uniform float uNow;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uFade;
uniform float uHotRadius;
const int MAX_CLICKS = ${MAX_CLICKS};
const int MAX_TRAIL = ${MAX_TRAIL};
uniform vec2  uClickPos[MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];
uniform vec3  uTrail[MAX_TRAIL];
out vec4 fragColor;

float Bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

float hash11(float n){ return fract(sin(n) * 43758.5453); }
float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}
float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0, freq = 1.0, sum = 1.0;
  for (int i = 0; i < 5; ++i){
    sum += amp * vnoise(p * freq);
    freq *= 1.25;
  }
  return sum * 0.5 + 0.5;
}

void main(){
  float pixelSize = uPixelSize;
  vec2 pixelId = floor(gl_FragCoord.xy) + uOrigin;
  vec2 fragCoord = (pixelId + 0.5) * pixelSize;      // центр точки, отсчёт от середины холста, как в оригинале
  vec2 canvasCoord = fragCoord + uResolution * .5;   // он же в координатах холста
  float aspectRatio = uResolution.x / uResolution.y;
  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;
  float feed = base + (uDensity - 0.5) * 0.3;

  // след курсора: точки вокруг него проступают гуще и загораются лаймом
  float hot = 0.0;
  for (int i = 0; i < MAX_TRAIL; ++i){
    vec3 tp = uTrail[i];
    float age = uNow - tp.z;
    if (tp.x < 0.0 || age < 0.0 || age > ${TRAIL_LIFE.toFixed(2)}) continue;
    float d = distance(canvasCoord, tp.xy);
    float k = 1.0 - age / ${TRAIL_LIFE.toFixed(2)};
    hot = max(hot, exp(-d * d / (2.0 * uHotRadius * uHotRadius)) * k * k);
  }
  feed += hot * 0.45;

  if (uEnableRipples == 1){
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float ring = exp(-pow((r - uRippleSpeed * t) / uRippleThickness, 2.0));
      float amt = ring * exp(-t) * exp(-10.0 * r) * uRippleIntensity;
      feed = max(feed, amt);
      hot = max(hot, amt);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);
  float h = fract(sin(dot(pixelId, vec2(127.1, 311.7))) * 43758.5453);
  float coverage = bw * (1.0 + (h - 0.5) * uPixelJitter);

  // пятно гаснет к краям плавно, без прямых срезов
  vec2 q = abs(canvasCoord / uResolution * 2.0 - 1.0);
  float rr = pow(pow(q.x, 2.5) + pow(q.y, 2.5), 0.4);
  float fade = 1.0 - smoothstep(max(0.0, 1.0 - uFade * 2.2), 1.0, rr);

  fragColor = vec4(coverage / 1.5, clamp(hot, 0.0, 1.0), fade, 1.0);
}`

  // Проход 2: каждая точка холста берёт значения своей точки узора и рисует фигуру
  const DOTS = `#version 300 es
precision highp float;
uniform sampler2D uCells;
uniform vec2  uResolution;
uniform vec2  uOrigin;
uniform float uPixelSize;
uniform vec3  uColor;
uniform vec3  uHot;
uniform int   uShapeType;
out vec4 fragColor;

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}
float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d = p.y - r * (1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d / aa, 0.0, 1.0);
}
float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  vec2 pixelId = floor(fragCoord / uPixelSize);
  vec2 pixelUV = fract(fragCoord / uPixelSize);
  vec4 cell = texelFetch(uCells, ivec2(pixelId - uOrigin), 0);
  float coverage = cell.r * 1.5;
  float M;
  if (uShapeType == 1) M = maskCircle(pixelUV, coverage);
  else if (uShapeType == 2) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == 3) M = maskDiamond(pixelUV, coverage);
  else M = coverage;
  M *= cell.b;
  vec3 col = mix(uColor, uHot, cell.g);
  fragColor = vec4(col * M, M);
}`

  function mount(host) {
    const d = host.dataset
    const o = {
      color: hex(d.color || '#3f4a17'),   // лайм, приглушённый до фона: видно, но не спорит с текстом
      hot: hex(d.hot || '#D8FF32'),
      shape: SHAPES[d.shape] ?? 1,
      size: +(d.size || 6),
      scale: +(d.scale || 3),
      density: +(d.density || 1.2),
      jitter: +(d.jitter || 0.5),
      speed: +(d.speed || 0.6),
      fade: +(d.fade || 0.3),
      radius: +(d.radius || 46)
    }
    const canvas = document.createElement('canvas')
    host.append(canvas)
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' })
    if (!gl) { canvas.remove(); return null }

    // Собираем программы и не ждём: с KHR_parallel_shader_compile видеокарта собирает их в фоне,
    // а готовность проверяем в кадре. Без расширения первая проверка подождёт сборку, но это случится заранее
    const parallel = gl.getExtension('KHR_parallel_shader_compile')
    const build = fs => {
      const p = gl.createProgram()
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type)
        gl.shaderSource(s, src)
        gl.compileShader(s)
        gl.attachShader(p, s)
      }
      gl.bindAttribLocation(p, 0, 'aPos')
      gl.linkProgram(p)
      return p
    }
    const cells = { p: build(CELLS) }, dots = { p: build(DOTS) }

    const clicks = new Float32Array(MAX_CLICKS * 2).fill(-1)
    const clickTimes = new Float32Array(MAX_CLICKS)
    const trail = new Float32Array(MAX_TRAIL * 3).fill(-1)
    let clickIx = 0, trailIx = 0, dpr = 1, lastX = -1e4, lastY = -1e4, lastAt = 0
    let hotUntil = 0, dirty = true, dead = false, ready = false, drawnAt = -1e9
    let tex = null, fbo = null, cellsW = 0, cellsH = 0
    const offset = Math.random() * 1000
    const t0 = performance.now()
    const clock = now => (now - t0) / 1000
    const patternTime = now => offset + (reduce ? 0 : clock(now) * o.speed)

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); dead = true })

    function prepare() {
      if (ready || dead) return ready
      if (parallel && !(gl.getProgramParameter(cells.p, parallel.COMPLETION_STATUS_KHR) && gl.getProgramParameter(dots.p, parallel.COMPLETION_STATUS_KHR))) return false
      for (const { p } of [cells, dots]) {
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          console.info('[пиксели] ' + gl.getProgramInfoLog(p))
          dead = true
          canvas.remove()
          return false
        }
      }
      // один треугольник на весь холст для обоих проходов
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      for (const prog of [cells, dots]) {
        prog.u = {}
        const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS)
        for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(prog.p, i).name; prog.u[name.replace('[0]', '')] = gl.getUniformLocation(prog.p, name) }
      }
      gl.useProgram(cells.p)
      gl.uniform1f(cells.u.uScale, o.scale)
      gl.uniform1f(cells.u.uDensity, o.density)
      gl.uniform1f(cells.u.uPixelJitter, o.jitter)
      gl.uniform1i(cells.u.uEnableRipples, reduce ? 0 : 1)
      gl.uniform1f(cells.u.uRippleSpeed, 0.4)
      gl.uniform1f(cells.u.uRippleThickness, 0.12)
      gl.uniform1f(cells.u.uRippleIntensity, 1.5)
      gl.uniform1f(cells.u.uFade, o.fade)
      gl.useProgram(dots.p)
      gl.uniform1i(dots.u.uCells, 0)
      gl.uniform3fv(dots.u.uColor, o.color)
      gl.uniform3fv(dots.u.uHot, o.hot)
      gl.uniform1i(dots.u.uShapeType, o.shape)
      // маленькая текстура: одна точка текстуры на одну точку узора
      tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      ;[[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
        .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v))
      fbo = gl.createFramebuffer()
      ready = true
      resize()
      return true
    }

    function resize() {
      // Плотность не выше 1,5: пиксельный узор на ретине выглядит так же, а точек почти вдвое меньше,
      // на слабом компьютере (класс lite) плотность 1
      dpr = Math.min(devicePixelRatio || 1, lite() ? 1 : 1.5)
      const w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      dirty = true
      if (!ready) return
      // номера точек узора считаются от середины холста, как в оригинале: первая и последняя по каждой оси
      const px = o.size * dpr
      const x0 = Math.floor((0.5 - w / 2) / px), x1 = Math.floor((w / 2 - 0.5) / px)
      const y0 = Math.floor((0.5 - h / 2) / px), y1 = Math.floor((h / 2 - 0.5) / px)
      if (x1 - x0 + 1 !== cellsW || y1 - y0 + 1 !== cellsH) {
        cellsW = x1 - x0 + 1
        cellsH = y1 - y0 + 1
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cellsW, cellsH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }
      for (const prog of [cells, dots]) {
        gl.useProgram(prog.p)
        gl.uniform2f(prog.u.uResolution, w, h)
        gl.uniform2f(prog.u.uOrigin, x0, y0)
        gl.uniform1f(prog.u.uPixelSize, px)
      }
      gl.useProgram(cells.p)
      gl.uniform1f(cells.u.uHotRadius, o.radius * dpr)
    }
    resize()
    new ResizeObserver(resize).observe(host)

    return {
      host,
      visible: false,
      resize,
      // браузер без сборки в фоне: ждём сборку сейчас, в свободное время, а не в момент появления пятна
      warm() { if (!parallel) prepare() },
      get dead() { return dead },
      // спокойный режим: холст убираем и отдаём его память видеокарте
      drop() { if (dead) return; dead = true; gl.getExtension('WEBGL_lose_context')?.loseContext(); canvas.remove() },
      // пока шейдеры собираются, заглядываем каждый кадр; потом кадры нужны, только пока горит след или волна
      hot: now => !ready || now < hotUntil || dirty,
      // след курсора в координатах холста: от левого нижнего угла, в пикселях устройства
      trail(x, y, now) {
        if (Math.hypot(x - lastX, y - lastY) < 5 && now - lastAt < 40) return
        lastX = x; lastY = y; lastAt = now
        const i = trailIx * 3
        trail[i] = x * dpr
        trail[i + 1] = (host.clientHeight - y) * dpr
        trail[i + 2] = clock(now)
        trailIx = (trailIx + 1) % MAX_TRAIL
        hotUntil = Math.max(hotUntil, now + TRAIL_LIFE * 1000)
        dirty = true
      },
      click(x, y, now) {
        if (reduce) return
        clicks[clickIx * 2] = x * dpr
        clicks[clickIx * 2 + 1] = (host.clientHeight - y) * dpr
        clickTimes[clickIx] = patternTime(now)
        clickIx = (clickIx + 1) % MAX_CLICKS
        hotUntil = Math.max(hotUntil, now + RIPPLE_LIFE * 1000)
        dirty = true
      },
      // Пока горит след или идёт волна, рисуем до 60 кадров в секунду; в покое узор меняется медленно, хватает 30
      render(now) {
        if (dead || !prepare()) return
        const active = now < hotUntil
        const gap = active ? 1000 / 60 : lite() ? 1000 / 20 : 1000 / 30
        if (reduce ? !(dirty || active) : !dirty && now - drawnAt < gap * 0.7) return
        drawnAt = now
        dirty = false
        // проход 1: значения точек узора в маленькую текстуру
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
        gl.viewport(0, 0, cellsW, cellsH)
        gl.useProgram(cells.p)
        gl.uniform1f(cells.u.uTime, patternTime(now))
        gl.uniform1f(cells.u.uNow, clock(now))
        gl.uniform2fv(cells.u.uClickPos, clicks)
        gl.uniform1fv(cells.u.uClickTimes, clickTimes)
        gl.uniform3fv(cells.u.uTrail, trail)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        // проход 2: фигуры на холст
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.useProgram(dots.p)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
  }

  // Холсты рисуются, только пока пятно на экране. Создаём их заранее, по одному в свободное время после загрузки,
  // чтобы шейдеры собрались до того, как человек докрутит до пятна. Показалось раньше: создаём сразу
  const live = []
  const mountHost = host => {
    if ('pxInst' in host) return host.pxInst
    if (calm()) return null   // спокойный режим на слабом компьютере (common.js): фона из пикселей нет
    const inst = mount(host)
    host.pxInst = inst
    if (inst) live.push(inst)
    return inst
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const inst = e.isIntersecting ? mountHost(e.target) : e.target.pxInst
      if (inst) inst.visible = e.isIntersecting
    })
    kick()
  }, { rootMargin: '120px 0px' })
  hosts.forEach(h => io.observe(h))
  const idle = window.requestIdleCallback ? fn => requestIdleCallback(fn, { timeout: 2000 }) : fn => setTimeout(fn, 200)
  const mountAll = () => {
    const queue = [...hosts]
    const next = () => {
      const h = queue.shift()
      if (!h) return
      if (!('pxInst' in h)) {
        mountHost(h)?.warm()
        io.unobserve(h); io.observe(h)   // заново наблюдаем, чтобы узнать, видно ли пятно
      }
      idle(next)
    }
    idle(next)
  }
  // с экраном загрузки ждём, пока отыграют заставки первого экрана: сборка шейдеров не должна им мешать
  if (document.documentElement.classList.contains('is-loading')) addEventListener('simple:revealed', () => setTimeout(mountAll, 2600), { once: true })
  else addEventListener('load', () => setTimeout(mountAll, 600))

  // Пока горит след, кадр на каждом обновлении экрана; в покое следующий кадр заказываем таймером,
  // чтобы страница не просыпалась 60–165 раз в секунду ради кадров, которые всё равно пропускаются
  let raf = 0, timer = 0
  function loop(now) {
    raf = 0
    if (document.hidden) return
    let any = false, hot = false
    live.forEach(l => { if (l.visible && !l.dead) { any = true; l.render(now); if (l.hot(now)) hot = true } })
    if (!any) return
    if (hot) raf = requestAnimationFrame(loop)
    else timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(loop) }, (lite() ? 1000 / 20 : 1000 / 30) - 8)
  }
  function kick() {
    if (timer) { clearTimeout(timer); timer = 0 }
    if (!raf) raf = requestAnimationFrame(loop)
  }
  document.addEventListener('visibilitychange', kick)
  // слабый компьютер (common.js): холсты переходят на плотность 1, а в спокойном режиме убираются совсем
  addEventListener('simple:lite', () => live.forEach(l => l.dead || l.resize()))
  addEventListener('simple:tier', () => { if (calm()) live.forEach(l => l.drop()) })

  // Курсор и клики слушаем на всём окне: пятна лежат под содержимым, до них самих события не доходят
  const pick = (e, fn) => {
    const now = performance.now()
    let touched = false
    live.forEach(l => {
      if (!l.visible || l.dead) return
      const r = l.host.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      if (x < -60 || y < -60 || x > r.width + 60 || y > r.height + 60) return
      l[fn](x, y, now)
      touched = true
    })
    // курсор далеко от пятен: кадры не нужны
    if (touched) kick()
  }
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pick(e, 'trail') }, { passive: true })
  addEventListener('pointerdown', e => pick(e, 'click'), { passive: true })
})()
