import { AbstractModel } from './types';

export type PersistentUnitResultCode =
  | 'insert'
  | 'refresh'
  | 'update'
  | 'delete'
  | 'hidden'
  | 'procedure';

export class PersistentUnitResult {
  constructor(
    public readonly code: PersistentUnitResultCode,
    public readonly error: any,
    public readonly model?: AbstractModel
  ) {}
}
