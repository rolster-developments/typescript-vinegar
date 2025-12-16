import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import { AbstractModel, DirtyModel, ModelHideable } from './types';

export abstract class AbstractEntityDataSource {
  abstract insert(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract update(
    model: AbstractModel,
    dirty: DirtyModel
  ): Promise<PersistentUnitResult>;

  abstract refresh(models: AbstractModel[]): Promise<PersistentUnitResult>;

  abstract delete(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract hidden(model: ModelHideable): Promise<PersistentUnitResult>;

  abstract procedure(
    procedure: AbstractProcedure
  ): Promise<PersistentUnitResult>;
}
