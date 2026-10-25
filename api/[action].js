// Compatibility route for Vercel's file-based API paths.
// The actual Free Guide logic stays together in ../free-guide.js,
// which keeps this project safely below Vercel Hobby's function limit.
module.exports = require('../free-guide');
