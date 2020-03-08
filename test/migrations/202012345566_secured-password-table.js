'use strict';

exports.up = knex =>
  knex.schema.createTable('secured_password_table', table => {
    table.increments('id');
    table.string('password_digest').nullable();
    table.string('custom_column').nullable();
    table.timestamps();
  });

exports.down = knex => knex.schema.dropTable('secured_password_table');
