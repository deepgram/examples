'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Credential check — MUST be first ──────────────────────────────────────
const envExample = path.join(__dirname, '..', '.env.example');
const required = fs.readFileSync(envExample, 'utf8')
	.split('\n')
	.filter((l) => /^[A-Z][A-Z0-9_]+=/.test(l.trim()))
	.map((l) => l.split('=')[0].trim());

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
	console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
	process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.DEEPGRAM_API_KEY;
const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const EXPECTED_WORDS = ['spacewalk', 'astronaut', 'nasa'];

function request(options, body) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, (res) => {
			const chunks = [];
			res.on('data', (chunk) => chunks.push(chunk));
			res.on('end', () => {
				const buffer = Buffer.concat(chunks);
				if (res.headers['content-type']?.includes('application/json')) {
					try {
						resolve({ status: res.statusCode, data: JSON.parse(buffer.toString()) });
					} catch {
						resolve({ status: res.statusCode, data: buffer });
					}
				} else {
					resolve({ status: res.statusCode, data: buffer });
				}
			});
		});
		req.on('error', reject);
		if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
		req.end();
	});
}

async function testCredentialValidation() {
	console.log('1. Testing credential validation (GET /v1/projects)...');
	const res = await request({
		hostname: 'api.deepgram.com',
		path: '/v1/projects',
		method: 'GET',
		headers: { Authorization: `Token ${API_KEY}` },
	});
	if (res.status !== 200) throw new Error(`Credential test failed: HTTP ${res.status}`);
	console.log('   ✓ API key is valid');
}

async function testTranscribeUrl() {
	console.log('2. Testing pre-recorded transcription (POST /v1/listen)...');
	const res = await request(
		{
			hostname: 'api.deepgram.com',
			path: '/v1/listen?model=nova-3&smart_format=true&tag=deepgram-examples',
			method: 'POST',
			headers: {
				Authorization: `Token ${API_KEY}`,
				'Content-Type': 'application/json',
			},
		},
		JSON.stringify({ url: KNOWN_AUDIO_URL }),
	);
	if (res.status !== 200) throw new Error(`Transcription failed: HTTP ${res.status}`);

	const transcript = res.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
	if (!transcript || transcript.length < 20) {
		throw new Error(`Transcript too short or empty: "${transcript}"`);
	}

	const lower = transcript.toLowerCase();
	const found = EXPECTED_WORDS.filter((w) => lower.includes(w));
	if (found.length === 0) {
		throw new Error(`Expected words not found. Got: "${transcript.substring(0, 200)}"`);
	}

	console.log(`   ✓ Transcript received (${transcript.length} chars, found: ${found.join(', ')})`);
}

async function testTts() {
	console.log('3. Testing text-to-speech (POST /v1/speak)...');
	const res = await request(
		{
			hostname: 'api.deepgram.com',
			path: '/v1/speak?model=aura-2-thalia-en&tag=deepgram-examples',
			method: 'POST',
			headers: {
				Authorization: `Token ${API_KEY}`,
				'Content-Type': 'application/json',
			},
		},
		JSON.stringify({ text: 'Hello from the Deepgram n8n community node.' }),
	);
	if (res.status !== 200) throw new Error(`TTS failed: HTTP ${res.status}`);

	if (!Buffer.isBuffer(res.data) || res.data.length < 1000) {
		throw new Error(`TTS response too small: ${res.data?.length ?? 0} bytes`);
	}
	console.log(`   ✓ Audio received (${res.data.length} bytes)`);
}

async function testAudioIntelligence() {
	console.log('4. Testing audio intelligence — summarize (POST /v1/listen?summarize=v2)...');
	const res = await request(
		{
			hostname: 'api.deepgram.com',
			path: '/v1/listen?model=nova-3&smart_format=true&summarize=v2&tag=deepgram-examples',
			method: 'POST',
			headers: {
				Authorization: `Token ${API_KEY}`,
				'Content-Type': 'application/json',
			},
		},
		JSON.stringify({ url: KNOWN_AUDIO_URL }),
	);
	if (res.status !== 200) throw new Error(`Intelligence failed: HTTP ${res.status}`);

	const summary = res.data?.results?.summary?.short;
	if (!summary || summary.length < 10) {
		throw new Error(`Summary too short or missing: "${summary}"`);
	}
	console.log(`   ✓ Summary received (${summary.length} chars): "${summary.substring(0, 100)}..."`);
}

async function testTypeScriptCompilation() {
	console.log('5. Testing TypeScript compilation...');
	const nodeFile = path.join(__dirname, '..', 'src', 'nodes', 'Deepgram', 'Deepgram.node.ts');
	const credFile = path.join(__dirname, '..', 'src', 'credentials', 'DeepgramApi.credentials.ts');

	if (!fs.existsSync(nodeFile)) throw new Error(`Node file not found: ${nodeFile}`);
	if (!fs.existsSync(credFile)) throw new Error(`Credential file not found: ${credFile}`);

	const nodeSource = fs.readFileSync(nodeFile, 'utf8');
	if (!nodeSource.includes('INodeType')) throw new Error('Node missing INodeType interface');
	if (!nodeSource.includes("tag: 'deepgram-examples'") && !nodeSource.includes("tag: \"deepgram-examples\"")) {
		throw new Error('Node missing deepgram-examples tag');
	}
	if (!nodeSource.includes('deepgramApi')) throw new Error('Node missing credential reference');

	const credSource = fs.readFileSync(credFile, 'utf8');
	if (!credSource.includes('ICredentialType')) throw new Error('Credential missing ICredentialType');

	console.log('   ✓ Source files valid');
}

async function run() {
	await testCredentialValidation();
	await testTranscribeUrl();
	await testTts();
	await testAudioIntelligence();
	await testTypeScriptCompilation();
}

run()
	.then(() => {
		console.log('\n✓ All tests passed');
		process.exit(0);
	})
	.catch((err) => {
		console.error(`\n✗ Test failed: ${err.message}`);
		process.exit(1);
	});
