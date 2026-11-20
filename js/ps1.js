// PS1 스타일 머티리얼 + 저해상도 후처리
// - 버텍스 스냅(폴리곤 흔들림), 아핀 텍스처 매핑(텍스처 일그러짐), 버텍스 조명(고러드), 안개
// - 저해상도 렌더 타깃 -> 15비트 색 + 4x4 디더 -> 화면 확대(최근접)
import * as THREE from 'three';

export const MAX_POINT = 8;

// 모든 PS1 머티리얼이 공유하는 유니폼 (값을 바꾸면 전체에 반영)
export const shared = {
  uSnap: { value: new THREE.Vector2(320, 240) },
  uSnapScale: { value: 1.0 },
  uAffine: { value: 0.65 },
  uFogColor: { value: new THREE.Color(0x0b0d12) },
  uFogNear: { value: 6.0 },
  uFogFar: { value: 26.0 },
  uAmbient: { value: new THREE.Color(0x383a44) },
  uDirDir: { value: new THREE.Vector3(-0.3, -1, -0.2).normalize() },
  uDirColor: { value: new THREE.Color(0x40424c) },
  uPointPos: { value: Array.from({ length: MAX_POINT }, () => new THREE.Vector3(0, -999, 0)) },
  uPointColor: { value: Array.from({ length: MAX_POINT }, () => new THREE.Color(0, 0, 0)) },
  uPointRange: { value: new Array(MAX_POINT).fill(1) },
};

// 뷰모델(1인칭 손/칼) 전용 – 스냅을 더 촘촘하게 해서 손이 과하게 떨리지 않게
export const sharedVM = {
  ...shared,
  uSnapScale: { value: 2.0 },
  uAmbient: { value: new THREE.Color(0x4a4c56) },
  uDirDir: { value: new THREE.Vector3(0.4, -0.8, -0.45).normalize() },
  uDirColor: { value: new THREE.Color(0x6a6870) },
};

const vert = /* glsl */`
  #define MAX_POINT ${MAX_POINT}
  uniform vec2 uSnap; uniform float uSnapScale;
  uniform vec3 uAmbient; uniform vec3 uDirDir; uniform vec3 uDirColor;
  uniform vec3 uPointPos[MAX_POINT]; uniform vec3 uPointColor[MAX_POINT]; uniform float uPointRange[MAX_POINT];
  uniform float uFogNear; uniform float uFogFar;
  uniform float uEmissive; uniform float uSpec;
  attribute vec3 color;
  varying vec2 vUvP; varying vec3 vUvA; varying vec3 vLight; varying float vFog; varying vec3 vCol; varying float vSpec;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 L = uAmbient + uDirColor * max(dot(n, -uDirDir), 0.0);
    vec3 camPos = cameraPosition;
    vec3 V = normalize(camPos - wp.xyz);
    float sp = 0.0;
    for (int i = 0; i < MAX_POINT; i++) {
      vec3 d = uPointPos[i] - wp.xyz;
      float dist = length(d);
      float att = clamp(1.0 - dist / uPointRange[i], 0.0, 1.0);
      att *= att;
      vec3 ld = d / max(dist, 0.0001);
      L += uPointColor[i] * att * (max(dot(n, ld), 0.0) * 0.85 + 0.15);
      vec3 h = normalize(ld + V);
      sp += pow(max(dot(n, h), 0.0), 24.0) * att * length(uPointColor[i]);
    }
    vec3 hd = normalize(-uDirDir + V);
    sp += pow(max(dot(n, hd), 0.0), 24.0) * length(uDirColor) * 0.6;
    vSpec = sp * uSpec;
    vLight = mix(L, vec3(1.0), uEmissive);
    vCol = color;
    vec4 mv = viewMatrix * wp;
    vFog = smoothstep(uFogNear, uFogFar, -mv.z);
    vec4 clip = projectionMatrix * mv;
    if (clip.w > 0.0) {
      vec2 g = uSnap * uSnapScale * 0.5;
      vec2 ndc = clip.xy / clip.w;
      ndc = floor(ndc * g + 0.5) / g;
      clip.xy = ndc * clip.w;
    }
    vUvP = uv;
    vUvA = vec3(uv * clip.w, clip.w);
    gl_Position = clip;
  }
`;

const frag = /* glsl */`
  uniform sampler2D map; uniform vec3 uColor; uniform float uAffine; uniform vec3 uFogColor;
  uniform float uOpacity; uniform float uUseMap;
  varying vec2 vUvP; varying vec3 vUvA; varying vec3 vLight; varying float vFog; varying vec3 vCol; varying float vSpec;
  void main(){
    vec2 uv = mix(vUvP, vUvA.xy / vUvA.z, uAffine);
    vec4 t = uUseMap > 0.5 ? texture2D(map, uv) : vec4(1.0);
    if (t.a < 0.5) discard;
    vec3 c = t.rgb * uColor * vCol * vLight + vec3(vSpec);
    c = mix(c, uFogColor, vFog);
    gl_FragColor = vec4(c, uOpacity);
  }
`;

const whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
whiteTex.needsUpdate = true;

/**
 * PS1 머티리얼 생성
 * @param {object} o { map, color, emissive, spec, vm(뷰모델용), side, transparent, opacity }
 */
export function ps1Mat(o = {}) {
  const base = o.vm ? sharedVM : shared;
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...base,
      map: { value: o.map || whiteTex },
      uUseMap: { value: o.map ? 1 : 0 },
      uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
      uEmissive: { value: o.emissive ?? 0 },
      uSpec: { value: o.spec ?? 0 },
      uOpacity: { value: o.opacity ?? 1 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: o.side ?? THREE.FrontSide,
    transparent: !!o.transparent,
    depthWrite: o.depthWrite ?? true,
  });
  m.vertexColors = false;
  m.userData.ps1 = true;
  // 바닥/벽에 붙은 장식(카펫, 포스터, 간판)은 항상 앞에 그려지게 – 깜빡임(Z-파이팅) 방지
  if (o.decal) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; }
  return m;
}

// 버텍스 컬러 속성이 없는 지오메트리에 흰색 color 속성을 채워 넣음
export function ensureColor(geo, c = [1, 1, 1]) {
  if (geo.getAttribute('color')) return geo;
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

export function mesh(geo, mat) {
  ensureColor(geo);
  const m = new THREE.Mesh(geo, mat);
  return m;
}

// ---------------- 후처리 ----------------
export class PS1Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.height = 240;
    this.rt = new THREE.WebGLRenderTarget(320, 240, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
    });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uRes: { value: new THREE.Vector2(320, 240) },
        uDither: { value: 1 },
        uLevels: { value: 32 },
        uVignette: { value: 0.35 },
        uBright: { value: 1.15 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uDither; uniform float uLevels; uniform float uVignette; uniform float uBright;
        varying vec2 vUv;
        float bayer(vec2 p){
          int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          float m[16];
          m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
          m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
          for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0 - 0.5; }
          return 0.0;
        }
        void main(){
          vec2 px = floor(vUv * uRes);
          vec3 c = texture2D(tDiffuse, (px + 0.5) / uRes).rgb;
          c = pow(c * uBright, vec3(1.0 / mix(1.0, 1.25, clamp(uBright - 1.0, 0.0, 1.0))));
          c += bayer(px) * uDither / uLevels;
          c = floor(c * uLevels + 0.5) / uLevels;
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * uVignette * 1.6;
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }
  setSize(w, h) {
    const H = this.height;
    const W = Math.round(H * (w / h));
    this.rt.setSize(W, H);
    this.mat.uniforms.uRes.value.set(W, H);
    shared.uSnap.value.set(W, H);
  }
  begin() {
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear(true, true, true);
  }
  end() {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
  }
}
