import {
  AbstractEntity,
  AbstractModel,
  DirtyModel,
  ModelEditable,
  QueryEntityManager,
  Transaction
} from './types';

function isModelEditable(model: any): model is ModelEditable {
  return typeof model === 'object' && 'updatedAt' in model;
}

export class Entity implements AbstractEntity {
  constructor(public readonly uuid: string) {}
}

export abstract class EntityLink<
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
    this.sync(manager);

    return this.createDirty();
  }

  private createDirtyFromModel(model: M): DirtyModel {
    const dirty: DirtyModel = {};

    Object.entries(model).forEach(([key, value]) => {
      dirty[key] = value;
    });

    return dirty;
  }

  private createDirty(): Undefined<DirtyModel> {
    const _model = this.createDirtyFromModel(this.model);
    const _dirty: DirtyModel = {};

    Object.entries(_model).forEach(([key, value]) => {
      if (_model[key] !== this.dirty[key]) {
        _dirty[key] = value;
      }
    });

    const requiredUpdate = Object.keys(_dirty).length > 0;

    if (requiredUpdate && isModelEditable(this.model)) {
      _dirty['updatedAt'] = new Date();
    }

    return requiredUpdate ? _dirty : undefined;
  }
}
