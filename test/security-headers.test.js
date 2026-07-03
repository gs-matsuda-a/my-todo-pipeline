const request = require('supertest');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'tasks.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const app = require('../server.js');

describe('Security headers', () => {
  test('X-Powered-By is not exposed', async () => {
    const res = await request(app).get('/api/me');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('X-Content-Type-Options is nosniff', async () => {
    const res = await request(app).get('/api/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('clickjacking protection header is present', async () => {
    const res = await request(app).get('/api/me');
    const hasFrameProtection =
      res.headers['x-frame-options'] !== undefined ||
      (res.headers['content-security-policy'] || '').includes('frame-ancestors');
    expect(hasFrameProtection).toBe(true);
  });
});

describe('Request body size limit', () => {
  test('rejects an oversized JSON body', async () => {
    const bigTitle = 'a'.repeat(200 * 1024);
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'sizetest', password: bigTitle });

    expect(res.status).toBe(413);
  });
});
