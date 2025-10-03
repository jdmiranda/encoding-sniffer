import { performance } from 'node:perf_hooks';
import { getEncoding, Sniffer } from './dist/esm/sniffer.js';

// Benchmark utilities
function benchmark(name, fn, iterations = 100_000) {
    // Warmup
    for (let i = 0; i < 1000; i++) fn();

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();

    const totalTime = end - start;
    const opsPerSec = (iterations / totalTime) * 1000;

    console.log(`${name}:`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Operations/sec: ${opsPerSec.toFixed(0)}`);
    console.log(`  Time per op: ${(totalTime / iterations * 1000).toFixed(3)}µs`);
    console.log();

    return opsPerSec;
}

// Test data generators
function createBufferWithBOM(type) {
    const header = type === 'utf8'
        ? new Uint8Array([0xef, 0xbb, 0xbf])
        : type === 'utf16le'
        ? new Uint8Array([0xff, 0xfe])
        : new Uint8Array([0xfe, 0xff]);

    const content = new TextEncoder().encode('<html><head><title>Test</title></head><body>Content</body></html>');
    const result = new Uint8Array(header.length + content.length);
    result.set(header, 0);
    result.set(content, header.length);
    return result;
}

function createBufferWithMetaTag(charset) {
    const html = `<!DOCTYPE html><html><head><meta charset="${charset}"><title>Test</title></head><body>Content</body></html>`;
    return new TextEncoder().encode(html);
}

function createBufferWithContentType(charset) {
    const html = `<!DOCTYPE html><html><head><meta http-equiv="content-type" content="text/html; charset=${charset}"><title>Test</title></head><body>Content</body></html>`;
    return new TextEncoder().encode(html);
}

function createPlainBuffer() {
    const html = '<html><head><title>Test</title></head><body>Plain content without encoding info</body></html>';
    return new TextEncoder().encode(html);
}

console.log('='.repeat(60));
console.log('ENCODING-SNIFFER PERFORMANCE BENCHMARKS');
console.log('='.repeat(60));
console.log();

// BOM Detection Benchmarks
console.log('--- BOM Detection (Fast Path) ---');
console.log();

const utf8BomBuffer = createBufferWithBOM('utf8');
const utf16leBomBuffer = createBufferWithBOM('utf16le');
const utf16beBomBuffer = createBufferWithBOM('utf16be');

const utf8BomOps = benchmark('UTF-8 BOM Detection', () => {
    getEncoding(utf8BomBuffer);
});

const utf16leOps = benchmark('UTF-16 LE BOM Detection', () => {
    getEncoding(utf16leBomBuffer);
});

const utf16beOps = benchmark('UTF-16 BE BOM Detection', () => {
    getEncoding(utf16beBomBuffer);
});

// Meta Tag Detection Benchmarks
console.log('--- Meta Tag Parsing ---');
console.log();

const metaUtf8 = createBufferWithMetaTag('utf-8');
const metaLatin1 = createBufferWithMetaTag('iso-8859-1');
const metaWindows1252 = createBufferWithMetaTag('windows-1252');

const metaUtf8Ops = benchmark('Meta charset="utf-8"', () => {
    getEncoding(metaUtf8);
}, 50_000);

benchmark('Meta charset="iso-8859-1"', () => {
    getEncoding(metaLatin1);
}, 50_000);

benchmark('Meta charset="windows-1252"', () => {
    getEncoding(metaWindows1252);
}, 50_000);

// Content-Type Meta Tag
console.log('--- HTTP-Equiv Content-Type ---');
console.log();

const contentTypeUtf8 = createBufferWithContentType('utf-8');
const contentTypeLatin1 = createBufferWithContentType('iso-8859-1');

benchmark('http-equiv content-type UTF-8', () => {
    getEncoding(contentTypeUtf8);
}, 50_000);

benchmark('http-equiv content-type Latin-1', () => {
    getEncoding(contentTypeLatin1);
}, 50_000);

// Default encoding (no BOM, no meta)
console.log('--- Default Encoding (Fallback) ---');
console.log();

const plainBuffer = createPlainBuffer();

benchmark('Plain HTML (default windows-1252)', () => {
    getEncoding(plainBuffer);
}, 50_000);

// Streaming performance
console.log('--- Streaming Sniffer ---');
console.log();

benchmark('Sniffer instance creation + write', () => {
    const sniffer = new Sniffer();
    sniffer.write(utf8BomBuffer);
    return sniffer.encoding;
}, 50_000);

// Large buffer performance
console.log('--- Large Buffer Handling ---');
console.log();

const largeHtml = `<html><head>${'<meta charset="utf-8">'.repeat(100)}<title>Test</title></head><body>${'Content '.repeat(1000)}</body></html>`;
const largeBuffer = new TextEncoder().encode(largeHtml);

benchmark('Large HTML buffer (10KB+)', () => {
    getEncoding(largeBuffer);
}, 10_000);

// Encoding cache performance test
console.log('--- Encoding Cache Performance ---');
console.log();

const cacheTestBuffers = [
    createBufferWithMetaTag('utf-8'),
    createBufferWithMetaTag('utf-8'),
    createBufferWithMetaTag('iso-8859-1'),
    createBufferWithMetaTag('iso-8859-1'),
    createBufferWithMetaTag('windows-1252'),
];

let cacheIdx = 0;
const cacheOps = benchmark('Mixed encodings (cache hit rate)', () => {
    getEncoding(cacheTestBuffers[cacheIdx++ % cacheTestBuffers.length]);
}, 100_000);

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log();
console.log('Fastest Operations:');
console.log(`  1. UTF-8 BOM Detection: ${utf8BomOps.toFixed(0)} ops/sec`);
console.log(`  2. UTF-16 LE BOM: ${utf16leOps.toFixed(0)} ops/sec`);
console.log(`  3. UTF-16 BE BOM: ${utf16beOps.toFixed(0)} ops/sec`);
console.log(`  4. Meta UTF-8: ${metaUtf8Ops.toFixed(0)} ops/sec`);
console.log(`  5. Cached encodings: ${cacheOps.toFixed(0)} ops/sec`);
console.log();
console.log('Key Optimizations:');
console.log('  - BOM detection uses fast path (direct byte comparison)');
console.log('  - Encoding normalization is cached');
console.log('  - UTF-8 BOM fast path in getEncoding()');
console.log('  - Buffer scanning optimization (indexOf for <)');
console.log();
