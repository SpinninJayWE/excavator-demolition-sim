import * as THREE from 'three'

const MAX_PARTICLES = 700

const VERT = /* glsl */ `
attribute float aSize;
attribute float aBirth;
attribute float aGrow;
attribute vec3 aVel;
uniform float uTime;
uniform float uGravity;
varying float vAge;
void main() {
  float age = uTime - aBirth;
  vAge = age;
  vec3 p = position + aVel * age;
  p.y += 0.5 * uGravity * age * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (age >= 0.0 && age <= 1.0) ? aSize * (1.0 + aGrow * age) * (150.0 / -mv.z) : 0.0;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAge;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = max(0.0, (1.0 - vAge)) * 0.85 * smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(uColor, alpha);
}
`

export class ParticleSystem {
  constructor(scene, color) {
    this.scene = scene
    this.time = 0
    this.cursor = 0
    this.birth = new Float32Array(MAX_PARTICLES).fill(-10)
    this.vel = new Float32Array(MAX_PARTICLES * 3)
    this.size = new Float32Array(MAX_PARTICLES)
    this.grow = new Float32Array(MAX_PARTICLES)

    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1))
    this.geo.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1))
    this.geo.setAttribute('aGrow', new THREE.BufferAttribute(this.grow, 1))
    this.geo.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3))

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: -7 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  burst(pos, n, speed, opts = {}) {
    const u = this.mat.uniforms
    if (opts.color && u.uColor.value.getHex() !== opts.color) u.uColor.value.set(opts.color)
    const spread = opts.spread ?? 1.2
    const up = opts.up ?? 1.2
    if (opts.gravity != null) u.uGravity.value = opts.gravity
    for (let i = 0; i < n; i++) {
      const idx = this.cursor
      this.cursor = (this.cursor + 1) % MAX_PARTICLES
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * spread
      const vx = Math.cos(a) * r * speed + (Math.random() - 0.5) * 0.8
      const vy = up * (0.4 + Math.random()) + r * 0.4 + Math.random() * 0.6
      const vz = Math.sin(a) * r * speed + (Math.random() - 0.5) * 0.8
      this.vel[idx * 3] = vx
      this.vel[idx * 3 + 1] = vy
      this.vel[idx * 3 + 2] = vz
      this.size[idx] = 0.14 + Math.random() * 0.24
      this.grow[idx] = 2.2 + Math.random() * 1.6
      this.birth[idx] = this.time - Math.random() * 0.18
    }
    this.geo.attributes.aVel.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
    this.geo.attributes.aBirth.needsUpdate = true
  }

  update(dt, time) {
    this.time = time
    this.mat.uniforms.uTime.value = time
  }

  dispose() {
    this.scene.remove(this.points)
    this.geo.dispose()
    this.mat.dispose()
  }
}
