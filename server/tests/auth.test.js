/**
 * tests/auth.test.js
 * -----------------------------------------------------------------------------
 * Authentication REST flow: register, login, protected profile, and the failure
 * cases (duplicate email, bad credentials, missing/invalid token).
 */

const { setupTestDB } = require('./helpers/db');
const { app, request, registerUser, authHeader } = require('./helpers/utils');

setupTestDB();

describe('POST /api/auth/register', () => {
  test('creates an account and returns a token, never the password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Grace', email: 'Grace@Example.com', password: 'hopper42' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('grace@example.com'); // lowercased
    expect(res.body.user.password).toBeUndefined();
  });

  test('rejects a duplicate email with 409', async () => {
    await registerUser('dup@example.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'x', email: 'dup@example.com', password: 'password1' });
    expect(res.status).toBe(409);
  });

  test('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('returns a token for valid credentials', async () => {
    await registerUser('login@example.com', 'secret123');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('returns a generic 401 for a wrong password (no account enumeration)', async () => {
    await registerUser('login2@example.com', 'secret123');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login2@example.com', password: 'WRONG' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  test('returns the SAME generic 401 for an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });
});

describe('GET /api/auth/profile (protected)', () => {
  test('returns the user with a valid token', async () => {
    const { token } = await registerUser('me@example.com');
    const res = await request(app).get('/api/auth/profile').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  test('401 without a token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  test('401 with a malformed token', async () => {
    const res = await request(app).get('/api/auth/profile').set({ Authorization: 'Bearer not.a.jwt' });
    expect(res.status).toBe(401);
  });
});
