// src/app.test.ts
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from './app';

describe('backend API', () => {
  it('GET /health → 200 { ok:true }', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('CORS headers exist', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('unknown route → 404 JSON', async () => {
    const app = createApp();
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('GET /api/images/:name returns 404 when file missing', async () => {
    const app = createApp();
    const res = await request(app).get('/api/images/missing.png'); // <-- /api
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('GET /api/images/:name returns file content when exists (tmp dir)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    const fileName = 'hello.txt';
    const filePath = path.join(tmp, fileName);
    fs.writeFileSync(filePath, 'hello world');

    const prev = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmp;
    const app = createApp();

    const res = await request(app).get(`/api/images/${fileName}`); // <-- /api
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello world');
    process.env.UPLOADS_DIR = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
