import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import { AbstractModel, HideableModel } from './types';
import { RefreshModel } from './values';

export abstract class AbstractEntityDataSource {
  abstract insert(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract update(
    model: AbstractModel,
    changes: LiteralObject
  ): Promise<PersistentUnitResult>;

  abstract refresh(models: RefreshModel[]): Promise<PersistentUnitResult>;

  abstract delete(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract hidden(model: HideableModel): Promise<PersistentUnitResult>;

  abstract procedure(
    procedure: AbstractProcedure
  ): Promise<PersistentUnitResult>;
}
