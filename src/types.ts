import { Optional } from '@rolster/commons';

export type DirtyModel = Record<string, any>;

export interface AbstractModel {
  id: number;
}

export interface ModelEditable extends AbstractModel {
  updatedAt?: Date;
}

export interface ModelHideable extends AbstractModel {
  hidden: boolean;
  hiddenAt?: Date;
}

export interface Model extends ModelHideable {
  updatedAt?: Date;
}

export interface AbstractEntity {
  readonly uuid: string;
}

export interface TransactionRefresh {
  execute(): Promise<void>;
}

export interface QueryEntityManager {
  select<T extends AbstractModel>(entity: AbstractEntity): Optional<T>;
}
