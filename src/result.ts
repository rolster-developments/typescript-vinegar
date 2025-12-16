import { AbstractModel } from './types';

export type PersistentUnitResultCode =
  | 'insert'
  | 'update'
  | 'refresh'
  | 'delete'
  | 'hidden'
  | 'procedure'
  | 'operation';

export class PersistentUnitResult {
  constructor(
    public readonly code: PersistentUnitResultCode,
    public readonly error: any,
    public readonly model?: AbstractModel
  ) {}
}
