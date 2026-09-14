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

`Entity` implements the `AbstractEntity` interface (`{ readonly uuid: string }`),
which is the type every manager method accepts, so any object exposing a `uuid`
qualifies as an entity.

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
these abstract classes. Every abstract method receives a `QueryEntityManager`
(`select<M>(entity): Result<M>`), the read-only view of the manager that lets a
mapping look up the model already linked to another entity:

- `EntityPersist<E, M>` — `new (entity, relationable = true)`; create a model
  from an entity: `create(manager): M | Promise<M>`.
- `EntityPersistList<E>` — `new (entity)`; create several models at once:
  `create(manager): AbstractModel[] | Promise<AbstractModel[]>`.
- `EntitySync<E, M>` — `new (entity, model, relationable = true)`; update an
  existing model. It captures the model's initial state in the constructor so
  only the **changed** fields are persisted: `sync(manager)` mutates the model,
  `verify(manager)` runs `sync` and returns the diff (or `undefined`).
- `EntityRefresh<E, M>` — `new (entity, model, relationable = true)`; reload
  fresh data into one or more models:
  `dispatch(manager): RefreshModel[] | Promise<RefreshModel[]>`.

When `relationable` is `true` the manager links the entity to its model
(see `relation` below) as soon as the operation is queued (or, for
`EntityPersist`, once the model is created).

```typescript
import {
  EntityPersist,
  EntityRefresh,
  EntitySync,
  QueryEntityManager,
  RefreshModel
} from '@rolster/vinegar';

class UserPersist extends EntityPersist<User, UserModel> {
  create(): UserModel {
    return { id: 0, name: this.entity.name, email: this.entity.email };
  }
}

class UserSync extends EntitySync<User, UserModel> {
  sync(): void {
    this.model.name = this.entity.name;
  }
}

class UserRefresh extends EntityRefresh<User, UserModel> {
  dispatch(manager: QueryEntityManager): RefreshModel[] {
    const refresh = new RefreshModel(this.model);
    const result = manager.select<UserModel>(this.entity);

    if (result.isSuccess) {
      this.model.email = result.value.email;
    }

    return [refresh];
  }
}
```

#### RefreshModel

`new RefreshModel(model)` snapshots a model's current state; `getChanges()`
returns the fields that changed since the snapshot (adding `updatedAt` for an
`EditableModel`), or `undefined` when nothing changed. `EntityRefresh.dispatch`
returns them and `AbstractEntityDataSource.refresh(models)` receives them, so
the data source only writes the diff of each model.

### Unit of Work — `EntityManager`

`AbstractEntityManager` queues operations and flushes them as a batch. It
implements `QueryEntityManager`; `Result` comes from `@rolster/commons`:

```typescript
import { Result } from '@rolster/commons';
import {
  AbstractEntity,
  AbstractModel,
  AbstractProcedure,
  EntityPersist,
  EntityPersistList,
  EntityRefresh,
  EntitySync,
  PersistentUnitResult,
  QueryEntityManager
} from '@rolster/vinegar';

abstract class AbstractEntityManager implements QueryEntityManager {
  abstract uuid: string;
  abstract persist(persist: EntityPersist<AbstractEntity, AbstractModel>): void;
  abstract persists(persists: EntityPersistList<AbstractEntity>): void;
  abstract sync(sync: EntitySync<AbstractEntity, AbstractModel>): void;
  abstract refresh(refresh: EntityRefresh<AbstractEntity, AbstractModel>): void;
  abstract destroy(entity: AbstractEntity): void;
  abstract procedure(procedure: AbstractProcedure): void;
  abstract relation(entity: AbstractEntity, model: AbstractModel): void;
  abstract link<E extends AbstractEntity>(entity: E, model: AbstractModel): E;
  abstract select<M extends AbstractModel>(entity: AbstractEntity): Result<M>;
  abstract flush(): Promise<PersistentUnitResult[]>;
  abstract dispose(): void;
}
```

| Method                    | Queues / does                                                        |
| ------------------------- | -------------------------------------------------------------------- |
| `persist(persist)`        | a create                                                             |
| `persists(persists)`      | multiple creates                                                     |
| `sync(sync)`              | an update (diff-based)                                               |
| `refresh(refresh)`        | a reload                                                             |
| `destroy(entity)`         | a delete, or a soft-hide when the model is hideable                  |
| `procedure(procedure)`    | a custom operation                                                   |
| `relation(entity, model)` | links an entity to its model                                         |
| `link(entity, model)`     | links and returns the entity                                         |
| `select(entity)`          | the model linked to an entity, as a `Result` (`isSuccess` / `value`) |
| `flush()`                 | runs everything in order and returns the results                     |
| `dispose()`               | clears the queue and the links                                       |

`EntityManager<D extends AbstractEntityDataSource>` is the ready-to-use
implementation. `new EntityManager(dataSource)` assigns a random `uuid` and
delegates each queued operation to the data source when `flush()` runs, in
this order: persists, persist lists, syncs, refreshes, procedures, hides,
deletes. `destroy(entity)` resolves the model through `select`, so the entity
must have been linked first; the queue is disposed after every `flush()`.

```typescript
import { EntityManager } from '@rolster/vinegar';

const manager = new EntityManager(dataSource);

manager.persist(new UserPersist(user));
manager.sync(new UserSync(admin, adminModel));
manager.destroy(admin);

const results = await manager.flush();
```

### Persistence backend

- `AbstractEntityDatabase` — connection & transaction lifecycle: `connect()`,
  `disconnect(all?: boolean)`, `transaction()`, `commit()`, `rollback()`, all
  returning `Promise<void>`.
- `AbstractEntityDataSource` — the low-level operations the manager delegates
  to, each returning `Promise<PersistentUnitResult>`: `insert(model)`,
  `update(model, changes)`, `refresh(models: RefreshModel[])`, `delete(model)`,
  `hidden(model: HideableModel)`, `procedure(manager, procedure)`.
- `AbstractPersistentUnit` — declares only
  `flush(): Promise<PersistentUnitResult[]>`; an implementation is expected to
  wire a database and a manager so the flush runs inside a single transaction
  (see `TypeormPersistentUnit` in `@rolster/vinegar-typeorm`).
- `AbstractProcedure` — wraps a custom database operation
  (`execute(...args): Promise<void>`); the data source decides which arguments
  it receives.
- `Transaction` — interface (`execute(): Promise<void>`) for an operation
  meant to run inside a transaction.

### Operation result

Every operation produces a `PersistentUnitResult`:

```typescript
class PersistentUnitResult {
  constructor(
    public readonly code: PersistentUnitResultCode,
    public readonly error: any, // null/undefined when the operation succeeded
    public readonly model?: AbstractModel
  ) {}
}
```

`PersistentUnitResultCode` is
`'insert' | 'update' | 'refresh' | 'delete' | 'hidden' | 'procedure' | 'operation'`.
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
