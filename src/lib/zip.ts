/** Minimal ZIP writer.
 *
 * Tiled output is several files, and handing someone a browser that fires off
 * twelve separate downloads is hostile. A zip is one file. Rather than pull in
 * a library for it, this uses CompressionStream, which every current browser
 * has, so the archive is properly deflated and the dependency count stays at
 * zero.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipEntry {
  name: string
  data: Uint8Array | string
}

/** Writes a ZIP with no directory entries and no timestamps, so the same
 *  inputs always produce the same archive. */
export async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const raw = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data
    const crc = crc32(raw)
    const body = await deflate(raw)

    const local = new Uint8Array(30 + name.length + body.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // local file header
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0, true) // flags
    lv.setUint16(8, 8, true) // deflate
    lv.setUint16(10, 0, true) // time
    lv.setUint16(12, 0, true) // date
    lv.setUint32(14, crc, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true) // extra length
    local.set(name, 30)
    local.set(body, 30 + name.length)
    locals.push(local)

    const dir = new Uint8Array(46 + name.length)
    const dv = new DataView(dir.buffer)
    dv.setUint32(0, 0x02014b50, true) // central directory header
    dv.setUint16(4, 20, true) // version made by
    dv.setUint16(6, 20, true) // version needed
    dv.setUint16(8, 0, true)
    dv.setUint16(10, 8, true)
    dv.setUint16(12, 0, true)
    dv.setUint16(14, 0, true)
    dv.setUint32(16, crc, true)
    dv.setUint32(20, body.length, true)
    dv.setUint32(24, raw.length, true)
    dv.setUint16(28, name.length, true)
    dv.setUint16(30, 0, true)
    dv.setUint16(32, 0, true)
    dv.setUint16(34, 0, true)
    dv.setUint16(36, 0, true)
    dv.setUint32(38, 0, true) // external attributes
    dv.setUint32(42, offset, true)
    dir.set(name, 46)
    central.push(dir)

    offset += local.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // end of central directory
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...locals, ...central, end] as BlobPart[], { type: 'application/zip' })
}

/** Gzip, for .svgz. Illustrator opens it directly and a mosaic SVG is mostly
 *  repeated markup, so this routinely cuts it by most of its size. */
export async function gzip(text: string): Promise<Blob> {
  const cs = new CompressionStream('gzip')
  const stream = new Blob([text]).stream().pipeThrough(cs)
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' })
}
