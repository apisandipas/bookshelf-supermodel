const Joi = require('@hapi/joi');
const db = require('./db');
const bookshelf = require('bookshelf')(db);
const SuperModel = require('../index')(bookshelf);
const debug = require('debug')('supermodel');

describe('SuperModel Secure Password functionality', () => {
  beforeAll(() => {
    return db.migrate.latest();
  });

  afterAll(() => {
    return db.destroy();
  });

  let BasicModel;
  let CustomModel;
  let RoundsModel;
  let model;

  beforeEach(() => {
    BasicModel = SuperModel.extend({
      tableName: 'secured_password_table',
      hasSecurePassword: true
    });

    CustomModel = SuperModel.extend({
      tableName: 'secured_password_table',
      hasSecurePassword: 'customColumn'
    });

    RoundsModel = SuperModel.extend({
      tableName: 'secured_password_table',
      hasSecurePassword: true,
      bcryptRounds: 5
    });
  });

  describe('with the default column', () => {
    beforeEach(function() {
      model = new BasicModel({ id: 1, password: 'testing' });
    });

    describe('before save', function() {
      it('does not keep the raw password on the model', function() {
        expect(model.get('password')).toBe(undefined);
        expect(model.attributes.password).toBe(undefined);

        expect(model.get('passwordDigest')).toBe(undefined);
        expect(model.attributes.passwordDigest).toBe(undefined);
      });
    });

    describe('after save', function() {
      beforeEach(function() {
        return model.save({}, { method: 'insert' });
      });

      afterEach(function() {
        return model.destroy();
      });

      it('sets the password digest field to null if given a `null` value', async () => {
        expect(model.get('passwordDigest')).toBeTruthy();
        await model.save({ password: null });
        expect(model.get('passwordDigest')).toBeNull();
      });

      it('does not change the password digest if given undefined', async function() {
        const originalString = model.get('passwordDigest');
        model.set('password', undefined);

        await model.save();
        expect(model.get('passwordDigest')).toEqual(originalString);
      });

      it('does not change the password digest if given an empty string', async function() {
        const originalString = model.get('passwordDigest');
        model.set('password', '');

        await model.save();
        expect(model.get('passwordDigest')).toEqual(originalString);
      });

      it('changes the password digest if given a blank (spaces-only) string', async function() {
        const originalString = model.get('passwordDigest');
        model.set('password', '  ');
        await model.save();
        expect(model.get('passwordDigest')).toBeType('string');
        expect(model.get('passwordDigest')).not.toEqual(originalString);
      });
    });

    it('handles the case if a later validation throws an exception', function() {
      let digest;

      model.on('saving', function(model) {
        throw new Error();
      });

      return model
        .save()
        .then(
          () => {
            expect(false).toBeTruthy();
          },
          () => {
            expect(model.get('password')).toBeUndefined();
            expect(model.get('passwordDigest')).toBeType('string');
            digest = model.get('passwordDigest');
            return model.save();
          }
        )
        .then(
          () => {
            expect(false).toBeTruthy();
          },
          () => {
            expect(model.get('passwordDigest')).toEqual(digest);
          }
        );
    });
  });

  describe('with a custom column', () => {
    beforeEach(function() {
      model = new CustomModel({ id: 2, password: 'testing' });
      return model.save({}, { require: false, insert: true });
    });

    it('allows the default column to be overwritten', () => {
      expect(model.get('password')).toBeUndefined();
      expect(model.attributes.password).toBeUndefined();

      expect(model.get('customColumn')).toBeType('string');
      expect(model.attributes.customColumn).toBeType('string');
    });
  });

  describe('with a bcrypt rounds', function() {
    describe('custom number of rounds', function() {
      it('uses custom bcrypt rounds', async () => {
        model = new RoundsModel({ password: 'testing' });
        await model.save({}, { require: false, insert: true });
        expect(model.get('passwordDigest').substr(4, 2)).toEqual('05');
      });
    });

    describe('default number of rounds', function() {
      it('uses default bcrypt rounds', async () => {
        model = new BasicModel({ id: 4, password: 'testing' });
        await model.save({}, { require: false, insert: true });
        expect(model.get('passwordDigest').substr(4, 2)).toEqual('12');
      });
    });
  });
});
