import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import { AbstractModel, DirtyModel, ModelHideable, Transaction } from './types';

export abstract class AbstractEntityDataSource {
  abstract insert(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract refresh(transaction: Transaction): Promise<PersistentUnitResult>;

  abstract update(
    model: AbstractModel,
    dirty: DirtyModel
  ): Promise<PersistentUnitResult>;

  abstract delete(model: AbstractModel): Promise<PersistentUnitResult>;

  abstract hidden(model: ModelHideable): Promise<PersistentUnitResult>;

  abstract procedure(procedure: AbstractProcedure): Promise<PersistentUnitResult>;
}
