import {
  AbstractEntity,
  AbstractModel,
  DirtyModel,
  ModelEditable,
  QueryEntityManager,
  Transaction
} from './types';

function modelIsEditable(model: any): model is ModelEditable {
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
> implements Transaction
{
  protected declare manager: QueryEntityManager;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {}

  public abstract refresh(manager: QueryEntityManager): void;

  public setManager(manager: QueryEntityManager): void {
    this.manager = manager;
  }

  public async execute(): Promise<void> {
    this.refresh(this.manager);
  }
}

export abstract class EntitySync<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  private dirty: DirtyModel;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {
    this.dirty = this.createDirtyFromModel(model);
  }

  public abstract sync(manager: QueryEntityManager): void;

  public verify(manager: QueryEntityManager): Undefined<DirtyModel> {
    return this.verifySync(manager);
  }

  private createDirtyFromModel(model: M): DirtyModel {
    const dirty: DirtyModel = {};

    Object.entries(model).forEach(([key, value]) => {
      dirty[key] = value;
    });

    return dirty;
  }

  private verifySync(manager: QueryEntityManager): Undefined<DirtyModel> {
    this.sync(manager); // Sync data Entity/Model

    const model = this.createDirtyFromModel(this.model);
    const dirty: DirtyModel = {};

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
