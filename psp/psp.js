/* ============================================================
   PSP SECTION — Saad Musani Portfolio
   Adapted from shutterkif-oss for integration into main site.
   Photos instead of reels. Paths updated to /psp/.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const WORKS = window.SK_WORKS || [];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Desktop only — skip entirely on mobile
if (window.innerWidth < 768) {
  // noop — do not load Three.js or PSP on mobile
} else {

// Wait for canvas to be mounted by the inline script (it may not exist yet)
function waitForCanvas(cb) {
  const el = document.getElementById('pspCanvas');
  if (el) { cb(el); return; }
  let done = false;
  const obs = new MutationObserver(() => {
    const el2 = document.getElementById('pspCanvas');
    if (el2 && !done) { done = true; clearInterval(t); obs.disconnect(); cb(el2); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  const t = setInterval(() => {
    const el3 = document.getElementById('pspCanvas');
    if (el3 && !done) { done = true; clearInterval(t); obs.disconnect(); cb(el3); }
  }, 100);
}

let canvas, stage, section, loadingEl, railIdx, railTot, railOpen, railEl;

if (WORKS.length) {
  waitForCanvas((c) => {
    canvas    = c;
    stage     = c.parentElement;
    section   = document.getElementById('hero');
    loadingEl = null; // no loading spinner needed
    railIdx   = document.getElementById('pspRailIdx');
    railTot   = document.getElementById('pspRailTot');
    railOpen  = document.getElementById('pspRailOpen');
    railEl    = document.getElementById('pspRail');
    console.log('[PSP] canvas found, initializing...');
    init();
  });
}

function init() {

  /* ── power state — hoisted so setup() can set it ───────── */
  let powerT = 1, powerTarget = 1, warpT = 0;  // warpT = 0 means no channel-change distortion

  /* ── RENDERER / SCENE ─────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(0, 0, 30);

  const root  = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0x2a3a4d, 0x05070a, 0.55);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xbcd4e8, 0.85);
  keyLight.position.set(-8, 9, 12);
  scene.add(keyLight);
  const rimIce = new THREE.DirectionalLight(0x7fe3ff, 1.15);
  rimIce.position.set(11, 4, -9);
  scene.add(rimIce);
  const rimHot = new THREE.DirectionalLight(0xff2e7e, 0.75);
  rimHot.position.set(-12, -5, -7);
  scene.add(rimHot);

  const spillA = new THREE.PointLight(0xffffff, 0, 26, 2);
  const spillB = new THREE.PointLight(0xffffff, 0, 20, 2);
  const spillC = new THREE.PointLight(0xffffff, 0, 20, 2);
  scene.add(spillA, spillB, spillC);
  const pressLight = new THREE.PointLight(0x7fe3ff, 0, 9, 2);
  scene.add(pressLight);
  let pressLightLife = 0;

  /* ── SCREEN CANVAS ─────────────────────────────────────── */
  const SW = 960, SH = 544;
  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const sctx = sc.getContext('2d', { willReadFrequently: false });
  sctx.fillStyle = '#05070a';
  sctx.fillRect(0, 0, SW, SH);

  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.magFilter = THREE.LinearFilter;
  screenTex.generateMipmaps = false;

  const av = document.createElement('canvas');
  av.width = 8; av.height = 5;
  const avctx = av.getContext('2d', { willReadFrequently: true });

  /* ── CRT SHADER ────────────────────────────────────────── */
  const crtMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:    { value: screenTex },
      uTime:   { value: 0 },
      uPower:  { value: 0 },
      uWarp:   { value: 0 },
      uGrid:   { value: new THREE.Vector2(480, 272) },  // higher res = cleaner image
      uBright: { value: 1.0 }  // full brightness
    },
    transparent: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uTex;
      uniform float uTime, uPower, uWarp, uBright;
      uniform vec2 uGrid;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        vec2 c = uv - 0.5;
        float r2 = dot(c, c);
        uv = 0.5 + c * (1.0 + 0.032 * r2);
        float band = step(0.5, hash(vec2(floor(uv.y * 26.0), floor(uTime * 22.0))));
        uv.x += uWarp * (band - 0.5) * 0.09;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.005, 0.008, 0.013, 1.0); return;
        }
        vec2 g = uGrid;
        vec2 quv = (floor(uv * g) + 0.5) / g;
        float ab = (0.0005 + 0.0035 * r2) * (1.0 + uWarp * 6.0);
        float rr = texture2D(uTex, vec2(quv.x + ab, quv.y)).r;
        float gg = texture2D(uTex, quv).g;
        float bb = texture2D(uTex, vec2(quv.x - ab, quv.y)).b;
        vec3 col = vec3(rr, gg, bb);
        float sub = mod(floor(uv.x * g.x * 3.0), 3.0);
        vec3 mask = vec3(sub < 1.0 ? 1.0 : 0.90, (sub >= 1.0 && sub < 2.0) ? 1.0 : 0.90, sub >= 2.0 ? 1.0 : 0.90);
        col *= mask;
        float scan = 0.93 + 0.07 * cos(uv.y * g.y * 6.28318);
        col *= scan;
        col += vec3(0.05, 0.075, 0.10) * pow(1.0 - uv.y, 3.0) * 0.45;
        col *= 1.0 - 0.30 * pow(r2 * 1.55, 1.6);
        col += (hash(quv * 620.0) - 0.5) * 0.012;
        /* no boot scan animation — screen is always fully on */
        float open = 1.0;
        col *= open;
        gl_FragColor = vec4(col * uBright, 1.0);
      }`
  });

  /* ── LOAD MODEL ────────────────────────────────────────── */
  let screenMesh = null;
  const buttons = {};
  const pressable = [];
  let modelReady = false;
  const shellMats = [];

  function tintable(m) {
    m.userData.uInv = { value: 0 };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uInv = m.userData.uInv;
      shader.fragmentShader = 'uniform float uInv;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0) - diffuseColor.rgb, uInv);'
      );
    };
    return m;
  }

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(
    'psp/models/psp.glb',
    (gltf) => { setup(gltf.scene); },
    undefined,
    (err) => {
      console.error('[psp] model failed', err);
      if (loadingEl) loadingEl.textContent = 'MODEL UNAVAILABLE';
    }
  );

  function setup(src) {
    model.add(src);
    src.updateWorldMatrix(true, true);

    const parts = {};
    const bin = [];
    src.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const n = o.name.toLowerCase();
      if (n.indexOf('ground') === 0) { bin.push(o); return; }
      if (n.indexOf('screen') === 0) screenMesh = o;
      const m = n.match(/^button(\d+)/);
      if (m) parts['b' + m[1]] = o;
      if (o.material) {
        o.material = o.material.clone();
        shellMats.push(tintable(o.material));
        o.material.envMapIntensity = 1.25;
        if (o.material.metalness !== undefined) {
          o.material.metalness = Math.min(1, (o.material.metalness ?? 0.5) * 0.9 + 0.18);
          o.material.roughness = Math.max(0.12, (o.material.roughness ?? 0.5) * 0.82);
        }
      }
    });

    bin.forEach((o) => { o.parent && o.parent.remove(o); });
    if (!screenMesh) { console.warn('[psp] no screen mesh'); return; }

    const nrm = largestFaceNormal(screenMesh);
    const centreOf = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const centre = centreOf(src);
    const sCentre = centreOf(screenMesh);
    if (nrm.dot(sCentre.clone().sub(centre)) < 0) nrm.negate();

    const rowKeys = ['b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15'];
    const row = new THREE.Vector3();
    let rowN = 0;
    rowKeys.forEach((k) => { if (parts[k]) { row.add(centreOf(parts[k])); rowN++; } });

    let up;
    if (rowN) {
      row.divideScalar(rowN);
      const down = row.sub(sCentre).projectOnPlane(nrm).normalize();
      up = down.negate();
    } else {
      up = new THREE.Vector3(0, 1, 0).projectOnPlane(nrm).normalize();
    }
    const right = new THREE.Vector3().crossVectors(up, nrm).normalize();
    up.crossVectors(nrm, right).normalize();

    const basis = new THREE.Matrix4().makeBasis(right, up, nrm);
    model.quaternion.setFromRotationMatrix(basis).invert();
    model.updateWorldMatrix(true, true);

    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(10 / Math.max(size.x, size.y, size.z));
    model.updateWorldMatrix(true, true);
    model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
    model.updateWorldMatrix(true, true);
    fitToView();

    const sNrm = largestFaceNormal(screenMesh);
    if (sNrm.z < 0) sNrm.negate();
    buildScreenUVs(screenMesh, sNrm, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
    screenMesh.material = crtMat;
    screenMesh.renderOrder = 2;

    mapButton('up', parts.b1);
    mapButton('right', parts.b2);
    mapButton('down', parts.b3);
    mapButton('left', parts.b4);
    mapButton('triangle', parts.b5);
    mapButton('circle', parts.b6);
    mapButton('cross', parts.b7);
    mapButton('square', parts.b8);
    mapButton('home', parts.b9);
    mapButton('select', parts.b14);
    mapButton('start', parts.b15);
    ['b10', 'b11', 'b12', 'b13'].forEach((k2, i) => mapButton('aux' + i, parts[k2]));

    function mapButton(role, mesh) {
      if (!mesh) return;
      const parent = mesh.parent || model;
      const pq = new THREE.Quaternion(); parent.getWorldQuaternion(pq);
      const ps = new THREE.Vector3(); parent.getWorldScale(ps);
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(pq.invert());
      axis.set(axis.x / (ps.x || 1), axis.y / (ps.y || 1), axis.z / (ps.z || 1));
      buttons[role] = { role, mesh, home: mesh.position.clone(), axis, t: 0 };
      if (['up','right','down','left','cross','circle','triangle','square','start','select','home'].indexOf(role) > -1) {
        mesh.userData.role = role;
        pressable.push(mesh);
      }
    }

    const sb = new THREE.Box3().setFromObject(screenMesh);
    const sc2 = sb.getCenter(new THREE.Vector3());
    const halfW = (sb.max.x - sb.min.x) / 2;
    spillA.position.set(sc2.x, sc2.y, sc2.z + 2.2);
    spillB.position.set(sc2.x - halfW * 1.5, sc2.y, sc2.z + 1.5);
    spillC.position.set(sc2.x + halfW * 1.5, sc2.y, sc2.z + 1.5);

    if (screenMesh) screenMesh.userData.role = 'screen';
    pressable.push(screenMesh);

    modelReady = true;
    if (loadingEl) loadingEl.classList.add('is-off');
    // Start fully powered — no boot animation
    powerT = 1;
    powerTarget = 1;
    crtMat.uniforms.uPower.value = 1;
    select(0, true);
  }

  function largestFaceNormal(mesh) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const idx = geo.getIndex();
    const count = idx ? idx.count : pos.count;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cr = new THREE.Vector3();
    let best = -1;
    const out = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      ab.subVectors(b, a); ac.subVectors(c, a);
      cr.crossVectors(ab, ac);
      const area = cr.lengthSq();
      if (area > best) { best = area; out.copy(cr).normalize(); }
    }
    return out.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  }

  function buildScreenUVs(mesh, nrm, right, up) {
    const geo = mesh.geometry;
    const p = geo.getAttribute('position');
    const mw = mesh.matrixWorld;
    const wp = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mw);
      wp.push(v.clone());
    }
    const e1 = right.clone().projectOnPlane(nrm).normalize();
    const e2 = new THREE.Vector3().crossVectors(nrm, e1).normalize();
    const a = [], b = [];
    let ma = 0, mb = 0;
    for (let i = 0; i < wp.length; i++) {
      const x = wp[i].dot(e1), y = wp[i].dot(e2);
      a.push(x); b.push(y); ma += x; mb += y;
    }
    ma /= a.length; mb /= b.length;
    let Saa = 0, Sbb = 0, Sab = 0;
    for (let i = 0; i < a.length; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      Saa += da * da; Sbb += db * db; Sab += da * db;
    }
    const th = 0.5 * Math.atan2(2 * Sab, Saa - Sbb);
    const cs = Math.cos(th), sn = Math.sin(th);
    const U = e1.clone().multiplyScalar(cs).addScaledVector(e2, sn).normalize();
    const V = e1.clone().multiplyScalar(-sn).addScaledVector(e2, cs).normalize();
    if (U.dot(right) < 0) U.negate();
    if (V.dot(up) < 0) V.negate();
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const us = [], vs = [];
    for (let i = 0; i < wp.length; i++) {
      const u = wp[i].dot(U), w = wp[i].dot(V);
      us.push(u); vs.push(w);
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (w < minV) minV = w; if (w > maxV) maxV = w;
    }
    const du = (maxU - minU) || 1, dv = (maxV - minV) || 1;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (us[i] - minU) / du;
      uv[i * 2 + 1] = (vs[i] - minV) / dv;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  /* ── SCREEN CONTENT (photos only, no video) ─────────────── */
  const imgCache = new Map();
  function getImage(src) {
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    imgCache.set(src, p);
    return p;
  }

  const bg = document.createElement('canvas');
  bg.width = SW; bg.height = SH;
  const bgctx = bg.getContext('2d');

  function paintBackdrop(img) {
    bgctx.setTransform(1, 0, 0, 1, 0, 0);
    bgctx.fillStyle = '#04070b';
    bgctx.fillRect(0, 0, SW, SH);
    if (!img || !img.naturalWidth) return;
    const ar = img.naturalWidth / img.naturalHeight, sar = SW / SH;
    bgctx.save();
    try { bgctx.filter = 'blur(34px) saturate(1.5) brightness(0.62)'; } catch (e) {}
    let cw, ch;
    if (ar > sar) { ch = SH * 1.28; cw = ch * ar; } else { cw = SW * 1.28; ch = cw / ar; }
    bgctx.drawImage(img, (SW - cw) / 2, (SH - ch) / 2, cw, ch);
    bgctx.restore();
    bgctx.filter = 'none';
  }

  function drawFrame(work, img) {
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.drawImage(bg, 0, 0);

    if (img && img.naturalWidth) {
      const ar = img.naturalWidth / img.naturalHeight;
      const sar = SW / SH;
      let fw, fh;
      const pad = 0.90;
      if (ar > sar) { fw = SW * pad; fh = fw / ar; } else { fh = SH * pad; fw = fh * ar; }
      const fx = (SW - fw) / 2, fy = (SH - fh) / 2;
      sctx.save();
      sctx.shadowColor = 'rgba(0,0,0,.75)';
      sctx.shadowBlur = 26;
      sctx.drawImage(img, fx, fy, fw, fh);
      sctx.restore();
      sctx.strokeStyle = 'rgba(230,242,252,.35)';
      sctx.lineWidth = 2;
      sctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
    }

    /* HUD — index + dots */
    sctx.textBaseline = 'middle';
    sctx.font = '30px "VT323", monospace';
    sctx.fillStyle = 'rgba(127,227,255,.92)';
    sctx.fillText(String(current + 1).padStart(2, '0'), 26, 32);
    sctx.fillStyle = 'rgba(154,169,187,.55)';
    sctx.fillText('/ ' + String(WORKS.length).padStart(2, '0'), 62, 32);

    const px0 = SW - 26;
    for (let i = 0; i < WORKS.length; i++) {
      const on = i === current;
      const w = on ? 20 : 7;
      const x = px0 - (WORKS.length - i) * 24;
      sctx.fillStyle = on ? '#7fe3ff' : 'rgba(154,169,187,.38)';
      sctx.fillRect(x, SH - 30, w, 3);
    }

    sctx.restore();
    screenTex.needsUpdate = true;
  }

  let spillDue = 0;
  function updateSpillThrottled(t) {
    if (t < spillDue) return;
    spillDue = t + 0.16;
    updateSpill();
  }

  function updateSpill() {
    avctx.drawImage(sc, 0, 0, av.width, av.height);
    let r = 0, g = 0, b = 0;
    try {
      const d = avctx.getImageData(0, 0, av.width, av.height).data;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      r /= n * 255; g /= n * 255; b /= n * 255;
    } catch (e) { r = g = b = 0.6; }
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b) || 1;
    const col = new THREE.Color(
      Math.min(1, 0.30 + (r / mx) * 0.70),
      Math.min(1, 0.30 + (g / mx) * 0.70),
      Math.min(1, 0.30 + (b / mx) * 0.70)
    );
    spillTargetColor.copy(col);
    spillTargetIntensity = 16 + lum * 46;
  }

  const spillTargetColor = new THREE.Color(0.6, 0.8, 1);
  let spillTargetIntensity = 0;
  let current = 0;
  let selectToken = 0;

  async function select(i, instant) {
    current = ((i % WORKS.length) + WORKS.length) % WORKS.length;
    const w = WORKS[current];

    if (railIdx)  railIdx.textContent  = String(current + 1).padStart(2, '0');
    if (railTot)  railTot.textContent  = '/' + String(WORKS.length).padStart(2, '0');
    if (railOpen) railOpen.href = w.link || '#';
    if (railEl && !instant && !reduce) {
      railEl.classList.remove('is-swap');
      void railEl.offsetWidth;
      railEl.classList.add('is-swap');
    }
    // Glitch effect on switch (not on first load)
    if (!instant && !reduce) warpT = 1;

    const token = ++selectToken;
    const img = await getImage(w.img);
    if (token !== selectToken) return;
    paintBackdrop(img);
    drawFrame(w, img);
    updateSpill();
  }

  function open() {
    const w = WORKS[current];
    if (!w || !w.link) return;
    window.open(w.link, '_blank', 'noopener');
  }

  /* ── BUTTON PRESSES ────────────────────────────────────── */
  const PRESS_DEPTH = 0.17;

  function press(role) {
    const b = buttons[role];
    if (b) {
      b.t = 1;
      const wp = new THREE.Box3().setFromObject(b.mesh).getCenter(new THREE.Vector3());
      pressLight.position.copy(wp).add(new THREE.Vector3(0, 0, 1.4));
      pressLight.color.set(role === 'cross' ? 0xc8ff3c : 0x7fe3ff);
      pressLightLife = 1;
    }
    if      (role === 'left')     select(current - 1);
    else if (role === 'right')    select(current + 1);
    else if (role === 'up')       select(0);
    else if (role === 'down')     select(WORKS.length - 1);
    else if (role === 'circle')   select(WORKS.findIndex(w => w.id === 'skeleton') > -1 ? (current === WORKS.findIndex(w => w.id === 'skeleton') ? 0 : WORKS.findIndex(w => w.id === 'skeleton')) : current - 1);
    else if (role === 'triangle') select(current + 1);
    else if (role === 'cross' || role === 'start' || role === 'screen') open();
    else if (role === 'square' || role === 'select' || role === 'home') {
      const a = document.getElementById('about');
      a && a.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  /* ── INPUT ─────────────────────────────────────────────── */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null;
  let dragging = false, dragged = false, lastX = 0, lastY = 0;
  let spinY = 0, spinX = 0, spinVY = 0, spinVX = 0;

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    ptr.x = ((t.clientX - r.left) / r.width)  * 2 - 1;
    ptr.y = -((t.clientY - r.top)  / r.height) * 2 + 1;
  }

  function pick() {
    if (!modelReady) return null;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pressable, false)[0];
    return hit ? hit.object : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    toNDC(e);
    dragging = true; dragged = false;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    toNDC(e);
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
      spinVY += dx * 0.00042;
      spinVX += dy * 0.00030;
      lastX = e.clientX; lastY = e.clientY;
      return;
    }
    const o = pick();
    if (o !== hovered) { hovered = o; canvas.style.cursor = o ? 'pointer' : 'grab'; }
  });
  function endDrag() { dragging = false; }
  canvas.addEventListener('pointerup', (e) => {
    if (!dragged) { toNDC(e); const o = pick(); if (o && o.userData.role) press(o.userData.role); }
    endDrag();
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { endDrag(); hovered = null; canvas.style.cursor = 'grab'; });
  canvas.style.cursor = 'grab';

  window.addEventListener('keydown', (e) => {
    if (!inView) return;
    const k = e.key;
    if (k === 'ArrowLeft')  { press('left');     e.preventDefault(); }
    else if (k === 'ArrowRight') { press('right'); e.preventDefault(); }
    else if (k === 'Enter')      { press('cross'); }
  });

  /* ── COMPOSER + RESIZE ─────────────────────────────────── */
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearColor = new THREE.Color(0x000000);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.55);
  Object.keys(bloom).forEach((k) => {
    const m = bloom[k];
    if (!m || !m.isMaterial || m.blending !== THREE.AdditiveBlending) return;
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneFactor;
    m.blendEquationAlpha = THREE.AddEquation;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
  });
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function fitToView() {
    if (!modelBox()) return;
    const bx = modelBox();
    const sz = bx.getSize(new THREE.Vector3());
    const fill = window.innerWidth < 720 ? 1.05 : 0.92;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = (sz.y / 2) / Math.tan(vFov / 2);
    const distW = (sz.x / 2) / (Math.tan(vFov / 2) * camera.aspect);
    camera.position.set(0, 0.8, Math.max(distH, distW) / fill + sz.z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  function modelBox() {
    if (!modelReady && !model.children.length) return null;
    return new THREE.Box3().setFromObject(model);
  }

  function resize() {
    const stageEl = canvas ? canvas.parentElement : null;
    if (!stageEl) return;
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.fov = w < 720 ? 42 : 32;
    camera.updateProjectionMatrix();
    if (modelReady) fitToView();
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      inView = es[0].isIntersecting;
    }, { threshold: 0.01 }).observe(section || canvas);
  }

  /* ── LOOP ──────────────────────────────────────────────── */
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (!inView) return;

    // Drag rotation — springs back to center when released
    spinVY *= 0.90; spinVX *= 0.90;
    spinY += spinVY; spinX += spinVX;
    spinX = Math.max(-0.55, Math.min(0.55, spinX));
    if (!dragging) {
      spinY += (0 - spinY) * Math.min(1, dt * 3.2);
      spinX += (0 - spinX) * Math.min(1, dt * 3.2);
      if (Math.abs(spinY) < 0.0008) spinY = 0;
      if (Math.abs(spinX) < 0.0008) spinX = 0;
    }

    root.rotation.y = spinY;
    root.rotation.x = spinX + Math.sin(t * 0.6) * 0.04 - 0.18; // gentle float + tilt correction

    // Power is always 1 — no boot animation
    crtMat.uniforms.uPower.value = 1;
    // Warp decays naturally after button press
    warpT *= Math.pow(0.0025, dt);
    if (warpT < 0.001) warpT = 0;
    crtMat.uniforms.uWarp.value = warpT;
    crtMat.uniforms.uTime.value = t;

    const on = powerT;
    spillA.color.lerp(spillTargetColor, 0.12);
    spillB.color.copy(spillA.color);
    spillC.color.copy(spillA.color);
    spillA.intensity += ((spillTargetIntensity * on) - spillA.intensity) * 0.14;
    spillB.intensity = spillA.intensity * 0.42;
    spillC.intensity = spillA.intensity * 0.42;

    for (const k in buttons) {
      const b = buttons[k];
      if (b.t <= 0.0005 && b.mesh.position.equals(b.home)) continue;
      b.t *= Math.pow(0.004, dt);
      if (b.t < 0.0005) b.t = 0;
      const d = b.axis.clone().multiplyScalar(-PRESS_DEPTH * b.t);
      b.mesh.position.copy(b.home).add(d);
    }

    if (pressLightLife > 0) {
      pressLightLife -= dt * 3.4;
      pressLight.intensity = Math.max(0, pressLightLife) * 26;
    } else pressLight.intensity = 0;

    updateSpillThrottled(t);
    composer.render();
  }
  tick();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (modelReady) select(current, true); });
  }
}

} // end desktop-only block
