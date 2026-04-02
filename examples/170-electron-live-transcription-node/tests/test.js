'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Credential check — MUST be first ──────────────────────────────────────
const required = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  .split('\n').filter(l => /^[A-Z][A-Z0-9_]+=/.test(l.trim())).map(l => l.split('=')[0].trim());
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────────

// ── Test 1: File structure check ───────────────────────────────────────────
function testFileStructure() {
  const root = path.join(__dirname, '..');
  const requiredFiles = [
    'package.json',
    '.env.example',
    'README.md',
    'src/main.js',
    'src/preload.js',
    'src/renderer.js',
    'src/index.html',
  ];

  for (const f of requiredFiles) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) throw new Error(`Missing required file: ${f}`);
  }
  console.log('File structure check passed');
}

// ── Test 2: Deepgram connection options factory ────────────────────────────
// Electron's UI requires a display server so we can't run it in CI. Instead,
// src/main.js exports getDeepgramConnectionOptions() so tests can validate
// the Deepgram configuration without actually opening a WebSocket connection.
function testDeepgramConnectionOptions() {
  const { getDeepgramConnectionOptions } = require('../src/main.js');

  if (typeof getDeepgramConnectionOptions !== 'function') {
    throw new Error('src/main.js must export getDeepgramConnectionOptions()');
  }

  const opts = getDeepgramConnectionOptions();

  if (opts.model !== 'nova-3') {
    throw new Error(`Expected model='nova-3', got '${opts.model}'`);
  }
  if (opts.encoding !== 'linear16') {
    throw new Error(`Expected encoding='linear16', got '${opts.encoding}'`);
  }
  if (opts.sample_rate !== 16000) {
    throw new Error(`Expected sample_rate=16000, got ${opts.sample_rate}`);
  }
  if (opts.channels !== 1) {
    throw new Error(`Expected channels=1, got ${opts.channels}`);
  }
  if (!opts.smart_format) {
    throw new Error('smart_format must be true');
  }
  if (!opts.interim_results) {
    throw new Error('interim_results must be true');
  }
  if (opts.tag !== 'deepgram-examples') {
    throw new Error(`Expected tag='deepgram-examples', got '${opts.tag}'`);
  }

  console.log('Deepgram connection options correctly configured:');
  console.log(`  model: ${opts.model}, encoding: ${opts.encoding}, sample_rate: ${opts.sample_rate}`);
  console.log(`  tag: ${opts.tag}`);
}

// ── Test 3: Connection factory functions are exported ──────────────────────
function testConnectionFactoryExports() {
  const { startDeepgramConnection, stopDeepgramConnection } = require('../src/main.js');

  if (typeof startDeepgramConnection !== 'function') {
    throw new Error('src/main.js must export startDeepgramConnection()');
  }
  if (typeof stopDeepgramConnection !== 'function') {
    throw new Error('src/main.js must export stopDeepgramConnection()');
  }

  console.log('startDeepgramConnection and stopDeepgramConnection are exported');
}

// ── Test 4: Electron integration validation ─────────────────────────────────
// Validates that source files are syntactically valid and use the expected APIs.
function testElectronIntegration() {
  const root = path.join(__dirname, '..');

  const electronPath = require.resolve('electron');
  if (!electronPath) throw new Error('electron package does not resolve');
  console.log(`electron package resolves to: ${electronPath}`);

  const sourceFiles = ['src/main.js', 'src/preload.js', 'src/renderer.js'];
  for (const f of sourceFiles) {
    const full = path.join(root, f);
    execSync(`node --check "${full}"`, { stdio: 'pipe' });
  }
  console.log('All Electron source files pass syntax check');

  const mainSrc = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const electronImports = [
    'BrowserWindow', 'ipcMain', 'Tray', 'Menu', 'globalShortcut', 'nativeImage',
  ];
  for (const api of electronImports) {
    if (!mainSrc.includes(api)) {
      throw new Error(`main.js missing expected Electron API: ${api}`);
    }
  }
  console.log('main.js uses expected Electron APIs: ' + electronImports.join(', '));

  const preloadSrc = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
  if (!preloadSrc.includes('contextBridge')) {
    throw new Error('preload.js missing contextBridge usage');
  }
  if (!preloadSrc.includes('ipcRenderer')) {
    throw new Error('preload.js missing ipcRenderer usage');
  }
  console.log('preload.js uses contextBridge and ipcRenderer correctly');

  if (!mainSrc.includes('contextIsolation: true')) {
    throw new Error('main.js missing contextIsolation: true (security requirement)');
  }
  if (!mainSrc.includes('nodeIntegration: false')) {
    throw new Error('main.js missing nodeIntegration: false (security requirement)');
  }
  console.log('Electron security settings verified (contextIsolation, nodeIntegration)');
}

// ── Main ──────────────────────────────────────────────────────────────────────
function run() {
  testFileStructure();
  testDeepgramConnectionOptions();
  testConnectionFactoryExports();
  testElectronIntegration();
}

try {
  run();
  console.log('\nAll tests passed');
  process.exit(0);
} catch (err) {
  console.error(`\nTest failed: ${err.message}`);
  process.exit(1);
}
