import { afterEach, describe, expect, it, vi } from 'vitest';
import { cellText, crc32, downloadFile, makeXlsx, makeZip, slug } from './xlsx';

const enc = new TextEncoder();
const text = (u8: Uint8Array) => new TextDecoder('latin1').decode(u8);

/** Reads a stored zip back through its central directory: name -> bytes. */
function readZip(zip: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true);
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out.set(name, data);
    p += 46 + nameLen;
  }
  return out;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('makeZip', () => {
  it('stores text and binary files that read back intact', () => {
    const bin = new Uint8Array([0, 1, 2, 255]);
    const zip = makeZip([
      { name: 'a.txt', data: 'hello ✨' },
      { name: 'dir/b.bin', data: bin },
    ]);
    const files = readZip(zip);
    expect([...files.keys()]).toEqual(['a.txt', 'dir/b.bin']);
    expect(new TextDecoder().decode(files.get('a.txt'))).toBe('hello ✨');
    expect(files.get('dir/b.bin')).toEqual(bin);
  });

  it('writes the given date in DOS format', () => {
    const zip = makeZip([{ name: 'a', data: '' }], new Date(2026, 4, 10, 13, 45, 30));
    const v = new DataView(zip.buffer);
    expect(v.getUint16(10, true)).toBe((13 << 11) | (45 << 5) | 15);
    expect(v.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (5 << 5) | 10);
  });

  it('makes an empty zip', () => {
    expect(readZip(makeZip([])).size).toBe(0);
  });
});

describe('cellText', () => {
  it('neutralises formulas', () => {
    expect(cellText('=HYPERLINK("x")')).toBe(`'=HYPERLINK(&quot;x&quot;)`);
    expect(cellText('+1')).toBe("'+1");
    expect(cellText('-1')).toBe("'-1");
    expect(cellText('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(cellText('a=b')).toBe('a=b');
  });
  it('escapes XML and strips control characters', () => {
    expect(cellText('<b>&"</b>')).toBe('&lt;b&gt;&amp;&quot;&lt;/b&gt;');
    expect(cellText('a\u0000b\u0007c\td\ne')).toBe('abc\td\ne');
    // A control character cannot hide a formula.
    expect(cellText('\u0001=1')).toBe("'=1");
  });
  it('handles non-strings', () => {
    expect(cellText(undefined)).toBe('');
    expect(cellText(null)).toBe('');
    expect(cellText(42)).toBe('42');
  });
});

describe('makeXlsx', () => {
  const book = makeXlsx([
    { name: 'Answers', rows: [['Q', 'A'], ['=cmd', 'ok']], widths: [10, 20] },
    { name: 'A very long sheet name that goes past 31 chars', rows: [Array.from({ length: 28 }, (_, i) => `c${i}`)], widths: [5] },
  ]);
  const files = readZip(book);
  const get = (n: string) => new TextDecoder().decode(files.get(n));

  it('has the parts Excel needs', () => {
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    expect(get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
    expect(get('xl/_rels/workbook.xml.rels')).toContain('Id="rId3"');
    expect(get('xl/_rels/workbook.xml.rels')).toContain('Target="styles.xml"');
  });

  it('names sheets, cutting to 31 characters', () => {
    const wb = get('xl/workbook.xml');
    expect(wb).toContain('<sheet name="Answers" sheetId="1" r:id="rId1"/>');
    expect(wb).toContain('name="A very long sheet name that goe"');
  });

  it('writes cells as inline strings with a bold header and neutralised formulas', () => {
    const s1 = get('xl/worksheets/sheet1.xml');
    expect(s1).toContain('<col min="1" max="1" width="10" customWidth="1"/>');
    expect(s1).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Q</t></is></c>');
    expect(s1).toContain(`<c r="A2" t="inlineStr" s="2"><is><t xml:space="preserve">'=cmd</t></is></c>`);
    expect(s1).not.toContain('<f>');
  });

  it('names columns past Z', () => {
    const s2 = get('xl/worksheets/sheet2.xml');
    expect(s2).toContain('<c r="Z1"');
    expect(s2).toContain('<c r="AA1"');
    expect(s2).toContain('<c r="AB1"');
  });

  it('is found by name in the raw bytes', () => {
    expect(text(book)).toContain('xl/workbook.xml');
  });
});

describe('slug', () => {
  it('makes a safe file name part', () => {
    expect(slug('Ravi Kumar')).toBe('Ravi-Kumar');
    expect(slug('  !Asha!  ')).toBe('Asha');
    expect(slug('प्रिया')).toBe('x');
    expect(slug('')).toBe('x');
  });
});

describe('downloadFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('hands the bytes to a temporary link, then frees the URL', async () => {
    vi.useFakeTimers();
    const a = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => a), body: { append } });
    const createObjectURL = vi.fn((_b: Blob) => 'blob:1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    downloadFile('room.zip', new Uint8Array([1, 2, 3]), 'application/zip');

    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe('application/zip');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(a).toMatchObject({ href: 'blob:1', download: 'room.zip' });
    expect(append).toHaveBeenCalledWith(a);
    expect(a.click).toHaveBeenCalled();
    expect(a.remove).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });
});
