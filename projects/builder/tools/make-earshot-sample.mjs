// Builds Earshot's sample: an untagged two-page public notice whose content
// stream is written in a scrambled order (footer first, right column before
// left, table column by column), the way careless exports often are.
// Usage: node make-earshot-sample.mjs <dir containing node_modules/@pdf-lib/fontkit>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PDFDocument, rgb } from '../../../site/builder/earshot/vendor/pdf-lib.esm.min.js';

const libDir = process.argv[2] || '/tmp/lib';
const fontkit = createRequire(libDir + '/')('@pdf-lib/fontkit');
const out = new URL('../../../site/builder/earshot/sample.pdf', import.meta.url);

// A small procedural "photo": sky, hills, a pond and two canoes.
function photoPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = y / h;
      let c = [120 + 90 * t, 175 + 50 * t, 235];
      const hill = h * 0.42 + Math.sin(x / 31) * 10 + Math.sin(x / 13 + 1) * 4;
      if (y > hill) c = [60 + 30 * Math.sin(x / 9), 130 + 20 * Math.sin(y / 7), 70];
      if (y > h * 0.62) c = [50 + 20 * Math.sin((x + y * 3) / 11), 110 + 15 * Math.sin(x / 5), 170];
      const sun = Math.hypot(x - w * 0.8, y - h * 0.18);
      if (sun < h * 0.09) c = [255, 222, 120];
      for (const [cx, cy, col] of [[w * 0.33, h * 0.76, [214, 70, 52]], [w * 0.6, h * 0.84, [240, 170, 40]]]) {
        const dx = (x - cx) / (w * 0.09), dy = (y - cy) / (h * 0.025);
        if (dx * dx + dy * dy < 1) c = col;
      }
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return crc ^ 0xffffffff;
}

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const regular = await doc.embedFont(readFileSync('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'), { subset: true });
const bold = await doc.embedFont(readFileSync('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'), { subset: true });
const photo = await doc.embedPng(photoPng(360, 200));
doc.setTitle('untitled'); // a typical leftover export title
doc.setProducer('Earshot sample generator');
doc.setCreator('Earshot');

const ink = rgb(0.1, 0.13, 0.19), grey = rgb(0.42, 0.46, 0.52), accent = rgb(0.12, 0.42, 0.36);
const W = 612, H = 792, M = 54;

function wrap(text, font, size, width) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
// Returns a function that draws later, so we can choose the content order.
function para(page, text, x, y, width, { font = regular, size = 10.5, lead = 1.38, color = ink } = {}) {
  const lines = wrap(text, font, size, width);
  const draw = () => lines.forEach((l, i) => page.drawText(l, { x, y: y - i * size * lead, size, font, color }));
  return { draw, bottom: y - (lines.length - 1) * size * lead - size * lead };
}
function chrome(page, n) {
  return {
    header: () => {
      page.drawText('Town of Millbrook  ·  Parks & Recreation Department', { x: M, y: H - 40, size: 8.5, font: regular, color: grey });
      page.drawLine({ start: { x: M, y: H - 48 }, end: { x: W - M, y: H - 48 }, thickness: 0.6, color: grey });
    },
    footer: () => {
      page.drawText('Published May 2027', { x: M, y: 34, size: 8.5, font: regular, color: grey });
      const t = `Page ${n} of 2`;
      page.drawText(t, { x: W - M - regular.widthOfTextAtSize(t, 8.5), y: 34, size: 8.5, font: regular, color: grey });
    },
  };
}

// ---------- Page 1 ----------
{
  const page = doc.addPage([W, H]);
  const c = chrome(page, 1);
  const title = () => page.drawText('Summer Recreation Programs 2027', { x: M, y: H - 92, size: 24, font: bold, color: accent });
  const intro = para(page, 'Every summer the Town of Millbrook runs day camps, swimming lessons and sports leagues for residents of all ages. This notice explains how to sign up, what each program costs and how to get help paying for it. Registration opens on Monday, June 2 and most programs fill within two weeks.', M, H - 124, W - 2 * M, { size: 11.5 });
  const colW = (W - 2 * M - 28) / 2, x1 = M, x2 = M + colW + 28;
  let y = intro.bottom - 22;
  const left = [];
  left.push(() => page.drawText('How to register', { x: x1, y, size: 15, font: bold, color: ink }));
  const lp = para(page, 'You can register for any program in three ways. Please have each participant’s date of birth and an emergency contact ready before you start.', x1, y - 24, colW);
  left.push(lp.draw);
  let ly = lp.bottom - 6;
  const bullets = ['Online at millbrook.gov/rec, open around the clock', 'In person at Town Hall, Room 104, weekdays 8:30 to 4:30', 'By phone at (555) 014-2290 during office hours'];
  for (const b of bullets) {
    const yy = ly;
    const p = para(page, b, x1 + 14, yy, colW - 14);
    left.push(() => { page.drawText('•', { x: x1 + 2, y: yy, size: 10.5, font: regular, color: ink }); p.draw(); });
    ly = p.bottom - 4;
  }
  const lp2 = para(page, 'Spaces are given in the order registrations are received. If a program is full you will be added to its waiting list and contacted if a space opens.', x1, ly - 8, colW);
  left.push(lp2.draw);

  const right = [];
  right.push(() => page.drawText('Financial assistance', { x: x2, y, size: 15, font: bold, color: ink }));
  const rp = para(page, 'No child should miss out on summer because of cost. The Recreation Fund covers up to 75 percent of program fees for eligible families, and payment plans are available for everyone.', x2, y - 24, colW);
  right.push(rp.draw);
  const h3y = rp.bottom - 10;
  right.push(() => page.drawText('Who qualifies', { x: x2, y: h3y, size: 12, font: bold, color: ink }));
  const rp2 = para(page, 'Households that receive SNAP, WIC or free school meals qualify automatically. Other households may apply with proof of income. Applications are confidential and are decided within five working days.', x2, h3y - 20, colW);
  right.push(rp2.draw);
  const rp3 = para(page, 'Ask for an application form at Town Hall or download one from the website.', x2, rp2.bottom - 6, colW);
  right.push(rp3.draw);

  // Scrambled content order: footer, right column, header, left column, title, intro.
  c.footer(); right.forEach(f => f()); c.header(); left.forEach(f => f()); title(); intro.draw();
}

// ---------- Page 2 ----------
{
  const page = doc.addPage([W, H]);
  const c = chrome(page, 2);
  const h2 = () => page.drawText('Program fees', { x: M, y: H - 92, size: 15, font: bold, color: ink });
  const cols = [M, M + 190, M + 290, M + 380];
  const rows = [
    ['Program', 'Ages', 'Weeks', 'Resident fee'],
    ['Adventure Day Camp', '6–12', '8', '$640'],
    ['Learn to Swim', '4 and up', '4', '$85'],
    ['Junior Tennis', '8–15', '6', '$120'],
    ['Teen Leadership Corps', '13–17', '8', '$150'],
    ['Adult Pickleball League', '18 and up', '10', '$60'],
  ];
  const ty = H - 124, rowH = 22;
  const table = () => {
    page.drawRectangle({ x: M - 6, y: ty - 7, width: W - 2 * M + 12, height: rowH, color: rgb(0.9, 0.94, 0.92) });
    for (let r = 1; r <= rows.length; r++) page.drawLine({ start: { x: M - 6, y: ty - 7 - (r - 1) * rowH }, end: { x: W - M + 6, y: ty - 7 - (r - 1) * rowH }, thickness: 0.5, color: rgb(0.75, 0.78, 0.8) });
    // Column by column: a screen reader reading file order hears every program name, then every age range.
    for (let ci = 0; ci < cols.length; ci++) {
      rows.forEach((row, ri) => page.drawText(row[ci], { x: cols[ci], y: ty - ri * rowH, size: 10.5, font: ri === 0 ? bold : regular, color: ink }));
    }
  };
  const note = para(page, 'Non-resident fees are 25 percent higher. Fees include all equipment, and camp fees include a daily lunch.', M, ty - rows.length * rowH - 10, W - 2 * M, { size: 10, color: grey });
  const iy = note.bottom - 152;
  const img = () => page.drawImage(photo, { x: M, y: iy, width: 252, height: 140 });
  const cap = para(page, 'Last summer more than 900 residents took part in at least one program, the highest number since the department began keeping records in 1998.', M + 272, iy + 130, W - 2 * M - 272);
  const ah = iy - 36;
  const acc = () => page.drawText('Accessibility', { x: M, y: ah, size: 15, font: bold, color: ink });
  const ap = para(page, 'All programs welcome participants with disabilities. To request an accommodation, such as a support worker, sign language interpreter or adapted equipment, contact the Recreation Office at least two weeks before the program starts. This notice is also available in large print and in Spanish.', M, ah - 24, W - 2 * M);

  c.header(); img(); table(); h2(); ap.draw(); c.footer(); acc(); note.draw(); cap.draw();
}

writeFileSync(out, await doc.save({ useObjectStreams: false }));
console.log('wrote', out.pathname);
