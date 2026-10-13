import * as THREE from '../assets/vendor/three.module.js';
import { WORLD_CURVE_UNIFORMS } from './world_curve_engine.js';

// ============================================================================
// Helper: Hook any Three.js Material so particles curve with the Argon Valley horizon
// ============================================================================
function applyParticleWorldCurve(material) {
  if (!material || material.userData?.hasParticleWorldCurve) return material;
  material.userData = material.userData || {};
  material.userData.hasParticleWorldCurve = true;

  const prevOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (typeof prevOnBeforeCompile === 'function') {
      prevOnBeforeCompile(shader, renderer);
    }
    shader.uniforms.uCurveStrength = WORLD_CURVE_UNIFORMS.uCurveStrength;
    shader.uniforms.uCurveRadialX = WORLD_CURVE_UNIFORMS.uCurveRadialX || { value: 0.22 };
    shader.uniforms.uCameraZ = WORLD_CURVE_UNIFORMS.uCameraZ;
    shader.uniforms.uCameraX = WORLD_CURVE_UNIFORMS.uCameraX;
    shader.uniforms.uCurveStartDist = WORLD_CURVE_UNIFORMS.uCurveStartDist;
    shader.uniforms.uCurveEnabled = WORLD_CURVE_UNIFORMS.uCurveEnabled;
    shader.uniforms.uTime = WORLD_CURVE_UNIFORMS.uTime;

    if (!shader.vertexShader.includes('uniform float uCurveStrength;')) {
      shader.vertexShader =
        `
        uniform float uCurveStrength;
        uniform float uCurveRadialX;
        uniform float uCameraZ;
        uniform float uCameraX;
        uniform float uCurveStartDist;
        uniform float uCurveEnabled;
        uniform float uTime;
        ` + shader.vertexShader;
    }

    const projectTarget = '#include <project_vertex>';
    const curvedProjectChunk = `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      vec4 worldPosCurve = modelMatrix * mvPosition;
      if (uCurveEnabled > 0.5) {
        float dzCurve = worldPosCurve.z - uCameraZ;
        float dxCurve = (worldPosCurve.x - uCameraX) * uCurveRadialX;
        float distCurve = max(0.0, length(vec2(dxCurve, dzCurve)) - uCurveStartDist);
        worldPosCurve.y -= uCurveStrength * distCurve * distCurve;
      }
      mvPosition = viewMatrix * worldPosCurve;
      gl_Position = projectionMatrix * mvPosition;
    `;
    shader.vertexShader = shader.vertexShader.replace(projectTarget, curvedProjectChunk);
  };
  material.needsUpdate = true;
  return material;
}

// ============================================================================
// 1. CozyPostProcessor
//    - Offscreen MSAA WebGLRenderTarget (samples: 4, HalfFloatType + DepthTexture)
//    - Multi-tap Spiral SSAO (crevice & contact grounding without silhouette halos)
//    - Delicate Warm Bloom (campfire, cottage windows, water sun-sparkles)
//    - Miniature Diorama Tilt-Shift Depth of Field (extreme horizon/bottom edges)
//    - Argon Argon Valley Warm Pastel Color Grading & Filmic Tone Mapping + sRGB output
// ============================================================================
export class CozyPostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    const size = new THREE.Vector2();
    if (this.renderer && typeof this.renderer.getSize === 'function') {
      this.renderer.getSize(size);
    } else {
      size.set(window.innerWidth || 1280, window.innerHeight || 720);
    }
    const pixelRatio =
      this.renderer && typeof this.renderer.getPixelRatio === 'function'
        ? this.renderer.getPixelRatio()
        : Math.min(window.devicePixelRatio || 1, 2);

    const rtWidth = Math.max(1, Math.floor(size.x * pixelRatio));
    const rtHeight = Math.max(1, Math.floor(size.y * pixelRatio));

    this.depthTexture = new THREE.DepthTexture(
      rtWidth,
      rtHeight,
      THREE.UnsignedIntType
    );
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;

    this.renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
      samples: 0,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: this.depthTexture,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      tColor: { value: this.renderTarget.texture },
      tDepth: { value: this.depthTexture },
      uResolution: { value: new THREE.Vector2(rtWidth, rtHeight) },
      uNear: { value: this.camera?.near || 0.1 },
      uFar: { value: this.camera?.far || 450.0 },
      uTime: { value: 0.0 },
      uSSAOStrength: { value: 0.44 },
      uBloomStrength: { value: 0.14 },
      uBloomThreshold: { value: 1.08 },
      uTiltShiftStrength: { value: 0.28 },
      uExposure: { value: 0.94 },
      uSaturation: { value: 1.14 },
      uWarmth: { value: 0.028 },
    };

    this.material = new THREE.ShaderMaterial({
      name: 'Argon ValleyCozyPostShader',
      uniforms: this.uniforms,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uResolution;
        uniform float uNear;
        uniform float uFar;
        uniform float uTime;
        uniform float uSSAOStrength;
        uniform float uBloomStrength;
        uniform float uBloomThreshold;
        uniform float uTiltShiftStrength;
        uniform float uExposure;
        uniform float uSaturation;
        uniform float uWarmth;

        varying vec2 vUv;

        float linearizeDepth(float d) {
          float z_n = 2.0 * d - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - z_n * (uFar - uNear));
        }

        // Interleaved gradient noise for jittering spiral SSAO taps
        float ign(vec2 pixel) {
          return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
        }

        // 1. Multi-Tap Spiral Screen-Space Ambient Occlusion (SSAO)
        //    Symmetric pair crevice detection prevents false slope shading & silhouette halos
        float computeSSAO(vec2 uv, float rawDepth, float centerDepth) {
          if (rawDepth >= 0.9994 || uSSAOStrength <= 0.001) {
            return 1.0;
          }

          vec2 aspect = vec2(uResolution.y / max(1.0, uResolution.x), 1.0);
          float baseRadius = clamp(0.015 / (centerDepth * 0.055 + 0.45), 0.0022, 0.018);
          float noiseAngle = ign(gl_FragCoord.xy) * 6.2831853;

          float occlusion = 0.0;
          float validWeight = 0.0;

          // 8 symmetric golden-spiral pairs = 16 depth taps
          for (int i = 0; i < 8; i++) {
            float fi = float(i);
            float r = ((fi + 0.5) / 8.0);
            r = mix(0.22, 1.0, r * r);
            float theta = fi * 2.3999632 + noiseAngle;
            vec2 dir = vec2(cos(theta), sin(theta)) * aspect * (baseRadius * r);

            float d1 = linearizeDepth(texture2D(tDepth, clamp(uv + dir, 0.001, 0.999)).r);
            float d2 = linearizeDepth(texture2D(tDepth, clamp(uv - dir, 0.001, 0.999)).r);

            // Symmetric valley check: on flat slopes, (d1 + d2) * 0.5 == centerDepth!
            // In crevices/contact corners (flower stems, tree roots, furniture legs, cliff base),
            // average neighbor depth is closer to camera than centerDepth.
            float avgDepth = 0.5 * (d1 + d2);
            float valley = centerDepth - avgDepth;

            // Tight range check eliminates dark halos around foreground silhouettes
            float range1 = smoothstep(0.65, 0.08, abs(centerDepth - d1));
            float range2 = smoothstep(0.65, 0.08, abs(centerDepth - d2));
            float pairRange = range1 * range2;

            float pairOcc = smoothstep(0.008, 0.14, valley) * pairRange;
            occlusion += pairOcc;
            validWeight += 1.0;
          }

          float ao = 1.0 - clamp((occlusion / max(1.0, validWeight)) * uSSAOStrength * 1.65, 0.0, 0.52);
          return ao;
        }

        // 2 & 3. Combined Neighborhood Sampling for Delicate Warm Bloom & Diorama Tilt-Shift
        void computeBloomAndTiltShift(vec2 uv, vec3 baseColor, out vec3 bloomCol, out vec3 tiltBlurCol) {
          vec2 texel = 1.0 / max(uResolution, vec2(1.0));
          vec3 highlightSum = vec3(0.0);
          vec3 blurSum = baseColor * 1.5;
          float blurWeight = 1.5;

          // 12-tap 2-ring disc kernel
          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            float ring = (i < 6) ? 1.65 : 3.4;
            float angle = fi * 1.0471975 + ((i >= 6) ? 0.523598 : 0.0);
            vec2 offset = vec2(cos(angle), sin(angle)) * texel * ring;

            vec3 sampleCol = texture2D(tColor, clamp(uv + offset, 0.001, 0.999)).rgb;

            // Soft knee highlight extraction for campfire, windows, and water sun-sparkles
            float luma = dot(sampleCol, vec3(0.2126, 0.7152, 0.0722));
            float knee = smoothstep(uBloomThreshold * 0.85, uBloomThreshold * 1.55, luma);
            highlightSum += sampleCol * knee;

            float w = (i < 6) ? 1.0 : 0.7;
            blurSum += sampleCol * w;
            blurWeight += w;
          }

          bloomCol = (highlightSum / 12.0) * vec3(1.05, 0.97, 0.86);
          tiltBlurCol = blurSum / blurWeight;
        }

        // 4. Argon Argon Valley Filmic Tone Mapping & Warm Pastel Color Grading
        vec3 valleyToneMapAndGrade(vec3 linearColor) {
          vec3 col = max(vec3(0.0), linearColor) * uExposure;

          // Gentle warm sunlit tint in highlights & cozy sky lift in deep shadows
          col.r *= (1.0 + uWarmth * 0.55);
          col.g *= (1.0 + uWarmth * 0.18);

          // Soft filmic shoulder curve that preserves vibrant midtones while rolling off bright >1.0 highlights
          vec3 num = col * (col * 0.35 + 0.92);
          vec3 den = col * (col * 0.35 + 0.88) + 0.16;
          col = clamp(num / den, 0.0, 1.0);

          // Pastel vibrancy boost (emerald grass, sky blues, coral tulips)
          float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
          // Protect pure highlights from over-saturating so clouds/foam stay crisp white
          float satMask = 1.0 - smoothstep(0.78, 0.98, luma) * 0.55;
          col = mix(vec3(luma), col, 1.0 + (uSaturation - 1.0) * satMask);

          return clamp(col, 0.0, 1.0);
        }

        vec3 linearToSRGB(vec3 linearRGB) {
          vec3 cutoff = step(linearRGB, vec3(0.0031308));
          vec3 higher = vec3(1.055) * pow(max(linearRGB, vec3(0.0)), vec3(1.0 / 2.4)) - vec3(0.055);
          vec3 lower = linearRGB * vec3(12.92);
          return clamp(mix(higher, lower, cutoff), 0.0, 1.0);
        }

        void main() {
          vec3 baseColor = texture2D(tColor, vUv).rgb;
          float rawDepth = texture2D(tDepth, vUv).r;
          float centerDepth = linearizeDepth(rawDepth);

          // 1. SSAO with warm emerald-earth contact shadow tint
          float ao = computeSSAO(vUv, rawDepth, centerDepth);
          vec3 aoTint = mix(vec3(0.24, 0.30, 0.22), vec3(1.0), ao);
          vec3 color = baseColor * aoTint;

          // 2 & 3. Bloom + Miniature Diorama Tilt-Shift at extreme top/bottom edges
          vec3 bloomCol;
          vec3 tiltBlurCol;
          computeBloomAndTiltShift(vUv, color, bloomCol, tiltBlurCol);

          // Apply tilt-shift only near extreme top horizon and extreme bottom foreground
          float distFromFocusBand = abs(vUv.y - 0.48);
          float tiltMask = smoothstep(0.37, 0.52, distFromFocusBand) * clamp(uTiltShiftStrength, 0.0, 1.0);
          color = mix(color, tiltBlurCol * aoTint, tiltMask);

          // Add delicate warm bloom
          color += bloomCol * uBloomStrength;

          // 4. Argon Valley Color Grading, Filmic Tone Mapping & sRGB Output
          vec3 gradedLinear = valleyToneMapAndGrade(color);
          vec3 finalSRGB = linearToSRGB(gradedLinear);

          gl_FragColor = vec4(finalSRGB, 1.0);
        }
      `,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(quadGeo, this.material);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);
  }

  setSize(width, height) {
    if (!this.renderer || !this.renderTarget) return;
    const pixelRatio =
      typeof this.renderer.getPixelRatio === 'function'
        ? this.renderer.getPixelRatio()
        : Math.min(window.devicePixelRatio || 1, 2);
    const rtWidth = Math.max(1, Math.floor(width * pixelRatio));
    const rtHeight = Math.max(1, Math.floor(height * pixelRatio));
    this.renderTarget.setSize(rtWidth, rtHeight);
    this.uniforms.uResolution.value.set(rtWidth, rtHeight);
  }

  render(dt = 0.016, elapsed = 0) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.uniforms.uTime.value = elapsed;
    this.uniforms.uNear.value = this.camera.near || 0.1;
    this.uniforms.uFar.value = this.camera.far || 450.0;

    try {
      const prevRenderTarget = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);

      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);

      if (prevRenderTarget) {
        this.renderer.setRenderTarget(prevRenderTarget);
      }
    } catch (err) {
      // Fallback to direct render if MSAA renderTarget fails in an unusual context
      this.enabled = false;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.renderTarget) this.renderTarget.dispose();
    if (this.depthTexture) this.depthTexture.dispose();
    if (this.material) this.material.dispose();
    if (this.quad?.geometry) this.quad.geometry.dispose();
  }
}

// ============================================================================
// 2. ParticleSystemManager
//    - 65 Floating Cherry Blossom Petals & Autumn Leaves (curved with horizon)
//    - Golden Hour Dust Motes & Twilight Fireflies
//    - Campfire Embers (beach campfire & yard boiler) + Cottage Chimney Smoke Puffs
//    - Watering Can Droplet Spray Arcs & 4-Point Tulip Star Sparkles (ref_02, ref_03)
//    - Shovel Terraforming Sculpted 3D Dirt Clod Burst (ref_06) + Trowel Puffs
//    - Footstep Dust Puffs
// ============================================================================
export class ParticleSystemManager {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'CozyParticleSystemRoot';
    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.root);
    }

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._lastPlayerPos = new THREE.Vector3();
    this._hasLastPlayerPos = false;
    this._stepDistanceAccum = 0;
    this.currentPreset = 'beach_sunset';

    this._initFloatingPetalsAndLeaves();
    this._initDustMotesAndFireflies();
    this._initCampfireEmbersAndChimneySmoke();
    this._initWateringSprayAndSparkles();
    this._initShovelDirtClodBurst();
    this._initFootstepDustPool();

    this.setScenePreset(this.currentPreset);
  }

  // --------------------------------------------------------------------------
  // 2.1 Floating Cherry Blossom Petals & Autumn Leaves (65 instanced 3D quads)
  //     Base radius reduced by 65% (0.018) and visible only in free_roam / follow_player
  // --------------------------------------------------------------------------
  _initFloatingPetalsAndLeaves() {
    this.petalCount = 65;
    const petalGeo = new THREE.PlaneGeometry(0.036, 0.024, 2, 2);
    const pos = petalGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const edgeFactor = 1.0 - Math.min(1.0, Math.abs(x) / 0.018) * 0.45;
      pos.setY(i, y * edgeFactor);
      pos.setZ(i, (x * x + y * y) * 1.8);
    }
    petalGeo.computeVertexNormals();

    const petalMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );

    this.petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, this.petalCount);
    this.petalMesh.frustumCulled = false;
    this.petalMesh.castShadow = false;
    this.petalMesh.receiveShadow = false;
    this.petalMesh.visible = false;

    const palette = [
      new THREE.Color('#ffb7c5'),
      new THREE.Color('#ffd6e0'),
      new THREE.Color('#ffc49b'),
      new THREE.Color('#9be15d'),
      new THREE.Color('#f7c95f'),
    ];

    this.petalData = [];
    for (let i = 0; i < this.petalCount; i++) {
      const data = {
        x: (Math.random() - 0.5) * 44,
        y: 1.0 + Math.random() * 6.5,
        z: -16 + Math.random() * 38,
        vx: -0.35 - Math.random() * 0.35,
        vy: -0.22 - Math.random() * 0.18,
        vz: (Math.random() - 0.5) * 0.25,
        phase: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 2.4,
        rotSpeedY: (Math.random() - 0.5) * 2.4,
        rotSpeedZ: (Math.random() - 0.5) * 1.8,
        scale: 0.65 + Math.random() * 0.55,
      };
      this.petalData.push(data);
      this.petalMesh.setColorAt(i, palette[i % palette.length]);
    }
    if (this.petalMesh.instanceColor) {
      this.petalMesh.instanceColor.needsUpdate = true;
    }
    this.root.add(this.petalMesh);
  }

  // --------------------------------------------------------------------------
  // 2.2 Golden Hour Dust Motes & Twilight Fireflies
  //     Base radius reduced by 65% (0.018) and visible only in free_roam / follow_player
  // --------------------------------------------------------------------------
  _initDustMotesAndFireflies() {
    this.moteCount = 72;
    const moteGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const moteMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );

    this.moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, this.moteCount);
    this.moteMesh.frustumCulled = false;
    this.moteMesh.visible = false;

    const moteColors = [
      new THREE.Color('#ffe885'),
      new THREE.Color('#ffd269'),
      new THREE.Color('#c8ff75'),
      new THREE.Color('#fff7cc'),
    ];

    this.moteData = [];
    for (let i = 0; i < this.moteCount; i++) {
      this.moteData.push({
        baseX: (Math.random() - 0.5) * 38,
        baseY: 0.85 + Math.random() * 3.6,
        baseZ: -15 + Math.random() * 36,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.1,
        radius: 0.25 + Math.random() * 0.55,
        baseScale: 0.5 + Math.random() * 0.65,
      });
      this.moteMesh.setColorAt(i, moteColors[i % moteColors.length]);
    }
    if (this.moteMesh.instanceColor) {
      this.moteMesh.instanceColor.needsUpdate = true;
    }
    this.root.add(this.moteMesh);
  }

  // --------------------------------------------------------------------------
  // 2.3 Campfire Embers (1.6, 0.75, 19.6) & Cottage Chimney Smoke (-4.9, 4.3, -10.2)
  // --------------------------------------------------------------------------
  _initCampfireEmbersAndChimneySmoke() {
    // A. Campfire Embers — delicate round orange sparks strictly above campfire
    this.emberCount = 6;
    const emberGeo = new THREE.SphereGeometry(0.016, 6, 6);
    const emberMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, this.emberCount);
    this.emberMesh.frustumCulled = false;

    const emberPalette = [
      new THREE.Color('#ff8c3b'),
      new THREE.Color('#ffb84d'),
      new THREE.Color('#ff6e3b'),
    ];

    this.emberData = [];
    for (let i = 0; i < this.emberCount; i++) {
      this.emberData.push({
        originX: 1.55,
        originY: 0.72,
        originZ: 19.6,
        phase: (i / this.emberCount) * Math.PI * 2,
        speed: 0.38 + (i % 3) * 0.08,
        swayX: ((i % 2 === 0 ? 1 : -1) * 0.05),
        swayZ: 0.02,
        maxHeight: 0.55 + (i % 2) * 0.22,
      });
      this.emberMesh.setColorAt(i, emberPalette[i % emberPalette.length]);
    }
    if (this.emberMesh.instanceColor) {
      this.emberMesh.instanceColor.needsUpdate = true;
    }
    this.root.add(this.emberMesh);

    // B. Cottage Chimney Smoke Puffs (-4.9, 4.3, -10.2)
    this.smokeCount = 10;
    const smokeGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const smokeMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xfffdf6,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, this.smokeCount);
    this.smokeMesh.frustumCulled = false;

    this.smokeData = [];
    for (let i = 0; i < this.smokeCount; i++) {
      this.smokeData.push({
        originX: -4.9,
        originY: 4.3,
        originZ: -10.2,
        offset: i / this.smokeCount,
        speed: 0.22 + (i % 3) * 0.03,
        driftX: -0.35 + (i % 5) * 0.05,
        driftZ: -0.20 + (i % 4) * 0.04,
      });
    }
    this.root.add(this.smokeMesh);
  }

  // --------------------------------------------------------------------------
  // 2.4 Watering Can Droplet Spray & Flower Sparkles (ref_02, ref_03)
  //     - this.barnabySprayGroup at (0.25, 1.02, -6.85) visible ONLY in 'house_yard' & 'free_roam'
  //     - this.playerSprayGroup at (-3.35, 1.05, -0.35) visible ONLY in 'flower_river'
  // --------------------------------------------------------------------------
  _initWateringSprayAndSparkles() {
    const dropGeo = new THREE.ConeGeometry(0.018, 0.075, 5);
    dropGeo.rotateX(Math.PI * 0.5);
    const dropMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xf4fbff,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );

    const buildSprayGroup = (name, x, y, z, dirX, dirZ) => {
      const group = new THREE.Group();
      group.name = name;
      group.position.set(x, y, z);
      group.scale.setScalar(0.55);

      const count = 28;
      const instMesh = new THREE.InstancedMesh(dropGeo, dropMat, count);
      instMesh.frustumCulled = false;
      const items = [];
      for (let i = 0; i < count; i++) {
        const fanAngle = ((i % 7) / 6 - 0.5) * 0.68;
        items.push({
          phase: i / count,
          speed: 1.5 + (i % 5) * 0.12,
          fanAngle,
          spreadRadius: 0.52 + (i % 4) * 0.09,
          dirX,
          dirZ,
        });
      }
      group.add(instMesh);
      group.userData = { instMesh, items, count };
      return group;
    };

    // Barnaby watering spray in house_yard (ref_02) & free_roam
    this.barnabySprayGroup = buildSprayGroup(
      'BarnabyWaterSprayGroup',
      0.25,
      1.02,
      -6.85,
      -0.35,
      0.88
    );
    this.root.add(this.barnabySprayGroup);

    // Player watering spray in flower_river (ref_03)
    this.playerSprayGroup = buildSprayGroup(
      'PlayerWaterSprayGroup',
      -3.35,
      1.05,
      -0.35,
      -0.36,
      0.88
    );
    this.root.add(this.playerSprayGroup);

    // B. 4-Point Star Sparkles above watered tulips (ref_02, ref_03)
    this.sparkleCount = 24;
    const starShape = new THREE.Shape();
    const outerR = 0.048;
    const innerR = 0.013;
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / 4;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(sx, sy);
      else starShape.lineTo(sx, sy);
    }
    starShape.closePath();
    const starGeo = new THREE.ShapeGeometry(starShape);

    const starMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    this.sparkleMesh = new THREE.InstancedMesh(
      starGeo,
      starMat,
      this.sparkleCount
    );
    this.sparkleMesh.frustumCulled = false;

    const starColors = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#fff59e'),
      new THREE.Color('#d4f5ff'),
    ];

    this.sparkleData = [];
    for (let i = 0; i < this.sparkleCount; i++) {
      const isGardenPatch = i < 16;
      const bx = isGardenPatch
        ? -4.5 + (i % 4) * 0.65
        : -0.2 + (i % 4) * 0.42;
      const bz = isGardenPatch
        ? -0.1 + Math.floor(i / 4) * 0.48
        : -6.9 + Math.floor((i - 16) / 4) * 0.45;
      this.sparkleData.push({
        isGardenPatch,
        x: bx + (Math.random() - 0.5) * 0.16,
        y: 0.98 + Math.random() * 0.22,
        z: bz + (Math.random() - 0.5) * 0.16,
        phase: Math.random() * Math.PI * 2,
        speed: 2.2 + Math.random() * 1.4,
      });
      this.sparkleMesh.setColorAt(i, starColors[i % starColors.length]);
    }
    if (this.sparkleMesh.instanceColor) {
      this.sparkleMesh.instanceColor.needsUpdate = true;
    }
    this.root.add(this.sparkleMesh);
  }

  // --------------------------------------------------------------------------
  // 2.5 Shovel Terraforming Sculpted 3D Dirt Clod Burst (ref_06) & Burst Pool
  //     Specifically anchored at (-7.5, 0.65, -8.0) with #8c5a36 / #a46e46 soil clods
  // --------------------------------------------------------------------------
  _initShovelDirtClodBurst() {
    this.shovelDirtBurstGroup = new THREE.Group();
    this.shovelDirtBurstGroup.name = 'ShovelDirtClodBurst';
    this.shovelDirtBurstGroup.position.set(-7.48, 0.64, -8.12);
    this.shovelDirtBurstGroup.scale.setScalar(1.25);

    const clodDarkMat = applyParticleWorldCurve(
      new THREE.MeshStandardMaterial({
        color: 0x8c5a36,
        roughness: 0.92,
        metalness: 0.0,
      })
    );
    const clodMidMat = applyParticleWorldCurve(
      new THREE.MeshStandardMaterial({
        color: 0xa46e46,
        roughness: 0.9,
        metalness: 0.0,
      })
    );
    const clodLightMat = applyParticleWorldCurve(
      new THREE.MeshStandardMaterial({
        color: 0xb68056,
        roughness: 0.88,
        metalness: 0.0,
      })
    );

    const clodGeo = new THREE.DodecahedronGeometry(0.11, 1);
    // Sculpt the organic flying dirt clod arcs seen in ref_06_cliff_waterfall.png
    const clodSpecs = [
      // Left plume arc
      { x: -0.18, y: 0.08, z: 0.05, sx: 1.15, sy: 1.35, sz: 1.0, mat: clodDarkMat },
      { x: -0.22, y: 0.24, z: 0.02, sx: 0.95, sy: 1.2, sz: 0.9, mat: clodMidMat },
      { x: -0.16, y: 0.38, z: -0.02, sx: 0.72, sy: 0.9, sz: 0.75, mat: clodLightMat },
      // Center-top plume arc
      { x: 0.02, y: 0.14, z: -0.06, sx: 1.2, sy: 1.1, sz: 1.1, mat: clodMidMat },
      { x: 0.04, y: 0.34, z: -0.04, sx: 1.05, sy: 1.25, sz: 0.95, mat: clodLightMat },
      { x: 0.0, y: 0.48, z: 0.0, sx: 0.78, sy: 0.85, sz: 0.78, mat: clodMidMat },
      // Right-lower soil mound & pebbles
      { x: 0.16, y: 0.06, z: 0.10, sx: 1.35, sy: 0.85, sz: 1.25, mat: clodMidMat },
      { x: 0.22, y: 0.22, z: 0.04, sx: 0.82, sy: 1.05, sz: 0.82, mat: clodLightMat },
      { x: -0.08, y: 0.04, z: 0.14, sx: 1.1, sy: 0.75, sz: 1.1, mat: clodDarkMat },
      // Flying small pebbles
      { x: -0.28, y: 0.44, z: 0.08, sx: 0.42, sy: 0.42, sz: 0.42, mat: clodDarkMat },
      { x: 0.24, y: 0.40, z: -0.05, sx: 0.46, sy: 0.46, sz: 0.46, mat: clodMidMat },
      { x: 0.12, y: 0.54, z: 0.06, sx: 0.38, sy: 0.38, sz: 0.38, mat: clodLightMat },
    ];

    this.dirtClodMeshes = [];
    for (let i = 0; i < clodSpecs.length; i++) {
      const s = clodSpecs[i];
      const mesh = new THREE.Mesh(clodGeo, s.mat);
      mesh.position.set(s.x, s.y, s.z);
      mesh.scale.set(s.sx, s.sy, s.sz);
      mesh.rotation.set(i * 0.7, i * 1.1, i * 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.basePos = mesh.position.clone();
      mesh.userData.baseScale = mesh.scale.clone();
      mesh.userData.phase = i * 0.55;
      this.shovelDirtBurstGroup.add(mesh);
      this.dirtClodMeshes.push(mesh);
    }

    this.root.add(this.shovelDirtBurstGroup);

    // Dynamic burst particle pool for interactive shovel/trowel actions anywhere
    this.dynamicClodCount = 24;
    this.dynamicClodMesh = new THREE.InstancedMesh(
      clodGeo,
      clodMidMat,
      this.dynamicClodCount
    );
    this.dynamicClodMesh.frustumCulled = false;
    this.dynamicClodData = [];
    for (let i = 0; i < this.dynamicClodCount; i++) {
      this.dynamicClodData.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0.65,
        scale: 0.6,
      });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.001);
      this._dummy.updateMatrix();
      this.dynamicClodMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.dynamicClodMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.dynamicClodMesh);
  }

  // --------------------------------------------------------------------------
  // 2.6 Footstep Dust Puffs Pool
  // --------------------------------------------------------------------------
  _initFootstepDustPool() {
    this.footstepCount = 32;
    const puffGeo = new THREE.IcosahedronGeometry(0.09, 1);
    const puffMat = applyParticleWorldCurve(
      new THREE.MeshBasicMaterial({
        color: 0xf7efe0,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      })
    );
    this.footstepMesh = new THREE.InstancedMesh(
      puffGeo,
      puffMat,
      this.footstepCount
    );
    this.footstepMesh.frustumCulled = false;

    this.footstepCursor = 0;
    this.footstepData = [];
    for (let i = 0; i < this.footstepCount; i++) {
      this.footstepData.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0.55,
        maxScale: 1.0,
      });
      this._dummy.position.set(0, -100, 0);
      this._dummy.scale.setScalar(0.001);
      this._dummy.updateMatrix();
      this.footstepMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.footstepMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.footstepMesh);
  }

  // --------------------------------------------------------------------------
  // Public Emitter Triggers (callable by main.js, characters, or UI)
  // --------------------------------------------------------------------------
  emitFootstep(x, y = 0.65, z = 0, surfaceType = 'grass') {
    if (x && typeof x === 'object') {
      surfaceType = y || 'grass';
      z = x.z || 0;
      y = x.y ?? 0.65;
      x = x.x || 0;
    }
    for (let k = 0; k < 2; k++) {
      const idx = this.footstepCursor;
      this.footstepCursor = (this.footstepCursor + 1) % this.footstepCount;
      const p = this.footstepData[idx];
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.24;
      p.y = y + 0.05;
      p.z = z + (Math.random() - 0.5) * 0.24;
      p.vx = (Math.random() - 0.5) * 0.45;
      p.vy = 0.35 + Math.random() * 0.25;
      p.vz = (Math.random() - 0.5) * 0.45;
      p.age = 0;
      p.life = 0.45 + Math.random() * 0.2;
      p.maxScale = surfaceType === 'sand' || surfaceType === 'dirt_path' ? 1.15 : 0.85;
    }
  }

  spawnFootstepDust(pos, surfaceType = 'grass') {
    this.emitFootstep(pos, surfaceType);
  }

  emitDirtBurst(x = -7.5, y = 0.65, z = -8.0) {
    if (x && typeof x === 'object') {
      z = x.z ?? -8.0;
      y = x.y ?? 0.65;
      x = x.x ?? -7.5;
    }
    for (let i = 0; i < this.dynamicClodCount; i++) {
      const p = this.dynamicClodData[i];
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.22;
      p.y = y + 0.08 + Math.random() * 0.12;
      p.z = z + (Math.random() - 0.5) * 0.22;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.65 + Math.random() * 1.1;
      p.vx = Math.cos(angle) * speed;
      p.vy = 1.6 + Math.random() * 1.4;
      p.vz = Math.sin(angle) * speed;
      p.age = 0;
      p.life = 0.55 + Math.random() * 0.25;
      p.scale = 0.45 + Math.random() * 0.65;
    }
  }

  spawnDirtBurst(pos) {
    this.emitDirtBurst(pos);
  }

  emitShovelDig(x, y, z) {
    this.emitDirtBurst(x, y, z);
  }

  emitWaterSpray(x, y = 1.05, z = 0, dirX = -0.35, dirZ = 0.88) {
    if (!this.playerSprayGroup) return;
    this.playerSprayTimer = 1.15;
    if (x && typeof x === 'object') {
      const pos = x;
      const dir = y || { x: -0.35, z: 0.88 };
      this.playerSprayGroup.position.set(
        pos.x ?? -3.35,
        (pos.y ?? 0.6) + 0.45,
        pos.z ?? -0.35
      );
      for (const item of this.playerSprayGroup.userData.items) {
        item.dirX = dir.x ?? -0.35;
        item.dirZ = dir.z ?? 0.88;
      }
      this.playerSprayGroup.visible = true;
      return;
    }
    this.playerSprayGroup.position.set(x, y, z);
    for (const item of this.playerSprayGroup.userData.items) {
      item.dirX = dirX;
      item.dirZ = dirZ;
    }
    this.playerSprayGroup.visible = true;
  }

  spawnWaterSpray(pos, dir) {
    this.emitWaterSpray(pos, dir);
  }

  emitFlowerSparkle(x, y = 1.0, z = 0) {
    if (!this.sparkleData || !this.sparkleData.length) return;
    this._sparkleWriteIdx = ((this._sparkleWriteIdx || 0) + 1) % this.sparkleData.length;
    const sp = this.sparkleData[this._sparkleWriteIdx];
    sp.x = x + (Math.random() - 0.5) * 0.16;
    sp.y = (y || 0.6) + 0.38 + Math.random() * 0.15;
    sp.z = z + (Math.random() - 0.5) * 0.16;
    sp.phase = Math.random() * Math.PI * 2;
    sp.speed = 2.6 + Math.random() * 1.2;
  }

  setScenePreset(presetName) {
    const aliasMap = {
      ref_01: 'beach_sunset',
      ref_02: 'house_yard',
      ref_03: 'flower_river',
      ref_04: 'tent_horizon',
      ref_05: 'bridge_plaza',
      ref_06: 'cliff_waterfall',
    };
    const preset = aliasMap[presetName] || presetName || 'free_roam';
    this.currentPreset = preset;

    const isFreeRoam = preset === 'free_roam' || preset === 'follow_player';
    if (this.petalMesh) {
      this.petalMesh.visible = isFreeRoam;
    }
    if (this.moteMesh) {
      this.moteMesh.visible = isFreeRoam;
    }
    if (this.barnabySprayGroup) {
      this.barnabySprayGroup.visible = preset === 'house_yard' || isFreeRoam;
    }
    if (this.playerSprayGroup) {
      this.playerSprayGroup.visible = preset === 'flower_river';
    }
    if (this.shovelDirtBurstGroup) {
      this.shovelDirtBurstGroup.visible = preset === 'cliff_waterfall';
    }
    if (this.sparkleMesh) {
      this.sparkleMesh.visible =
        preset === 'flower_river' || preset === 'house_yard' || isFreeRoam;
    }
    if (this.emberMesh) {
      this.emberMesh.visible = preset === 'beach_sunset' || isFreeRoam;
    }
    if (this.smokeMesh) {
      this.smokeMesh.visible = preset === 'house_yard' || isFreeRoam;
    }
  }

  setPreset(presetName) {
    this.setScenePreset(presetName);
  }

  _updateSprayGroup(group, elapsed) {
    if (!group || !group.visible || !group.userData) return;
    const { instMesh, items, count } = group.userData;
    for (let i = 0; i < count; i++) {
      const d = items[i];
      const t = (elapsed * d.speed + d.phase) % 1.0;
      const baseAngle = Math.atan2(d.dirX, d.dirZ) + d.fanAngle;
      const horizDist = t * d.spreadRadius * 1.95;
      const wx = Math.sin(baseAngle) * horizDist;
      const wz = Math.cos(baseAngle) * horizDist;
      const wy = 0.16 * t - 0.85 * t * t;

      this._dummy.position.set(wx, wy, wz);
      this._dummy.rotation.set(0.65 + t * 0.7, baseAngle, 0);
      const dropScale = Math.sin(t * Math.PI);
      this._dummy.scale.set(
        Math.max(0.04, dropScale * 0.75),
        Math.max(0.04, dropScale * 0.75),
        Math.max(0.04, dropScale * 1.25)
      );
      this._dummy.updateMatrix();
      instMesh.setMatrixAt(i, this._dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Frame Update
  // --------------------------------------------------------------------------
  update(dt = 0.016, elapsed = 0, context = null) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const preset = this.currentPreset || 'free_roam';
    const isFreeRoam = preset === 'free_roam' || preset === 'follow_player';

    if (this.playerSprayTimer && this.playerSprayTimer > 0) {
      this.playerSprayTimer = Math.max(0, this.playerSprayTimer - safeDt);
    }

    // Ensure preset visibility rules stay enforced
    if (this.petalMesh) this.petalMesh.visible = isFreeRoam;
    if (this.moteMesh) this.moteMesh.visible = isFreeRoam;
    if (this.barnabySprayGroup) {
      this.barnabySprayGroup.visible = preset === 'house_yard' || isFreeRoam;
    }
    if (this.playerSprayGroup) {
      this.playerSprayGroup.visible =
        preset === 'flower_river' || (this.playerSprayTimer > 0);
    }
    if (this.shovelDirtBurstGroup) {
      this.shovelDirtBurstGroup.visible = preset === 'cliff_waterfall';
    }

    // 1. Update Floating Cherry Blossom Petals & Autumn Leaves (only when visible)
    if (this.petalMesh && this.petalMesh.visible) {
      for (let i = 0; i < this.petalCount; i++) {
        const p = this.petalData[i];
        p.x += (p.vx + Math.sin(elapsed * 1.1 + p.phase) * 0.22) * safeDt;
        p.y += (p.vy + Math.cos(elapsed * 1.6 + p.phase) * 0.08) * safeDt;
        p.z += (p.vz + Math.cos(elapsed * 0.9 + p.phase) * 0.16) * safeDt;

        if (p.y < 0.15) {
          p.y = 5.5 + Math.random() * 2.5;
          p.x = (Math.random() - 0.5) * 42;
          p.z = -15 + Math.random() * 36;
        }
        if (p.x < -24) p.x = 24;
        if (p.x > 24) p.x = -24;

        this._dummy.position.set(p.x, p.y, p.z);
        this._dummy.rotation.set(
          elapsed * p.rotSpeedX + p.phase,
          elapsed * p.rotSpeedY + p.phase,
          elapsed * p.rotSpeedZ
        );
        this._dummy.scale.setScalar(p.scale);
        this._dummy.updateMatrix();
        this.petalMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.petalMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Update Golden Hour Dust Motes & Twilight Fireflies (only when visible)
    if (this.moteMesh && this.moteMesh.visible) {
      for (let i = 0; i < this.moteCount; i++) {
        const m = this.moteData[i];
        const t = elapsed * m.speed + m.phase;
        const mx = m.baseX + Math.sin(t) * m.radius;
        const my = m.baseY + Math.sin(t * 1.35) * 0.28;
        const mz = m.baseZ + Math.cos(t * 0.9) * m.radius;
        const pulse = m.baseScale * (0.55 + 0.45 * Math.sin(t * 2.2));

        this._dummy.position.set(mx, my, mz);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.setScalar(Math.max(0.05, pulse));
        this._dummy.updateMatrix();
        this.moteMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.moteMesh.instanceMatrix.needsUpdate = true;
    }

    // 3A. Update Campfire Embers
    if (this.emberMesh && this.emberMesh.visible) {
      for (let i = 0; i < this.emberCount; i++) {
        const e = this.emberData[i];
        const progress = (elapsed * e.speed + e.phase) % 1.0;
        const ex =
          e.originX +
          Math.sin(progress * Math.PI * 2 + e.phase) * 0.05 +
          e.swayX * progress;
        const ey = e.originY + progress * e.maxHeight;
        const ez = e.originZ + e.swayZ * progress;
        const scale = Math.sin(progress * Math.PI) * 0.85;

        this._dummy.position.set(ex, ey, ez);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.setScalar(Math.max(0.01, scale));
        this._dummy.updateMatrix();
        this.emberMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.emberMesh.instanceMatrix.needsUpdate = true;
    }

    // 3B. Update Cottage Chimney Smoke Puffs (-4.9, 4.3, -10.2)
    if (this.smokeMesh && this.smokeMesh.visible) {
      for (let i = 0; i < this.smokeCount; i++) {
        const s = this.smokeData[i];
        const progress = (elapsed * s.speed + s.offset) % 1.0;
        const sx =
          s.originX +
          s.driftX * progress * 1.8 +
          Math.sin(elapsed * 1.4 + i) * 0.08 * progress;
        const sy = s.originY + progress * 2.4;
        const sz = s.originZ + s.driftZ * progress * 1.4;
        const scale =
          Math.sin(progress * Math.PI) * (0.38 + progress * 0.85);

        this._dummy.position.set(sx, sy, sz);
        this._dummy.rotation.set(elapsed * 0.4 + i, elapsed * 0.3, 0);
        this._dummy.scale.setScalar(Math.max(0.01, scale));
        this._dummy.updateMatrix();
        this.smokeMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.smokeMesh.instanceMatrix.needsUpdate = true;
    }

    // 4A. Update Watering Can Droplet Spray Groups (Barnaby + Player)
    this._updateSprayGroup(this.barnabySprayGroup, elapsed);
    this._updateSprayGroup(this.playerSprayGroup, elapsed);

    // 4B. Update 4-Point Tulip Star Sparkles
    if (this.sparkleMesh && this.sparkleMesh.visible) {
      for (let i = 0; i < this.sparkleCount; i++) {
        const sp = this.sparkleData[i];
        const showThisPatch =
          isFreeRoam ||
          (preset === 'flower_river' && sp.isGardenPatch) ||
          (preset === 'house_yard' && !sp.isGardenPatch);
        if (!showThisPatch) {
          this._dummy.position.set(0, -100, 0);
          this._dummy.scale.setScalar(0.001);
          this._dummy.updateMatrix();
          this.sparkleMesh.setMatrixAt(i, this._dummy.matrix);
          continue;
        }
        const wave = Math.sin(elapsed * sp.speed + sp.phase);
        const scale = Math.max(0.0, wave) * 0.85;
        this._dummy.position.set(
          sp.x,
          sp.y + Math.sin(elapsed * 1.8 + sp.phase) * 0.06,
          sp.z
        );
        this._dummy.rotation.set(-0.35, 0, elapsed * 1.5 + sp.phase);
        this._dummy.scale.setScalar(scale);
        this._dummy.updateMatrix();
        this.sparkleMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.sparkleMesh.instanceMatrix.needsUpdate = true;
    }

    // 5. Update Shovel Terraforming Sculpted 3D Dirt Clod Burst (-7.5, 0.65, -8.0)
    if (this.shovelDirtBurstGroup && this.shovelDirtBurstGroup.visible) {
      for (let i = 0; i < this.dirtClodMeshes.length; i++) {
        const m = this.dirtClodMeshes[i];
        const pulse = Math.sin(elapsed * 3.2 + m.userData.phase) * 0.02;
        m.position.y = m.userData.basePos.y + pulse;
        m.rotation.z += safeDt * 0.35 * (i % 2 === 0 ? 1 : -1);
      }
    }

    // Update dynamic dig burst particles
    let clodMatrixDirty = false;
    for (let i = 0; i < this.dynamicClodCount; i++) {
      const p = this.dynamicClodData[i];
      if (!p.active) continue;
      clodMatrixDirty = true;
      p.age += safeDt;
      if (p.age >= p.life) {
        p.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        this.dynamicClodMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z += p.vz * safeDt;
      p.vy -= 5.8 * safeDt;
      const s = p.scale * (1.0 - (p.age / p.life) * 0.65);
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.rotation.set(p.age * 5, p.age * 4, 0);
      this._dummy.scale.setScalar(Math.max(0.01, s));
      this._dummy.updateMatrix();
      this.dynamicClodMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (clodMatrixDirty) {
      this.dynamicClodMesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Auto-track player footsteps if player object is provided in context
    const playerObj =
      context?.player?.mesh ||
      context?.player?.root ||
      context?.player?.group ||
      context?.player;
    if (playerObj && playerObj.position) {
      if (this._hasLastPlayerPos) {
        const dx = playerObj.position.x - this._lastPlayerPos.x;
        const dz = playerObj.position.z - this._lastPlayerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001 && dist < 1.5) {
          this._stepDistanceAccum += dist;
          if (this._stepDistanceAccum >= 0.65) {
            this._stepDistanceAccum = 0;
            this.emitFootstep(
              playerObj.position.x,
              playerObj.position.y,
              playerObj.position.z,
              context?.surfaceType || 'grass'
            );
          }
        }
      }
      this._lastPlayerPos.copy(playerObj.position);
      this._hasLastPlayerPos = true;
    }

    // Update active footstep puffs
    let footstepDirty = false;
    for (let i = 0; i < this.footstepCount; i++) {
      const f = this.footstepData[i];
      if (!f.active) continue;
      footstepDirty = true;
      f.age += safeDt;
      if (f.age >= f.life) {
        f.active = false;
        this._dummy.position.set(0, -100, 0);
        this._dummy.scale.setScalar(0.001);
        this._dummy.updateMatrix();
        this.footstepMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      const norm = f.age / f.life;
      f.x += f.vx * safeDt;
      f.y += f.vy * safeDt;
      f.z += f.vz * safeDt;
      const scale = Math.sin(norm * Math.PI) * f.maxScale;
      this._dummy.position.set(f.x, f.y, f.z);
      this._dummy.rotation.set(f.age * 2, f.age * 1.5, 0);
      this._dummy.scale.setScalar(Math.max(0.01, scale));
      this._dummy.updateMatrix();
      this.footstepMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (footstepDirty) {
      this.footstepMesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ============================================================================
// Pre-Generated Lyria 3 Island Music & Gemini 3.8 Flash TTS Voice-Designed Clips
// ============================================================================
export const LYRIA_ISLAND_TRACKS = {
  morning: {
    id: 'morning',
    title: '8:15 AM • Morning Breeze (Lyria 3)',
    src: './assets/audio/music/morning_breeze.mp3',
    baseVolume: 0.44,
  },
  noon: {
    id: 'noon',
    title: '1:20 PM • Sunny Noon Plaza (Lyria 3)',
    src: './assets/audio/music/sunny_noon.mp3',
    baseVolume: 0.44,
  },
  golden_hour: {
    id: 'golden_hour',
    title: '5:42 PM • Golden Hour Cove (Lyria 3)',
    src: './assets/audio/music/golden_hour.mp3',
    baseVolume: 0.46,
  },
  night: {
    id: 'night',
    title: '9:30 PM • Starry Night Lullaby (Lyria 3)',
    src: './assets/audio/music/starry_night.mp3',
    baseVolume: 0.42,
  },
};

export const GEMINI_38_TTS_CLIPS = {
  Barnaby: [
    './assets/audio/tts/barnaby_01.wav',
    './assets/audio/tts/barnaby_02.wav',
    './assets/audio/tts/barnaby_03.wav',
  ],
  Clover: [
    './assets/audio/tts/clover_01.wav',
    './assets/audio/tts/clover_02.wav',
    './assets/audio/tts/clover_03.wav',
  ],
  Milo: [
    './assets/audio/tts/milo_01.wav',
    './assets/audio/tts/milo_02.wav',
    './assets/audio/tts/milo_03.wav',
  ],
};

export const GEMINI_38_VOICE_DESIGN_SAMPLES = {
  Barnaby: './assets/audio/tts/voice_design_barnaby.wav',
  Clover: './assets/audio/tts/voice_design_clover.wav',
  Milo: './assets/audio/tts/voice_design_milo.wav',
};

// ============================================================================
// 3. CozyAudioEngine
//    - Pre-generated Lyria 3 Island Soundtrack (./assets/audio/music/*.mp3)
//      with smooth time-of-day crossfading & voice-over ducking
//    - Pre-generated Gemini 3.8 Flash TTS Voice-Designed Villager Dialogue
//      (./assets/audio/tts/*.wav) with custom vocal personas & inline vocal tags
//    - Procedural Web Audio API Nature Ambience & Tactile SFX fallback
// ============================================================================
export class CozyAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;

    this.isInitialized = false;
    this.isMuted = false;
    this.isPlaying = false;
    this.timeOfDay = 'golden_hour';

    // Preloaded HTML5 Audio elements for Lyria 3 music & Gemini 3.8 Flash TTS dialogue
    this.lyriaTracks = new Map();
    this.ttsClips = new Map();
    this.activeLyriaTrack = null;
    this.activeVoiceAudio = null;
    this.isVoiceSpeaking = false;
    this.lyriaMusicActive = false;

    // Argon Valley Hourly Chord Progression fallback:
    // Fmaj7 - Em7 - Dm7 - Cmaj7 - Bbmaj7 - Am7 - Gm7 - C9
    this.chordProgression = [
      { name: 'Fmaj7', notes: [174.61, 220.0, 261.63, 329.63, 392.0], melody: [523.25, 659.25, 587.33, 523.25] },
      { name: 'Em7',   notes: [164.81, 196.0, 246.94, 293.66, 392.0], melody: [493.88, 587.33, 659.25, 493.88] },
      { name: 'Dm7',   notes: [146.83, 220.0, 261.63, 349.23, 440.0], melody: [523.25, 440.0, 392.0, 349.23] },
      { name: 'Cmaj7', notes: [130.81, 196.0, 246.94, 329.63, 392.0], melody: [392.0, 523.25, 493.88, 392.0] },
      { name: 'Bbmaj7',notes: [116.54, 174.61, 220.0, 293.66, 349.23], melody: [440.0, 587.33, 523.25, 440.0] },
      { name: 'Am7',   notes: [110.0, 164.81, 220.0, 261.63, 329.63], melody: [523.25, 392.0, 440.0, 329.63] },
      { name: 'Gm7',   notes: [98.0, 146.83, 196.0, 233.08, 293.66],  melody: [392.0, 440.0, 523.25, 587.33] },
      { name: 'C9',    notes: [130.81, 164.81, 233.08, 293.66, 392.0], melody: [659.25, 587.33, 523.25, 392.0] },
    ];

    this._chordIndex = 0;
    this._stepIndex = 0;
    this._stepTimer = 0;
    this._noiseBuffer = null;

    this._preloadLyriaAndTtsAssets();
    this._bindUnlockListeners();
  }

  _preloadLyriaAndTtsAssets() {
    if (typeof Audio === 'undefined') return;

    // 1. Preload 4 Lyria 3 time-of-day tracks
    for (const [tod, meta] of Object.entries(LYRIA_ISLAND_TRACKS)) {
      try {
        const audio = new Audio();
        audio.src = meta.src;
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = meta.baseVolume;
        this.lyriaTracks.set(tod, audio);
      } catch (e) {}
    }

    // 2. Preload 9 Gemini 3.8 Flash TTS Voice-Designed dialogue clips
    for (const [villager, urls] of Object.entries(GEMINI_38_TTS_CLIPS)) {
      urls.forEach((url, idx) => {
        try {
          const audio = new Audio();
          audio.src = url;
          audio.preload = 'auto';
          audio.volume = 0.92;
          this.ttsClips.set(`${villager}_${idx}`, audio);
        } catch (e) {}
      });
    }
  }

  _bindUnlockListeners() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (!this.isInitialized && !this.isMuted) {
        this.init();
      }
      if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
      if (!this.isMuted && !this.lyriaMusicActive) {
        this._playLyriaTrackForTod(this.timeOfDay);
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  _playLyriaTrackForTod(tod) {
    const key = LYRIA_ISLAND_TRACKS[tod] ? tod : 'golden_hour';
    const nextAudio = this.lyriaTracks.get(key);
    if (!nextAudio) return;

    const targetVol = this.isMuted
      ? 0.0
      : this.isVoiceSpeaking
        ? 0.14
        : (LYRIA_ISLAND_TRACKS[key]?.baseVolume ?? 0.44);

    for (const [k, track] of this.lyriaTracks.entries()) {
      if (k !== key && !track.paused) {
        track.pause();
      }
    }

    nextAudio.volume = targetVol;
    this.activeLyriaTrack = nextAudio;
    if (!this.isMuted && nextAudio.paused) {
      nextAudio
        .play()
        .then(() => {
          this.lyriaMusicActive = true;
        })
        .catch(() => {});
    }
  }

  init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume().catch(() => {});
      }
      if (!this.isMuted) {
        this._playLyriaTrackForTod(this.timeOfDay);
      }
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0.0 : 0.72;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.masterGain);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.value = 0.24;
      this.ambienceGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.58;
      this.sfxGain.connect(this.masterGain);

      this._createPinkNoiseBuffer();
      this._startNatureAmbience();

      this.isInitialized = true;
      this.isPlaying = true;
      if (!this.isMuted) {
        this._playLyriaTrackForTod(this.timeOfDay);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isMuted) {
      this._playLyriaTrackForTod(this.timeOfDay);
    }
  }

  toggleMute() {
    if (!this.isInitialized) {
      this.isMuted = false;
      this.init();
      this.playUIClick();
      return this.isMuted;
    }
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0.0 : 0.72, now, 0.06);
      if (!this.isMuted && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
    if (this.isMuted) {
      for (const track of this.lyriaTracks.values()) {
        track.pause();
      }
      if (this.activeVoiceAudio && !this.activeVoiceAudio.paused) {
        this.activeVoiceAudio.pause();
      }
      this.lyriaMusicActive = false;
    } else {
      this._playLyriaTrackForTod(this.timeOfDay);
      this.playUIClick();
    }
    this.isPlaying = !this.isMuted;
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0.0 : 0.72,
        this.ctx.currentTime,
        0.05
      );
    }
    if (this.isMuted) {
      for (const track of this.lyriaTracks.values()) {
        track.pause();
      }
      if (this.activeVoiceAudio && !this.activeVoiceAudio.paused) {
        this.activeVoiceAudio.pause();
      }
      this.lyriaMusicActive = false;
    } else {
      this._playLyriaTrackForTod(this.timeOfDay);
    }
    this.isPlaying = !this.isMuted;
  }

  setTimeOfDay(tod) {
    this.timeOfDay = tod || 'golden_hour';
    if (!this.isMuted && this.isInitialized) {
      this._playLyriaTrackForTod(this.timeOfDay);
    }
  }

  _createPinkNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
    this._noiseBuffer = buffer;
  }

  _startNatureAmbience() {
    if (!this.ctx || !this._noiseBuffer) return;
    try {
      // 1. Ocean Surf Waves (Filtered Pink Noise + 0.13 Hz Wave LFO)
      const surfSource = this.ctx.createBufferSource();
      surfSource.buffer = this._noiseBuffer;
      surfSource.loop = true;

      const surfFilter = this.ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 340;

      const surfWaveGain = this.ctx.createGain();
      surfWaveGain.gain.value = 0.16;

      const waveLfo = this.ctx.createOscillator();
      waveLfo.type = 'sine';
      waveLfo.frequency.value = 0.13; // ~7.7s per gentle ocean wave
      const waveLfoDepth = this.ctx.createGain();
      waveLfoDepth.gain.value = 220;
      waveLfo.connect(waveLfoDepth);
      waveLfoDepth.connect(surfFilter.frequency);

      surfSource.connect(surfFilter);
      surfFilter.connect(surfWaveGain);
      surfWaveGain.connect(this.ambienceGain);

      surfSource.start();
      waveLfo.start();

      // 2. Waterfall & River Stream Babble (Bandpass filtered stream murmur)
      const riverSource = this.ctx.createBufferSource();
      riverSource.buffer = this._noiseBuffer;
      riverSource.loop = true;

      const riverFilter = this.ctx.createBiquadFilter();
      riverFilter.type = 'bandpass';
      riverFilter.frequency.value = 820;
      riverFilter.Q.value = 1.4;

      const riverGain = this.ctx.createGain();
      riverGain.gain.value = 0.065;

      riverSource.connect(riverFilter);
      riverFilter.connect(riverGain);
      riverGain.connect(this.ambienceGain);
      riverSource.start();
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Plucked Nylon Acoustic Guitar & Wooden Marimba Synthesis
  // --------------------------------------------------------------------------
  _playGuitarPluck(freq, startTime, duration = 0.85, velocity = 0.14) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2.0, startTime); // Warm 2nd harmonic

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, startTime);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(180, freq * 1.2),
        startTime + duration * 0.75
      );

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(velocity, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      const harmGain = this.ctx.createGain();
      harmGain.gain.value = 0.25;

      osc1.connect(filter);
      osc2.connect(harmGain);
      harmGain.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration + 0.02);
      osc2.stop(startTime + duration + 0.02);
    } catch (e) {}
  }

  _playMarimbaNote(freq, startTime, velocity = 0.11) {
    if (!this.ctx || this.isMuted) return;
    try {
      const fund = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      fund.type = 'sine';
      overtone.type = 'sine';
      fund.frequency.setValueAtTime(freq, startTime);
      overtone.frequency.setValueAtTime(freq * 3.98, startTime); // Classic wooden bar 4th harmonic

      const fundGain = this.ctx.createGain();
      fundGain.gain.setValueAtTime(0.0001, startTime);
      fundGain.gain.linearRampToValueAtTime(velocity, startTime + 0.006);
      fundGain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.34);

      const overGain = this.ctx.createGain();
      overGain.gain.setValueAtTime(0.0001, startTime);
      overGain.gain.linearRampToValueAtTime(velocity * 0.35, startTime + 0.004);
      overGain.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.065);

      fund.connect(fundGain);
      overtone.connect(overGain);
      fundGain.connect(this.musicGain);
      overGain.connect(this.musicGain);

      fund.start(startTime);
      overtone.start(startTime);
      fund.stop(startTime + 0.36);
      overtone.stop(startTime + 0.08);
    } catch (e) {}
  }

  _playShakerTick(startTime, accent = false) {
    if (!this.ctx || !this._noiseBuffer || this.isMuted) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5200;

      const gain = this.ctx.createGain();
      const peak = accent ? 0.045 : 0.022;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.045);

      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.musicGain);

      src.start(startTime, Math.random() * 2.0, 0.05);
    } catch (e) {}
  }

  update(dt = 0.016, elapsed = 0) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (this.ctx.state !== 'running') return;

    // When a pre-generated Lyria 3 MP3 track is actively playing, let Lyria 3 carry the island soundtrack!
    if (this.lyriaMusicActive && this.activeLyriaTrack && !this.activeLyriaTrack.paused) {
      return;
    }

    const stepDuration = this.timeOfDay === 'night' ? 0.31 : 0.25; // Syncopated 16th/8th groove
    this._stepTimer += Math.min(dt || 0.016, 0.1);
    if (this._stepTimer < stepDuration) return;
    this._stepTimer -= stepDuration;

    const now = this.ctx.currentTime + 0.01;
    const chord = this.chordProgression[this._chordIndex];
    const step = this._stepIndex % 8;

    // Step 0: Warm bass root + strummed guitar chord arpeggio
    if (step === 0) {
      chord.notes.forEach((n, idx) => {
        this._playGuitarPluck(n, now + idx * 0.032, 1.35, idx === 0 ? 0.15 : 0.09);
      });
    } else if (step === 3 || step === 6) {
      // Syncopated bossa/island chord Comp
      this._playGuitarPluck(chord.notes[1], now, 0.55, 0.075);
      this._playGuitarPluck(chord.notes[2], now + 0.018, 0.55, 0.075);
      this._playGuitarPluck(chord.notes[3], now + 0.035, 0.55, 0.075);
    }

    // Wooden Marimba Counter-Melody on syncopated steps
    if (step === 1 || step === 4 || step === 5 || step === 7) {
      const mIdx = (step + this._chordIndex) % chord.melody.length;
      this._playMarimbaNote(chord.melody[mIdx], now, 0.09);
    }

    // Soft shaker rhythm
    if (step % 2 === 0 || step === 5) {
      this._playShakerTick(now, step === 0 || step === 4);
    }

    this._stepIndex++;
    if (this._stepIndex >= 8) {
      this._stepIndex = 0;
      this._chordIndex = (this._chordIndex + 1) % this.chordProgression.length;
    }
  }

  // --------------------------------------------------------------------------
  // Tactile Island SFX + Gemini 3.8 Flash TTS Voice-Designed Dialogue Playback
  // --------------------------------------------------------------------------
  playFootstep(surfaceType = 'grass') {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const configs = {
        grass: { fStart: 155, fEnd: 75, dur: 0.065, vol: 0.12, type: 'sine' },
        sand: { fStart: 240, fEnd: 110, dur: 0.075, vol: 0.10, type: 'triangle' },
        dirt_path: { fStart: 185, fEnd: 85, dur: 0.055, vol: 0.15, type: 'triangle' },
        bridge: { fStart: 290, fEnd: 150, dur: 0.05, vol: 0.18, type: 'sine' },
        stone_plaza: { fStart: 420, fEnd: 210, dur: 0.04, vol: 0.16, type: 'triangle' },
        cliff: { fStart: 360, fEnd: 180, dur: 0.045, vol: 0.15, type: 'triangle' },
      };
      const cfg = configs[surfaceType] || configs.grass;

      osc.type = cfg.type;
      osc.frequency.setValueAtTime(cfg.fStart * (0.94 + Math.random() * 0.12), now);
      osc.frequency.exponentialRampToValueAtTime(cfg.fEnd, now + cfg.dur);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(cfg.vol, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + cfg.dur);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + cfg.dur + 0.01);
    } catch (e) {}
  }

  playTreeShake() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Rustle noise + cheerful fruit pop
      if (this._noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1400;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.22, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.sfxGain);
        src.start(now, 0, 0.25);
      }
      this.playFruitPop(now + 0.12);
    } catch (e) {}
  }

  playFruitPop(startTime = null) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = startTime || this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(760, t + 0.09);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    } catch (e) {}
  }

  playShovelDig() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Crisp soil crunch + low earth thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.14);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.17);

      if (this._noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 950;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.24, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(this.sfxGain);
        src.start(now, 0.2, 0.15);
      }
    } catch (e) {}
  }

  playTrowelPat() {
    this.playFootstep('dirt_path');
  }

  playWateringCan() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Gentle water shower + sparkle bell notes
      const notes = [783.99, 987.77, 1174.66, 1567.98];
      notes.forEach((f, i) => {
        this._playMarimbaNote(f, now + i * 0.055, 0.08);
      });
    } catch (e) {}
  }

  playUIClick() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      this._playMarimbaNote(587.33, now, 0.12);
      this._playMarimbaNote(880.0, now + 0.04, 0.1);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Pre-Generated Gemini 3.8 Flash TTS Voice-Designed Dialogue Playback
  // --------------------------------------------------------------------------
  playVillagerVoiceLine(villagerKey = 'Barnaby', lineIndex = 0, fallbackText = '', pitchBase = 1.0) {
    if (this.isMuted) return;
    if (!this.isInitialized) this.init();

    const clipKey = `${villagerKey}_${lineIndex % 3}`;
    const clip = this.ttsClips.get(clipKey);

    if (this.activeVoiceAudio && !this.activeVoiceAudio.paused) {
      try {
        this.activeVoiceAudio.pause();
        this.activeVoiceAudio.currentTime = 0;
      } catch (e) {}
    }

    if (clip) {
      try {
        clip.currentTime = 0;
        clip.volume = 0.94;
        this.activeVoiceAudio = clip;
        this.isVoiceSpeaking = true;

        // Duck Lyria 3 background music slightly so the Voice-Designed dialogue shines
        if (this.activeLyriaTrack) {
          this.activeLyriaTrack.volume = 0.14;
        }

        const restoreMusicVol = () => {
          this.isVoiceSpeaking = false;
          if (this.activeLyriaTrack && !this.isMuted) {
            const baseVol = LYRIA_ISLAND_TRACKS[this.timeOfDay]?.baseVolume ?? 0.44;
            this.activeLyriaTrack.volume = baseVol;
          }
        };
        clip.onended = restoreMusicVol;

        clip.play().catch(() => {
          restoreMusicVol();
          this.playValleySpeech(fallbackText, pitchBase);
        });
        return;
      } catch (e) {}
    }

    this.playValleySpeech(fallbackText, pitchBase);
  }

  // --------------------------------------------------------------------------
  // ValleySpeech Vowel-Formant Voice Synth (fallback if audio autoplay is locked)
  // --------------------------------------------------------------------------
  speakCharacter(char, pitchBase = 1.0) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (!char || !/[a-zA-Z]/.test(char)) return;
    try {
      const now = this.ctx.currentTime;
      const code = char.toLowerCase().charCodeAt(0) - 97;
      const semitoneOffset = ((code * 5) % 9) - 3;
      const fundamental =
        310 * pitchBase * Math.pow(2, semitoneOffset / 12) * (0.96 + Math.random() * 0.08);

      // Vowel formants (F1 / F2) approximated per letter group
      const formants = [
        [730, 1090], // a
        [530, 1840], // e
        [390, 1990], // i
        [570, 840],  // o
        [440, 1020], // u
      ];
      const [f1, f2] = formants[code % formants.length];

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(fundamental, now);
      osc.frequency.linearRampToValueAtTime(fundamental * 1.12, now + 0.055);

      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(f1 * pitchBase, now);
      filter1.Q.value = 3.2;

      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'bandpass';
      filter2.frequency.setValueAtTime(f2 * pitchBase, now);
      filter2.Q.value = 3.5;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.095, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.068);

      osc.connect(filter1);
      osc.connect(filter2);
      filter1.connect(env);
      filter2.connect(env);
      env.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.072);
    } catch (e) {}
  }

  playValleySpeech(text = '', pitchBase = 1.0) {
    if (!this.isInitialized) this.init();
    const clean = String(text).replace(/<[^>]*>/g, '');
    const maxChars = Math.min(clean.length, 36);
    for (let i = 0; i < maxChars; i++) {
      const ch = clean[i];
      if (/[a-zA-Z]/.test(ch)) {
        setTimeout(() => this.speakCharacter(ch, pitchBase), i * 42);
      }
    }
  }

  playPickupChime() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 880.0]; // D5 -> A5 cheerful pop
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.065;
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.06, t0 + 0.11);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.18, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + 0.15);
      });
    } catch (e) {}
  }

  playCatchFanfare() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Joyful Argon Valley major-9th catch arpeggio (F5 - A5 - C6 - E6 - G6)
      const notes = [698.46, 880.0, 1046.5, 1318.5, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const t0 = now + idx * 0.075;
        const dur = idx === notes.length - 1 ? 0.38 : 0.16;
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      });
    } catch (e) {}
  }

  playSplash() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted || !this.pinkNoiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.exponentialRampToValueAtTime(1450, now + 0.18);
      filter.Q.value = 2.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.26);
    } catch (e) {}
  }

  playNetWhoosh() {
    if (!this.isInitialized) this.init();
    if (!this.ctx || this.isMuted || !this.pinkNoiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(920, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + 0.16);
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.2);
    } catch (e) {}
  }
}

// ============================================================================
// 4. CozyUIManager
//    - Manages Island Pocket & Activity Tracker Card, Toast Banner,
//      3D Contextual Action Prompt Pill, Bottom-Left Argon Valley Clock & Weather,
//      Bottom-Right Tool & Action Dock, and Villager Dialogue with Choices
//    - Automatically hides all HUD elements in ?clean=1 or ?hud=0 mode!
// ============================================================================
export class CozyUIManager {
  constructor(options = {}) {
    this.options = options || {};
    this.audioEngine = options.audioEngine || options.audio || null;

    this.activePreset = 'free_roam';
    this.activeTimeOfDay = 'noon';
    this.activeTool = 'watering_can';
    this.curveEnabled = true;
    this.curveStrength = WORLD_CURVE_UNIFORMS?.uCurveStrength?.value ?? 0.0115;

    // Villager Dialogue Roster (Barnaby, Clover, Milo)
    this.villagerDialogues = {
      Barnaby: {
        name: 'Barnaby',
        bg: '#f49342',
        fg: '#fffdf4',
        pitch: 1.18,
        lines: [
          'Hammie! Nothing beats watering the tulips while the golden breeze rolls across the island, <span class="dialogue-highlight">li\'l bucko</span>!',
          'I just did 500 squat-curls by the cottage! Care to join my island workout patrol, <span class="dialogue-highlight">hammie</span>?',
          'Did you see how plump the apples look on the trees today? Shake a tree with <span class="dialogue-highlight">Space</span> for a snack!',
        ],
        giftLines: [
          'WHOA! A fresh island fruit?! That\'s pure high-octane cardio fuel, <span class="dialogue-highlight">hammie</span>! Here\'s <span class="dialogue-highlight">300 Coins</span> for being my best workout buddy!',
          'You brought me a snack?! My biceps are doing a happy dance right now, <span class="dialogue-highlight">li\'l bucko</span>! Take <span class="dialogue-highlight">300 Coins</span>!',
        ],
      },
      Clover: {
        name: 'Clover',
        bg: '#ff6e6b',
        fg: '#fffdf4',
        pitch: 1.32,
        lines: [
          'Tee-hee! Sitting by the flower river with a chocolate popsicle is peak island living, <span class="dialogue-highlight">tee-hee</span>!',
          'Look at all these red, yellow, and pink tulips! Try watering the flower buds with your <span class="dialogue-highlight">Watering Can</span>!',
          'You look TOTALLY fab in that outfit today! Have you tried catching a butterfly with the <span class="dialogue-highlight">Bug Net</span>?',
        ],
        giftLines: [
          'OMG!! For me?! This is literally the sweetest fruit on the whole island, <span class="dialogue-highlight">tee-hee</span>! Here\'s <span class="dialogue-highlight">300 Coins</span> as a thank-you gift!',
          'YUM! You always know how to brighten my day! Take <span class="dialogue-highlight">300 Coins</span> from my sparkly coin purse, <span class="dialogue-highlight">tee-hee</span>!',
        ],
      },
      Milo: {
        name: 'Milo',
        bg: '#5ec4f8',
        fg: '#fffdf4',
        pitch: 0.96,
        lines: [
          'Sulky! The acoustic guitar chords drifting over the stone arch bridge are actually perfection, <span class="dialogue-highlight">sulky</span>.',
          'I was just brewing a single-origin espresso before strolling down to the beach loungers.',
          'Have you cast your <span class="dialogue-highlight">Fishing Rod</span> in the river mouth yet? I spotted a Red Snapper earlier, <span class="dialogue-highlight">sulky</span>.',
        ],
        giftLines: [
          'Wait... an artisanal, hand-picked island fruit? I suppose I can pair this with my afternoon espresso, <span class="dialogue-highlight">sulky</span>. Please accept <span class="dialogue-highlight">300 Coins</span>.',
          'Impeccable taste as always! Here is <span class="dialogue-highlight">300 Coins</span> for your generosity, <span class="dialogue-highlight">sulky</span>.',
        ],
      },
    };
    this._villagerKeys = ['Barnaby', 'Clover', 'Milo'];
    this._currentVillagerIdx = 0;
    this._currentLineIdx = 0;
    this._typewriterTimer = null;
    this._toastTimer = null;

    this._checkCleanMode();
    this._bindDOMElements();
    this._attachEventListeners();
    this._applyURLPresetIfPresent();
  }

  _checkCleanMode() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    this.isCleanMode =
      params.get('clean') === '1' ||
      params.get('clean') === 'true' ||
      params.get('hud') === '0' ||
      params.get('hud') === 'false';

    const uiRoot = document.getElementById('ui-root');
    if (this.isCleanMode) {
      document.documentElement.classList.add('clean-mode');
      document.body?.classList.add('clean-mode');
      if (uiRoot) {
        uiRoot.classList.add('clean-hidden');
        uiRoot.style.display = 'none';
      }
    }
  }

  _bindDOMElements() {
    if (typeof document === 'undefined') return;
    this.uiRoot = document.getElementById('ui-root');
    this.nookPanel = document.getElementById('pocket-panel');
    this.collapseBtn = document.getElementById('btn-collapse-pocket');
    this.presetButtons = Array.from(
      document.querySelectorAll('#scene-preset-buttons .scene-pill')
    );
    this.todButtons = Array.from(
      document.querySelectorAll('#tod-buttons .tod-pill')
    );
    this.curveToggleBtn = document.getElementById('btn-curve-toggle');
    this.curveSlider = document.getElementById('curve-slider');
    this.curveValueLabel = document.getElementById('curve-value-label');

    // Pocket Inventory & Activity Counters
    this.invEls = {
      bells: document.getElementById('inv-bells'),
      apple: document.getElementById('inv-apple'),
      orange: document.getElementById('inv-orange'),
      coconut: document.getElementById('inv-coconut'),
      watered: document.getElementById('inv-watered'),
      fish: document.getElementById('inv-fish'),
      bugs: document.getElementById('inv-bugs'),
    };

    // Toast Banner & Context Prompt Pill
    this.toastBanner = document.getElementById('island-toast-banner');
    this.toastIcon = document.getElementById('toast-icon');
    this.toastText = document.getElementById('toast-text');
    this.contextPromptPill = document.getElementById('context-prompt-pill');
    this.promptKeyBadge = document.getElementById('prompt-key-badge');
    this.promptLabelText = document.getElementById('prompt-label-text');

    // Clock & Weather HUD
    this.weatherIconEl = document.getElementById('valley-weather-icon');
    this.timeDigitsEl = document.getElementById('valley-time-digits');
    this.timeAmPmEl = document.getElementById('valley-time-ampm');
    this.dateTextEl = document.getElementById('valley-date-text');
    this.dayPillEl = document.getElementById('valley-day-pill');

    // Dialogue Bubble & Choices
    this.dialogueBox = document.getElementById('valley-dialogue-box');
    this.speakerTag = document.getElementById('dialogue-speaker-tag');
    this.speakerName = document.getElementById('dialogue-speaker-name');
    this.dialogueText = document.getElementById('dialogue-text');
    this.dialogueNextBtn = document.getElementById('dialogue-next-btn');
    this.dialogueChoiceButtons = Array.from(
      document.querySelectorAll('#dialogue-choices .dialogue-choice-btn')
    );

    // Tool Dock
    this.toolButtons = Array.from(
      document.querySelectorAll('#valley-tool-dock .tool-bubble[data-tool]')
    );
    this.actionButtons = Array.from(
      document.querySelectorAll('#valley-tool-dock .tool-bubble[data-action]')
    );
    this.audioToggleBtn = document.getElementById('btn-audio-toggle');
    this.audioEmojiEl = document.getElementById('audio-emoji');
    this.audioLabelEl = document.getElementById('audio-label');
  }

  _attachEventListeners() {
    if (typeof document === 'undefined') return;

    // Collapse / Expand Pocket Panel
    if (this.collapseBtn && this.nookPanel) {
      this.collapseBtn.addEventListener('click', () => {
        const collapsed = this.nookPanel.classList.toggle('collapsed');
        this.collapseBtn.querySelector('span').textContent = collapsed ? '+' : '–';
        this.audioEngine?.playUIClick?.();
      });
    }

    // Scene Preset / Fast-Travel Pills
    this.presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.selectPreset(preset, true);
      });
    });

    // Time of Day Pills
    this.todButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tod = btn.dataset.tod;
        this.selectTimeOfDay(tod, true);
      });
    });

    // World Curve Toggle & Slider
    if (this.curveToggleBtn) {
      this.curveToggleBtn.addEventListener('click', () => {
        this.curveEnabled = !this.curveEnabled;
        this.curveToggleBtn.classList.toggle('active', this.curveEnabled);
        this.curveToggleBtn.textContent = this.curveEnabled ? 'ON' : 'OFF';
        if (WORLD_CURVE_UNIFORMS?.uCurveEnabled) {
          WORLD_CURVE_UNIFORMS.uCurveEnabled.value = this.curveEnabled ? 1.0 : 0.0;
        }
        this.options.onToggleCurve?.(this.curveEnabled, this.curveStrength);
        this.audioEngine?.playUIClick?.();
      });
    }

    if (this.curveSlider) {
      this.curveSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.curveStrength = val;
        if (this.curveValueLabel) {
          this.curveValueLabel.textContent = val.toFixed(4);
        }
        if (WORLD_CURVE_UNIFORMS?.uCurveStrength) {
          WORLD_CURVE_UNIFORMS.uCurveStrength.value = val;
        }
        this.options.onCurveChange?.(val);
      });
    }

    // Tool Buttons
    this.toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool, true);
      });
    });

    // Action Buttons (Use Tool, Sit/Wave, Switch Outfit, Chat, Audio Toggle)
    this.actionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._handleActionButton(action);
      });
    });

    // Context Prompt Pill Click
    if (this.contextPromptPill) {
      this.contextPromptPill.addEventListener('click', (e) => {
        e.stopPropagation();
        this.options.onTriggerContextPrompt?.();
      });
    }

    // Dialogue Choice Buttons ("Chat more!", "Gift a Fruit", "See ya!")
    this.dialogueChoiceButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const choice = btn.dataset.choice;
        if (choice === 'chat_more') {
          this._currentLineIdx = (this._currentLineIdx + 1) % 3;
          const key = this._villagerKeys[this._currentVillagerIdx];
          this.showDialogue(key);
        } else if (choice === 'gift_fruit') {
          const key = this._villagerKeys[this._currentVillagerIdx];
          this.options.onGiftVillager?.(key);
        } else if (choice === 'close') {
          this.hideDialogue();
          this.audioEngine?.playUIClick?.();
        }
      });
    });

    // Dialogue Continue Arrow Click
    if (this.dialogueNextBtn) {
      this.dialogueNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.advanceDialogue();
      });
    }

    // Keyboard Shortcuts:
    // 1-5, 0 = Equip Tools! (No longer hijacks 1-5 for static observer presets!)
    // H = Toggle HUD, T = Chat, M = Audio Mute, C / O = Cycle Outfit
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const toolKeyMap = {
        Digit1: 'watering_can',
        Digit2: 'shovel',
        Digit3: 'trowel',
        Digit4: 'fishing_rod',
        Digit5: 'bug_net',
        Digit0: 'none',
      };
      if (toolKeyMap[e.code]) {
        this.selectTool(toolKeyMap[e.code], true);
      } else if (e.code === 'KeyH') {
        this.toggleHUD();
      } else if (e.code === 'KeyT') {
        this._handleActionButton('talk_villager');
      } else if (e.code === 'KeyM') {
        this._handleActionButton('audio_toggle');
      } else if (e.code === 'KeyC' || e.code === 'KeyO') {
        this._handleActionButton('cycle_outfit');
      }
    });
  }

  _applyURLPresetIfPresent() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sceneParam = params.get('scene') || params.get('preset');
    if (!sceneParam) return;

    const indexMap = {
      '1': 'beach_sunset',
      '2': 'house_yard',
      '3': 'flower_river',
      '4': 'tent_horizon',
      '5': 'bridge_plaza',
      '6': 'cliff_waterfall',
      '0': 'free_roam',
    };
    const resolved = indexMap[sceneParam] || sceneParam;
    this.selectPreset(resolved, false);
  }

  // --------------------------------------------------------------------------
  // Pocket Inventory, Toast Banner & Context Prompt Pill Updates
  // --------------------------------------------------------------------------
  updateInventoryUI(inv = {}, changedKey = null) {
    if (!this.invEls) return;
    if (this.invEls.bells && Number.isFinite(inv.bells)) {
      this.invEls.bells.textContent = inv.bells.toLocaleString();
    }
    const keys = ['apple', 'orange', 'coconut', 'watered', 'fish', 'bugs'];
    for (const k of keys) {
      const el = this.invEls[k];
      if (el && Number.isFinite(inv[k])) {
        el.textContent = String(inv[k]);
        if (changedKey === k) {
          const chip = el.closest('.pocket-chip');
          if (chip) {
            chip.classList.remove('pop');
            void chip.offsetWidth;
            chip.classList.add('pop');
            setTimeout(() => chip.classList.remove('pop'), 360);
          }
        }
      }
    }
  }

  showToast(icon = '✨', text = '', durationMs = 2800) {
    if (this.isCleanMode || !this.toastBanner) return;
    if (this.toastIcon) this.toastIcon.textContent = icon;
    if (this.toastText) this.toastText.textContent = text;
    this.toastBanner.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastBanner?.classList.add('hidden');
    }, durationMs);
  }

  updateContextPrompt(promptInfo = null) {
    if (this.isCleanMode || !this.contextPromptPill) return;
    if (!promptInfo || !promptInfo.label) {
      this.contextPromptPill.classList.add('hidden');
      return;
    }
    if (this.promptKeyBadge) {
      this.promptKeyBadge.textContent = promptInfo.key || 'E';
    }
    if (this.promptLabelText) {
      this.promptLabelText.textContent = promptInfo.label;
    }
    if (Number.isFinite(promptInfo.screenX) && Number.isFinite(promptInfo.screenY)) {
      const cx = Math.min(Math.max(promptInfo.screenX, 110), window.innerWidth - 110);
      const cy = Math.min(Math.max(promptInfo.screenY, 72), window.innerHeight - 110);
      this.contextPromptPill.style.left = `${cx}px`;
      this.contextPromptPill.style.top = `${cy}px`;
    }
    this.contextPromptPill.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // Scene, Time of Day, Tool & Action Handlers
  // --------------------------------------------------------------------------
  selectPreset(presetName, userInitiated = false) {
    if (!presetName) return;
    this.activePreset = presetName;
    this.presetButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });

    // Default time-of-day mapping for each reference scene so lighting matches ref_01..06
    const presetTimeMap = {
      free_roam: 'noon',
      beach_sunset: 'golden_hour',
      house_yard: 'noon',
      flower_river: 'noon',
      tent_horizon: 'noon',
      bridge_plaza: 'noon',
      cliff_waterfall: 'noon',
    };
    if (presetTimeMap[presetName]) {
      this._updateClockAndTodUI(presetTimeMap[presetName], presetName);
    }

    // Default tool highlight per scene
    const presetToolMap = {
      free_roam: 'watering_can',
      beach_sunset: 'none',
      house_yard: 'trowel',
      flower_river: 'watering_can',
      tent_horizon: 'none',
      bridge_plaza: 'fishing_rod',
      cliff_waterfall: 'shovel',
    };
    if (presetToolMap[presetName]) {
      this.setActiveToolUI(presetToolMap[presetName]);
    }

    if (userInitiated) {
      this.audioEngine?.playUIClick?.();
    }

    // Invoke any bound callbacks or subsystems
    this.options.onSelectPreset?.(presetName);
    this.options.onPresetChange?.(presetName);
  }

  setPreset(presetName) {
    this.selectPreset(presetName, false);
  }

  selectTimeOfDay(tod, userInitiated = false) {
    if (!tod) return;
    this.activeTimeOfDay = tod;
    this._updateClockAndTodUI(tod, this.activePreset);

    if (userInitiated) {
      this.audioEngine?.playUIClick?.();
    }
    this.audioEngine?.setTimeOfDay?.(tod);
    this.options.onSelectTimeOfDay?.(tod);
    this.options.onTimeOfDayChange?.(tod);
    this.options.dayNight?.setPreset?.(tod);
    this.options.dayNight?.setTimeOfDay?.(tod);
  }

  setTimeOfDay(tod) {
    this.selectTimeOfDay(tod, false);
  }

  _updateClockAndTodUI(tod, presetName = '') {
    this.activeTimeOfDay = tod;
    this.todButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tod === tod);
    });

    const clockMap = {
      morning: { digits: '8:15', ampm: 'AM', icon: 'sun' },
      noon: { digits: '1:20', ampm: 'PM', icon: 'sun' },
      golden_hour: { digits: '5:42', ampm: 'PM', icon: 'sunset' },
      night: { digits: '9:30', ampm: 'PM', icon: 'moon' },
    };
    const info = clockMap[tod] || clockMap.noon;
    if (this.timeDigitsEl) this.timeDigitsEl.textContent = info.digits;
    if (this.timeAmPmEl) this.timeAmPmEl.textContent = info.ampm;

    if (this.weatherIconEl) {
      if (info.icon === 'moon') {
        this.weatherIconEl.innerHTML = `
          <svg viewBox="0 0 32 32" width="26" height="26">
            <path d="M21.5 5.5c-6.2 1.2-10.2 7.2-9 13.4 1 5.1 5.3 8.8 10.4 9.1-2.1 1.3-4.6 1.8-7.2 1.3-6.8-1.3-11.2-7.9-9.9-14.7 1.1-5.6 5.6-9.7 11.1-10.3 1.6-.2 3.1.1 4.6 1.2z" fill="#ffe678"/>
          </svg>
        `;
      } else {
        const sunColor = info.icon === 'sunset' ? '#ffb347' : '#ffd95e';
        this.weatherIconEl.innerHTML = `
          <svg viewBox="0 0 32 32" width="28" height="28">
            <circle cx="16" cy="16" r="8" fill="${sunColor}" />
            <g stroke="${sunColor}" stroke-width="2.6" stroke-linecap="round">
              <line x1="16" y1="3.5" x2="16" y2="6" />
              <line x1="16" y1="26" x2="16" y2="28.5" />
              <line x1="3.5" y1="16" x2="6" y2="16" />
              <line x1="26" y1="16" x2="28.5" y2="16" />
              <line x1="7.2" y1="7.2" x2="9" y2="9" />
              <line x1="23" y1="23" x2="24.8" y2="24.8" />
              <line x1="24.8" y1="7.2" x2="23" y2="9" />
              <line x1="9" y1="23" x2="7.2" y2="24.8" />
            </g>
          </svg>
        `;
      }
    }
  }

  setActiveToolUI(toolName) {
    this.activeTool = toolName;
    this.toolButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
  }

  selectTool(toolName, userInitiated = false) {
    this.setActiveToolUI(toolName);
    if (userInitiated) {
      this.audioEngine?.playUIClick?.();
    }
    this.options.onSelectTool?.(toolName);
    this.options.onToolChange?.(toolName);
    this.options.characters?.setTool?.(toolName);
  }

  _handleActionButton(action) {
    if (action === 'use_tool') {
      this.options.onAction?.('use_tool');
    } else if (action === 'sit_wave') {
      this.audioEngine?.playUIClick?.();
      this.options.onAction?.('sit_wave');
    } else if (action === 'cycle_outfit') {
      this.audioEngine?.playUIClick?.();
      this.options.onCycleOutfit?.();
      this.options.onAction?.('cycle_outfit');
    } else if (action === 'talk_villager') {
      this.options.onAction?.('talk_villager');
    } else if (action === 'audio_toggle') {
      if (this.audioEngine) {
        const isMuted = this.audioEngine.toggleMute();
        if (this.audioToggleBtn) {
          this.audioToggleBtn.classList.toggle('playing', !isMuted);
        }
        if (this.audioEmojiEl) {
          this.audioEmojiEl.textContent = isMuted ? '🔇' : '🎵';
        }
        if (this.audioLabelEl) {
          this.audioLabelEl.textContent = isMuted ? 'Audio Muted' : 'Island Audio';
        }
      }
      this.options.onAction?.('audio_toggle');
    }
  }

  // --------------------------------------------------------------------------
  // Villager Dialogue Pillow + Gemini 3.8 Flash TTS Voice-Designed Audio
  // --------------------------------------------------------------------------
  showDialogue(villagerKey = 'Barnaby', customHtml = null) {
    if (this.isCleanMode || !this.dialogueBox) return;
    const villager =
      this.villagerDialogues[villagerKey] || this.villagerDialogues.Barnaby;
    const idx = this._villagerKeys.indexOf(villager.name);
    if (idx >= 0) this._currentVillagerIdx = idx;

    const lineIdx = this._currentLineIdx % villager.lines.length;
    const htmlLine = customHtml || villager.lines[lineIdx];

    if (this.speakerTag) {
      this.speakerTag.style.setProperty('--speaker-bg', villager.bg);
      this.speakerTag.style.setProperty('--speaker-fg', villager.fg);
    }
    if (this.speakerName) {
      this.speakerName.textContent = villager.name;
    }

    this.dialogueBox.classList.remove('hidden');

    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer);
      this._typewriterTimer = null;
    }

    // Play pre-generated Gemini 3.8 Flash TTS Voice-Designed WAV clip (with ValleySpeech fallback)
    if (this.audioEngine?.playVillagerVoiceLine) {
      this.audioEngine.playVillagerVoiceLine(
        villager.name,
        lineIdx,
        htmlLine,
        villager.pitch
      );
    } else {
      this.audioEngine?.playValleySpeech?.(htmlLine, villager.pitch);
    }

    if (this.dialogueText) {
      this.dialogueText.innerHTML = htmlLine;
    }
  }

  showGiftDialogue(villagerKey = 'Barnaby') {
    const villager =
      this.villagerDialogues[villagerKey] || this.villagerDialogues.Barnaby;
    const giftLines = villager.giftLines || villager.lines;
    const htmlLine = giftLines[Math.floor(Math.random() * giftLines.length)];
    this.showDialogue(villagerKey, htmlLine);
  }

  hideDialogue() {
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer);
      this._typewriterTimer = null;
    }
    if (this.dialogueBox) {
      this.dialogueBox.classList.add('hidden');
    }
  }

  advanceDialogue() {
    this._currentLineIdx++;
    if (this._currentLineIdx >= 3) {
      this._currentLineIdx = 0;
      this.hideDialogue();
      this.audioEngine?.playUIClick?.();
      return;
    }
    const key = this._villagerKeys[this._currentVillagerIdx];
    this.showDialogue(key);
  }

  cycleVillagerDialogue(preferredVillager = null) {
    if (preferredVillager && this.villagerDialogues[preferredVillager]) {
      const isSameVillagerOpen =
        this.dialogueBox &&
        !this.dialogueBox.classList.contains('hidden') &&
        this._villagerKeys[this._currentVillagerIdx] === preferredVillager;
      this._currentVillagerIdx = this._villagerKeys.indexOf(preferredVillager);
      if (isSameVillagerOpen) {
        this._currentLineIdx = (this._currentLineIdx + 1) % 3;
      } else {
        this._currentLineIdx = 0;
      }
      this.showDialogue(preferredVillager);
      return;
    }
    this._currentVillagerIdx =
      (this._currentVillagerIdx + 1) % this._villagerKeys.length;
    this._currentLineIdx = 0;
    this.showDialogue(this._villagerKeys[this._currentVillagerIdx]);
  }

  setCleanMode(clean) {
    if (typeof document === 'undefined') return;
    this.isCleanMode = Boolean(clean);
    const uiRoot = this.uiRoot || document.getElementById('ui-root');
    if (this.isCleanMode) {
      document.documentElement.classList.add('clean-mode');
      document.body?.classList.add('clean-mode');
      if (uiRoot) {
        uiRoot.classList.add('clean-hidden');
        uiRoot.style.display = 'none';
      }
    } else {
      document.documentElement.classList.remove('clean-mode');
      document.body?.classList.remove('clean-mode');
      if (uiRoot) {
        uiRoot.classList.remove('clean-hidden');
        uiRoot.style.display = '';
      }
    }
  }

  toggleHUD() {
    this.setCleanMode(!this.isCleanMode);
  }

  update(dt = 0.016, elapsed = 0) {
    if (this.audioEngine && typeof this.audioEngine.update === 'function') {
      this.audioEngine.update(dt, elapsed);
    }
  }
}
