import {
  AbstractEntity,
  AbstractModel,
  DirtyModel,
  ModelEditable,
  QueryEntityManager,
  Transaction
} from './types';

function itIsModelEditable(model: any): model is ModelEditable {
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
  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {}

  public abstract refresh(): void;

  public async execute(): Promise<void> {
    this.refresh();
  }
}

export abstract class EntitySync<
  E extends AbstractEntity,
  M extends AbstractModel
> {
  private _dirty: DirtyModel;

  constructor(
    public readonly entity: E,
    public readonly model: M,
    public readonly relationable = true
  ) {
    this._dirty = this.createDirtyFromModel(model);
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
    const _modelDirty = this.createDirtyFromModel(this.model);
    const _dirty: DirtyModel = {};

    Object.entries(_modelDirty).forEach(([key, value]) => {
      if (_modelDirty[key] !== this._dirty[key]) {
        _dirty[key] = value;
      }
    });

    const requiredUpdate = Object.keys(_dirty).length > 0;

    if (requiredUpdate && itIsModelEditable(this.model)) {
      _dirty['updatedAt'] = new Date();
    }

    return requiredUpdate ? _dirty : undefined;
  }
}
