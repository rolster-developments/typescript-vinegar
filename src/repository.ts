import { Optional } from '@rolster/commons';
import { Entity } from './entity';

export abstract class AbstractRepository<T extends Entity> {
  abstract save(entity: T): Promise<void>;

  abstract findOptionalByUuid(uuid: string): Promise<Optional<T>>;

  abstract findAll(): Promise<T[]>;

  abstract destroy(entity: T): Promise<void>;
}
