// Aperçus des meubles ajoutés à la main ; ceux du catalogue sont déjà prêts sous forme d'images.
import * as THREE from 'three';
import { buildProc } from './procedural.js';

const M = 0.01;

export class ThumbRenderer {
  cache = new Map(); queue = []; busy = false; stale = [];
  constructor() {
    const mgr = THREE.DefaultLoadingManager, start = mgr.onStart, done = mgr.onLoad;
    mgr.onStart = (...a) => { this.loading = true; start?.(...a); };
    mgr.onLoad = (...a) => {
      this.loading = false;
      done?.(...a);
      const again = this.stale; this.stale = [];
      for (const j of again) { this.cache.delete(j.def.id); if (j.el.isConnected) this.queue.push(j); }
      this.pump();
    };
  }
  init(size = 192) {
    if (this.r) return;
    const c = document.createElement('canvas');
    this.r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setSize(size, size, false); this.r.toneMapping = THREE.AgXToneMapping; this.r.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    const key = new THREE.DirectionalLight('#fff', 3.2); key.position.set(3, 6, 5);
    const fill = new THREE.HemisphereLight('#ffffff', '#c9c2b6', 2.2);
    this.scene.add(key, fill);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  }
  request(def, el) {
    const k = def.id;
    if (this.cache.has(k)) { el.src = this.cache.get(k); return; }
    this.queue.push({ def, el });
    this.pump();
  }
  pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    const run = () => {
      const job = this.queue.shift();
      if (job && job.el.isConnected) this.render(job.def, job.el);
      if (this.queue.length) setTimeout(run, 12); else this.busy = false;
    };
    setTimeout(run, 12);
  }
  /** Dessine un meuble dans le canevas interne. */
  draw(def) {
    this.init();
    const size = { w: def.w * M, d: def.d * M, h: def.h * M };
    const obj = buildProc({ ...def.model, color: def.model?.color }, def.model?.type === 'tv' ? {} : size, undefined);
    this.scene.add(obj);
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2 || 1;
    const d = (r / Math.sin(THREE.MathUtils.degToRad(13))) * 1.05;
    const flat = def.model?.type === 'rug';
    this.cam.position.set(c.x + d * 0.55, c.y + d * (flat ? 0.8 : 0.42), c.z + d * 0.72);
    this.cam.lookAt(c);
    this.r.render(this.scene, this.cam);
    this.scene.remove(obj);
    obj.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
  render(def, el) {
    this.draw(def);
    const url = this.r.domElement.toDataURL('image/webp', 0.82);
    this.cache.set(def.id, url);
    el.src = url;
    if (this.loading) this.stale.push({ def, el });
  }
}
