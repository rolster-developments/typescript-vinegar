# Rolster Vinegar

Container package of basic classes to implement a clean architecture.

## Installation

```
npm i @rolster/vinegar
```

## Configuration

You must install the `@rolster/types` to define package data types, which are configured by adding them to the `files` property of the `tsconfig.json` file.

```json
{
  "files": ["node_modules/@rolster/types/index.d.ts"]
}
```

## Overview

Vinegar provides the **abstractions** for a clean-architecture persistence
layer built around the _Unit of Work_ and _Repository_ patterns. It keeps your
domain (entities) decoupled from the persistence details (the ORM), which live
behind a `Datasource`/`Database` pair.

This package is ORM-agnostic — it only defines the contracts. For a ready-made
implementation use
[`@rolster/vinegar-typeorm`](https://www.npmjs.com/package/@rolster/vinegar-typeorm).

## Core abstractions

### Domain

```typescript
import { Entity } from '@rolster/vinegar';

// A domain entity is identified by a uuid
class User extends Entity {
  constructor(
    uuid: string,
    public name: string,
    public email: string
  ) {
    super(uuid);
  }
}
```

Models — the persisted shape — are described by interfaces from `types.ts`:

| Interface       | Shape                                                 |
| --------------- | ----------------------------------------------------- |
| `AbstractModel` | `{ id: number }`                                      |
| `EditableModel` | adds `updatedAt?: Date`                               |
| `HideableModel` | adds `hidden: boolean; hiddenAt?: Date` (soft delete) |
| `Model`         | hideable **and** editable                             |

Helpers `modelIsEditable(model)` and `modelIsHideable(model)` are type guards
over those shapes.

### Repository

`AbstractRepository<T>` is the contract for reading/persisting domain entities:

```typescript
abstract class AbstractRepository<T extends Entity> {
  abstract save(entity: T): Promise<void>;
  abstract findOptionalByUuid(uuid: string): Promise<Optional<T>>;
  abstract findAll(): Promise<T[]>;
  abstract destroy(entity: T): Promise<void>;
}
```

(`Optional` comes from `@rolster/commons`.)

### Mapping entity ↔ model

You describe how an entity is translated into persistence operations through
these abstract classes:

- `EntityPersist<E, M>` — create a model from an entity: `create(manager): M`
- `EntityPersistList<E>` — create several models at once.
- `EntitySync<E, M>` — update an existing model; it captures the model's initial
  state in the constructor so only the **changed** fields are persisted
  (`sync(manager)` mutates the model, `verify()` returns the diff).
- `EntityRefresh<E, M>` — reload fresh data into a model: `dispatch(manager)`.

### Unit of Work — `EntityManager`

`AbstractEntityManager` queues operations and flushes them as a batch:

```typescript
abstract class AbstractEntityManager {
  persist(persist: EntityPersist): void; // queue a create
  persists(persists: EntityPersistList): void; // queue multiple creates
  sync(sync: EntitySync): void; // queue an update (diff-based)
  refresh(refresh: EntityRefresh): void; // queue a reload
  destroy(entity: AbstractEntity): void; // queue a delete (or soft-hide)
  procedure(procedure: AbstractProcedure): void; // queue a custom operation
  relation(entity, model): void; // link an entity to its model
  link<E>(entity: E, model): E; // link and return the entity
  select<M>(entity): Result<M>; // get the model linked to an entity
  flush(): Promise<PersistentUnitResult[]>; // run everything in order
  dispose(): void; // clear the queue
}
```

### Persistence backend

- `AbstractEntityDatabase` — connection & transaction lifecycle: `connect`,
  `disconnect`, `transaction`, `commit`, `rollback`.
- `AbstractEntityDataSource` — the low-level operations the manager delegates to:
  `insert`, `update`, `refresh`, `delete`, `hidden`, `procedure`.
- `AbstractPersistentUnit` — coordinates a database + manager so a `flush()`
  runs inside a single transaction.
- `AbstractProcedure` — wraps a custom database operation (`execute(...args)`).

### Operation result

Every operation produces a `PersistentUnitResult`:

```typescript
class PersistentUnitResult {
  code:
    | 'insert'
    | 'update'
    | 'refresh'
    | 'delete'
    | 'hidden'
    | 'procedure'
    | 'operation';
  error: any; // null/undefined when the operation succeeded
  model?: AbstractModel;
}
```

`flush()` returns the array of results, so you can inspect which operations
failed.

## Flow

1. The domain layer works only with `Entity` objects.
2. To persist changes you queue `EntityPersist` / `EntitySync` / `EntityRefresh`
   instances (or a `destroy`/`procedure`) into the `EntityManager`.
3. `flush()` runs the queued operations through the `Datasource`, inside a
   transaction managed by the `Database`/`PersistentUnit`, and returns a
   `PersistentUnitResult[]`.

For a concrete, ready-to-use wiring of all these abstractions see
**@rolster/vinegar-typeorm**.

## Contributing

- Daniel Andrés Castillo Pedroza :rocket:
