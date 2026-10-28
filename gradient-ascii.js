// GradientASCII из React Bits без React: градиентный свет, собранный из символов. Свет медленно дышит,
// под курсором символы перемешиваются, от клика расходится волна. На WebGL2, пять проходов: поле света
// в четверти разрешения (оно плавное, мельче не нужно), клетки символов (по точке на клетку), ореол в четверти с размытием, итог в полном
// с символами из атласа.
// Дополнено под сайт: шрифт Onest, плотность пикселей ограничена, вне экрана и в скрытой вкладке кадров нет,
// символы считаются по клеткам, а не по пикселям, кадров не больше 30 в секунду (свет движется медленно),
// а пока под курсором перемешиваются символы, сколько даёт экран. На слабом компьютере (класс lite, common.js)
// ещё и без ореола и плотность пикселей 1, в спокойном режиме (calm) один кадр.
// GradientASCII: Copyright (c) 2026 David Haz, React Bits, MIT + Commons Clause

const MAX_COLORS = 8
const MAX_CLICKS = 4
const MAX_TRAIL = 24
const CLICK_LIFE = 1.2
const TRAIL_LIFE = 0.7
const TRAIL_STEP = 0.015
const INTRO_SECONDS = 2.4
const ATLAS_CELL_W = 60
const ATLAS_CELL_H = 100
const ATLAS_COLUMNS = 16
const FONT_SCALE = 0.78
const SHAPES = { horizon: 0, pinch: 1, rise: 2, eclipse: 3 }
const CLICK_EFFECTS = { none: 0, wave: 1, burst: 2 }

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const COMMON = `
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`

const FIELD = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uTime;
uniform int uShape;
uniform vec3 uRamp[8];
uniform int uCount;
uniform float uScale;
uniform float uSoftness;
uniform float uFlow;
uniform vec2 uSeed;
uniform vec4 uTrail[24];
uniform float uRadius;
uniform vec4 uClicks[4];
uniform int uClickEffect;
uniform float uIntro;
uniform float uFrame;
uniform float uLift;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAux;
${COMMON}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i), f);
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 labToRgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 horizon(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 1.0);
  float x = p.x / span;
  float arch = -0.17 - 0.2 * x * x + 0.02 * sin(time * 0.6);
  float soft = mix(0.05, 0.22, uSoftness);
  float edge = p.y - arch;
  float rim = 0.38 * smoothstep(-soft, 0.42, edge);
  vec2 sun = vec2(0.08 * sin(time * 0.31) * span, 0.58);
  float spread = length((p - sun) / vec2(0.95 * span, 0.75));
  float sky = mix(0.55, 1.0, smoothstep(0.2, 0.95, spread));
  order = clamp(edge * 1.3, 0.0, 1.0);
  return vec3(rim, sky, smoothstep(0.18, 0.62, edge));
}

vec3 pinch(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 0.75);
  float x = p.x / span;
  float sway = 0.02 * sin(x * 1.7 + time * 0.55);
  float breathe = 1.0 + 0.06 * sin(time * 0.8);
  float width = (0.13 + 0.22 * x * x) * breathe * mix(0.85, 1.2, uSoftness);
  float y = abs(p.y - sway) / width;
  float t = exp(-pow(y, 2.2)) * (0.42 + 0.58 * exp(-x * x * 1.8));
  order = clamp(abs(p.y - sway) * 2.4 + abs(x) * 0.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec3 rise(vec2 p, float time, out float order) {
  float wide = max(uAspect, 0.9);
  vec2 center = vec2(0.05 * sin(time * 0.45) * wide, -0.7 + uLift);
  vec2 radius = vec2(0.82 * wide, 0.64 * (1.0 + 0.04 * sin(time * 0.8)));
  float d = length((p - center) / radius);
  float soft = mix(0.6, 1.15, uSoftness);
  float t = clamp(pow(clamp(1.0 - d, 0.0, 1.0), soft) * 1.35, 0.0, 1.0);
  order = clamp((d - 0.2) * 1.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec3 eclipse(vec2 p, float time, out float order) {
  float fit = min(1.0, uAspect * 1.25);
  float r = 0.23 * fit * (1.0 + 0.015 * sin(time * 0.9));
  float angle = atan(p.y, p.x);
  float rays = noise(vec2(cos(angle), sin(angle)) * 2.2 + time * 0.08) * 0.8 + 0.6;
  float d = length(p) - r;
  float reach = mix(0.07, 0.15, uSoftness) * rays * fit;
  float t = smoothstep(-0.006, 0.006 + 0.02 * uSoftness, d) * exp(-max(d, 0.0) / reach);
  order = clamp(d * 2.0, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec4 tone(float t) {
  float x = smoothstep(0.3, 1.0, t) * float(uCount - 1);
  int index = int(floor(x));
  return vec4(mix(uRamp[index], uRamp[min(index + 1, uCount - 1)], fract(x)), smoothstep(0.0, 0.38, t));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float time = uTime;
  vec2 q = p / uScale;
  vec2 warp = vec2(
    noise(q * 1.6 + uSeed + vec2(0.0, time * 0.3)),
    noise(q * 1.6 + uSeed.yx + vec2(4.3, -time * 0.24))
  ) - 0.5;
  q += warp * uFlow * (uShape == 3 ? 0.04 : 0.18);
  float order = 0.0;
  vec3 shape;
  if (uShape == 0) shape = horizon(q, time, order);
  else if (uShape == 1) shape = pinch(q, time, order);
  else if (uShape == 2) shape = rise(q, time, order);
  else shape = eclipse(q, time, order);

  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);

  float scramble = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 point = uTrail[i];
    if (point.z <= 0.0) continue;
    vec2 d = p - point.xy;
    scramble = max(scramble, point.z * exp(-dot(d, d) / (uRadius * uRadius)));
  }
  for (int i = 0; i < 4; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(p - c.xy);
    if (uClickEffect == 1) {
      scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.06, 2.0)) * c.w);
    } else if (uClickEffect == 2) {
      float size = 0.08 + 0.22 * (1.0 - exp(-c.z * 5.0));
      scramble = max(scramble, (1.0 - smoothstep(size * 0.6, size, d)) * c.w);
    }
  }
  vec2 t = clamp(shape.xy * mix(0.7, 1.0, reveal), 0.0, 1.0);
  vec4 mixed = mix(tone(t.x), tone(t.y), shape.z);
  vec3 color = encode(labToRgb(mixed.rgb));
  float alpha = mixed.a * reveal;
  float dither = (hash12(gl_FragCoord.xy + uFrame * 13.7) - 0.5) / 255.0;
  outColor = clamp(vec4(color * alpha + dither, alpha + dither), 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`

// Своё: всё, что зависит только от клетки (какой символ, цвет, мерцание, перемешивание), считается один раз
// на клетку, в маленькой текстуре размером в число клеток. В исходнике это считалось для каждого пикселя,
// а в клетке 16 px их сотни. Пиксельным проходам остаётся взять клетку и вырезать из атласа форму символа
const CELLS = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform sampler2D uAux;
uniform vec2 uResolution;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform float uCount;
uniform float uDensity;
uniform float uOpacity;
uniform float uFlicker;
uniform float uDepth;
uniform float uGlyphTime;
uniform float uSeedValue;
uniform float uLight;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outGlyph;
${COMMON}
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = clamp(((cell + 0.5) * uCell + uOffset) / uResolution, vec2(0.0), vec2(1.0));
  vec4 field = texture(uField, uv);
  vec4 aux = texture(uAux, uv);
  vec3 visible = uLight > 0.5 ? field.rgb + (1.0 - field.a) : field.rgb;
  float luma = dot(visible, vec3(0.2126, 0.7152, 0.0722));
  float value = uLight > 0.5 ? clamp((1.0 - luma) * 1.5, 0.0, 1.0) : luma;
  float pick = hash12(cell + uSeedValue * 7.31);
  float level = hash12(cell * 1.73 + 4.1 + uSeedValue);
  float tick = floor(uGlyphTime * 9.0 + level * 9.0);
  float wobble = (hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker * 0.4 + (level - 0.5) * 0.1;
  float tone = clamp(pow(value, 0.75) + wobble, 0.0, 1.0);
  float index = floor(tone * (uCount - 1.0) + 0.5);
  float decode = max(aux.g, 1.0 - aux.r);
  if (decode > 0.02) {
    float frame = floor(uGlyphTime * 20.0);
    if (hash12(cell * 3.7 + frame * 5.3) < decode * 1.25) index = 1.0 + floor(hash12(cell + frame * 1.37) * (uCount - 1.0));
  }
  float present = step(pick, uDensity * mix(1.0, 0.3 + tone * 1.1, 0.55));
  float cutoff = smoothstep(0.03, 0.1, value);
  float focus = step(hash12(cell * 0.71 + 9.2 + uSeedValue), uDepth);
  float alpha = uOpacity * present * cutoff * mix(1.0, 0.35 + 0.65 * level, 0.55) * (1.0 - focus * 0.5);
  if (uLight < 0.5) {
    vec3 light = field.rgb * 0.55 + vec3(0.03) * field.a;
    outColor = vec4(light * alpha, 0.6 * field.a * alpha);
  } else {
    outColor = vec4(visible * 0.8 * alpha, alpha);
  }
  outGlyph = vec4(index / 255.0, focus, 0.0, 1.0);
}`

const GLYPHS = `
uniform sampler2D uCells;
uniform sampler2D uCellGlyph;
uniform sampler2D uAtlas;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform vec2 uAtlasGrid;
${COMMON}
float sampleGlyph(float index, vec2 local, vec2 dx, vec2 dy, float soft) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + 1.0 - local.y) / uAtlasGrid.y);
  float scale = exp2(soft);
  return textureGrad(uAtlas, atlasUv, dx * scale, dy * scale).a;
}

vec4 glyphAt(vec2 px) {
  vec2 coord = (px - uOffset) / uCell;
  vec2 cell = floor(coord);
  // производные считаются до ветвления: в пустой клетке атлас не нужен, и пиксель выходит сразу
  vec2 continuous = coord / uAtlasGrid;
  vec2 dx = dFdx(continuous), dy = dFdy(continuous);
  ivec2 at = clamp(ivec2(cell), ivec2(0), textureSize(uCells, 0) - 1);
  vec4 color = texelFetch(uCells, at, 0);
  if (color == vec4(0.0)) return color;
  vec4 glyph = texelFetch(uCellGlyph, at, 0);
  return color * sampleGlyph(floor(glyph.r * 255.0 + 0.5), coord - cell, dx, dy, glyph.g * 1.2);
}
`

const HALO = `#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform sampler2D uHalo;
uniform float uLight;
uniform float uGlow;
uniform float uGradient;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  vec4 base = texture(uField, vUv) * uGradient;
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 halo = texture(uHalo, vUv) * uGlow;
  vec4 color;
  if (uLight < 0.5) {
    color = base + glyph + halo;
  } else {
    color = glyph + base * (1.0 - glyph.a);
    color += halo * 0.6 * (1.0 - color.a);
  }
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  float body = clamp(color.a, 0.0, 1.0);
  color.rgb += grain * (0.25 + body) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
}`

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const toLinear = value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
const toLab = ([r, g, b]) => {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  gl.deleteShader(shader)
  return null
}

function link(gl, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null }
  const uniforms = {}
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    if (!info) continue
    const name = info.name.replace(/\[0\]$/, '')
    uniforms[name] = gl.getUniformLocation(program, name)
  }
  return { program, uniforms }
}

function createTarget(gl, count) {
  const textures = Array.from({ length: count }, () => {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  })
  return { textures, framebuffer: gl.createFramebuffer(), width: 0, height: 0 }
}

function sizeTarget(gl, target, width, height) {
  if (target.width === width && target.height === height) return
  target.width = width
  target.height = height
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
  target.textures.forEach((texture, i) => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0)
  })
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

function buildAtlas(gl, characters, fontFamily) {
  const list = [...new Set([...characters].filter(char => char !== '\n' && char !== '\r'))]
  if (!list.length) list.push(' ')
  const font = `300 ${Math.round(ATLAS_CELL_H * FONT_SCALE)}px ${fontFamily}`
  const columns = Math.min(ATLAS_COLUMNS, list.length)
  const rows = Math.ceil(list.length / columns)
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_CELL_W * columns
  canvas.height = ATLAS_CELL_H * rows
  const context = canvas.getContext('2d')
  if (context) {
    context.font = font
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#fff'
    list.forEach((char, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      context.fillText(char, column * ATLAS_CELL_W + ATLAS_CELL_W / 2, row * ATLAS_CELL_H + ATLAS_CELL_H / 2 + 3)
    })
  }
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return { texture, count: list.length, grid: [columns, rows] }
}

const DEFAULTS = {
  colors: ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8'],
  shape: 'horizon',
  characters: ' =+xX0S8#@',
  cellSize: 18,
  density: 0.8,
  glyphOpacity: 0.85,
  glow: 0.2,
  depthOfField: 0,
  flicker: 0.2,
  softness: 0.5,
  scale: 1,
  lift: 0,              // своё: насколько поднять источник света формы rise, в долях высоты
  flow: 0.5,
  speed: 1,
  gradientOpacity: 0.9,
  grain: 0.08,
  variation: 0,
  mouseInteraction: true,
  scrambleRadius: 0.1,
  clickEffect: 'wave',
  intro: true,
  lightMode: false,
  fontFamily: "'Onest', system-ui, sans-serif",
  maxDpr: 1.5,          // символы мелкие: на плотных экранах нужна чёткость, но не вся плотность
  onReady: null,        // первый кадр нарисован
  onError: null         // WebGL2 нет или шейдеры не собрались
}

export function createGradientAscii(container, options = {}) {
  const html = document.documentElement
  const s = { ...DEFAULTS, ...options }
  const fail = message => { s.onError?.(new Error(message)); const d = () => {}; d.update = () => {}; return d }

  container.classList.add('gradient-ascii')
  const canvas = document.createElement('canvas')
  canvas.className = 'gradient-ascii__canvas'
  canvas.setAttribute('aria-hidden', 'true')
  container.appendChild(canvas)
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (!gl) { canvas.remove(); return fail('WebGL2 недоступен') }

  const field = link(gl, FIELD), cells = link(gl, CELLS), halo = link(gl, HALO), blur = link(gl, BLUR), composite = link(gl, COMPOSITE)
  if (!field || !cells || !halo || !blur || !composite) { canvas.remove(); return fail('шейдеры не собрались') }
  const vao = gl.createVertexArray()
  const fieldTarget = createTarget(gl, 2), cellTarget = createTarget(gl, 2), haloA = createTarget(gl, 1), haloB = createTarget(gl, 1)

  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const parse = value => {
    if (!probe) return [0, 0, 0]
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = '#000000'
    probe.fillStyle = String(value)
    probe.fillRect(0, 0, 1, 1)
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
    return [r / 255, g / 255, b / 255]
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const lite = () => html.classList.contains('lite')
  const calm = () => html.classList.contains('calm')
  const view = { width: 1, height: 1, ratio: 1 }
  const ramp = new Float32Array(MAX_COLORS * 3)
  const clickData = new Float32Array(MAX_CLICKS * 4), clicks = []
  const trailData = new Float32Array(MAX_TRAIL * 4), trail = []
  const pointer = { x: 0, y: 0, inside: false }
  let atlas = null, atlasKey = '', paletteKey = '', count = 2
  let time = 0, glyphTime = 0, introClock = s.intro && !reduce ? 0 : 1
  let frameSeed = 0, grainClock = 0, raf = 0, last = 0, drawnAt = 0
  let visible = true, disposed = false, readySent = false

  const still = () => reduce || calm()

  function syncAtlas() {
    const key = `${s.fontFamily}|${s.characters}`
    if (key === atlasKey && atlas) return
    atlasKey = key
    if (atlas) gl.deleteTexture(atlas.texture)
    atlas = buildAtlas(gl, s.characters, s.fontFamily)
    // шрифт мог ещё не загрузиться: когда загрузится, атлас пересобирается
    document.fonts?.load?.(`300 64px ${s.fontFamily}`, s.characters).then(() => {
      if (disposed || atlasKey !== key) return
      if (atlas) gl.deleteTexture(atlas.texture)
      atlas = buildAtlas(gl, s.characters, s.fontFamily)
      draw()
    }, () => {})
  }

  function syncPalette() {
    const colors = (s.colors?.length ? s.colors : DEFAULTS.colors).slice(0, MAX_COLORS)
    const list = colors.length > 1 ? colors : [colors[0], colors[0]]
    const key = list.join(',')
    if (key === paletteKey) return
    paletteKey = key
    count = list.length
    list.forEach((color, i) => ramp.set(toLab(parse(color)), i * 3))
  }

  // сетка клеток по холсту: размер клетки, сколько их, сдвиг, чтобы сетка стояла по центру
  function grid() {
    const height = clamp(s.cellSize, 6, 64) * view.ratio
    const width = height * (ATLAS_CELL_W / ATLAS_CELL_H)
    const columns = Math.ceil(canvas.width / width), rows = Math.ceil(canvas.height / height)
    return { width, height, columns, rows, x: (canvas.width - columns * width) / 2, y: (canvas.height - rows * height) / 2 }
  }

  // пиксельные проходы: клетка плюс форма символа из атласа
  function bindGlyphs(program, g) {
    const u = program.uniforms
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cellTarget.textures[0]); gl.uniform1i(u.uCells, 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cellTarget.textures[1]); gl.uniform1i(u.uCellGlyph, 1)
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlas.texture); gl.uniform1i(u.uAtlas, 2)
    gl.uniform2f(u.uCell, g.width, g.height)
    gl.uniform2f(u.uOffset, g.x, g.y)
    gl.uniform2f(u.uAtlasGrid, atlas.grid[0], atlas.grid[1])
  }

  // проход клеток: что за символ в каждой клетке и какого он цвета
  function bindCells(g) {
    const u = cells.uniforms
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[0]); gl.uniform1i(u.uField, 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[1]); gl.uniform1i(u.uAux, 1)
    gl.uniform2f(u.uResolution, canvas.width, canvas.height)
    gl.uniform2f(u.uCell, g.width, g.height)
    gl.uniform2f(u.uOffset, g.x, g.y)
    gl.uniform1f(u.uCount, atlas.count)
    gl.uniform1f(u.uDensity, clamp(s.density, 0, 1))
    gl.uniform1f(u.uOpacity, clamp(s.glyphOpacity, 0, 1))
    gl.uniform1f(u.uFlicker, still() ? 0 : clamp(s.flicker, 0, 1))
    gl.uniform1f(u.uDepth, clamp(s.depthOfField, 0, 1))
    gl.uniform1f(u.uGlyphTime, glyphTime)
    gl.uniform1f(u.uSeedValue, Math.max(0, s.variation))
    gl.uniform1f(u.uLight, s.lightMode ? 1 : 0)
  }

  function draw() {
    if (disposed) return
    const aspect = view.width / view.height
    syncAtlas()
    syncPalette()
    gl.bindVertexArray(vao)
    gl.disable(gl.BLEND)

    gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.framebuffer)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    gl.viewport(0, 0, fieldTarget.width, fieldTarget.height)
    gl.useProgram(field.program)
    const fu = field.uniforms
    gl.uniform1f(fu.uAspect, aspect)
    gl.uniform1f(fu.uTime, time)
    gl.uniform1i(fu.uShape, SHAPES[s.shape] ?? 0)
    gl.uniform3fv(fu.uRamp, ramp)
    gl.uniform1i(fu.uCount, count)
    gl.uniform1f(fu.uScale, clamp(s.scale, 0.4, 2.5))
    gl.uniform1f(fu.uSoftness, clamp(s.softness, 0, 1))
    gl.uniform1f(fu.uFlow, clamp(s.flow, 0, 2))
    gl.uniform2f(fu.uSeed, s.variation * 3.17, s.variation * 1.91)
    gl.uniform4fv(fu.uTrail, trailData)
    gl.uniform1f(fu.uRadius, clamp(s.scrambleRadius, 0.02, 0.4))
    gl.uniform4fv(fu.uClicks, clickData)
    gl.uniform1i(fu.uClickEffect, CLICK_EFFECTS[s.clickEffect] ?? 1)
    gl.uniform1f(fu.uIntro, introClock)
    gl.uniform1f(fu.uFrame, frameSeed)
    if (fu.uLift) gl.uniform1f(fu.uLift, s.lift)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    const g = grid()
    sizeTarget(gl, cellTarget, g.columns, g.rows)
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellTarget.framebuffer)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    gl.viewport(0, 0, g.columns, g.rows)
    gl.useProgram(cells.program)
    bindCells(g)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    const glowing = s.glow > 0.001 && !lite()
    if (glowing) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer)
      gl.drawBuffers([gl.COLOR_ATTACHMENT0])
      gl.viewport(0, 0, haloA.width, haloA.height)
      gl.useProgram(halo.program)
      bindGlyphs(halo, g)
      gl.uniform1f(halo.uniforms.uDownscale, canvas.width / haloA.width)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.useProgram(blur.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1i(blur.uniforms.uSource, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloB.framebuffer)
      gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0])
      gl.uniform2f(blur.uniforms.uStep, 1 / haloA.width, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer)
      gl.bindTexture(gl.TEXTURE_2D, haloB.textures[0])
      gl.uniform2f(blur.uniforms.uStep, 0, 1 / haloA.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(composite.program)
    bindGlyphs(composite, g)
    const cu = composite.uniforms
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0])
    gl.uniform1i(cu.uHalo, 3)
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[0])
    gl.uniform1i(cu.uField, 4)
    gl.uniform1f(cu.uLight, s.lightMode ? 1 : 0)
    gl.uniform1f(cu.uGlow, glowing ? clamp(s.glow, 0, 2) : 0)
    gl.uniform1f(cu.uGradient, clamp(s.gradientOpacity, 0, 1))
    gl.uniform1f(cu.uGrain, clamp(s.grain, 0, 0.4))
    gl.uniform1f(cu.uFrame, frameSeed)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    if (!readySent) {
      readySent = true
      container.dataset.ready = 'true'
      s.onReady?.()
    }
  }

  function resize() {
    view.width = Math.max(1, container.clientWidth)
    view.height = Math.max(1, container.clientHeight)
    view.ratio = Math.min(window.devicePixelRatio || 1, lite() ? 1 : s.maxDpr)
    canvas.width = Math.max(1, Math.round(view.width * view.ratio))
    canvas.height = Math.max(1, Math.round(view.height * view.ratio))
    sizeTarget(gl, fieldTarget, Math.max(1, Math.round(canvas.width / 4)), Math.max(1, Math.round(canvas.height / 4)))
    const hw = Math.max(1, Math.round(canvas.width / 4)), hh = Math.max(1, Math.round(canvas.height / 4))
    sizeTarget(gl, haloA, hw, hh)
    sizeTarget(gl, haloB, hw, hh)
    draw()
    wake()
  }

  function updateInput(dt) {
    trail.forEach(point => { point.age += dt })
    while (trail.length && trail[trail.length - 1].age > TRAIL_LIFE) trail.pop()
    for (let i = 0; i < MAX_TRAIL; i++) {
      const point = trail[i]
      if (!point) { trailData[i * 4 + 2] = 0; continue }
      const k = 1 - point.age / TRAIL_LIFE
      trailData.set([point.x, point.y, k * k, 0], i * 4)
    }
    clicks.forEach(click => { click.age += dt })
    while (clicks.length && clicks[clicks.length - 1].age > CLICK_LIFE) clicks.pop()
    for (let i = 0; i < MAX_CLICKS; i++) {
      const click = clicks[i]
      if (!click) { clickData[i * 4 + 3] = 0; continue }
      const k = click.age / CLICK_LIFE
      const envelope = Math.min(1, click.age / 0.08) * (1 - k) * (1 - k)
      clickData.set([click.x, click.y, click.age, envelope], i * 4)
    }
  }

  function frame(now) {
    raf = 0
    if (disposed || !visible || document.hidden) return
    // свет движется медленно, и 30 кадров в секунду ему хватает даже на мониторе в 144 Гц. Пока под курсором
    // перемешиваются символы или идёт волна от клика, кадров столько, сколько даёт экран, на слабом компьютере всегда 30
    const stirred = clicks.length > 0 || trail.length > 0
    if ((lite() || !stirred) && drawnAt && now - drawnAt < 1000 / 30 - 2) { raf = requestAnimationFrame(frame); return }
    drawnAt = now
    const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 60
    last = now
    if (!still()) {
      time += dt * Math.max(0, s.speed) * 0.5
      glyphTime += dt * Math.max(s.speed, 0.15)
    }
    if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS)
    grainClock += dt
    if (!still() && grainClock > 1 / 24) { grainClock = 0; frameSeed = (frameSeed + 1) % 97 }
    updateInput(dt)
    draw()
    const busy = !still() || introClock < 1 || clicks.length > 0 || trail.length > 0
    if (busy) raf = requestAnimationFrame(frame)
    else last = 0
  }

  function wake() {
    if (!raf && !disposed && visible && !document.hidden) raf = requestAnimationFrame(frame)
  }

  function locate(event) {
    const rect = container.getBoundingClientRect()
    const x = (event.clientX - rect.left) / Math.max(1, rect.width)
    const y = 1 - (event.clientY - rect.top) / Math.max(1, rect.height)
    const aspect = rect.width / Math.max(1, rect.height)
    pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
    pointer.x = (x - 0.5) * aspect
    pointer.y = y - 0.5
  }

  function onPointerMove(event) {
    if (!s.mouseInteraction || still() || event.pointerType === 'touch') return
    locate(event)
    if (!pointer.inside) return
    const head = trail[0]
    const gap = head ? Math.hypot(pointer.x - head.x, pointer.y - head.y) : Infinity
    if (gap < TRAIL_STEP) return
    if (head && head.age < 0.1) {
      const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)))
      for (let i = 1; i <= steps; i++) {
        const k = i / (steps + 1)
        trail.unshift({ x: head.x + (pointer.x - head.x) * k, y: head.y + (pointer.y - head.y) * k, age: 0 })
      }
    }
    trail.unshift({ x: pointer.x, y: pointer.y, age: 0 })
    trail.length = Math.min(trail.length, MAX_TRAIL)
    wake()
  }

  function onPointerDown(event) {
    if (!CLICK_EFFECTS[s.clickEffect] || still()) return
    locate(event)
    if (!pointer.inside) return
    clicks.unshift({ x: pointer.x, y: pointer.y, age: 0 })
    if (clicks.length > MAX_CLICKS) clicks.pop()
    wake()
  }

  const onVisibility = () => { last = 0; wake() }
  // смена режима (common.js): облегчённый снижает плотность пикселей, спокойный оставляет один кадр
  const onTier = () => { resize() }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  const intersection = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible) { last = 0; wake() }
  })
  intersection.observe(container)
  addEventListener('pointermove', onPointerMove, { passive: true })
  addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  addEventListener('simple:lite', onTier)
  addEventListener('simple:tier', onTier)
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; disposed = true })
  resize()

  const dispose = () => {
    disposed = true
    cancelAnimationFrame(raf)
    resizeObserver.disconnect()
    intersection.disconnect()
    removeEventListener('pointermove', onPointerMove)
    removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('visibilitychange', onVisibility)
    removeEventListener('simple:lite', onTier)
    removeEventListener('simple:tier', onTier)
    ;[fieldTarget, cellTarget, haloA, haloB].forEach(target => {
      target.textures.forEach(texture => gl.deleteTexture(texture))
      gl.deleteFramebuffer(target.framebuffer)
    })
    if (atlas) gl.deleteTexture(atlas.texture)
    gl.deleteVertexArray(vao)
    ;[field, cells, halo, blur, composite].forEach(item => gl.deleteProgram(item.program))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.remove()
  }
  dispose.update = patch => { Object.assign(s, patch); if (!disposed) { draw(); wake() } }
  return dispose
}
