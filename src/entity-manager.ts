import { Result, ResultFactory, fromPromise } from '@rolster/commons';
import { v4 as uuid } from 'uuid';
import { AbstractEntityDataSource } from './datasource';
import {
  EntityPersist,
  EntityPersistList,
  EntityRefresh,
  EntitySync
} from './entity';
import { modelIsHideable } from './helpers';
import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import {
  AbstractEntity,
  AbstractModel,
  HideableModel,
  QueryEntityManager
} from './types';

type VinegarPersist = EntityPersist<AbstractEntity, AbstractModel>;

type VinegarPersistList = EntityPersistList<AbstractEntity>;

type VinegarSync = EntitySync<AbstractEntity, AbstractModel>;

type VinegarRefresh = EntityRefresh<AbstractEntity, AbstractModel>;

export abstract class AbstractEntityManager implements QueryEntityManager {
  abstract uuid: string;

  abstract persist(options: VinegarPersist): void;

  abstract persists(persists: VinegarPersistList): void;

  abstract refresh(options: VinegarRefresh): void;

  abstract sync(options: VinegarSync): void;

  abstract destroy(entity: AbstractEntity): void;

  abstract procedure(procedure: AbstractProcedure): void;

  abstract relation(entity: AbstractEntity, model: AbstractModel): void;

  abstract link<E extends AbstractEntity>(entity: E, model: AbstractModel): E;

  abstract select<T extends AbstractModel>(entity: AbstractEntity): Result<T>;

  abstract flush(): Promise<PersistentUnitResult[]>;

  abstract dispose(): void;
}

export class EntityManager<
  D extends AbstractEntityDataSource = AbstractEntityDataSource
> implements AbstractEntityManager
{
  private _relations: Map<AbstractEntity, AbstractModel>;

  private _persists: VinegarPersist[] = [];

  private _persistsList: VinegarPersistList[] = [];

  private _syncs: VinegarSync[] = [];

  private _refreshs: VinegarRefresh[] = [];

  private _procedures: AbstractProcedure[] = [];

  private _hiddens: HideableModel[] = [];

  private _destroys: AbstractModel[] = [];

  public readonly uuid: string;

  constructor(protected dataSource: D) {
    this.uuid = uuid();
    this._relations = new Map();
  }

  public persist(persist: VinegarPersist): void {
    this._persists.push(persist);
  }

  public persists(persists: VinegarPersistList): void {
    this._persistsList.push(persists);
  }

  public sync(sync: VinegarSync): void {
    const { entity, model, relationable } = sync;

    relationable && this.relation(entity, model);

    this._syncs.push(sync);
  }

  public refresh(refresh: VinegarRefresh): void {
    const { entity, model, relationable } = refresh;

    relationable && this.relation(entity, model);

    this._refreshs.push(refresh);
  }

  public procedure(procedure: AbstractProcedure): void {
    this._procedures.push(procedure);
  }

  public destroy(entity: AbstractEntity): void {
    const result = this.select(entity);

    if (result.isSuccess) {
      !modelIsHideable(result.value)
        ? this._destroys.push(result.value)
        : this._hiddens.push(result.value);
    }
  }

  public relation(entity: AbstractEntity, model: AbstractModel): void {
    this._relations.set(entity, model);
  }

  public link<E extends AbstractEntity>(entity: E, model: AbstractModel): E {
    this.relation(entity, model);

    return entity;
  }

  public select<M extends AbstractModel>(entity: AbstractEntity): Result<M> {
    const model = this._relations.get(entity);

    return model
      ? ResultFactory.success(model as M)
      : ResultFactory.failure('Not found');
  }

  public async flush(): Promise<PersistentUnitResult[]> {
    const persists = [
      ...(await this.persistAll()),
      ...(await this.persistListAll())
    ];

    const syncs = await this.syncAll();
    const refreshs = await this.refreshAll();
    const procedures = await this.procedureAll();

    const [hiddens, destroys] = await Promise.all([
      this.hiddenAll(),
      this.destroyAll()
    ]);

    const results = [
      ...persists,
      ...syncs,
      ...refreshs,
      ...procedures,
      ...hiddens,
      ...destroys
    ];

    this.dispose();

    return results;
  }

  public dispose(): void {
    this._relations.clear();

    this._persists = [];
    this._persistsList = [];
    this._refreshs = [];
    this._syncs = [];
    this._hiddens = [];
    this._destroys = [];
    this._procedures = [];
  }

  private async persistAll(): Promise<PersistentUnitResult[]> {
    const results: PersistentUnitResult[] = [];

    for (const persist of this._persists) {
      const model = await fromPromise(persist.create(this));

      persist.relationable && this.relation(persist.entity, model);

      results.push(await this.dataSource.insert(model));
    }

    return results;
  }

  private async persistListAll(): Promise<PersistentUnitResult[]> {
    const results: PersistentUnitResult[] = [];

    for (const persists of this._persistsList) {
      const models = await fromPromise(persists.create(this));

      for (const model of models) {
        results.push(await this.dataSource.insert(model));
      }
    }

    return results;
  }

  private syncAll(): Promise<PersistentUnitResult[]> {
    const syncs = this._syncs.filter(({ model }) =>
      !modelIsHideable(model)
        ? !this._destroys.includes(model)
        : !this._hiddens.includes(model)
    );

    const syncs$: Promise<PersistentUnitResult>[] = [];

    syncs.forEach((sync) => {
      const dirty = sync.verify(this);

      if (dirty) {
        syncs$.push(this.dataSource.update(sync.model, dirty));
      }
    });

    return Promise.all(syncs$);
  }

  private async refreshAll(): Promise<PersistentUnitResult[]> {
    const refreshs$ = this._refreshs.map(async (refresh) => {
      const _models = await fromPromise(refresh.dispatch(this));

      const models = _models.filter(({ model }) =>
        !modelIsHideable(model)
          ? !this._destroys.includes(model)
          : !this._hiddens.includes(model)
      );

      return this.dataSource.refresh(models);
    });

    return Promise.all(refreshs$);
  }

  private async destroyAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this._destroys.map((destroy) => this.dataSource.delete(destroy))
    );
  }

  private async hiddenAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this._hiddens.map((hidden) => this.dataSource.hidden(hidden))
    );
  }

  private async procedureAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this._procedures.map((procedure) => this.dataSource.procedure(procedure))
    );
  }
}
