/**
 * Vue systeme : les mondes d'un systeme, alignes par ordre orbital.
 *
 * Comme la carte de saut, cette couche ne decide rien. Elle lit un `Systeme`
 * produit par le noyau et le met en volume. Tout ce qu'on voit — surfaces,
 * nuages, halos, anneaux, lunes — est genere a la volee : aucun modele, aucune
 * image. Douze mondes se construisent en une fraction de seconde, ce qui rend
 * viable d'entrer dans n'importe lequel des trois cents systemes.
 */

import * as THREE from 'three';
import { classeStellaire, typePlanete } from '../core/data';
import { Rng } from '../core/rng';
import type { Planete, Systeme } from '../core/types';
import { textureAnneaux, texturesMonde } from './textures';

/** Rayon a l'ecran : compresse pour qu'une geante n'ecrase pas une lune. */
function rayonEcran(planete: Planete): number {
  return 0.56 * Math.pow(planete.rayonKm / 6371, 0.4);
}

interface MondePose {
  planete: Planete;
  groupe: THREE.Group;
  corps: THREE.Mesh;
  rayon: number;
  x: number;
  rotation: number;
}

export class VueSysteme {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);

  private mondes: MondePose[] = [];
  private tournants: { obj: THREE.Object3D; v: number; orbite?: { d: number; a: number; v: number } }[] = [];
  private contenu = new THREE.Group();
  private xEtoile = -3;
  private xMax = 10;

  private camX = 0;
  private camZ = 12;
  private viseX = 0;
  private viseZ = 12;

  systeme: Systeme | null = null;

  constructor() {
    this.scene.add(this.contenu);
    this.fond();
  }

  private fond(): void {
    const N = 1400;
    const p = new Float32Array(N * 3);
    const c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.35) * 460;
      p[i * 3 + 1] = (Math.random() - 0.5) * 280;
      p[i * 3 + 2] = -40 - Math.random() * 280;
      const b = 0.45 + Math.random() * 0.55;
      c[i * 3] = b;
      c[i * 3 + 1] = b * 0.95;
      c[i * 3 + 2] = b * (Math.random() < 0.3 ? 1 : 0.85);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.scene.add(
      new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.85 })),
    );
  }

  /** Construit le systeme demande et cadre la vue sur son premier monde. */
  charger(systeme: Systeme, germe: string): void {
    this.systeme = systeme;
    this.contenu.clear();
    this.mondes = [];
    this.tournants = [];

    const classe = classeStellaire(systeme.classe);
    const rng = new Rng(`${germe}:${systeme.id}:scene`);

    // L'etoile, a l'echelle de sa classe : une naine blanche n'est pas une
    // geante, et le systeme doit le dire au premier coup d'oeil.
    const rayonEtoile = classe.taille * 0.62;
    const etoile = new THREE.Mesh(
      new THREE.SphereGeometry(rayonEtoile, 40, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(classe.couleur) }),
    );
    etoile.position.x = this.xEtoile;
    this.contenu.add(etoile);
    this.contenu.add(this.halo(classe.couleur, rayonEtoile));

    const lumiere = new THREE.PointLight(new THREE.Color(classe.couleur), 2.6, 0, 0);
    lumiere.position.set(this.xEtoile, 0, 0.6);
    this.contenu.add(lumiere);
    this.contenu.add(new THREE.HemisphereLight(0x33405e, 0x080a10, 0.42));
    const appoint = new THREE.DirectionalLight(0x6d86c4, 0.3);
    appoint.position.set(2, 3, 10);
    this.contenu.add(appoint);

    // Les mondes, espaces selon leur taille : lisible plutot qu'a l'echelle.
    let x = this.xEtoile + 4.2;
    systeme.planetes.forEach((planete) => {
      const type = typePlanete(planete.type);
      const rayon = rayonEcran(planete);
      x += rayon * (planete.anneaux ? 2.4 : 1.2);

      const groupe = new THREE.Group();
      groupe.position.x = x;
      groupe.rotation.z = THREE.MathUtils.degToRad(rng.range(0, 32));
      this.contenu.add(groupe);

      const tex = texturesMonde(planete, type, germe, systeme.id);
      const options: THREE.MeshStandardMaterialParameters = {
        map: tex.map,
        roughness: type.rendu.trait === 'oceans' ? 0.55 : 0.95,
        metalness: type.id === 'metallique' ? 0.35 : 0,
      };
      if (tex.emissive) {
        options.emissiveMap = tex.emissive;
        options.emissive = new THREE.Color(0xffffff);
        options.emissiveIntensity = 1.1;
      }
      const corps = new THREE.Mesh(new THREE.SphereGeometry(rayon, 48, 48), new THREE.MeshStandardMaterial(options));
      corps.userData.orbite = planete.orbite;
      groupe.add(corps);

      // La rotation reelle du monde : un monde verrouille tourne tres lentement.
      const vitesse = 0.0016 + 0.004 / Math.max(1, planete.jourH / 24);
      this.tournants.push({ obj: corps, v: Math.min(0.009, vitesse) });

      if (tex.nuages) {
        const ciel = new THREE.Mesh(
          new THREE.SphereGeometry(rayon * 1.022, 40, 40),
          new THREE.MeshStandardMaterial({ map: tex.nuages, transparent: true, depthWrite: false, roughness: 1 }),
        );
        groupe.add(ciel);
        this.tournants.push({ obj: ciel, v: Math.min(0.012, vitesse * 1.35) });
      }

      if (type.atmosphere !== 'aucune') groupe.add(this.atmosphere(rayon, type.couleur));
      if (planete.anneaux) groupe.add(this.anneaux(rayon, rng));
      for (const [i, lune] of planete.lunes.entries()) {
        const rl = Math.max(0.045, rayon * (0.1 + i * 0.03));
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(rl, 20, 20),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0x9a9088 : 0xb9b3ab, roughness: 1 }),
        );
        const d = rayon * (2.4 + i * 0.7);
        const a = rng.next() * Math.PI * 2;
        m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        groupe.add(m);
        this.tournants.push({ obj: m, v: 0.004, orbite: { d, a, v: 0.006 - i * 0.0012 } });
        // Le nom de la lune vit dans les donnees ; il s'affiche dans la fiche.
        m.userData.lune = lune.nom;
      }

      this.mondes.push({ planete, groupe, corps, rayon, x, rotation: 0 });
      // L'ecart suit le saut orbital reel, borne pour que le systeme externe
      // paraisse plus vide sans devenir intraversable.
      const suivante = systeme.planetes[planete.orbite + 1];
      const saut = suivante ? Math.min(2.4, Math.max(0.85, Math.log2(suivante.distanceUA / planete.distanceUA))) : 1;
      x += rayon * (planete.anneaux ? 2.4 : 1.2) + 1.6 + saut * 1.5;
    });

    this.xMax = x;
    this.contenu.add(this.reglette());

    this.camX = this.viseX = this.mondes.length ? this.mondes[0].x : 0;
    this.camZ = this.viseZ = 11;
    this.placer();
  }

  private halo(couleur: string, rayonEtoile: number): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const teinte = new THREE.Color(couleur);
    const rgb = `${Math.round(teinte.r * 255)},${Math.round(teinte.g * 255)},${Math.round(teinte.b * 255)}`;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, `rgba(${rgb},0.7)`);
    gr.addColorStop(0.18, `rgba(${rgb},0.2)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    const etendue = rayonEtoile * 4.4;
    s.scale.set(etendue, etendue, 1);
    s.position.x = this.xEtoile;
    return s;
  }

  /** Halo atmospherique : un liseré lumineux sur le limbe, pas un brouillard. */
  private atmosphere(rayon: number, couleur: string): THREE.Mesh {
    const c = new THREE.Color(couleur);
    return new THREE.Mesh(
      new THREE.SphereGeometry(rayon * 1.06, 32, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: { teinte: { value: new THREE.Vector3(c.r, c.g, c.b) } },
        vertexShader: `
          varying vec3 vN;
          void main(){ vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 teinte; varying vec3 vN;
          void main(){ float i = pow(0.70 - dot(vN, vec3(0.,0.,1.)), 2.8);
            i = clamp(i, 0.0, 1.0);
            gl_FragColor = vec4(teinte * i, i * 0.7); }`,
      }),
    );
  }

  private anneaux(rayon: number, rng: Rng): THREE.Mesh {
    const interne = rayon * 1.35;
    const externe = rayon * 2.25;
    const geo = new THREE.RingGeometry(interne, externe, 180, 3);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - interne) / (externe - interne), 0.5);
    }
    const anneau = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: textureAnneaux(rng), side: THREE.DoubleSide, transparent: true, depthWrite: false, roughness: 1,
      }),
    );
    anneau.rotation.x = -Math.PI / 2.06;
    return anneau;
  }

  /** La reglette de releve qui file sous les mondes, avec un cran par orbite. */
  private reglette(): THREE.Group {
    const g = new THREE.Group();
    const ligne = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(this.xEtoile + 2.4, 0, -2.4),
      new THREE.Vector3(this.xMax, 0, -2.4),
    ]);
    g.add(new THREE.LineSegments(ligne, new THREE.LineBasicMaterial({ color: 0x50637a, transparent: true, opacity: 0.5 })));
    const crans: THREE.Vector3[] = [];
    for (const m of this.mondes) {
      crans.push(new THREE.Vector3(m.x, -0.22, -2.4), new THREE.Vector3(m.x, 0.22, -2.4));
    }
    if (crans.length) {
      g.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(crans),
          new THREE.LineBasicMaterial({ color: 0xe9a94e, transparent: true, opacity: 0.55 }),
        ),
      );
    }
    return g;
  }

  /* ------------------------------------------------------------ camera */

  private placer(): void {
    this.camera.position.set(this.camX, 0.35, this.camZ);
    this.camera.lookAt(this.camX, 0, 0);
  }

  cadrer(orbite: number): void {
    const m = this.mondes[orbite];
    if (!m) return;
    this.viseX = m.x;
    this.viseZ = Math.max(2.6, m.rayon * (m.planete.anneaux ? 9.6 : 7.6));
  }

  vueEnsemble(): void {
    const etendue = this.xMax - this.xEtoile;
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) * this.camera.aspect);
    this.viseZ = Math.min(160, (etendue * 0.58) / Math.tan(hfov / 2));
    this.viseX = (this.xMax + this.xEtoile) / 2;
  }

  glisser(dx: number): void {
    this.viseX = Math.max(
      this.xEtoile - 2,
      Math.min(this.xMax + 3, this.viseX - dx * (this.camZ * 0.0016)),
    );
  }

  zoomer(delta: number): void {
    this.viseZ = Math.max(2.2, Math.min(160, this.viseZ + delta * 0.012 * Math.max(1, this.viseZ * 0.1)));
  }

  pincer(facteur: number): void {
    this.viseZ = Math.max(2.2, Math.min(160, this.viseZ * facteur));
  }

  /** Orbite du monde sous le curseur, ou -1. */
  viser(rayon: THREE.Raycaster): number {
    const touches = rayon.intersectObjects(this.mondes.map((m) => m.corps), false);
    return touches.length ? (touches[0].object.userData.orbite as number) : -1;
  }

  /** Position ecran d'un monde, pour poser une etiquette HTML. */
  projeter(orbite: number): { x: number; y: number; visible: boolean } | null {
    const m = this.mondes[orbite];
    if (!m) return null;
    const v = new THREE.Vector3(m.x, m.rayon + (m.planete.anneaux ? 0.5 : 0.3), 0).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-v.y * 0.5 + 0.5) * innerHeight,
      visible: v.z < 1 && this.camZ < 110,
    };
  }

  get nombreDeMondes(): number {
    return this.mondes.length;
  }

  animer(): void {
    for (const t of this.tournants) {
      if (t.orbite) {
        t.orbite.a += t.orbite.v;
        t.obj.position.set(Math.cos(t.orbite.a) * t.orbite.d, 0, Math.sin(t.orbite.a) * t.orbite.d);
      }
      t.obj.rotation.y += t.v;
    }
    this.camX += (this.viseX - this.camX) * 0.09;
    this.camZ += (this.viseZ - this.camZ) * 0.09;
    this.placer();
  }
}
