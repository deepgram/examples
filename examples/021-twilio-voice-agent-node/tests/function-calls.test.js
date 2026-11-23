'use strict';

const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const test = require('node:test');
const WebSocket = require('ws');
const { createApp, AGENT_SETTINGS } = require('../src/index.js');

test('function requests send documented response envelopes over the agent socket', async () => {
  const originalKey = process.env.DEEPGRAM_API_KEY;
  process.env.DEEPGRAM_API_KEY = 'offline-test-key';
  let upstream;
  class FakeAgentSocket extends EventEmitter {
    constructor() {
      super();
      upstream = this;
      this.readyState = WebSocket.OPEN;
      this.sent = [];
      queueMicrotask(() => this.emit('open'));
    }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = WebSocket.CLOSED; this.emit('close'); }
  }
  const server = createApp({ AgentWebSocket: FakeAgentSocket }).listen(0, '127.0.0.1');
  let caller;
  try {
    await once(server, 'listening');
    caller = new WebSocket(`ws://127.0.0.1:${server.address().port}/media`);
    await once(caller, 'open');
    assert.deepEqual(upstream.sent[0], AGENT_SETTINGS);
    upstream.emit('message', Buffer.from(JSON.stringify({
      type: 'FunctionCallRequest',
      functions: [
        { id: 'order-call', name: 'check_order_status', arguments: '{"order_number":"999"}', client_side: true },
        { id: 'unknown-call', name: 'unknown_function', arguments: '{}', client_side: true },
      ],
    })), false);
    const responses = upstream.sent.filter(msg => msg.type === 'FunctionCallResponse');
    assert.equal(responses.length, 2);
    assert.deepEqual(Object.keys(responses[0]).sort(), ['content', 'id', 'name', 'type']);
    assert.equal(responses[0].id, 'order-call');
    assert.equal(responses[0].name, 'check_order_status');
    assert.equal(typeof responses[0].content, 'string');
    assert.equal(JSON.parse(responses[0].content).order_number, '999');
    assert.equal(responses[1].id, 'unknown-call');
    assert.equal(responses[1].name, 'unknown_function');
    assert.deepEqual(JSON.parse(responses[1].content), { error: 'Unknown function' });
    assert.equal('output' in responses[1], false);
  } finally {
    if (caller) { const closed = once(caller, 'close'); caller.close(); await closed; }
    await new Promise(resolve => server.close(resolve));
    if (originalKey === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = originalKey;
  }
});
