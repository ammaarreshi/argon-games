// ============================================================================
// Argon Tennis — Argon Tennis Mii Character & Racket Satin PBR + Rim-Light Shader Overhaul
// ============================================================================

import * as THREE from 'three';

let sharedDoubleRingShadowTexture = null;

/**
 * Generates a 256x256 Argon Tennis double-ring radial contact shadow texture:
 * - Deep grounded inner core beneath the Mii's sneakers
 * - Soft mid-penumbra gradient
 * - Subtle outer ambient turf halo ring so the character feels grounded on grass
 */
export function createDoubleRingShadowTexture() {
  if (sharedDoubleRingShadowTexture) return sharedDoubleRingShadowTexture;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const cx = 128;
  const cy = 128;

  // Primary soft radial contact shadow core
  const coreGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 118);
  coreGrad.addColorStop(0.0, 'rgba(8, 22, 6, 0.84)');
  coreGrad.addColorStop(0.38, 'rgba(10, 26, 8, 0.62)');
  coreGrad.addColorStop(0.68, 'rgba(12, 30, 10, 0.26)');
  coreGrad.addColorStop(0.84, 'rgba(14, 34, 12, 0.12)');
  coreGrad.addColorStop(1.0, 'rgba(14, 34, 12, 0.0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle Argon Tennis secondary outer ring halo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(8, 24, 6, 0.16)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  sharedDoubleRingShadowTexture = tex;
  return tex;
}

/**
 * Injects the Argon Tennis view-space Fresnel rim-lighting and hemisphere
 * top-light boost into a MeshStandardMaterial via onBeforeCompile.
 */
function injectWiiSportsRimShader(material, { rimStrength = 0.28, topBoost = 0.10 } = {}) {
  if (!material || material.userData?.wiiRimInjected) return material;

  material.userData = material.userData || {};
  material.userData.wiiRimInjected = true;
  material.userData.rimStrength = rimStrength;
  material.userData.topBoost = topBoost;

  const cacheKey = `wii_mii_satin_rim_v1_${rimStrength.toFixed(2)}_${topBoost.toFixed(2)}`;
  material.customProgramCacheKey = () => cacheKey;

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      // Argon Tennis Rim-Lighting + Hemisphere Top-Light Boost
      vec3 wiiViewDir = normalize( vViewPosition );
      vec3 wiiNormal = normalize( vNormal );
      float wiiRim = pow( 1.0 - max( dot( wiiNormal, wiiViewDir ), 0.0 ), 2.6 ) * ${rimStrength.toFixed(3)};
      float wiiHemiTop = clamp( wiiNormal.y * 0.5 + 0.5, 0.0, 1.0 ) * ${topBoost.toFixed(3)};
      vec3 wiiRimTint = vec3( 1.0, 0.985, 0.94 );
      outgoingLight += wiiRimTint * wiiRim + diffuseColor.rgb * wiiHemiTop;
      #include <opaque_fragment>
      `
    );
  };

  material.needsUpdate = true;
  return material;
}

/**
 * Classifies a Mii material/mesh name to apply authentic Argon Tennis satin toy PBR roughness/metalness.
 */
function tuneSingleMiiMaterial(srcMat, meshName = '', role = 'player') {
  if (!srcMat) return srcMat;

  const mat = srcMat.clone();
  const label = `${srcMat.name || ''} ${meshName || ''}`;

  // Default satin toy-like finish
  let roughness = 0.38;
  let metalness = 0.04;
  let rimStrength = 0.28;
  let topBoost = 0.10;

  if (/EyeDark|EyePupil|EyeLash/i.test(label)) {
    // Glossy expressive Mii eyes
    roughness = 0.12;
    metalness = 0.06;
    rimStrength = 0.18;
    topBoost = 0.04;
  } else if (/EyeHighlight|EyeWhite/i.test(label)) {
    // Crisp catchlight highlights & sclera
    roughness = 0.16;
    metalness = 0.02;
    rimStrength = 0.22;
    topBoost = 0.12;
    if (mat.emissive) {
      mat.emissive.setHex(0xffffff);
      mat.emissiveIntensity = /Highlight/i.test(label) ? 0.22 : 0.08;
    }
  } else if (/Skin|Ear|Nose|Neck|Hand|Mitt|Thumb|Ankle/i.test(label)) {
    // Warm satin Mii skin finish with Argon subsurface peach warmth so shadow side never turns olive-gray
    roughness = 0.36;
    metalness = 0.02;
    rimStrength = 0.34;
    topBoost = 0.28;
    if (mat.emissive) {
      mat.emissive.setHex(0xffa87c);
      mat.emissiveIntensity = 0.22;
    }
  } else if (/Shirt|Polo|Shorts|Leg|Headband/i.test(label)) {
    // Soft athletic polo & shorts fabric
    roughness = 0.42;
    metalness = 0.04;
    rimStrength = 0.28;
    topBoost = 0.11;
  } else if (/Visor|Shoe|Stripe|White|Collar|Button|Wristband|Sock|Teeth/i.test(label)) {
    // Crisp molded visor, sneakers & white athletic piping
    roughness = 0.32;
    metalness = 0.05;
    rimStrength = 0.28;
    topBoost = 0.10;
  } else if (/Hair|Eyebrow/i.test(label)) {
    // Smooth sculpted Mii hair locks & spikes
    roughness = 0.38;
    metalness = 0.04;
    rimStrength = 0.28;
    topBoost = 0.09;
  }

  mat.roughness = roughness;
  mat.metalness = metalness;
  mat.envMapIntensity = 1.08;

  injectWiiSportsRimShader(mat, { rimStrength, topBoost });
  mat.userData.role = role;
  return mat;
}

/**
 * Traverses all meshes in actor.model (or a passed miiScene Object3D), guarantees smooth
 * vertex normals where appropriate, and upgrades all MeshStandardMaterials with Argon Tennis
 * satin PBR tuning and Fresnel rim-lighting.
 */
export function upgradeMiiCharacterMaterials(actorOrScene, role = 'player') {
  if (!actorOrScene) return;

  const isActorObj = Boolean(actorOrScene.model || actorOrScene.root);
  const miiScene = isActorObj ? actorOrScene.model : actorOrScene;
  const resolvedRole = role || (isActorObj && actorOrScene.role) || 'player';

  if (miiScene && typeof miiScene.traverse === 'function') {
    const matCache = new Map();

    miiScene.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      // Tuck baked UpperArmNub skin stumps (vy > 0.0 in Torso local space, where origin is y=0.72m
      // so ankles are at vy ≈ -0.575 and UpperArmNubs are at vy ≈ +0.212) inside the chest so
      // detached floating hands (Hand_L, Hand_R) have zero protruding arm stumps!
      let isUnderTorso = /Torso/i.test(child.name || '');
      let p = child.parent;
      while (p && !isUnderTorso) {
        if (/Torso/i.test(p.name || '')) isUnderTorso = true;
        p = p.parent;
      }
      const matName = Array.isArray(child.material)
        ? child.material.map((m) => m?.name || '').join(' ')
        : child.material?.name || '';
      if (
        isUnderTorso &&
        /Skin/i.test(matName) &&
        child.geometry?.attributes?.position &&
        !child.geometry.userData?.armNubsTucked
      ) {
        child.geometry = child.geometry.clone();
        const posAttr = child.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vy = posAttr.getY(i);
          if (vy > 0.0) {
            posAttr.setXYZ(i, 0.0, 0.20, 0.0);
          }
        }
        posAttr.needsUpdate = true;
        child.geometry.userData = child.geometry.userData || {};
        child.geometry.userData.armNubsTucked = true;
      }

      if (child.geometry) {
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        } else if (
          child.geometry.index !== null &&
          !child.geometry.userData?.normalsVerified
        ) {
          // Ensure all vertex normals are unit-length for clean Fresnel rim shading
          if (typeof child.geometry.normalizeNormals === 'function') {
            child.geometry.normalizeNormals();
          }
          child.geometry.userData = child.geometry.userData || {};
          child.geometry.userData.normalsVerified = true;
        }
      }

      const upgradeMat = (m) => {
        if (!m) return m;
        const key = `${m.uuid}_${resolvedRole}`;
        if (!matCache.has(key)) {
          matCache.set(key, tuneSingleMiiMaterial(m, child.name, resolvedRole));
        }
        return matCache.get(key);
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map(upgradeMat);
      } else if (child.material) {
        child.material = upgradeMat(child.material);
      }
    });
  }

  if (isActorObj) {
    if (actorOrScene.racketMesh) {
      upgradeRacketMaterials(actorOrScene.racketMesh);
    }
    if (actorOrScene.shadowBlob) {
      upgradeCharacterShadowBlob(actorOrScene);
    }
  }
}

/**
 * Upgrades the oversized Argon Tennis tennis racket materials for high-contrast gameplay readability:
 * metallic blue/silver aerodynamic bevel frame, crisp white throat bridge with red/cyan pro striping,
 * cushioned black grip, and bright white string bed.
 */
export function upgradeRacketMaterials(racketOrActor) {
  if (!racketOrActor) return;
  const racketRoot = racketOrActor.racketMesh ? racketOrActor.racketMesh : racketOrActor;
  if (!racketRoot || typeof racketRoot.traverse !== 'function') return;

  const matCache = new Map();

  racketRoot.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const tuneRacketMat = (srcMat) => {
      if (!srcMat) return srcMat;
      if (matCache.has(srcMat.uuid)) return matCache.get(srcMat.uuid);

      const mat = srcMat.clone();
      const label = `${srcMat.name || ''} ${child.name || ''}`;

      if (/String/i.test(label)) {
        mat.roughness = 0.18;
        mat.metalness = 0.05;
        if (mat.emissive) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.34;
        }
        injectWiiSportsRimShader(mat, { rimStrength: 0.24, topBoost: 0.12 });
      } else if (/Silver/i.test(label)) {
        mat.roughness = 0.18;
        mat.metalness = 0.78;
        injectWiiSportsRimShader(mat, { rimStrength: 0.30, topBoost: 0.10 });
      } else if (/Blue|Throat|Hoop/i.test(label)) {
        mat.roughness = 0.22;
        mat.metalness = 0.62;
        injectWiiSportsRimShader(mat, { rimStrength: 0.28, topBoost: 0.10 });
      } else if (/Red|Cyan|Stripe/i.test(label)) {
        mat.roughness = 0.24;
        mat.metalness = 0.38;
        injectWiiSportsRimShader(mat, { rimStrength: 0.26, topBoost: 0.10 });
      } else if (/Grip/i.test(label)) {
        mat.roughness = 0.56;
        mat.metalness = 0.04;
        injectWiiSportsRimShader(mat, { rimStrength: 0.18, topBoost: 0.06 });
      } else {
        // White butt cap, overgrip collar, throat bridge
        mat.roughness = 0.28;
        mat.metalness = 0.08;
        injectWiiSportsRimShader(mat, { rimStrength: 0.26, topBoost: 0.10 });
      }

      matCache.set(srcMat.uuid, mat);
      return mat;
    };

    if (Array.isArray(child.material)) {
      child.material = child.material.map(tuneRacketMat);
    } else if (child.material) {
      child.material = tuneRacketMat(child.material);
    }
  });
}

/**
 * Upgrades an actor's contact shadow mesh with a double-ring radial shadow texture
 * and a soft secondary outer halo ring.
 */
export function upgradeCharacterShadowBlob(actor) {
  if (!actor || !actor.shadowBlob) return;
  const blob = actor.shadowBlob;
  if (blob.userData?.wiiShadowUpgraded) return;

  blob.userData = blob.userData || {};
  blob.userData.wiiShadowUpgraded = true;

  const baseOpacity = blob.material?.opacity ?? 0.82;
  blob.userData.baseOpacity = baseOpacity;

  const doubleRingTex = createDoubleRingShadowTexture();
  if (blob.material) {
    blob.material = blob.material.clone();
    if (doubleRingTex) {
      blob.material.map = doubleRingTex;
    }
    blob.material.needsUpdate = true;
  }

  // Add subtle secondary outer ring halo mesh that breathes softly on hops
  const haloGeo = new THREE.RingGeometry(0.42, 0.58, 36);
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x0a1c08,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.002;
  haloMesh.renderOrder = blob.renderOrder || 2;
  blob.add(haloMesh);
  blob.userData.haloMesh = haloMesh;
}

/**
 * Updates the character's ground contact shadow position, soft scale, and double-ring
 * halo opacity as the Mii hops and strides during rallies.
 */
export function updateCharacterContactShadow(actor, bobHeight = undefined) {
  if (!actor || !actor.shadowBlob) return;

  if (!actor.shadowBlob.userData?.wiiShadowUpgraded) {
    upgradeCharacterShadowBlob(actor);
  }

  const blob = actor.shadowBlob;
  const bob =
    typeof bobHeight === 'number'
      ? Math.max(0, bobHeight)
      : Math.max(0, (actor.root?.position?.y || 0) - (actor.pos?.y || 0));

  if (actor.pos) {
    blob.position.x = actor.pos.x;
    blob.position.z = actor.pos.z;
  }

  const baseOpacity = blob.userData?.baseOpacity ?? 0.82;
  const shadowScale = THREE.MathUtils.clamp(1.03 - bob * 0.68, 0.72, 1.06);
  blob.scale.setScalar(shadowScale);

  if (blob.material) {
    blob.material.opacity = THREE.MathUtils.clamp(
      baseOpacity * (1.0 - bob * 1.12),
      0.38,
      baseOpacity
    );
  }

  const haloMesh = blob.userData?.haloMesh;
  if (haloMesh && haloMesh.material) {
    const haloScale = THREE.MathUtils.clamp(1.0 + bob * 0.75, 1.0, 1.28);
    haloMesh.scale.setScalar(haloScale);
    haloMesh.material.opacity = THREE.MathUtils.clamp(0.16 * (1.0 - bob * 1.35), 0.04, 0.18);
  }
}
