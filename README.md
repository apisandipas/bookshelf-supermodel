# Bookshelf Supermodel [![Build Status](https://travis-ci.org/apisandipas/bookshelf-supermodel.svg?branch=master)](https://travis-ci.org/apisandipas/bookshelf-supermodel)

## @apiasandipas/supermodel

A [Bookshelf.js](https://github.com/tgriesser/bookshelf) base model class with super powers.

I just found myself using several plugins and would find cases where they sometimes didnt play nicely. This is an effort to bring those plugins together to a single home that I can reuse.

#### Installation

`yarn add @apisandipas/supermodel`

or

`npm install @apisandipas/supermodel`

### Features

- Convenience CRUD methods: `findAll`, `findById`, `findOne`, `create`, `create`, `update`, `destroy`, `findOrCreate`, `upsert`
- Opt-in secured password behavior with bcrypt password hashing and `authenticate` convenience method
- Consumable as an extensible base class or as a Bookshelf plugin

### Roadmap

- [] Convert to Typescript?
- [] Rollup build?

### API

- todo: document api here...

### Inspiration

- [bookshelf-modelbase](https://github.com/bsiddiqui/bookshelf-modelbase).
- [bookshelf-secure-password](https://www.npmjs.com/package/bookshelf-secure-password)
- [bookshelf-camelcase](https://www.npmjs.com/package/bookshelf-camelcase)
