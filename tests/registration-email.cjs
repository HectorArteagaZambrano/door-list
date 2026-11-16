/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name),
    Response, AbortSignal, console: { error() {} }, ...globals });
  return exports;
}
const ticket = { code: 'a'.repeat(64), name: '<script>alert(1)</script>', email: 'guest@example.com',
  event_title: 'Evento & amigos', starts_at: '2026-12-01T01:00:00Z', venue: '<Sala>', ticket_type: 'General' };

test('email embeds a real PNG, escapes event data, uses Lima and Resend idempotency', async () => {
  let sent;
  const { sendTicketEmail } = load('app/ticket-email.ts', {}, {
    process: { env: { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'test@example.com' } },
    fetch: async (url, options) => { sent = { url, ...options, payload: JSON.parse(options.body) }; return new Response('{}'); },
  });
  await sendTicketEmail(ticket);
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.headers['Idempotency-Key'], `registration-ticket/${ticket.code}`);
  assert.deepEqual(sent.payload.to, [ticket.email]);
  assert.match(sent.payload.html, /cid:ticket-qr/);
  assert.match(sent.payload.html, /Evento &amp; amigos/);
  assert.match(sent.payload.html, /&lt;Sala&gt;/);
  assert.doesNotMatch(sent.payload.html, /<script>/);
  assert.match(sent.payload.text, /30 de noviembre/);
  assert.match(sent.payload.text, /20:00|8:00 p\. m\./);
  const attachment = sent.payload.attachments[0];
  assert.equal(attachment.content_id, 'ticket-qr');
  assert.equal(Buffer.from(attachment.content, 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('provider failure rejects email sending', async () => {
  const { sendTicketEmail } = load('app/ticket-email.ts', {}, {
    process: { env: { RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'test@example.com' } },
    fetch: async () => new Response('{}', { status: 429 }),
  });
  await assert.rejects(sendTicketEmail(ticket));
});

test('test sender restriction is diagnosed without exposing provider personal data', async () => {
  const { sendTicketEmail } = load('app/ticket-email.ts', {}, {
    process: { env: { RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'onboarding@resend.dev' } },
    fetch: async () => Response.json({ message: 'You can only send testing emails to your own email address (private@example.com).' }, { status: 403 }),
  });
  await assert.rejects(sendTicketEmail(ticket), error => {
    assert.equal(error.code, 'resend_test_sender_restricted');
    assert.equal(error.status, 403);
    assert.doesNotMatch(error.message, /private@example.com/);
    return true;
  });
});

test('registration survives email failure; invalid/sold-out requests never send', async () => {
  let result = { code: 'ok', ticket_code: ticket.code };
  let sends = 0;
  let registrations = 0;
  const { POST } = load('app/api/registrations/route.ts', {
    '../../public-db': { publicDb: { rpc: async name => {
      if (name === 'register_attendee') { registrations++; return { data: result }; }
      return { data: ticket };
    } } },
    '../../ticket-email': { TicketEmailError: Error, sendTicketEmail: async () => { sends++; throw new Error('offline'); } },
  });
  const body = { eventId: '12345678-1234-1234-1234-123456789012', ticketId: '12345678-1234-1234-1234-123456789012',
    requestId: '12345678-1234-1234-1234-123456789012', name: 'Guest', email: ticket.email };
  const request = value => new Request('http://localhost/api/registrations', { method: 'POST', body: JSON.stringify(value) });
  const response = await POST(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 'ok', ticket_code: ticket.code, email_status: 'failed' });
  assert.equal(sends, 1);
  result = { code: 'sold_out' };
  assert.equal((await (await POST(request(body))).json()).code, 'sold_out');
  assert.equal(sends, 1);
  assert.equal((await POST(request({ ...body, email: 'bad' }))).status, 400);
  assert.equal(registrations, 2);
});
