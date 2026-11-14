// OMNI//GRID v3 content layer (obsidian far, cedar middle, khaki near): each game's machine as a robot-perception point cloud,
// coloured by depth (khaki near, cedar middle, obsidian far). One WebGL draw call, no assets.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const MORPH_MS = 1400;
  const SCAN_MS = 1100;
  const TONES = { neutral: [0.89, 0.86, 0.75], gain: [0.71, 0.81, 0.59], bust: [0.85, 0.47, 0.35] };

  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const jit = (r, s) => (r() - 0.5) * s;
  const rx = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rz = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
  const circleXY = (r, rad, j) => { const a = r() * TAU; return [Math.cos(a) * rad + jit(r, j), Math.sin(a) * rad + jit(r, j), jit(r, j)]; };
  const circleXZ = (r, rad, j) => { const a = r() * TAU; return [Math.cos(a) * rad + jit(r, j), jit(r, j), Math.sin(a) * rad + jit(r, j)]; };
  const sphere = (r, rad) => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); return [s * Math.cos(a) * rad, u * rad, s * Math.sin(a) * rad]; };

  function rrect(r, w, h, rad, j) {
    const hw = w / 2, hh = h / 2, sw = w - 2 * rad, sh = h - 2 * rad, q = Math.PI * rad / 2;
    const L = [sw, q, sh, q, sw, q, sh, q];
    let t = r() * (2 * sw + 2 * sh + 4 * q), k = 0;
    while (k < 7 && t > L[k]) { t -= L[k]; k++; }
    let x, y, a;
    switch (k) {
      case 0: x = -hw + rad + t; y = hh; break;
      case 1: a = Math.PI / 2 - t / rad; x = hw - rad + Math.cos(a) * rad; y = hh - rad + Math.sin(a) * rad; break;
      case 2: x = hw; y = hh - rad - t; break;
      case 3: a = -t / rad; x = hw - rad + Math.cos(a) * rad; y = -hh + rad + Math.sin(a) * rad; break;
      case 4: x = hw - rad - t; y = -hh; break;
      case 5: a = -Math.PI / 2 - t / rad; x = -hw + rad + Math.cos(a) * rad; y = -hh + rad + Math.sin(a) * rad; break;
      case 6: x = -hw; y = -hh + rad + t; break;
      default: a = Math.PI - t / rad; x = -hw + rad + Math.cos(a) * rad; y = hh - rad + Math.sin(a) * rad;
    }
    return [x + jit(r, j), y + jit(r, j), jit(r, j)];
  }
  function box(r, w, h, d, j) {
    const A = [w * h, w * h, w * d, w * d, h * d, h * d];
    let t = r() * (A[0] * 2 + A[2] * 2 + A[4] * 2), k = 0;
    while (k < 5 && t > A[k]) { t -= A[k]; k++; }
    const u = r() - 0.5, v = r() - 0.5;
    const p = [[u * w, v * h, d / 2], [u * w, v * h, -d / 2], [u * w, h / 2, v * d], [u * w, -h / 2, v * d], [w / 2, u * h, v * d], [-w / 2, u * h, v * d]][k];
    return [p[0] + jit(r, j), p[1] + jit(r, j), p[2] + jit(r, j)];
  }
  function boxEdge(r, w, h, d, j) {
    const hx = w / 2, hy = h / 2, hz = d / 2, e = Math.floor(r() * 12), t = r() * 2 - 1;
    let p;
    if (e < 4) p = [t * hx, e & 1 ? hy : -hy, e & 2 ? hz : -hz];
    else if (e < 8) p = [e & 1 ? hx : -hx, t * hy, e & 2 ? hz : -hz];
    else p = [e & 1 ? hx : -hx, e & 2 ? hy : -hy, t * hz];
    return [p[0] + jit(r, j), p[1] + jit(r, j), p[2] + jit(r, j)];
  }
  function star(r, R, ri, k) {
    const e = Math.floor(r() * k * 2), t = r();
    const a0 = e * Math.PI / k, a1 = (e + 1) * Math.PI / k, r0 = e % 2 ? ri : R, r1 = (e + 1) % 2 ? ri : R;
    return [Math.cos(a0) * r0 * (1 - t) + Math.cos(a1) * r1 * t, Math.sin(a0) * r0 * (1 - t) + Math.sin(a1) * r1 * t, 0];
  }
  function arch(r, w, h, z) {
    const rad = w / 2, post = h - rad, total = 2 * post + Math.PI * rad;
    let t = r() * total, x, y;
    if (t < post) { x = -rad; y = -h / 2 + t; }
    else if (t < 2 * post) { x = rad; y = -h / 2 + t - post; }
    else { const a = (t - 2 * post) / rad; x = Math.cos(a) * rad; y = -h / 2 + post + Math.sin(a) * rad; }
    return [x + jit(r, 0.012), y + jit(r, 0.012), z + jit(r, 0.012)];
  }
  function card(r, angle, dx, dz, withStar) {
    const q = r();
    let p;
    if (q < 0.6) p = rrect(r, 0.92, 1.32, 0.09, 0.006);
    else if (q < 0.78) p = rrect(r, 0.74, 1.14, 0.06, 0.006);
    else if (withStar && q < 0.97) p = star(r, 0.25, 0.13, 8);
    else p = [(r() - 0.5) * 0.84, (r() - 0.5) * 1.24, jit(r, 0.01)];
    p = rz(p, angle);
    return [p[0] + dx, p[1] - 0.05, p[2] + dz];
  }
  function pick(parts, r, n) {
    const total = parts.reduce((s, p) => s + p[0], 0), out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x = r() * total, k = 0;
      while (k < parts.length - 1 && x > parts[k][0]) { x -= parts[k][0]; k++; }
      const p = parts[k][1]();
      out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2];
    }
    return out;
  }

  const SHAPES = {
    core: (r, n) => pick([
      [0.36, () => sphere(r, 0.95)],
      [0.2, () => rx(rz(circleXZ(r, 1.42, 0.025), 0.35), 0.15)],
      [0.14, () => rx(rz(circleXZ(r, 1.7, 0.02), -0.55), -0.1)],
      [0.12, () => { const p = circleXY(r, 0.42 + r() * 0.06, 0.01); return [p[0], p[1], 0.96]; }],
      [0.06, () => { const p = circleXY(r, 0.18, 0.01); return [p[0], p[1], 0.98]; }],
      [0.12, () => { const p = sphere(r, 1.9 + r() * 0.9); return [p[0], p[1] * 0.6, p[2]]; }],
    ], r, n),
    grid: (r, n) => pick([
      [0.78, () => {
        const i = Math.floor(r() * 25), cx = (i % 5 - 2) * 0.44, cy = (Math.floor(i / 5) - 2) * 0.44;
        const p = r() < 0.72 ? rrect(r, 0.36, 0.36, 0.08, 0.006) : [(r() - 0.5) * 0.28, (r() - 0.5) * 0.28, jit(r, 0.01)];
        return rx([p[0] + cx, p[1] + cy, p[2]], -0.55);
      }],
      [0.12, () => rx(rrect(r, 2.36, 2.36, 0.18, 0.01), -0.55)],
      [0.1, () => rx([(r() - 0.5) * 2.7, (r() - 0.5) * 2.7, -0.14 + jit(r, 0.02)], -0.55)],
    ], r, n),
    crash: (r, n) => pick([
      [0.5, () => { const t = r(); return [-1.1 + t * 2.2, -1.0 + 0.09 * Math.exp(3.1 * t), jit(r, 0.06)]; }],
      [0.14, () => [-1.15 + r() * 2.35, -1.05, jit(r, 0.02)]],
      [0.11, () => [-1.15, -1.05 + r() * 2.3, jit(r, 0.02)]],
      [0.13, () => { const p = sphere(r, 0.13); return [1.1 + p[0], 1.0 + p[1], p[2]]; }],
      [0.12, () => [-1.15 + r() * 2.35, -1.05 + Math.floor(r() * 5) * 0.5, jit(r, 0.01)]],
    ], r, n),
    cards: (r, n) => pick([
      [0.32, () => card(r, 0.32, -0.62, -0.2, false)],
      [0.36, () => card(r, 0, 0, 0.06, true)],
      [0.32, () => card(r, -0.32, 0.62, -0.2, false)],
    ], r, n),
    door: (r, n) => pick([
      [0.28, () => arch(r, 1.15, 2.0, 0.7)],
      [0.22, () => arch(r, 1.15, 2.0, -0.1)],
      [0.17, () => arch(r, 1.15, 2.0, -0.9)],
      [0.11, () => arch(r, 1.15, 2.0, -1.7)],
      [0.14, () => [(Math.floor(r() * 5) - 2) * 0.29, -1.0, 0.8 - r() * 2.7]],
      [0.08, () => [-0.58 + r() * 1.16, -1.0, 0.8 - Math.floor(r() * 6) * 0.5]],
    ], r, n),
    robot: (r, n) => pick([
      [0.2, () => { const p = r() < 0.65 ? boxEdge(r, 0.8, 0.6, 0.55, 0.008) : box(r, 0.8, 0.6, 0.55, 0.008); return [p[0], p[1] + 0.92, p[2]]; }],
      [0.06, () => [-0.26 + r() * 0.52, 0.94 + jit(r, 0.012), 0.29]],
      [0.03, () => [jit(r, 0.01), 1.22 + r() * 0.22, jit(r, 0.01)]],
      [0.26, () => { const p = r() < 0.6 ? boxEdge(r, 1.1, 0.95, 0.62, 0.008) : box(r, 1.1, 0.95, 0.62, 0.008); return [p[0], p[1] + 0.06, p[2]]; }],
      [0.07, () => { const p = circleXY(r, 0.16, 0.006); return [p[0], p[1] + 0.12, 0.32]; }],
      [0.08, () => { const s = r() < 0.5 ? -1 : 1, p = sphere(r, 0.2); return [s * 0.74 + p[0], 0.42 + p[1], p[2]]; }],
      [0.18, () => { const s = r() < 0.5 ? -1 : 1, t = r(), a = r() * TAU; return [s * (0.8 + 0.1 * t) + Math.cos(a) * 0.09, 0.3 - t * 0.95, Math.sin(a) * 0.09]; }],
      [0.12, () => { const p = circleXZ(r, 0.75 + r() * 0.06, 0.01); return [p[0], -0.62, p[2]]; }],
    ], r, n),
    vault: (r, n) => pick([
      [0.26, () => circleXY(r, 1.12, 0.01)],
      [0.12, () => circleXY(r, 1.0, 0.01)],
      [0.14, () => { const a = Math.floor(r() * 8) * TAU / 8, p = circleXY(r, 0.075, 0.004); return [Math.cos(a) * 0.84 + p[0], Math.sin(a) * 0.84 + p[1], 0.05]; }],
      [0.12, () => { const p = circleXY(r, 0.34, 0.006); return [p[0], p[1], 0.12]; }],
      [0.08, () => { const a = Math.floor(r() * 24) * TAU / 24, t = 0.38 + r() * 0.06; return [Math.cos(a) * t, Math.sin(a) * t, 0.12]; }],
      [0.12, () => { const a = Math.floor(r() * 3) * TAU / 3 + 0.5, t = 0.36 + r() * 0.3; return [Math.cos(a) * t, Math.sin(a) * t, 0.16]; }],
      [0.06, () => { const a = Math.floor(r() * 3) * TAU / 3 + 0.5, p = circleXY(r, 0.06, 0.004); return [Math.cos(a) * 0.7 + p[0], Math.sin(a) * 0.7 + p[1], 0.16]; }],
      [0.1, () => { const p = rrect(r, 2.6, 2.6, 0.2, 0.01); return [p[0], p[1], -0.25]; }],
    ], r, n),
  };

  const VS = `
attribute vec3 aA; attribute vec3 aB; attribute float aSeed;
uniform float uMix, uTime, uScan, uScanOn, uAspect, uSize, uK, uMotion;
uniform vec2 uOffset; uniform mat3 uRot;
varying float vDepth; varying float vScan;
void main() {
  float t = clamp((uMix - aSeed * 0.45) / 0.55, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(aA, aB, t);
  p += uMotion * 0.012 * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.7 + aSeed * 31.0), sin(uTime * 0.8 + aSeed * 17.0));
  p += sin(t * 3.14159) * 0.2 * vec3(sin(aSeed * 91.0), cos(aSeed * 53.0), sin(aSeed * 27.0));
  p = uRot * p;
  float persp = 3.0 / (4.4 - p.z);
  vec2 q = p.xy * persp * uK;
  gl_Position = vec4(q.x / uAspect + uOffset.x, q.y + uOffset.y, 0.0, 1.0);
  vDepth = clamp((p.z + 1.4) / 2.6, 0.0, 1.0);
  float d = (p.y - uScan) * 5.0;
  vScan = uScanOn * exp(-d * d);
  gl_PointSize = uSize * persp * (0.55 + 0.75 * vDepth) * (1.0 + vScan * 0.8);
}`;
  const FS = `
precision mediump float;
varying float vDepth; varying float vScan;
uniform vec3 uTone; uniform float uDim;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.02, d);
  vec3 plum = vec3(0.22, 0.28, 0.17), cob = vec3(0.47, 0.60, 0.36), ice = vec3(0.91, 0.87, 0.74);
  vec3 col = mix(plum, cob, smoothstep(0.0, 0.55, vDepth));
  col = mix(col, ice, smoothstep(0.55, 1.0, vDepth));
  col = mix(col, uTone, vScan * 0.85);
  float alpha = a * (0.35 + 0.65 * vDepth + vScan * 0.6) * uDim;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  // Without WebGL: draw the same machine once, as a still 2D image, so the scene never goes blank.
  function still(canvas, opts, stub) {
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.classList.add('is-off'); return stub; }
    const near = [233, 222, 189], mid = [120, 153, 92], far = [56, 71, 43];
    const draw = name => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      ctx.clearRect(0, 0, w, h);
      const pts = (SHAPES[name] || SHAPES.core)(rng(hash(name)), 2600);
      const yaw = -0.35 + (opts.yaw || 0), pitch = -0.12;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const k = 0.82 * Math.min(1, (w / h) * (opts.fit || 1)) * (opts.scale || 1) * h / 2;
      const off = opts.offset || [0, 0];
      const order = [];
      for (let i = 0; i < 2600; i++) {
        const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
        const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
        const y2 = cp * y + sp * z1, z2 = -sp * y + cp * z1;
        order.push([x1, y2, z2]);
      }
      order.sort((a, b) => a[2] - b[2]);
      for (const [x, y, z] of order) {
        const persp = 3.0 / (4.4 - z), d = Math.max(0, Math.min(1, (z + 1.4) / 2.6));
        const c = d < 0.55 ? far.map((v, j) => v + (mid[j] - v) * (d / 0.55)) : mid.map((v, j) => v + (near[j] - v) * ((d - 0.55) / 0.45));
        ctx.fillStyle = `rgba(${c.map(Math.round).join(',')},${((0.35 + 0.65 * d) * (opts.dim == null ? 1 : opts.dim)).toFixed(3)})`;
        const r = (opts.pointSize || 2.4) * dpr * persp * (0.55 + 0.75 * d) / 2;
        ctx.beginPath();
        ctx.arc(w / 2 + x * persp * k + off[0] * w / 2, h / 2 - y * persp * k - off[1] * h / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    let shape = SHAPES[opts.shape] ? opts.shape : 'core';
    draw(shape);
    canvas.classList.add('is-live');
    addEventListener('resize', () => draw(shape));
    return { supported: false, get shape() { return shape; }, morph(name) { if (SHAPES[name]) { shape = name; draw(name); } }, scan() {}, destroy() {} };
  }

  function mount(canvas, opts) {
    opts = opts || {};
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stub = { morph() {}, scan() {}, destroy() {}, supported: false, shape: opts.shape || 'core' };
    let gl;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return still(canvas, opts, stub);

    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { canvas.classList.add('is-off'); return stub; }
    gl.useProgram(prog);

    const small = Math.min(innerWidth, innerHeight) < 700;
    const n = Math.round((opts.count || (small ? 3000 : 4200)) * (opts.density || 1));
    const cache = {};
    const make = name => cache[name] || (cache[name] = (SHAPES[name] || SHAPES.core)(rng(hash(name)), n));

    let shape = SHAPES[opts.shape] ? opts.shape : 'core';
    let A = make(shape).slice(), B = make(shape);
    const seeds = new Float32Array(n);
    const sr = rng(7);
    for (let i = 0; i < n; i++) seeds[i] = sr();

    const bufA = gl.createBuffer(), bufB = gl.createBuffer(), bufS = gl.createBuffer();
    const attr = (buf, name, size, data) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr(bufA, 'aA', 3, A); attr(bufB, 'aB', 3, B); attr(bufS, 'aSeed', 1, seeds);
    const U = {};
    ['uMix', 'uTime', 'uScan', 'uScanOn', 'uAspect', 'uSize', 'uK', 'uMotion', 'uOffset', 'uRot', 'uTone', 'uDim'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let mixStart = -1e9, scanStart = -1e9, tone = TONES.neutral;
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0, visible = true, dpr = 1;
    const t0 = performance.now();
    const offset = opts.offset || [0, 0];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else addEventListener('resize', resize);
    resize();

    const onPointer = e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; };
    const onTilt = e => { if (e.gamma == null) return; tx = Math.max(-0.5, Math.min(0.5, e.gamma / 60)); ty = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90)); };
    addEventListener('pointermove', onPointer, { passive: true });
    addEventListener('deviceorientation', onTilt, { passive: true });

    function currentMix(now) { return reduce ? 1 : Math.min(1, (now - mixStart) / MORPH_MS); }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const time = reduce ? 0 : (now - t0) / 1000;
      px += (tx - px) * 0.035; py += (ty - py) * 0.035;
      const yaw = (reduce ? 0 : Math.sin(time * 0.16) * 0.5) + px * 0.5 + (opts.yaw || 0);
      const pitch = -0.12 + py * 0.25 + (reduce ? 0 : Math.sin(time * 0.11) * 0.05);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rot = new Float32Array([cy, sy * sp, -sy * cp, 0, cp, sp, sy, -cy * sp, cy * cp]);

      const sMix = currentMix(now);
      const eased = 1 - Math.pow(1 - sMix, 3);
      const sp2 = Math.min(1, (now - scanStart) / SCAN_MS);
      const scanning = sp2 < 1 && !reduce;

      const aspect = canvas.width / canvas.height;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.uMix, eased);
      gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uScan, 1.7 - 3.4 * sp2);
      gl.uniform1f(U.uScanOn, scanning ? Math.sin(sp2 * Math.PI) : 0);
      gl.uniform1f(U.uAspect, aspect);
      gl.uniform1f(U.uSize, (opts.pointSize || 2.4) * dpr);
      gl.uniform1f(U.uK, 0.82 * Math.min(1, aspect * (opts.fit || 1)) * (opts.scale || 1));
      gl.uniform1f(U.uMotion, reduce ? 0 : 1);
      gl.uniform2f(U.uOffset, offset[0], offset[1]);
      gl.uniformMatrix3fv(U.uRot, false, rot);
      gl.uniform3f(U.uTone, tone[0], tone[1], tone[2]);
      gl.uniform1f(U.uDim, opts.dim == null ? 1 : opts.dim);
      gl.drawArrays(gl.POINTS, 0, n);
      if (!reduce || sMix < 1) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }) : null;
    if (io) io.observe(canvas);
    document.addEventListener('visibilitychange', kick);
    requestAnimationFrame(() => canvas.classList.add('is-live'));
    kick();

    return {
      supported: true,
      get shape() { return shape; },
      morph(name) {
        if (!SHAPES[name] || name === shape) return;
        const now = performance.now();
        const m = 1 - Math.pow(1 - currentMix(now), 3);
        if (m < 1) {
          for (let i = 0; i < n; i++) {
            let t = Math.max(0, Math.min(1, (m - seeds[i] * 0.45) / 0.55)); t = t * t * (3 - 2 * t);
            for (let k = 0; k < 3; k++) A[i * 3 + k] += (B[i * 3 + k] - A[i * 3 + k]) * t;
          }
        } else A.set(B);
        B = make(name); shape = name;
        gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.bufferData(gl.ARRAY_BUFFER, A, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, B, gl.DYNAMIC_DRAW);
        mixStart = now; kick();
      },
      scan(name) { tone = TONES[name] || TONES.neutral; scanStart = performance.now(); kick(); },
      destroy() {
        cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect();
        removeEventListener('pointermove', onPointer); removeEventListener('deviceorientation', onTilt);
      },
    };
  }

  window.OmniCloud = { mount, shapes: Object.keys(SHAPES) };
})();
