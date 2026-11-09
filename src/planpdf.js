// Plan coté en PDF, à la vraie échelle, écrit directement : le fichier reste léger et net à toutes les tailles.
import { analyzeLevel, wallCorners, dist, itemCorners, polygonArea } from './geometry.js';
import { getItem, isDoorType } from './catalog.js';
import { parcelOf, parcelArea, setbackOf, insetPolygon, metres } from './parcel.js';

const W = 841.89, H = 595.28, CM = 28.3465, MARGIN = 28, FOOT = 58;
const SPECIAL = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, 'Š': 0x8a, 'Œ': 0x8c, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'š': 0x9a, 'œ': 0x9c, 'Ÿ': 0x9f, ' ': 0xa0 };
const code = (ch) => { const c = ch.charCodeAt(0); return SPECIAL[ch] ?? (c < 256 ? c : 63); };
const n = (v) => (Math.round(v * 100) / 100).toString();
const ruler = document.createElement('canvas').getContext('2d');
const textWidth = (s, size, bold) => { ruler.font = `${bold ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`; return ruler.measureText(s).width; };

class Page {
  ops = [];
  add(s) { this.ops.push(s); }
  stroke(rgb) { this.add(`${rgb.map(n).join(' ')} RG`); }
  fill(rgb) { this.add(`${rgb.map(n).join(' ')} rg`); }
  width(w) { this.add(`${n(w)} w`); }
  dash(on, off) { this.add(on ? `[${n(on)} ${n(off)}] 0 d` : '[] 0 d'); }
  poly(pts, close = true) { this.add(`${pts.map((p, i) => `${n(p[0])} ${n(p[1])} ${i ? 'l' : 'm'}`).join(' ')}${close ? ' h' : ''}`); }
  line(a, b) { this.add(`${n(a[0])} ${n(a[1])} m ${n(b[0])} ${n(b[1])} l S`); }
  /** Quart de cercle de `from` à `to` autour du centre `c`. */
  arc(c, from, to) {
    const k = 0.5523, a = [from[0] - c[0], from[1] - c[1]], b = [to[0] - c[0], to[1] - c[1]];
    this.add(`${n(from[0])} ${n(from[1])} m ${n(from[0] + b[0] * k)} ${n(from[1] + b[1] * k)} ${n(to[0] + a[0] * k)} ${n(to[1] + a[1] * k)} ${n(to[0])} ${n(to[1])} c S`);
  }
  text(s, x, y, size, { bold, align = 'left', angle = 0, rgb = [0.15, 0.14, 0.12] } = {}) {
    const w = textWidth(s, size, bold), off = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    const c = Math.cos(angle), t = Math.sin(angle), hex = [...s].map((ch) => code(ch).toString(16).padStart(2, '0')).join('');
    this.fill(rgb);
    this.add(`BT /${bold ? 'F2' : 'F1'} ${n(size)} Tf ${n(c)} ${n(t)} ${n(-t)} ${n(c)} ${n(x + off * c)} ${n(y + off * t)} Tm <${hex}> Tj ET`);
  }
}

function writePdf(pages, title) {
  const objs = [], add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(''), tree = add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = pages.map((p) => {
    const body = p.ops.join('\n');
    const content = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${content} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objs[tree - 1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] >>`;
  const hex = [...title].map((ch) => code(ch).toString(16).padStart(2, '0')).join('');
  const info = add(`<< /Title <${hex}> /Producer (Notre Maison) >>`);
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(out, (c) => c.charCodeAt(0))], { type: 'application/pdf' });
}

const today = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const area = (v) => `${v.toFixed(1).replace('.', ',')} m²`;

function footer(page, project, title, detail) {
  page.stroke([0.15, 0.14, 0.12]); page.width(0.6);
  page.line([MARGIN, FOOT - 6], [W - MARGIN, FOOT - 6]);
  page.text(project.name, MARGIN, FOOT - 22, 13, { bold: true });
  page.text(title, MARGIN, FOOT - 37, 10);
  page.text(detail, W / 2, FOOT - 22, 9, { align: 'center' });
  page.text(`Édité le ${today()}`, W - MARGIN, FOOT - 22, 9, { align: 'right' });
  page.text('Document indicatif : à faire valider par un professionnel avant tout chantier.', W - MARGIN, FOOT - 37, 8, { align: 'right', rgb: [0.4, 0.38, 0.34] });
}

function northArrow(page, project) {
  const x = W - MARGIN - 18, y = H - MARGIN - 20, r = ((project.site.north || 0) * Math.PI) / 180, L = 14;
  const P = (dx, dy) => [x + dx * Math.cos(r) + dy * Math.sin(r), y - dx * Math.sin(r) + dy * Math.cos(r)];
  page.fill([0.15, 0.14, 0.12]); page.poly([P(0, L), P(-5, -L), P(0, -L * 0.45), P(5, -L)]); page.add('f');
  const t = P(0, L + 6);
  page.text('N', t[0], t[1], 9, { bold: true, align: 'center' });
}

function scaleBar(page, s, denom) {
  const x = MARGIN, y = H - MARGIN - 12, m = 100 * s;
  page.stroke([0.15, 0.14, 0.12]); page.width(0.8);
  page.line([x, y], [x + 5 * m, y]);
  for (let i = 0; i <= 5; i++) page.line([x + i * m, y - 3], [x + i * m, y + 3]);
  page.text('0', x, y + 6, 7, { align: 'center' });
  page.text('5 m', x + 5 * m, y + 6, 7, { align: 'center' });
  page.text(`Échelle 1/${denom} (impression A4 à 100 %)`, x + 5 * m + 14, y - 2, 8);
}

function fitScale(x0, y0, x1, y1) {
  const room = 95, aw = W - 2 * MARGIN - room * 2, ah = H - FOOT - MARGIN - 34 - room * 1.2;
  const denom = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000].find((d) => (x1 - x0) * (CM / d) <= aw && (y1 - y0) * (CM / d) <= ah) || 2500;
  const s = CM / denom, cy = FOOT + 8 + (H - FOOT - MARGIN - 34) / 2;
  return { denom, s, X: (x) => W / 2 + (x - (x0 + x1) / 2) * s, Y: (y) => cy - (y - (y0 + y1) / 2) * s };
}

function dimension(page, a, b, off, label, size = 8) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return;
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], A = [a[0] + off[0], a[1] + off[1]], B = [b[0] + off[0], b[1] + off[1]];
  page.stroke([0.2, 0.19, 0.17]); page.width(0.45);
  page.line(A, B);
  for (const p of [A, B]) page.line([p[0] - (u[0] - u[1]) * 2.5, p[1] - (u[1] + u[0]) * 2.5], [p[0] + (u[0] - u[1]) * 2.5, p[1] + (u[1] + u[0]) * 2.5]);
  let angle = Math.atan2(u[1], u[0]);
  if (angle > Math.PI / 2 + 0.01 || angle <= -Math.PI / 2 + 0.01) angle += Math.PI;
  const m = [(A[0] + B[0]) / 2 - Math.sin(angle) * 2.5, (A[1] + B[1]) / 2 + Math.cos(angle) * 2.5];
  page.text(label, m[0], m[1], size, { align: 'center', angle });
}

function drawOpening(page, wall, o, A, B, X, Y, s) {
  const L = dist(A, B), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, nx = -uy, ny = ux, hw = o.width / 2, ht = wall.thickness / 2;
  const P = (t, d) => [X(A.x + ux * (o.t + t) + nx * d), Y(A.y + uy * (o.t + t) + ny * d)];
  page.fill([1, 1, 1]); page.poly([P(-hw, -ht - 0.6), P(hw, -ht - 0.6), P(hw, ht + 0.6), P(-hw, ht + 0.6)]); page.add('f');
  page.stroke([0.15, 0.14, 0.12]); page.width(0.5);
  page.line(P(-hw, -ht), P(-hw, ht)); page.line(P(hw, -ht), P(hw, ht));
  if (o.type === 'passage') return;
  if (['door', 'entry'].includes(o.type) && o.leaves !== 2) {
    const dx = o.hinge === 'right' ? -1 : 1, dy = o.flip ? -1 : 1, hx = -dx * hw;
    const c = P(hx, dy * ht), open = P(hx, dy * (ht + o.width)), shut = P(hx + dx * o.width, dy * ht);
    page.line(c, open); page.dash(2, 2); page.arc(c, open, shut); page.dash();
    return;
  }
  if (o.type === 'double' || (o.type === 'entry' && o.leaves === 2)) {
    for (const k of [-1, 1]) { const c = P(k * hw, ht), open = P(k * hw, ht + hw), shut = P(0, ht); page.line(c, open); page.dash(2, 2); page.arc(c, open, shut); page.dash(); }
    return;
  }
  if (isDoorType(o.type)) { page.line(P(-hw, 0), P(hw, 0)); return; }
  page.line(P(-hw, -ht * 0.35), P(hw, -ht * 0.35)); page.line(P(-hw, ht * 0.35), P(hw, ht * 0.35));
  void s;
}

function levelPage(project, level) {
  const a = analyzeLevel(level), page = new Page(), nodes = Object.values(level.nodes);
  const xs = nodes.map((p) => p.x), ys = nodes.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const { denom, s, X, Y } = fitScale(x0, y0, x1, y1), corners = wallCorners(level, a), pt = (p) => [X(p.x), Y(p.y)];

  page.stroke([0.62, 0.6, 0.56]); page.width(0.35);
  for (const it of level.items) {
    const def = getItem(it.cat); if (!def || def.ceiling || def.sub === 'plantation') continue;
    const c = itemCorners(it, def).map(pt);
    if (c.every(([u, v]) => u > MARGIN && u < W - MARGIN && v > FOOT && v < H - MARGIN)) { page.poly(c); page.add('S'); }
  }
  page.fill([0.15, 0.14, 0.12]);
  for (const w of a.walls) { const q = corners.get(w.id); if (q) { page.poly([q.aL, q.bL, q.bR, q.aR].map(pt)); page.add('f'); } }
  for (const w of a.walls) for (const o of w.openings) drawOpening(page, w, o, level.nodes[w.a], level.nodes[w.b], X, Y, s);

  a.rooms.forEach((r, i) => {
    const info = level.rooms[i]; if (!info) return;
    const [x, y] = pt(r.center);
    page.text(info.name, x, y + 3, 9.5, { bold: true, align: 'center' });
    page.text(area(r.area), x, y - 9, 8.5, { align: 'center' });
  });

  for (const w of a.walls) {
    const A = level.nodes[w.a], B = level.nodes[w.b], L = dist(A, B); if (L < 40) continue;
    const left = a.sideRoom.get(`${w.id}:L`) === undefined, right = a.sideRoom.get(`${w.id}:R`) === undefined;
    const nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L;
    if (left !== right) {
      const k = left ? 1 : -1, d = (w.thickness / 2) * s + 20;
      dimension(page, pt(A), pt(B), [nx * k * d, -ny * k * d], metres(L));
    } else if (L * s > 34) {
      const off = (w.thickness / 2) * s + 7;
      dimension(page, pt(A), pt(B), [nx * off, -ny * off], metres(L), 6.5);
    }
  }
  const pad = 46;
  dimension(page, [X(x0), Y(y0)], [X(x1), Y(y0)], [0, pad], `${metres(x1 - x0)} au total`, 9);
  dimension(page, [X(x0), Y(y1)], [X(x0), Y(y0)], [-pad, 0], `${metres(y1 - y0)} au total`, 9);

  scaleBar(page, s, denom);
  northArrow(page, project);
  const hab = a.rooms.reduce((t, r, i) => t + (['garage', 'terrasse'].includes(level.rooms[i]?.type) ? 0 : r.area), 0);
  footer(page, project, `Plan : ${level.name}`, `${area(hab)} habitables · hauteur sous plafond ${metres(level.height)}`);
  return page;
}

function massPage(project) {
  const parcel = parcelOf(project), page = new Page(), level = project.levels[project.entry || 0], pts = parcel.pts, nodes = [...pts, ...Object.values(level.nodes)];
  const xs = nodes.map((p) => p.x), ys = nodes.map((p) => p.y);
  const { denom, s, X, Y } = fitScale(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)), pt = (p) => [X(p.x), Y(p.y)];
  page.stroke([0.15, 0.14, 0.12]); page.width(1.2); page.dash(7, 4); page.poly(pts.map(pt)); page.add('S'); page.dash();
  const need = setbackOf(project);
  page.stroke([0.7, 0.33, 0.18]); page.width(0.5); page.dash(3, 3); page.poly(insetPolygon(pts, need).map(pt)); page.add('S'); page.dash();
  const a = analyzeLevel(level), corners = wallCorners(level, a);
  page.fill([0.15, 0.14, 0.12]);
  for (const w of a.walls) { const q = corners.get(w.id); if (q) { page.poly([q.aL, q.bL, q.bR, q.aR].map(pt)); page.add('f'); } }
  const sign = polygonArea(pts) > 0 ? 1 : -1;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], L = dist(p, q), nx = (-(q.y - p.y) / L) * -sign, ny = ((q.x - p.x) / L) * -sign;
    dimension(page, pt(p), pt(q), [nx * 14, -ny * 14], metres(L), 9);
  });
  scaleBar(page, s, denom);
  northArrow(page, project);
  footer(page, project, 'Plan de masse', `Parcelle de ${Math.round(parcelArea(parcel))} m² · recul figuré : ${metres(need)}`);
  return page;
}

function summaryPage(project) {
  const page = new Page(), left = MARGIN, top = H - MARGIN - 8, mid = W / 2 + 10;
  page.text('Surfaces par pièce', left, top, 14, { bold: true });
  let y = top - 22, total = 0;
  project.levels.slice().reverse().forEach((level) => {
    const a = analyzeLevel(level);
    if (y < FOOT + 40) return;
    page.text(level.name, left, y, 10.5, { bold: true }); y -= 15;
    a.rooms.forEach((r, i) => {
      if (y < FOOT + 14) return;
      const info = level.rooms[i]; if (!info) return;
      page.text(info.name, left + 10, y, 9.5);
      page.text(area(r.area), mid - 40, y, 9.5, { align: 'right' });
      if (!['garage', 'terrasse'].includes(info.type)) total += r.area;
      y -= 13;
    });
    y -= 6;
  });
  page.text(`Surface habitable totale : ${area(total)}`, left, FOOT + 10, 11, { bold: true });

  page.text('Portes et fenêtres', mid, top, 14, { bold: true });
  const list = new Map();
  for (const level of project.levels) for (const w of level.walls) for (const o of w.openings) {
    const k = `${o.name}|${o.width}|${o.height}`;
    list.set(k, { o, n: (list.get(k)?.n || 0) + 1 });
  }
  y = top - 22;
  page.text('Quantité', mid, y, 8.5, { bold: true }); page.text('Désignation', mid + 50, y, 8.5, { bold: true }); page.text('Largeur × hauteur', W - MARGIN, y, 8.5, { bold: true, align: 'right' });
  y -= 15;
  for (const { o, n: count } of [...list.values()].sort((p, q) => q.o.width - p.o.width)) {
    if (y < FOOT + 14) break;
    page.text(String(count), mid + 16, y, 9.5, { align: 'center' });
    page.text(o.name || (isDoorType(o.type) ? 'Porte' : 'Fenêtre'), mid + 50, y, 9.5);
    page.text(`${metres(o.width)} × ${metres(o.height)}`, W - MARGIN, y, 9.5, { align: 'right' });
    y -= 13;
  }
  footer(page, project, 'Récapitulatif', `${project.levels.length} niveau${project.levels.length > 1 ? 'x' : ''}`);
  return page;
}

export function planPdf(project) {
  const pages = [];
  if (parcelOf(project)) pages.push(massPage(project));
  for (const level of [...project.levels].reverse()) if (level.walls.length) pages.push(levelPage(project, level));
  if (!pages.length) return null;
  pages.push(summaryPage(project));
  return writePdf(pages, project.name);
}
