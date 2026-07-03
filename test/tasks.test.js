const request = require('supertest');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'tasks.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const app = require('../server.js');

async function registerAndLogin(username, password = 'password123') {
  await request(app).post('/api/register').send({ username, password });
  const res = await request(app).post('/api/login').send({ username, password });
  const cookie = res.headers['set-cookie'];
  return cookie;
}

describe('PUT /api/tasks/:id - due_date preservation', () => {
  let cookie;
  let taskId;

  beforeAll(async () => {
    cookie = await registerAndLogin('duedateuser');

    const createRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'task with due date', due_date: '2026-12-31' });

    taskId = createRes.body.id;
  });

  test('created task has the given due_date', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    expect(res.body.due_date).toBe('2026-12-31');
  });

  test('updating only completed does not clear due_date', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ completed: 1, version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBe('2026-12-31');
    expect(res.body.completed).toBe(1);
  });

  test('updating only title does not clear due_date', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ title: 'renamed task', version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBe('2026-12-31');
    expect(res.body.title).toBe('renamed task');
  });

  test('explicitly setting due_date to null clears it', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: null, version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBeNull();
  });

  test('updating due_date to a new value works', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: '2027-01-01', version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBe('2027-01-01');
  });
});

describe('PUT /api/tasks/:id - title validation', () => {
  let cookie;
  let taskId;

  beforeAll(async () => {
    cookie = await registerAndLogin('puttitlevaliduser');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'original title' });
    taskId = createRes.body.id;
  });

  test('rejects title longer than 200 chars on update', async () => {
    const before = await request(app).get(`/api/tasks/${taskId}`).set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ title: 'a'.repeat(201), version: before.body.version });

    expect(res.status).toBe(400);
  });

  test('accepts title update within limit', async () => {
    const before = await request(app).get(`/api/tasks/${taskId}`).set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ title: 'updated title', version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('updated title');
  });
});

describe('POST /api/tasks - title length limit', () => {
  let cookie;

  beforeAll(async () => {
    cookie = await registerAndLogin('titlelimituser');
  });

  test('rejects title longer than 200 chars', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'a'.repeat(201) });

    expect(res.status).toBe(400);
  });

  test('accepts title of exactly 200 chars', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'a'.repeat(200) });

    expect(res.status).toBe(201);
  });
});

describe('PUT /api/tasks/:id - due_date format validation', () => {
  let cookie;
  let taskId;

  beforeAll(async () => {
    cookie = await registerAndLogin('duedateformatuser');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie)
      .send({ title: 'Test task', due_date: '2026-12-31' });
    taskId = createRes.body.id;
  });

  test('rejects invalid due_date format (slash separator)', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: '2026/12/31', version: before.body.version });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('due_date');
  });

  test('rejects invalid due_date format (non-date string)', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: 'not-a-date', version: before.body.version });

    expect(res.status).toBe(400);
  });

  test('accepts valid due_date format (YYYY-MM-DD)', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: '2027-06-15', version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBe('2027-06-15');
  });

  test('accepts null/empty due_date', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: null, version: before.body.version });

    expect(res.status).toBe(200);
    expect(res.body.due_date).toBeNull();
  });

  test('rejects invalid calendar date (2026-02-30)', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: '2026-02-30', version: before.body.version });

    expect(res.status).toBe(400);
  });

  test('rejects invalid calendar date (2026-04-31)', async () => {
    const before = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', cookie)
      .send({ due_date: '2026-04-31', version: before.body.version });

    expect(res.status).toBe(400);
  });
});
