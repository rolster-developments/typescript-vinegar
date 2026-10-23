import {
  modelIsEditable,
  modelIsHideable,
  modelToLiteralObject,
  verifyChangesInModel
} from './helpers';
import { AbstractModel, EditableModel, HideableModel } from './types';

interface ProductModel extends AbstractModel {
  name: string;
  price: number;
}

function createProduct(): ProductModel {
  return { id: 1, name: 'Vinegar', price: 1500 };
}

describe('Helpers - Model type guards', () => {
  it('should recognize an editable model by its updatedAt key', () => {
    const editable: EditableModel = { id: 1, updatedAt: new Date() };

    expect(modelIsEditable(editable)).toBe(true);
    expect(modelIsEditable({ id: 1, updatedAt: undefined })).toBe(true);
    expect(modelIsEditable(createProduct())).toBe(false);
  });

  it('should recognize a hideable model only when both keys are present', () => {
    const hideable: HideableModel = { hidden: false, id: 1 };

    expect(modelIsHideable({ ...hideable, hiddenAt: undefined })).toBe(true);
    expect(modelIsHideable(hideable)).toBe(false);
    expect(modelIsHideable({ hiddenAt: new Date(), id: 1 })).toBe(false);
    expect(modelIsHideable(createProduct())).toBe(false);
  });

  it('should discard values that are not objects', () => {
    expect(modelIsEditable('updatedAt')).toBe(false);
    expect(modelIsEditable(13)).toBe(false);
    expect(modelIsHideable('hidden')).toBe(false);
    expect(modelIsHideable(13)).toBe(false);
  });
});

describe('Helpers - modelToLiteralObject', () => {
  it('should copy every own property of the model', () => {
    const product = createProduct();

    expect(modelToLiteralObject(product)).toEqual({
      id: 1,
      name: 'Vinegar',
      price: 1500
    });
  });

  it('should return a snapshot detached from the model', () => {
    const product = createProduct();
    const snapshot = modelToLiteralObject(product);

    product.price = 2000;

    expect(snapshot.price).toBe(1500);
  });
});

describe('Helpers - verifyChangesInModel', () => {
  it('should return undefined when nothing changed', () => {
    const product = createProduct();
    const initialStatus = modelToLiteralObject(product);

    expect(verifyChangesInModel(product, initialStatus)).toBeUndefined();
  });

  it('should return only the properties that changed', () => {
    const product = createProduct();
    const initialStatus = modelToLiteralObject(product);

    product.price = 2000;

    expect(verifyChangesInModel(product, initialStatus)).toEqual({
      price: 2000
    });
  });

  it('should collect every changed property', () => {
    const product = createProduct();
    const initialStatus = modelToLiteralObject(product);

    product.name = 'Rolster';
    product.price = 2000;

    expect(verifyChangesInModel(product, initialStatus)).toEqual({
      name: 'Rolster',
      price: 2000
    });
  });

  it('should stamp updatedAt when an editable model changed', () => {
    const product: ProductModel & EditableModel = {
      ...createProduct(),
      updatedAt: undefined
    };

    const initialStatus = modelToLiteralObject(product);

    product.price = 2000;

    const changes = verifyChangesInModel(product, initialStatus);

    expect(changes?.price).toBe(2000);
    expect(changes?.updatedAt).toBeInstanceOf(Date);
  });

  it('should not stamp updatedAt when the model is not editable', () => {
    const product = createProduct();
    const initialStatus = modelToLiteralObject(product);

    product.price = 2000;

    expect(verifyChangesInModel(product, initialStatus)).not.toHaveProperty(
      'updatedAt'
    );
  });

  it('should ignore an editable model without changes', () => {
    const product: ProductModel & EditableModel = {
      ...createProduct(),
      updatedAt: undefined
    };

    const initialStatus = modelToLiteralObject(product);

    expect(verifyChangesInModel(product, initialStatus)).toBeUndefined();
    expect(product.updatedAt).toBeUndefined();
  });
});
