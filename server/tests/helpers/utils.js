/**
 * tests/helpers/utils.js
 * -----------------------------------------------------------------------------
 * Small shared helpers for tests: user registration, auth headers, a Socket.IO
 * test server, and promise-ified socket events.
 */

const http = require('http');
const request = require('supertest');
const { io: ClientIO } = require('socket.io-client');

const app = require('../../app');
const { initSocket } = require('../../socket');

/** Register a user through the real HTTP API; returns token + id + user. */
async function registerUser(email, password = 'password1') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: email.split('@')[0], email, password });
  return { token: res.body.token, id: res.body.user._id || res.body.user.id, user: res.body.user };
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

/** Start an HTTP + Socket.IO server on an ephemeral port. */
async function startTestServer(opts = {}) {
  const server = http.createServer(app);
  const io = initSocket(server, opts);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, io, url: `http://localhost:${server.address().port}` };
}

const makeClient = (url, token) => ClientIO(url, { auth: { token }, reconnection: false });

/** Resolve on the next occurrence of `event`. */
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

/** Emit `event` and resolve with the server's ack. */
const emitAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

const closeServer = (server) => new Promise((resolve) => server.close(resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  app,
  request,
  registerUser,
  authHeader,
  startTestServer,
  makeClient,
  once,
  emitAck,
  closeServer,
  sleep,
};
