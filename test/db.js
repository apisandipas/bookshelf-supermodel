const path = require('path');
const knexFile = require(path.resolve(__dirname, 'knexfile.js'));
const knex = require('knex')(knexFile['development']);

module.exports = knex;
