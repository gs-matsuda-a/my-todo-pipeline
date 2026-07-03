const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Clean up DB before importing app
const dbPath = path.join(__dirname, '..', 'tasks.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const app = require('../server.js');

describe('Authentication - validateUsername', () => {
  test('valid username with 3 chars', () => {
    expect(app.validateUsername('abc')).toBe(true);
  });

  test('valid username with numbers and underscore', () => {
    expect(app.validateUsername('user_123')).toBe(true);
  });

  test('valid username with 20 chars', () => {
    expect(app.validateUsername('a'.repeat(20))).toBe(true);
  });

  test('invalid username - too short (2 chars)', () => {
    expect(app.validateUsername('ab')).toBe(false);
  });

  test('invalid username - too long (21 chars)', () => {
    expect(app.validateUsername('a'.repeat(21))).toBe(false);
  });

  test('invalid username - contains hyphen', () => {
    expect(app.validateUsername('user-name')).toBe(false);
  });

  test('invalid username - contains space', () => {
    expect(app.validateUsername('user name')).toBe(false);
  });

  test('invalid username - empty string', () => {
    expect(app.validateUsername('')).toBe(false);
  });
});

describe('Authentication - validatePassword', () => {
  test('valid password with 8 chars', () => {
    expect(app.validatePassword('password')).toBe(true);
  });

  test('valid password with 64 chars', () => {
    expect(app.validatePassword('a'.repeat(64))).toBe(true);
  });

  test('invalid password - too short (7 chars)', () => {
    expect(app.validatePassword('pass123')).toBe(false);
  });

  test('invalid password - too long (65 chars)', () => {
    expect(app.validatePassword('a'.repeat(65))).toBe(false);
  });

  test('invalid password - empty string', () => {
    expect(app.validatePassword('')).toBe(false);
  });
});

describe('Authentication - Bcrypt hashing', () => {
  test('hashPassword returns bcrypt hash', () => {
    const hash = app.hashPassword('password123');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(10);
  });

  test('comparePassword matches correct password', () => {
    const pwd = 'password123';
    const hash = app.hashPassword(pwd);
    expect(app.comparePassword(pwd, hash)).toBe(true);
  });

  test('comparePassword rejects wrong password', () => {
    const hash = app.hashPassword('password123');
    expect(app.comparePassword('wrongpassword', hash)).toBe(false);
  });

  test('different passwords produce different hashes', () => {
    const hash1 = app.hashPassword('password123');
    const hash2 = app.hashPassword('password456');
    expect(hash1).not.toBe(hash2);
  });
});

describe('POST /api/register', () => {
  test('register with valid credentials', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'validuser1', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.username).toBe('validuser1');
  });

  test('register with duplicate username', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'dupuser', password: 'password123' });

    const res = await request(app)
      .post('/api/register')
      .send({ username: 'dupuser', password: 'password456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  test('register with short username', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'ab', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('register with short password', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'validuser', password: 'pass123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test('register with missing username', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  test('register with missing password', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'testuser' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/login', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'loginuser', password: 'password123' });
    if (res.status !== 201) {
      console.error('Failed to register user for login tests:', res.body);
    }
  });

  test('login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'loginuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.username).toBe('loginuser');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('login with wrong password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'loginuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  test('login with non-existent user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'nouser', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('login with short password fails validation', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'loginuser', password: 'short' });

    expect(res.status).toBe(400);
  });

  test('login with missing credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'loginuser' });

    expect(res.status).toBe(400);
  });
});
