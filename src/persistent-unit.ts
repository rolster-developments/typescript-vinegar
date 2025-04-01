import { PersistentUnitResult } from './result';

export abstract class AbstractPersistentUnit {
  abstract flush(): Promise<PersistentUnitResult[]>;
}
