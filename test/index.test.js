const Joi = require('@hapi/joi');
const db = require('./db');
const bookshelf = require('bookshelf')(db);
const SuperModel = require('../index')(bookshelf);

describe('SuperModel', () => {
  let specimen;
  let SpecimenClass;

  describe('CRUD functionality', () => {
    beforeAll(() => {
      return db.migrate.latest();
    });

    beforeEach(() => {
      SpecimenClass = SuperModel.extend({
        tableName: 'test_table',
        validate: {
          firstName: Joi.string()
            .valid('hello', 'goodbye', 'yo')
            .required(),
          lastName: Joi.string().allow(null)
        }
      });

      specimen = new SpecimenClass({
        firstName: 'hello'
      });

      return specimen.save();
    });

    afterAll(() => {
      return db.destroy();
    });

    describe('initialize', () => {
      let origModelBase;

      beforeAll(() => {
        origModelBase = bookshelf.Model;
      });

      afterAll(() => {
        bookshelf.Model = origModelBase;
      });

      it('should error if not passed bookshelf object', () => {
        expect(() => {
          require('../src/Supermodel')();
        }).toThrow(/Must pass an initialized bookshelf instance/);
      });

      it('should be separately applyable', function() {
        var Model = require('../src/Supermodel')(bookshelf);
        expect(typeof Model.findOne).toBe('function');
        expect(typeof bookshelf.Model.findOne).toBe('undefined');
      });

      it('should be usable as a bookshelf plugin', function() {
        expect(typeof bookshelf.Model.findOne).toBe('undefined');
        bookshelf.plugin(function() {
          require('../src/Supermodel').pluggable.apply(null, arguments);
        });
        expect(typeof bookshelf.Model.findOne).toBe('function');
      });
    });

    describe('Validate save', () => {
      it('should allow extended Joi object', async () => {
        SpecimenClass = SuperModel.extend({
          tableName: 'test_table',
          validate: Joi.object().keys({
            firstName: Joi.string().valid('hello', 'goodbye'),
            lastName: Joi.string().default('world')
          })
        });

        specimen = new SpecimenClass({
          firstName: 'hello'
        });

        const model = await specimen.save();
        expect(typeof model).toBeTruthy();
        expect(model.get('lastName')).toBe('world');
      });

      it('should validate own attributes', () => {
        return expect(specimen.validateSave().firstName).toBe('hello');
      });

      it('should error on invalid attributes', () => {
        var error;

        specimen.set('firstName', 1);
        try {
          specimen.validateSave();
        } catch (err) {
          error = err;
        }

        expect(error.tableName).toBe('test_table');
      });

      it('should work with updates method specified', async () => {
        // WHY DOESNT THIS WORK WITH CAMELCASE KEYS????
        const model = await SpecimenClass.where({ first_name: 'hello' }).save(
          { lastName: 'world' },
          { patch: true, method: 'update', require: false }
        );
        expect(model.get('lastName')).toBe('world');
      });

      it('should work with model id specified', async () => {
        const model = await SpecimenClass.forge({ id: 1 }).save(
          { lastName: 'world' },
          { patch: true, require: false }
        );

        expect(model.get('lastName')).toBe('world');
      });

      it('should not validate when  Model.validate is not present', async () => {
        const Model = SuperModel.extend({ tableName: 'test_table' });
        const model = await Model.forge({ id: 1 }).save(
          'firstName',
          'notYoName'
        );

        expect(model.get('firstName')).toBe('notYoName');
      });
    });

    describe('constructor', () => {
      it('should itself be extensible', () => {
        expect(SuperModel.extend({ testKey: 'test' })).toHaveProperty('extend');
      });
    });

    describe('findAll', () => {
      it('should return a collection', async () => {
        const collection = await SpecimenClass.findAll();
        expect(collection).toBeInstanceOf(bookshelf.Collection);
      });
    });

    describe('findById', () => {
      it("should find a model by it's id", async () => {
        let created = await SpecimenClass.create({ firstName: 'yo' });
        let model = await SpecimenClass.findById(created.id);
        expect(model.id).toEqual(created.id);
      });
    });

    describe('findOne', () => {
      it('should return a model', async () => {
        const model = await SpecimenClass.findOne();
        expect(model).toBeInstanceOf(SpecimenClass);
      });
    });

    describe('create', () => {
      it('should return a model', async () => {
        const model = await SpecimenClass.create({
          firstName: 'hello'
        });
        expect(model.id).not.toEqual(specimen.id);
      });
    });

    describe('update', () => {
      it('should return a model', async () => {
        expect(specimen.get('first_name')).not.toEqual('goodbye');
        const model = await SpecimenClass.update(
          {
            firstName: 'goodbye'
          },
          {
            id: specimen.get('id')
          }
        );
        expect(model.get('id')).toEqual(specimen.get('id'));
        expect(model.get('firstName')).toEqual('goodbye');
      });

      it('should return if require:false and not found', async () => {
        const model = await SpecimenClass.update(
          {
            first_name: 'goodbye'
          },
          {
            id: -1,
            require: false
          }
        );

        expect(model).toEqual(undefined);
      });
    });

    describe('destroy', () => {
      it('should destroy the model', async () => {
        const model = await SpecimenClass.forge({ firstName: 'hello' })
          .save()
          .bind({});
        await SpecimenClass.destroy({ id: model.id });

        try {
          await SpecimenClass.findOne({ id: model.id });
        } catch (err) {
          expect(err.message).toEqual('EmptyResponse');
        }
      });
    });

    describe('findOrCreate', () => {
      it('should find an existing model', async () => {
        const model = await SpecimenClass.findOrCreate({ id: specimen.id });
        expect(model.get('firstName')).toEqual('hello');
      });

      it('should find with options', async () => {
        const model = await SpecimenClass.findOrCreate(
          { id: specimen.id },
          { columns: 'id' }
        );

        expect(model.id).toEqual(specimen.id);
        expect(model.get('firstName')).toEqual(undefined);
      });

      it('should not apply defaults when model found', async () => {
        const model = await SpecimenClass.findOrCreate(
          { id: specimen.id },
          { defaults: { lastName: 'world' } }
        );
        expect(model.get('id')).toEqual(specimen.id);
        expect(model.get('firstName')).toEqual('hello');
        expect(model.get('lastName')).toBe(null);
      });

      it('should create when model not found', async () => {
        const model = await SpecimenClass.findOrCreate({
          firstName: 'hello',
          lastName: '' + new Date()
        });

        expect(model.id).not.toEqual(specimen.id);
      });

      it('should apply defaults if creating', async () => {
        var date = '' + new Date();

        const model = await SpecimenClass.findOrCreate(
          {
            lastName: date
          },
          {
            defaults: { firstName: 'hello' }
          }
        );

        expect(model.id).not.toEqual(specimen.id);
        expect(model.get('firstName')).toEqual('hello');
        expect(model.get('lastName')).toEqual(date);
      });

      it('should work with defaults and options', async () => {
        const model = await SpecimenClass.findOrCreate(
          {
            id: specimen.id
          },
          {
            defaults: { lastName: 'hello' },
            columns: ['id', 'last_name']
            // TODO investigate changing this to use camelCase field names
            // As were specifying actual db column names, we have to use the snake case version. note ideal
          }
        );
        expect(model.get('id')).toEqual(specimen.id);
        expect(model.get('firstName')).toBe(undefined);
        expect(model.get('lastName')).toBe(null);
      });
    });
    describe('upsert', function() {
      it('should update if existing model found', async function() {
        const firstModel = await SpecimenClass.create({
          firstName: 'hello',
          lastName: 'upsert'
        }).bind({});

        const secondModel = await SpecimenClass.upsert(
          {
            lastName: 'upsert'
          },
          {
            lastName: 'success'
          }
        );

        expect(secondModel.get('firstName')).toEqual('hello');
        expect(secondModel.get('lastName')).toEqual('success');
        expect(secondModel.id).toEqual(firstModel.id);
      });

      it('should create if existing model not found', async function() {
        const model = await SpecimenClass.upsert(
          {
            firstName: 'goodbye',
            lastName: 'update'
          },
          {
            lastName: 'updated'
          }
        );

        expect(model.get('firstName')).toEqual('goodbye');
        expect(model.get('lastName')).toEqual('updated');
      });

      it.only('should create even with application assigned id', async function() {
        const model = await SpecimenClass.upsert(
          {
            id: 0,
            firstName: 'goodbye',
            lastName: 'update'
          },
          {
            lastName: 'updated'
          }
        );

        expect(model.id).toEqual(0);
        expect(model.get('firstName')).toEqual('goodbye');
        expect(model.get('lastName')).toEqual('updated');
      });
    });
  });

  describe('Secure Password functionality', () => {});
});
