import { Result } from '@rolster/commons';

export interface AbstractModel {
  id: number;
}

export interface EditableModel extends AbstractModel {
  updatedAt?: Date;
}

export interface HideableModel extends AbstractModel {
  hidden: boolean;
  hiddenAt?: Date;
}

export interface Model extends HideableModel {
  updatedAt?: Date;
}

export interface AbstractEntity {
  readonly uuid: string;
}

export class RefreshValue {
  constructor(
    public readonly model: AbstractModel,
    public readonly changes: LiteralObject
  ) {}
}

export interface Transaction {
  execute(): Promise<void>;
}

export interface QueryEntityManager {
  select<M extends AbstractModel>(entity: AbstractEntity): Result<M>;
}
