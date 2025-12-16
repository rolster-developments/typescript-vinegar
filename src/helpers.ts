import { AbstractModel, EditableModel, HideableModel } from './types';

export function modelIsEditable(model: any): model is EditableModel {
  return typeof model === 'object' && 'updatedAt' in model;
}

export function modelIsHideable(model: any): model is HideableModel {
  return typeof model === 'object' && 'hidden' in model && 'hiddenAt' in model;
}

export function modelToLiteralObject(model: AbstractModel): LiteralObject {
  const changes: LiteralObject = {};

  Object.entries(model).forEach(([key, value]) => {
    changes[key] = value;
  });

  return changes;
}

export function verifyChangesInModel(
  model: AbstractModel,
  initialStatus: LiteralObject
): Undefined<LiteralObject> {
  const currentStatus = modelToLiteralObject(model);
  const changes: LiteralObject = {};

  Object.entries(currentStatus).forEach(([key, value]) => {
    if (currentStatus[key] !== initialStatus[key]) {
      changes[key] = value;
    }
  });

  const requiredUpdate = Object.keys(changes).length > 0;

  if (requiredUpdate && modelIsEditable(model)) {
    changes['updatedAt'] = new Date();
  }

  return requiredUpdate ? changes : undefined;
}
