import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));

function runIsolated(source: string) {
  // 취약한 파서가 재유입돼도 무한 반복이 테스트 러너 전체를 멈추지 않게 한다.
  return execFileSync(process.execPath, ['-e', source], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    timeout: 15_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const imagePrelude = `
  const assert = require('node:assert/strict');
  const sizeOf = require('image-size');
  function box(name, payload = Buffer.alloc(0), declaredSize = payload.length + 8) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(declaredSize);
    header.write(name, 4);
    return Buffer.concat([header, payload]);
  }
  function icnsEntry(name, length = 8) {
    const entry = Buffer.alloc(8);
    entry.write(name); entry.writeUInt32BE(length, 4);
    return entry;
  }
`;

describe('dependency security and consumer compatibility', () => {
  test.each([0, 1, 7])('rejects ICNS entry length %i without hanging', (length) => {
    expect(runIsolated(`${imagePrelude}
      const entry = icnsEntry('icp4', ${length});
      const image = box('icns', entry);
      image.write('icns', 0); image.writeUInt32BE(image.length, 4);
      assert.throws(() => sizeOf(image), /Invalid ICNS/);
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('rejects a zero-length second ICNS entry and a truncated header', () => {
    expect(runIsolated(`${imagePrelude}
      for (const tail of [icnsEntry('icp5', 0), Buffer.from('icp5')]) {
        const image = Buffer.concat([Buffer.alloc(8), icnsEntry('icp4'), tail]);
        image.write('icns'); image.writeUInt32BE(image.length, 4);
        assert.throws(() => sizeOf(image), /Invalid ICNS/);
      }
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('preserves valid multi-entry ICNS dimensions', () => {
    expect(runIsolated(`${imagePrelude}
      const image = Buffer.concat([Buffer.alloc(8), icnsEntry('icp4'), icnsEntry('icp5')]);
      image.write('icns'); image.writeUInt32BE(image.length, 4);
      const size = sizeOf(image);
      assert.equal(size.width, 16); assert.equal(size.height, 16);
      assert.deepEqual(size.images.map(image => image.width), [16, 32]);
      const prefix = Buffer.concat([Buffer.alloc(8), icnsEntry('ic10', 1024 * 1024)]);
      prefix.write('icns'); prefix.writeUInt32BE(8 + 1024 * 1024, 4);
      assert.equal(sizeOf(prefix).width, 1024);
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('terminates malformed JXL partial streams and HEIF containers', () => {
    expect(runIsolated(`${imagePrelude}
      const { JXL } = require('image-size/dist/types/jxl.js');
      const { HEIF } = require('image-size/dist/types/heif.js');
      for (const length of [0, 1, 7]) {
        assert.throws(() => JXL.calculate(box('jxlp', Buffer.alloc(4), length)));
        assert.throws(() => HEIF.calculate(box('ftyp', Buffer.from('heic'), length)));
      }
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('preserves HEIF dimensions and valid boxes extending to EOF', () => {
    expect(runIsolated(`${imagePrelude}
      const { findBox } = require('image-size/dist/types/utils.js');
      const dimensions = Buffer.alloc(12);
      dimensions.writeUInt32BE(320, 4); dimensions.writeUInt32BE(240, 8);
      for (const size of [20, 0]) {
        const ispe = box('ispe', dimensions, size);
        const meta = box('meta', Buffer.concat([Buffer.alloc(4), box('iprp', box('ipco', ispe))]));
        const image = Buffer.concat([box('ftyp', Buffer.from('heic')), meta]);
        assert.equal(sizeOf(image).width, 320); assert.equal(sizeOf(image).height, 240);
        assert.equal(findBox(ispe, 'ispe', 0).size, ispe.length);
      }
      assert.equal(findBox(Buffer.from([0, 0, 0, 0]), 'ispe', 0), undefined);
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('preserves all checked-in mobile image dimensions', () => {
    expect(runIsolated(`${imagePrelude}
      const fs = require('node:fs');
      const path = require('node:path');
      const directory = 'apps/mobile/assets/images';
      const images = fs.readdirSync(directory).filter(file => /\\.png$/i.test(file));
      assert.ok(images.length > 0);
      for (const file of images) {
        const bytes = fs.readFileSync(path.join(directory, file));
        const size = sizeOf(bytes);
        assert.equal(size.width, bytes.readUInt32BE(16));
        assert.equal(size.height, bytes.readUInt32BE(20));
      }
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('keeps query-string CommonJS, Unicode, plus, fragments and array semantics', () => {
    expect(runIsolated(`
      const assert = require('node:assert/strict');
      const query = require('query-string');
      assert.deepEqual({...query.parse('name=%EC%95%BD%EC%86%8D&text=a+b&plus=%2B&x=1&x=2&empty&blank=')}, {
        name: '약속', text: 'a b', plus: '+', x: ['1', '2'], empty: null, blank: '',
      });
      const parsed = query.parseUrl('https://example.com/i/token?a=1#hello+world', {parseFragmentIdentifier: true});
      assert.equal(parsed.fragmentIdentifier, 'hello world');
      assert.equal(query.parse('x=%FE%FF').x, '\\uFFFD\\uFFFD');
      assert.equal(query.parse('x=%C2').x, '\\uFFFD');
      const encoded = query.stringify({x: ['약속', 'a+b']}, {arrayFormat: 'bracket'});
      assert.deepEqual(query.parse(encoded, {arrayFormat: 'bracket'}).x, ['약속', 'a+b']);
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('decodes long malformed URI runs within the child-process deadline', () => {
    expect(runIsolated(`
      const assert = require('node:assert/strict');
      const query = require('query-string');
      const malformed = '%A9'.repeat(20_000);
      assert.equal(query.parse('x=' + malformed).x, malformed);
      assert.equal(query.parse('x=' + malformed + '%EC%95%BD%EC%86%8D').x, malformed + '약속');
      process.stdout.write('ok');
    `)).toBe('ok');
  });

  test('keeps xcode project UUID generation and rejects undersized uuid buffers', () => {
    expect(runIsolated(`
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const xcode = require('xcode');
      const uuid = createRequire(require.resolve('xcode'))('uuid');
      const project = xcode.project('unused.pbxproj');
      project.hash = {project: {objects: {PBXGroup: {}}}};
      const group = project.addPbxGroup([], 'Security');
      assert.match(group.uuid, /^[A-F0-9]{24}$/);
      const parsed = require('xcode/lib/parser/pbxproj').parse(project.writeSync());
      assert.equal(parsed.project.objects.PBXGroup[group.uuid].name, 'Security');
      for (const method of [uuid.v3, uuid.v5]) {
        assert.throws(() => method('test', method.DNS, new Uint8Array(1)), RangeError);
      }
      process.stdout.write('ok');
    `)).toBe('ok');
  });
});
