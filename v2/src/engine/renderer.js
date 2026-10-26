// レンダラーとポストプロセス。
// Render → Bloom → 仕上げ（ACES トーンマッピング・sRGB・色収差・ビネット・フィルムグレインを 1 パスで）
// 内蔵 GPU のノート PC でも 60fps を保てるよう、フレーム時間を見て描画解像度を自動で上下させる。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uGrain: { value: 0.06 },
    uVignette: { value: 1.0 },
    uAberration: { value: 0.0015 },
    uFade: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uExposure, uGrain, uVignette, uAberration, uFade;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // three.js と同じ ACES Filmic
    vec3 RRTAndODTFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }
    vec3 ACES(vec3 c) {
      const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= uExposure / 0.6;
      c = inM * c;
      c = RRTAndODTFit(c);
      c = outM * c;
      return clamp(c, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    }
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uAberration * (1.0 + r2 * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col = toSRGB(ACES(col));
      float v = smoothstep(0.85, 0.15, r2 * uVignette * 1.6);
      col *= mix(0.55, 1.0, v);
      float g = hash(vUv * uResolution + fract(uTime * 13.7) * 100.0) - 0.5;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * uGrain * (1.15 - lum);
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  const maxScale = Math.min(devicePixelRatio, isMobile ? 1.25 : 1.5);
  const minScale = 0.5;
  let scale = Math.min(maxScale, isMobile ? 0.85 : 1.0);
  renderer.setPixelRatio(scale);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping; // 仕上げパスで行う
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(scale);
  const scene = new THREE.Scene();
  // 奥行きの範囲を空間の大きさ（長さ 45m・空の板まで）に合わせて狭め、重なった面のちらつきを防ぐ
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);

  const renderPass = new RenderPass(scene, camera);
  const bloomScale = isMobile ? 0.25 : 0.4;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.6, 0.85);
  const finish = new ShaderPass(FinishShader);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(finish);

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(scale);
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(scale);
    composer.setSize(innerWidth, innerHeight);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    finish.uniforms.uResolution.value.set(s.x, s.y);
    bloom.setSize(Math.round(s.x * bloomScale), Math.round(s.y * bloomScale));
  }
  addEventListener('resize', resize);
  resize();

  // ---- 自動解像度: 直近のフレーム時間の平均で 0.5〜maxScale の間を動かす
  let acc = 0;
  let frames = 0;
  let cooldown = 2;
  function adapt(dt) {
    if (dt <= 0 || dt > 0.25) return; // タブ切り替え直後などは無視
    acc += dt; frames++;
    cooldown -= dt;
    if (acc < 1.0 || cooldown > 0) return;
    const avg = acc / frames;
    acc = 0; frames = 0;
    let next = scale;
    // 下げる・上げるの境目を離して、行ったり来たりしないようにする（解像度が変わるたびに画面がちらつく）
    if (avg > 1 / 45) next = Math.max(minScale, scale * Math.min(0.9, Math.sqrt((1 / 55) / avg)));
    else if (avg < 1 / 90 && scale < maxScale) next = Math.min(maxScale, scale + 0.1);
    if (Math.abs(next - scale) > 0.02) {
      const down = next < scale;
      scale = next;
      resize();
      // 一度下げたら、しばらく上げない
      cooldown = down ? 8 : 3;
    }
  }

  function applyLook(look) {
    finish.uniforms.uExposure.value = look.exposure ?? 1;
    bloom.strength = look.bloom?.strength ?? 0.4;
    bloom.radius = look.bloom?.radius ?? 0.6;
    bloom.threshold = look.bloom?.threshold ?? 0.85;
    finish.uniforms.uGrain.value = look.grain ?? 0.06;
    finish.uniforms.uVignette.value = look.vignette ?? 1;
    finish.uniforms.uAberration.value = look.aberration ?? 0.0015;
  }

  function render(t) {
    finish.uniforms.uTime.value = t;
    composer.render();
  }

  return { renderer, composer, scene, camera, render, applyLook, finish, adapt, get scale() { return scale; } };
}
