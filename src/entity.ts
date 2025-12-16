import {
  AbstractEntity,
  AbstractModel,
  EditableModel,
  QueryEntityManager
} from './types';

type RefreshResponse = AbstractModel[] | Promise<AbstractModel[]>;

function modelIsEditable(model: any): model is EditableModel {
  return typeof model === 'object' && 'updatedAt' in model;
}

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

export abstract class EntityRefresh<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  protected declare manager: QueryEntityManager;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {}

  public abstract dispatch(manager: QueryEntityManager): RefreshResponse;
}

export abstract class EntitySync<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  private dirty: LiteralObject;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {
    this.dirty = this.createDirtyFromModel(model);
  }

  public abstract sync(manager: QueryEntityManager): void;

  public verify(manager: QueryEntityManager): Undefined<LiteralObject> {
    return this.verifySync(manager);
  }

  private createDirtyFromModel(model: M): LiteralObject {
    const dirty: LiteralObject = {};

    Object.entries(model).forEach(([key, value]) => {
      dirty[key] = value;
    });

    return dirty;
  }

  private verifySync(manager: QueryEntityManager): Undefined<LiteralObject> {
    this.sync(manager); // Sync data Entity/Model

    const model = this.createDirtyFromModel(this.model);
    const dirty: LiteralObject = {};

    Object.entries(model).forEach(([key, value]) => {
      if (model[key] !== this.dirty[key]) {
        dirty[key] = value;
      }
    });

    const requiredUpdate = Object.keys(dirty).length > 0;

    if (requiredUpdate && modelIsEditable(this.model)) {
      dirty['updatedAt'] = new Date();
    }

    return requiredUpdate ? dirty : undefined;
  }
}
