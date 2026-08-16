/**
 * Petites textures partagees par les deux vues.
 *
 * Un `PointsMaterial` sans texte rend des quads : les etoiles apparaissent
 * carrees. Toutes les nuees de points passent donc par cette pastille ronde.
 */

import * as THREE from 'three';

let pastilleCache: THREE.Texture | null = null;

/** Disque doux, blanc, a bords fondus. */
export function pastille(): THREE.Texture {
  if (pastilleCache) return pastilleCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.24)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  pastilleCache = new THREE.CanvasTexture(c);
  return pastilleCache;
}

/** Nuee d'etoiles de fond : des points ronds, jamais des carres. */
export function materiauEtoiles(taille: number, opacite: number): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    map: pastille(),
    size: taille,
    vertexColors: true,
    transparent: true,
    opacity: opacite,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
}
