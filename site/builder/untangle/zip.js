// Minimal ZIP reader: an .xlsx is a zip of XML files. Uses the browser's own
// DecompressionStream, so nothing is uploaded and no library is needed.

const td = new TextDecoder();

function findEOCD(view) {
  const min = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error("This file isn't a zip archive, so it isn't an .xlsx workbook.");
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function readZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEOCD(view);
  let count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset === 0xffffffff || count === 0xffff) {
    // Zip64: the real values live in the zip64 end-of-central-directory record.
    const loc = eocd - 20;
    if (loc >= 0 && view.getUint32(loc, true) === 0x07064b50) {
      const rec = Number(view.getBigUint64(loc + 8, true));
      count = Number(view.getBigUint64(rec + 32, true));
      offset = Number(view.getBigUint64(rec + 48, true));
    }
  }
  const entries = new Map();
  let p = offset;
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    let compSize = view.getUint32(p + 20, true);
    let size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    let local = view.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // Zip64 extra field carries 64-bit sizes/offsets when the 32-bit ones are saturated.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = view.getUint16(e, true), len = view.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = Number(view.getBigUint64(q, true)); q += 8; }
        if (compSize === 0xffffffff) { compSize = Number(view.getBigUint64(q, true)); q += 8; }
        if (local === 0xffffffff) { local = Number(view.getBigUint64(q, true)); }
      }
      e += 4 + len;
    }
    entries.set(name.replace(/\\/g, "/"), { name, flags, method, compSize, size, local });
    p = extraEnd + commentLen;
  }

  async function read(name) {
    const ent = entries.get(name) || [...entries.values()].find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!ent) return null;
    if (ent.flags & 1) throw new Error("This workbook is password-protected (encrypted), so it can't be opened here.");
    const lp = ent.local;
    const start = lp + 30 + view.getUint16(lp + 26, true) + view.getUint16(lp + 28, true);
    const data = bytes.subarray(start, start + ent.compSize);
    if (ent.method === 0) return data;
    if (ent.method === 8) return inflateRaw(data);
    throw new Error(`Unsupported zip compression method ${ent.method}.`);
  }

  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(name),
    read,
    async text(name) {
      const b = await read(name);
      return b ? td.decode(b) : null;
    },
  };
}
