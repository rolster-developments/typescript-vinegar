import { AbstractModel, EditableModel } from './types';
import { RefreshModel } from './values';

interface ProductModel extends AbstractModel {
  name: string;
  price: number;
}

function createProduct(): ProductModel {
  return { id: 1, name: 'Vinegar', price: 1500 };
}

describe('RefreshModel', () => {
  it('should expose the model it was built with', () => {
    const product = createProduct();

    expect(new RefreshModel(product).model).toBe(product);
  });

  it('should return undefined while the model stays untouched', () => {
    expect(new RefreshModel(createProduct()).getChanges()).toBeUndefined();
  });

  it('should detect the changes made after its creation', () => {
    const product = createProduct();
    const refresh = new RefreshModel(product);

    product.price = 2000;

    expect(refresh.getChanges()).toEqual({ price: 2000 });
  });

  it('should ignore changes made before its creation', () => {
    const product = createProduct();

    product.price = 2000;

    expect(new RefreshModel(product).getChanges()).toBeUndefined();
  });

  it('should report the changes accumulated between calls', () => {
    const product = createProduct();
    const refresh = new RefreshModel(product);

    product.name = 'Rolster';

    expect(refresh.getChanges()).toEqual({ name: 'Rolster' });

    product.price = 2000;

    expect(refresh.getChanges()).toEqual({ name: 'Rolster', price: 2000 });
  });

  it('should stamp updatedAt when the model is editable', () => {
    const product: ProductModel & EditableModel = {
      ...createProduct(),
      updatedAt: undefined
    };

    const refresh = new RefreshModel(product);

    product.price = 2000;

    expect(refresh.getChanges()?.updatedAt).toBeInstanceOf(Date);
  });
});
