import { Entity, EntitySync } from './entity';
import { AbstractModel, EditableModel, QueryEntityManager } from './types';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

interface ProductModel extends AbstractModel {
  name: string;
  price: number;
}

class ProductEntity extends Entity {
  constructor(
    uuid: string,
    public price: number
  ) {
    super(uuid);
  }
}

class ProductSync extends EntitySync<ProductEntity, ProductModel> {
  public sync(): void {
    this.model.price = this.entity.price;
  }
}

function createProduct(): ProductModel {
  return { id: 1, name: 'Vinegar', price: 1500 };
}

const manager = {} as QueryEntityManager;

describe('Entity', () => {
  it('should expose the uuid it was built with', () => {
    expect(new Entity(UUID).uuid).toBe(UUID);
  });
});

describe('EntitySync', () => {
  it('should be relationable by default', () => {
    const entity = new ProductEntity(UUID, 1500);

    expect(new ProductSync(entity, createProduct()).relationable).toBe(true);
    expect(
      new ProductSync(entity, createProduct(), false).relationable
    ).toBe(false);
  });

  it('should return undefined when sync produces no change', () => {
    const sync = new ProductSync(new ProductEntity(UUID, 1500), createProduct());

    expect(sync.verify(manager)).toBeUndefined();
  });

  it('should apply sync over the model and report the change', () => {
    const product = createProduct();
    const sync = new ProductSync(new ProductEntity(UUID, 2000), product);

    expect(sync.verify(manager)).toEqual({ price: 2000 });
    expect(product.price).toBe(2000);
  });

  it('should compare against the status captured on construction', () => {
    const product = createProduct();
    const sync = new ProductSync(new ProductEntity(UUID, 2000), product);

    sync.verify(manager);

    expect(sync.verify(manager)).toEqual({ price: 2000 });
  });

  it('should stamp updatedAt when the model is editable', () => {
    const product: ProductModel & EditableModel = {
      ...createProduct(),
      updatedAt: undefined
    };

    const sync = new ProductSync(new ProductEntity(UUID, 2000), product);

    expect(sync.verify(manager)?.updatedAt).toBeInstanceOf(Date);
  });
});
