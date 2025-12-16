import { modelToLiteralObject, verifyChangesInModel } from './helpers';
import { AbstractEntity, AbstractModel, QueryEntityManager } from './types';
import { RefreshModel } from './values';

type RefreshResponse = RefreshModel[] | Promise<RefreshModel[]>;

export class Entity implements AbstractEntity {
  constructor(public readonly uuid: string) {}
}

export abstract class EntityPersist<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  constructor(
    public readonly entity: E,
    public readonly relationable = true
  ) {}

  public abstract create(manager: QueryEntityManager): M | Promise<M>;
}

export abstract class EntitySync<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  private readonly initialStatus: LiteralObject;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {
    this.initialStatus = modelToLiteralObject(model);
  }

  public abstract sync(manager: QueryEntityManager): void;

  public verify(manager: QueryEntityManager): Undefined<LiteralObject> {
    return this.verifySync(manager);
  }

  private verifySync(manager: QueryEntityManager): Undefined<LiteralObject> {
    this.sync(manager); // Sync data Entity/Model

    return verifyChangesInModel(this.model, this.initialStatus);
  }
}

export abstract class EntityRefresh<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {}

  public abstract dispatch(manager: QueryEntityManager): RefreshResponse;
}
