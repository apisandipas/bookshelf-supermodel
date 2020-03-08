'use strict';

exports.up = knex =>
  knex.schema.createTable('crud_table', table => {
    table.increments('id');
    table.string('first_name').notNullable();
    table.string('last_name');
    table.timestamps();
  });

exports.down = knex => knex.schema.dropTable('crud_table');
