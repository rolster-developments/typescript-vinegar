import { modelToLiteralObject, verifyChangesInModel } from './helpers';
import { AbstractModel } from './types';

export class RefreshModel {
  private readonly initialStatus: LiteralObject;

  constructor(public readonly model: AbstractModel) {
    this.initialStatus = modelToLiteralObject(model);
  }

  public getChanges(): Undefined<LiteralObject> {
    return verifyChangesInModel(this.model, this.initialStatus);
  }
}
