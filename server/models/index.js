/**
 * models/index.js
 * -----------------------------------------------------------------------------
 * Barrel export for all Mongoose models.
 *
 * WHY IT EXISTS
 *   So the rest of the app imports models from one place
 *   (`const { User, Document } = require('../models')`) instead of reaching into
 *   individual files. Also guarantees every model is registered with Mongoose
 *   before code that `populate()`s across them runs.
 */

module.exports = {
  User: require('./User'),
  Document: require('./Document'),
  Operation: require('./Operation'),
  Presence: require('./Presence'),
};
