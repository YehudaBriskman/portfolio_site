/**
 * The SMTP provider against a real socket.
 *
 * Not a mocked `createTransport`: the point of this file is to notice when a
 * nodemailer upgrade changes what goes over the wire, and a mock of nodemailer
 * cannot notice anything about nodemailer. So a few dozen lines of SMTP server
 * on a loopback port play the relay, and the test reads back what it was told:
 * the AUTH credentials, the envelope, and the message itself.
 *
 * `src/env.ts` parses process.env once, at import time, so the provider is
 * imported after the server is listening and the environment points at it,
 * with the module registry reset so `env` is read again.
 */
import net from 'net';
import type { AddressInfo } from 'net';

type Session = {
  ehlo: boolean;
  auth: string | null;
  mailFrom: string | null;
  rcptTo: string[];
  data: string;
};

function fakeSmtpServer(opts: { rejectRcpt?: boolean } = {}) {
  const sessions: Session[] = [];
  const server = net.createServer((sock) => {
    const s: Session = { ehlo: false, auth: null, mailFrom: null, rcptTo: [], data: '' };
    sessions.push(s);
    let buf = '';
    let inData = false;
    const say = (line: string) => sock.write(line + '\r\n');
    say('220 fake.invalid ESMTP');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i: number;
      while ((i = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') { inData = false; say('250 2.0.0 queued as FAKE1'); }
          else s.data += (line.startsWith('..') ? line.slice(1) : line) + '\r\n';
          continue;
        }
        const verb = line.split(' ')[0].toUpperCase();
        if (verb === 'EHLO') { s.ehlo = true; say('250-fake.invalid'); say('250 AUTH PLAIN LOGIN'); }
        else if (verb === 'AUTH') { s.auth = line.slice(5); say('235 2.7.0 ok'); }
        else if (verb === 'MAIL') { s.mailFrom = line; say('250 ok'); }
        else if (verb === 'RCPT') {
          if (opts.rejectRcpt) say('550 5.1.1 no such user');
          else { s.rcptTo.push(line); say('250 ok'); }
        }
        else if (verb === 'DATA') { inData = true; say('354 go ahead'); }
        else if (verb === 'QUIT') { say('221 bye'); sock.end(); }
        else if (verb === 'RSET') { say('250 ok'); }
        else say('502 not implemented');
      }
    });
    sock.on('error', () => { /* client hung up; nothing to assert */ });
  });
  return { server, sessions };
}

async function providerAgainst(server: net.Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'relay-user';
  process.env.SMTP_PASS = 'relay-pass';
  vi.resetModules();
  const { smtpProvider } = await import('./smtp.provider.js');
  return smtpProvider;
}

describe('smtp provider', () => {
  const saved = { ...process.env };
  let server: net.Server | null = null;

  afterEach(async () => {
    process.env = { ...saved };
    vi.resetModules();
    if (server) await new Promise((r) => server!.close(r));
    server = null;
  });

  it('authenticates, sets the envelope and delivers the message as composed', async () => {
    const fake = fakeSmtpServer();
    server = fake.server;
    const smtp = await providerAgainst(server);

    const res = await smtp.send({
      from: 'Site <site@example.invalid>',
      to: 'owner@example.invalid',
      subject: 'Hello from the contact form',
      text: 'plain body',
      html: '<p>html body</p>',
      replyTo: 'visitor@example.invalid',
      headers: { 'X-Portfolio-Test': 'yes' },
      attachments: [{ filename: 'note.txt', content: 'attached text', contentType: 'text/plain' }],
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.messageId).toMatch(/^<.+@.+>$/);

    const [s] = fake.sessions;
    expect(s.ehlo).toBe(true);
    // AUTH PLAIN is base64("\0user\0pass"); nodemailer may send it inline or
    // after a 334, and this server only accepts the inline form - which is
    // what it sends when the server advertises PLAIN.
    expect(s.auth).toMatch(/^PLAIN /);
    expect(Buffer.from(s.auth!.slice(6), 'base64').toString()).toBe('\0relay-user\0relay-pass');
    expect(s.mailFrom).toBe('MAIL FROM:<site@example.invalid>');
    expect(s.rcptTo).toEqual(['RCPT TO:<owner@example.invalid>']);

    expect(s.data).toMatch(/^From: Site <site@example\.invalid>\r$/m);
    expect(s.data).toMatch(/^To: owner@example\.invalid\r$/m);
    expect(s.data).toMatch(/^Reply-To: visitor@example\.invalid\r$/m);
    expect(s.data).toMatch(/^Subject: Hello from the contact form\r$/m);
    expect(s.data).toMatch(/^X-Portfolio-Test: yes\r$/m);
    expect(s.data).toMatch(/^Content-Type: multipart\/mixed;/m);
    expect(s.data).toContain('plain body');
    expect(s.data).toContain('<p>html body</p>');
    expect(s.data).toMatch(/filename=note\.txt/);
  });

  it('reports a refused recipient as a failed send rather than throwing', async () => {
    const fake = fakeSmtpServer({ rejectRcpt: true });
    server = fake.server;
    const smtp = await providerAgainst(server);

    const res = await smtp.send({
      from: 'site@example.invalid',
      to: 'nobody@example.invalid',
      subject: 's',
      text: 't',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/550|no such user|rejected/i);
    /* The real nodemailer error, classified: a permanent unknown-user is a hard bounce. */
    expect(res).toMatchObject({ ok: false, kind: 'hard', code: 550 });
  });
});
