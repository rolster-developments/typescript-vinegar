import { AbstractEntityDataSource } from './datasource';
import {
  Entity,
  EntityPersist,
  EntityPersistList,
  EntityRefresh,
  EntitySync
} from './entity';
import { EntityManager } from './entity-manager';
import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import { AbstractModel, HideableModel, QueryEntityManager } from './types';
import { RefreshModel } from './values';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

interface ProductModel extends AbstractModel {
  name: string;
  price: number;
}

class ProductEntity extends Entity {
  constructor(
    uuid: string,
    public price = 1500
  ) {
    super(uuid);
  }
}

class ProductPersist extends EntityPersist<ProductEntity, ProductModel> {
  public create(): ProductModel {
    return { id: 1, name: 'Vinegar', price: this.entity.price };
  }
}

class ProductPersistList extends EntityPersistList<ProductEntity> {
  public create(): ProductModel[] {
    return [
      { id: 1, name: 'Vinegar', price: 1500 },
      { id: 2, name: 'Rolster', price: 2000 }
    ];
  }
}

class ProductSync extends EntitySync<ProductEntity, ProductModel> {
  public sync(): void {
    this.model.price = this.entity.price;
  }
}

class ProductRefresh extends EntityRefresh<ProductEntity, ProductModel> {
  public dispatch(): RefreshModel[] {
    this.model.price = this.entity.price;

    return [new RefreshModel(this.model)];
  }
}

class ProductProcedure extends AbstractProcedure {
  public async execute(): Promise<void> {}
}

class FakeDataSource extends AbstractEntityDataSource {
  public insert = vi.fn(async (model: AbstractModel) =>
    result('insert', model)
  );

  public update = vi.fn(async (model: AbstractModel, _changes: LiteralObject) =>
    result('update', model)
  );

  public refresh = vi.fn(async (_models: RefreshModel[]) => result('refresh'));

  public delete = vi.fn(async (model: AbstractModel) =>
    result('delete', model)
  );

  public hidden = vi.fn(async (model: HideableModel) =>
    result('hidden', model)
  );

  public procedure = vi.fn(
    async (_manager: QueryEntityManager, _procedure: AbstractProcedure) =>
      result('procedure')
  );
}

function result(
  code: PersistentUnitResult['code'],
  model?: AbstractModel
): PersistentUnitResult {
  return new PersistentUnitResult(code, undefined, model);
}

function createProduct(): ProductModel {
  return { id: 1, name: 'Vinegar', price: 1500 };
}

function createManager(): [EntityManager, FakeDataSource] {
  const dataSource = new FakeDataSource();

  return [new EntityManager(dataSource), dataSource];
}

describe('EntityManager - Relations', () => {
  it('should generate a uuid for every manager', () => {
    const [first] = createManager();
    const [second] = createManager();

    expect(first.uuid).toHaveLength(36);
    expect(first.uuid).not.toBe(second.uuid);
  });

  it('should fail the selection of an unrelated entity', () => {
    const [manager] = createManager();

    expect(manager.select(new ProductEntity(UUID)).isSuccess).toBe(false);
  });

  it('should select the model related to an entity', () => {
    const [manager] = createManager();
    const entity = new ProductEntity(UUID);
    const product = createProduct();

    manager.relation(entity, product);

    const selection = manager.select<ProductModel>(entity);

    expect(selection.isSuccess).toBe(true);
    expect(selection.value).toBe(product);
  });

  it('should link an entity and give it back', () => {
    const [manager] = createManager();
    const entity = new ProductEntity(UUID);

    expect(manager.link(entity, createProduct())).toBe(entity);
    expect(manager.select(entity).isSuccess).toBe(true);
  });
});

describe('EntityManager - Persist', () => {
  it('should insert the model created by the persist', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID, 2000);

    manager.persist(new ProductPersist(entity));

    const results = await manager.flush();

    expect(dataSource.insert).toHaveBeenCalledTimes(1);
    expect(dataSource.insert.mock.calls[0][0]).toEqual({
      id: 1,
      name: 'Vinegar',
      price: 2000
    });
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe('insert');
  });

  it('should insert every model created by a persist list', async () => {
    const [manager, dataSource] = createManager();

    manager.persists(new ProductPersistList(new ProductEntity(UUID)));

    const results = await manager.flush();

    expect(dataSource.insert).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });
});

describe('EntityManager - Sync', () => {
  it('should update the model only when it got dirty', async () => {
    const [manager, dataSource] = createManager();
    const product = createProduct();

    manager.sync(new ProductSync(new ProductEntity(UUID, 2000), product));

    await manager.flush();

    expect(dataSource.update).toHaveBeenCalledTimes(1);
    expect(dataSource.update.mock.calls[0][1]).toEqual({ price: 2000 });
    expect(product.price).toBe(2000);
  });

  it('should skip the update when the sync changed nothing', async () => {
    const [manager, dataSource] = createManager();

    manager.sync(
      new ProductSync(new ProductEntity(UUID, 1500), createProduct())
    );

    const results = await manager.flush();

    expect(dataSource.update).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('should relate the entity of a relationable sync', async () => {
    const [manager] = createManager();
    const entity = new ProductEntity(UUID);

    manager.sync(new ProductSync(entity, createProduct()));

    expect(manager.select(entity).isSuccess).toBe(true);
  });

  it('should not relate the entity of a non relationable sync', () => {
    const [manager] = createManager();
    const entity = new ProductEntity(UUID);

    manager.sync(new ProductSync(entity, createProduct(), false));

    expect(manager.select(entity).isSuccess).toBe(false);
  });

  it('should discard the sync of a model that will be deleted', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID, 2000);
    const product = createProduct();

    manager.sync(new ProductSync(entity, product));
    manager.destroy(entity);

    await manager.flush();

    expect(dataSource.update).not.toHaveBeenCalled();
    expect(dataSource.delete).toHaveBeenCalledTimes(1);
  });
});

describe('EntityManager - Refresh', () => {
  it('should send the dispatched models to the datasource', async () => {
    const [manager, dataSource] = createManager();
    const product = createProduct();

    manager.refresh(new ProductRefresh(new ProductEntity(UUID, 2000), product));

    const results = await manager.flush();

    expect(dataSource.refresh).toHaveBeenCalledTimes(1);
    expect(dataSource.refresh.mock.calls[0][0]).toHaveLength(1);
    expect(results[0].code).toBe('refresh');
  });

  it('should discard the refresh of a model that will be deleted', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID, 2000);
    const product = createProduct();

    manager.refresh(new ProductRefresh(entity, product));
    manager.destroy(entity);

    await manager.flush();

    expect(dataSource.refresh.mock.calls[0][0]).toHaveLength(0);
  });
});

describe('EntityManager - Destroy', () => {
  it('should delete a model that cannot be hidden', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID);

    manager.relation(entity, createProduct());
    manager.destroy(entity);

    const results = await manager.flush();

    expect(dataSource.delete).toHaveBeenCalledTimes(1);
    expect(dataSource.hidden).not.toHaveBeenCalled();
    expect(results[0].code).toBe('delete');
  });

  it('should hide a model that is hideable', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID);

    manager.relation(entity, {
      hidden: false,
      hiddenAt: undefined,
      id: 1
    } as HideableModel);

    manager.destroy(entity);

    const results = await manager.flush();

    expect(dataSource.hidden).toHaveBeenCalledTimes(1);
    expect(dataSource.delete).not.toHaveBeenCalled();
    expect(results[0].code).toBe('hidden');
  });

  it('should ignore the destruction of an unrelated entity', async () => {
    const [manager, dataSource] = createManager();

    manager.destroy(new ProductEntity(UUID));

    const results = await manager.flush();

    expect(dataSource.delete).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });
});

describe('EntityManager - Procedure', () => {
  it('should hand the procedure over to the datasource', async () => {
    const [manager, dataSource] = createManager();
    const procedure = new ProductProcedure();

    manager.procedure(procedure);

    const results = await manager.flush();

    expect(dataSource.procedure).toHaveBeenCalledWith(manager, procedure);
    expect(results[0].code).toBe('procedure');
  });
});

describe('EntityManager - Flush', () => {
  it('should return the results in operation order', async () => {
    const [manager] = createManager();
    const entity = new ProductEntity(UUID);

    manager.persist(new ProductPersist(new ProductEntity(UUID)));
    manager.procedure(new ProductProcedure());
    manager.relation(entity, createProduct());
    manager.destroy(entity);

    const results = await manager.flush();

    expect(results.map(({ code }) => code)).toEqual([
      'insert',
      'procedure',
      'delete'
    ]);
  });

  it('should dispose its state after flushing', async () => {
    const [manager, dataSource] = createManager();
    const entity = new ProductEntity(UUID);

    manager.persist(new ProductPersist(entity));

    await manager.flush();

    expect(await manager.flush()).toHaveLength(0);
    expect(dataSource.insert).toHaveBeenCalledTimes(1);
    expect(manager.select(entity).isSuccess).toBe(false);
  });

  it('should drop every pending operation on dispose', async () => {
    const [manager, dataSource] = createManager();

    manager.persist(new ProductPersist(new ProductEntity(UUID)));
    manager.procedure(new ProductProcedure());
    manager.dispose();

    expect(await manager.flush()).toHaveLength(0);
    expect(dataSource.insert).not.toHaveBeenCalled();
    expect(dataSource.procedure).not.toHaveBeenCalled();
  });
});
