import { AbstractProcedure } from './procedure';
import {
  AbstractModel,
  DirtyModel,
  ModelHideable,
  TransactionRefresh
} from './types';

export abstract class AbstractEntityDataSource {
  abstract insert(model: AbstractModel): Promise<void>;

  abstract refresh(entity: TransactionRefresh): Promise<void>;

  abstract update(model: AbstractModel, dirty: DirtyModel): Promise<void>;

  abstract delete(model: AbstractModel): Promise<void>;

  abstract hidden(model: ModelHideable): Promise<void>;

  abstract procedure(procedure: AbstractProcedure): Promise<void>;
}
