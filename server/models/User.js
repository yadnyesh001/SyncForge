/**
 * models/User.js
 * -----------------------------------------------------------------------------
 * The account record.
 *
 * WHY IT EXISTS
 *   Collaboration needs identity: who owns a document, who may edit it, whose
 *   cursor is whose. This is the root identity object everything else references.
 *
 * WHAT PROBLEM IT SOLVES
 *   - Stores credentials SAFELY: the password is bcrypt-hashed by a pre-save hook
 *     and excluded from query results by default (`select: false`), so it can
 *     never accidentally be serialized into an API response or a log line.
 *   - Provides `comparePassword()` so the login flow doesn't re-implement hashing.
 *
 * HOW IT WORKS
 *   - `pre('save')` hashes the password ONLY when it changed (so updates that
 *     don't touch the password don't double-hash).
 *   - `toJSON` strips password + __v, giving a clean shape for API responses.
 *
 * HOW IT CONNECTS
 *   Referenced by Document.owner / Document.collaborators, Operation.userId, and
 *   Presence.userId. The auth controller (Module 5) calls comparePassword() and
 *   signs a JWT from the returned _id.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // creates a unique index
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned unless explicitly .select('+password')
    },
  },
  { timestamps: true } // adds createdAt + updatedAt
);

// Hash the password before saving, but only if it actually changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Compare a plaintext candidate against the stored hash.
 * NOTE: requires the document to have been loaded WITH the password field,
 * e.g. `User.findOne({ email }).select('+password')`.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Keep secrets out of any serialized form.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
