/**
 * app.js
 * -----------------------------------------------------------------------------
 * Builds and configures the Express application (NO network listening here).
 *
 * WHY IT EXISTS
 *   Separating "build the app" from "start the server" is a deliberate, testable
 *   pattern: tests import this `app` and drive it with supertest in-memory, while
 *   production wraps it in an HTTP server (server.js, Module 7) that also hosts
 *   Socket.IO. One app definition, two entry points.
 *
 * WHAT IT WIRES UP
 *   - CORS (allow-listed origins from config)
 *   - JSON body parsing
 *   - HTTP request logging (pino-http, sharing our logger)
 *   - The /api router (auth now; documents next module)
 *   - 404 + central error handler (always LAST)
 *
 * HOW IT CONNECTS
 *   Imported by tests and by server.js. The error handler funnels every thrown
 *   ApiError into a consistent JSON response.
 */

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const config = require('./config/env');
const logger = require('./config/logger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust the reverse proxy (so secure cookies / req.ip work behind nginx/Docker).
app.set('trust proxy', 1);

app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// Log every HTTP request with the shared logger (silent in test).
app.use(pinoHttp({ logger }));

// Feature routes.
app.use('/api', routes);

// Unmatched route -> 404 -> error handler.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
