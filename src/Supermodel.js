'use strict';
const Joi = require('@hapi/joi');
const bcrypt = require('bcryptjs');
const extend = require('xtend');
const difference = require('lodash.difference');
const snakeCase = require('lodash.snakecase');
const camelCase = require('lodash.camelcase');

const debug = require('debug')('supermodel');

/**
 * Returns a formatted key given a formatter function
 * @param {Function} formatter
 */
const formatKey = formatter => attr =>
  Object.keys(attr).reduce((updated, oldKey) => {
    updated[formatter(oldKey)] = attr[oldKey];
    return updated;
  }, {});

/**
 * Generate the BCrypt hash for a given string.
 *
 * @param {Number} rounds - The number of bcrypt salt rounds
 * @param {String} value - The string to hash
 * @returns {Promise.<String>} - A BCrypt hashed version of the string
 */
const hash = async value => {
  if (value === null) {
    return Promise.resolve(null);
  }

  if (isEmpty(value)) {
    return Promise.resolve(undefined);
  }

  const salt = await bcrypt.genSalt(12);

  return bcrypt.hash(value, salt);
};

/**
 * Enable password hashing on the model when the model is saved.
 *
 * @param {Model} model - The bookshelf model to set up
 * @returns {Model} - The model
 */
const enablePasswordHashing = model => {
  const field = 'passwordDigest';
  const PRIVATE_PASSWORD_FIELD = '__password';

  model.virtuals = model.virtuals || {};
  model.virtuals.password = {
    get: function getPassword() {},
    set: function setPassword(value) {
      this[PRIVATE_PASSWORD_FIELD] = value;
    }
  };

  model.on('saving', async model => {
    let value = model[PRIVATE_PASSWORD_FIELD];

    const hashed = hash(value);

    model.unset('password');

    if (hashed !== undefined) {
      model.set(field, hashed);
    }

    return model;
  });
};

/**
 * Expects a configured Bookshelf instance
 * @param {Bookshelf} bookshelf
 */
const makeSupermodel = bookshelf => {
  if (!bookshelf) {
    throw new Error('Must pass an initialized bookshelf instance');
  }

  /**
   * Enable virtuals plugin
   */
  bookshelf.plugin('bookshelf-virtuals-plugin');
  bookshelf.plugin('bookshelf-case-converter-plugin');

  /**
   * Enable automatic snake_case to camelCase conversion
   */
  // bookshelf.plugin('bookshelf-case-converter-plugin');

  const bookshelfModel = bookshelf.Model;

  const Supermodel = bookshelf.Model.extend(
    {
      constructor: function() {
        bookshelfModel.apply(this, arguments);

        if (this.hasSecurePassword) {
          enablePasswordHashing(this);
        }

        if (this.validate) {
          const baseValidation = {
            // id might be number or string, for optimization
            id: Joi.any().optional(),
            createdAt: Joi.date().optional(),
            updatedAt: Joi.date().optional()
          };

          this.validate = this.validate.isJoi
            ? this.validate.keys(baseValidation)
            : Joi.object(this.validate).keys(baseValidation);

          this.on('saving', this.validateSave);
        }
      },

      /**
       * Model has default timestamps
       */
      hasTimestamps: ['createdAt', 'updatedAt'],

      /**
       * Convert snake_case column names to camelCase field names
       */
      // parse: formatKey(camelCase),

      // /**
      //  * Convert camelCase field names to snake_case column names
      //  */
      // format: formatKey(snakeCase),

      /**
       *  Models by default do not have passwords
       */
      hasSecurePassword: false,

      /**
       *  Model on('saving') callback
       */
      validateSave: function validateSave(model, attrs, options) {
        let validation;
        if (
          (model && !model.isNew()) ||
          (options && (options.method === 'update' || options.patch === true))
        ) {
          const schemaKeys = this.validate._inner.children.map(function(child) {
            return child.key;
          });
          const presentKeys = Object.keys(attrs);
          const optionalKeys = difference(schemaKeys, presentKeys);

          // only validate the keys that are being updated
          validation = Joi.validate(
            attrs,
            optionalKeys.length
              ? // optionalKeys() doesn't like empty arrays
                this.validate.optionalKeys(optionalKeys)
              : this.validate
          );
        } else {
          validation = Joi.validate(this.attributes, this.validate);
        }

        if (validation.error) {
          validation.error.tableName = this.tableName;

          throw validation.error;
        } else {
          this.set(validation.value);
          return validation.value;
        }
      }
    },
    {
      /**
       * Select a collection based on a query
       * @param {Object} [query]
       * @param {Object} [options] Options used of model.fetchAll
       * @return {Promise(bookshelf.Collection)} Bookshelf Collection of Models
       */
      findAll: function(filter, options) {
        return this.forge()
          .where(extend({}, filter))
          .fetchAll(options);
      },

      /**
       * Find a model based on it's ID
       * @param {String} id The model's ID
       * @param {Object} [options] Options used of model.fetch
       * @return {Promise(bookshelf.Model)}
       */
      findById: function(id, options) {
        return this.findOne({ [this.prototype.idAttribute]: id }, options);
      },

      /**
       * Select a model based on a query
       * @param {Object} [query]
       * @param {Object} [options] Options for model.fetch
       * @param {Boolean} [options.require=false]
       * @return {Promise(bookshelf.Model)}
       */
      findOne: function(query, options) {
        return this.forge(query).fetch(options);
      },

      /** s
       * Insert a model based on data
       * @param {Object} data
       * @param {Object} [options] Options for model.save
       * @return {Promise(bookshelf.Model)}
       */
      create: function(data, options) {
        return this.forge(data).save(null, options);
      },

      /**
       * Update a model based on data
       * @param {Object} data
       * @param {Object} options Options for model.fetch and model.save
       * @param {String|Integer} options.id The id of the model to update
       * @param {Boolean} [options.patch=true]
       * @param {Boolean} [options.require=true]
       * @return {Promise(bookshelf.Model)}
       */
      update: function(data, options) {
        options = extend({ patch: true, require: true }, options);
        return this.forge({ [this.prototype.idAttribute]: options.id })
          .fetch(options)
          .then(model => (model ? model.save(data, options) : undefined));
      },

      /**
       * Destroy a model by id
       * @param {Object} options
       * @param {String|Integer} options.id The id of the model to destroy
       * @param {Boolean} [options.require=false]
       * @return {Promise(bookshelf.Model)} empty model
       */
      destroy: function(options) {
        options = extend({ require: true }, options);
        return this.forge({ [this.prototype.idAttribute]: options.id }).destroy(
          options
        );
      },

      /**
       * Select a model based on data and insert if not found
       * @param {Object} data
       * @param {Object} [options] Options for model.fetch and model.save
       * @param {Object} [options.defaults] Defaults to apply to a create
       * @return {Promise(bookshelf.Model)} single Model
       */
      findOrCreate: function(data, options) {
        options = extend({ require: false }, options);
        return this.findOne(data, options)
          .bind(this)
          .then(model => {
            var defaults = options && options.defaults;
            return model || this.create(extend(defaults, data), options);
          });
      },

      /**
       * Select a model based on data and update if found, insert if not found
       * @param {Object} selectData Data for select
       * @param {Object} updateData Data for update
       * @param {Object} [options] Options for model.save
       */
      upsert: function(selectData, updateData, options) {
        options = extend({ require: false }, options);
        return this.findOne(selectData, options)
          .bind(this)
          .then(model => {
            return model
              ? model.save(
                  updateData,
                  extend({ patch: true, method: 'update' }, options)
                )
              : this.create(
                  extend(selectData, updateData),
                  extend(options, { method: 'insert' })
                );
          });
      }
    }
  );

  return Supermodel;
};

module.exports = makeSupermodel;

module.exports.pluggable = function(bookshelf, params) {
  bookshelf.Model = module.exports.apply(null, arguments);
};
