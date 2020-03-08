const Joi = require('@hapi/joi');
const db = require('./db');
const bookshelf = require('bookshelf')(db);
const SuperModel = require('../index')(bookshelf);
const PasswordMismatchError = require('../src/PasswordMismatchError');
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
    beforeEach(() => {
      model = new BasicModel({ id: 1, password: 'testing' });
    });

    describe('before save', () => {
      it('does not keep the raw password on the model', () => {
        expect(model.get('password')).toBe(undefined);
        expect(model.attributes.password).toBe(undefined);

        expect(model.get('passwordDigest')).toBe(undefined);
        expect(model.attributes.passwordDigest).toBe(undefined);
      });
    });

    describe('after save', () => {
      beforeEach(() => {
        return model.save({}, { method: 'insert' });
      });

      afterEach(() => {
        return model.destroy();
      });

      it('sets the password digest field to null if given a `null` value', async () => {
        expect(model.get('passwordDigest')).toBeTruthy();
        await model.save({ password: null });
        expect(model.get('passwordDigest')).toBeNull();
      });

      it('does not change the password digest if given undefined', async () => {
        const originalString = model.get('passwordDigest');
        model.set('password', undefined);

        await model.save();
        expect(model.get('passwordDigest')).toEqual(originalString);
      });

      it('does not change the password digest if given an empty string', async () => {
        const originalString = model.get('passwordDigest');
        model.set('password', '');

        await model.save();
        expect(model.get('passwordDigest')).toEqual(originalString);
      });

      it('changes the password digest if given a blank (spaces-only) string', async () => {
        const originalString = model.get('passwordDigest');
        model.set('password', '  ');
        await model.save();
        expect(model.get('passwordDigest')).toBeType('string');
        expect(model.get('passwordDigest')).not.toEqual(originalString);
      });
    });

    it('handles the case if a later validation throws an exception', () => {
      let digest;

      model.on('saving', model => {
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
    beforeEach(() => {
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

  describe('with a bcrypt rounds', () => {
    describe('custom number of rounds', () => {
      it('uses custom bcrypt rounds', async () => {
        model = new RoundsModel({ password: 'testing' });
        await model.save({}, { require: false, insert: true });
        expect(model.get('passwordDigest').substr(4, 2)).toEqual('05');
      });
    });

    describe('default number of rounds', () => {
      it('uses default bcrypt rounds', async () => {
        model = new BasicModel({ id: 4, password: 'testing' });
        await model.save({}, { require: false, insert: true });
        expect(model.get('passwordDigest').substr(4, 2)).toEqual('12');
      });
    });
  });

  describe('#authenticate', () => {
    describe('with hasSecurePassword enabled on the model', () => {
      beforeEach(() => {
        model = new BasicModel({ id: 1, password: 'testing' });
      });
      describe('before save', () => {
        it('does not authenticate until the record is saved', async () => {
          try {
            await model.authenticate('testing');
            expect(false).toBeTruthy();
          } catch (err) {
            expect(err).not.toBeUndefined();
            expect(err).toBeInstanceOf(PasswordMismatchError);
            expect(err.name).toEqual('PasswordMismatchError');
          }
        });
      });
      describe('after save', () => {
        beforeEach(() => {
          return model.save({}, { require: false, insert: true });
        });
        it('resolves the Model if the password matches', () => {
          return model.authenticate('testing').then(
            model => {
              expect(model).not.toBeUndefined();
            },
            err => {
              expect(err).toBeUndefined();
            }
          );
        });
        it('rejects with a PasswordMismatchError if the password does not match', () => {
          return model.authenticate('invalid').then(
            model => {
              expect(false).toBeTruthy();
            },
            err => {
              expect(err).not.toBeUndefined();
              expect(err).toBeInstanceOf(PasswordMismatchError);
              expect(err.name).toEqual('PasswordMismatchError');
            }
          );
        });
        it('rejects with a PasswordMismatchError if the no password is provided', async () => {
          try {
            await model.authenticate();
            expect(model).toBeUndefined();
          } catch (err) {
            expect(err).not.toBeUndefined();
            expect(err).toBeInstanceOf(PasswordMismatchError);
            expect(err.name).toEqual('PasswordMismatchError');
          }
        });
      });
    });
    describe('without hasSecurePassword on this model', () => {
      it('calls the model`s `authenticate` method', () => {
        const Model = bookshelf.Model.extend({});
        model = new Model({ id: 1, password: 'testing' });
        try {
          return model.authenticate('testing');
        } catch (err) {
          expect(err).not.toBeUndefined;
          expect(err).toBeInstanceOf(TypeError);
        }
      });
    });
  });
});
