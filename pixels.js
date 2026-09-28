// Фон из пикселей: PixelBlast из React Bits, перенесён без React и three.js, на чистом WebGL2.
// Шум складывается в пятна из точек, которые медленно перетекают. Как поле на первом экране: точки
// приглушённого лайма, под курсором и в волне от клика загораются ярким лаймом. Пятна лежат в пустых местах страницы,
// под всем содержимым, и гаснут к краям. Настройки берутся из data-атрибутов у [data-pixels].
// PixelBlast: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause
(() => {
  const hosts = [...document.querySelectorAll('[data-pixels]')]
  if (!hosts.length || !window.WebGL2RenderingContext) return
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const SHAPES = { square: 0, circle: 1, triangle: 2, diamond: 3 }
  const MAX_CLICKS = 10, MAX_TRAIL = 16
  const TRAIL_LIFE = 1.4     // сколько секунд горит след курсора
  const RIPPLE_LIFE = 4      // и волна от клика

  const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }

  const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

  // Шейдер PixelBlast как в оригинале. Добавлено: лаймовый след курсора (uTrail), лаймовые волны
  // и мягкое затухание пятна к краям вместо прямоугольного
  const FRAG = `#version 300 es
precision highp float;
uniform vec3  uColor;
uniform vec3  uHot;
uniform vec2  uResolution;
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
uniform int   uShapeType;
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
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;
  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);
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
    float d = distance(gl_FragCoord.xy, tp.xy);
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
  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float coverage = bw * (1.0 + (h - 0.5) * uPixelJitter);
  float M;
  if (uShapeType == 1) M = maskCircle(pixelUV, coverage);
  else if (uShapeType == 2) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == 3) M = maskDiamond(pixelUV, coverage);
  else M = coverage;

  // пятно гаснет к краям плавно, без прямых срезов
  vec2 q = abs(gl_FragCoord.xy / uResolution * 2.0 - 1.0);
  float rr = pow(pow(q.x, 2.5) + pow(q.y, 2.5), 0.4);
  M *= 1.0 - smoothstep(max(0.0, 1.0 - uFade * 2.2), 1.0, rr);

  vec3 col = mix(uColor, uHot, clamp(hot, 0.0, 1.0));
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

    const shader = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
      return s
    }
    const prog = gl.createProgram()
    try {
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
    } catch (e) {
      console.info('[пиксели] ' + e.message)
      canvas.remove()
      return null
    }
    gl.useProgram(prog)
    // один треугольник на весь холст
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const u = name => gl.getUniformLocation(prog, name)
    const U = {
      res: u('uResolution'), time: u('uTime'), now: u('uNow'), size: u('uPixelSize'), radius: u('uHotRadius'),
      clicks: u('uClickPos[0]'), clickTimes: u('uClickTimes[0]'), trail: u('uTrail[0]')
    }
    gl.uniform3fv(u('uColor'), o.color)
    gl.uniform3fv(u('uHot'), o.hot)
    gl.uniform1f(u('uScale'), o.scale)
    gl.uniform1f(u('uDensity'), o.density)
    gl.uniform1f(u('uPixelJitter'), o.jitter)
    gl.uniform1i(u('uEnableRipples'), reduce ? 0 : 1)
    gl.uniform1f(u('uRippleSpeed'), 0.4)
    gl.uniform1f(u('uRippleThickness'), 0.12)
    gl.uniform1f(u('uRippleIntensity'), 1.5)
    gl.uniform1f(u('uFade'), o.fade)
    gl.uniform1i(u('uShapeType'), o.shape)

    const clicks = new Float32Array(MAX_CLICKS * 2).fill(-1)
    const clickTimes = new Float32Array(MAX_CLICKS)
    const trail = new Float32Array(MAX_TRAIL * 3).fill(-1)
    let clickIx = 0, trailIx = 0, dpr = 1, lastX = -1e4, lastY = -1e4, lastAt = 0
    let hotUntil = 0, dirty = true, dead = false
    const offset = Math.random() * 1000
    const t0 = performance.now()
    const clock = now => (now - t0) / 1000
    const patternTime = now => offset + (reduce ? 0 : clock(now) * o.speed)

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); dead = true })

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(U.res, w, h)
      gl.uniform1f(U.size, o.size * dpr)
      gl.uniform1f(U.radius, o.radius * dpr)
      dirty = true
    }
    resize()
    new ResizeObserver(resize).observe(host)

    return {
      host,
      visible: false,
      get dead() { return dead },
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
      // Рисуем каждый кадр, пока горит след или идёт волна; в покое узор меняется медленно, хватает каждого второго кадра
      render(now, frame) {
        if (dead) return
        const active = now < hotUntil
        if (reduce ? !(dirty || active) : !active && frame % 2 && !dirty) return
        dirty = false
        gl.uniform1f(U.time, patternTime(now))
        gl.uniform1f(U.now, clock(now))
        gl.uniform2fv(U.clicks, clicks)
        gl.uniform1fv(U.clickTimes, clickTimes)
        gl.uniform3fv(U.trail, trail)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
  }

  // Холсты создаются, когда пятно впервые показалось на экране, и рисуются, только пока видны
  const live = []
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      let inst = live.find(l => l.host === e.target)
      if (!inst && e.isIntersecting) {
        inst = mount(e.target)
        if (!inst) { io.unobserve(e.target); return }
        live.push(inst)
      }
      if (inst) inst.visible = e.isIntersecting
    })
    kick()
  }, { rootMargin: '120px 0px' })
  hosts.forEach(h => io.observe(h))

  let raf = 0, frame = 0
  function loop(now) {
    raf = 0
    if (document.hidden) return
    frame++
    let any = false
    live.forEach(l => { if (l.visible && !l.dead) { any = true; l.render(now, frame) } })
    if (any) raf = requestAnimationFrame(loop)
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop) }
  document.addEventListener('visibilitychange', kick)

  // Курсор и клики слушаем на всём окне: пятна лежат под содержимым, до них самих события не доходят
  const pick = (e, fn) => {
    const now = performance.now()
    live.forEach(l => {
      if (!l.visible || l.dead) return
      const r = l.host.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      if (x < -60 || y < -60 || x > r.width + 60 || y > r.height + 60) return
      l[fn](x, y, now)
    })
    kick()
  }
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pick(e, 'trail') }, { passive: true })
  addEventListener('pointerdown', e => pick(e, 'click'), { passive: true })
})()
