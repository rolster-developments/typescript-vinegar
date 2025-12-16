import { Result, ResultFactory, fromPromise } from '@rolster/commons';
import { v4 as uuid } from 'uuid';
import { AbstractEntityDataSource } from './datasource';
import { EntityPersist, EntityRefresh, EntitySync } from './entity';
import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import {
  AbstractEntity,
  AbstractModel,
  HideableModel,
  QueryEntityManager
} from './types';

type VinegarPersist = EntityPersist<AbstractEntity, AbstractModel>;

type VinegarSync = EntitySync<AbstractEntity, AbstractModel>;

type VinegarRefresh = EntityRefresh<AbstractEntity, AbstractModel>;

type SyncPromise = [AbstractModel, LiteralObject];

function modelIsHideable(model: any): model is HideableModel {
  return typeof model === 'object' && 'hidden' in model && 'hiddenAt' in model;
}

export abstract class AbstractEntityManager implements QueryEntityManager {
  abstract uuid: string;

  abstract persist(options: VinegarPersist): void;

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
  private relations: Map<AbstractEntity, AbstractModel>;

  private persists: VinegarPersist[] = [];

  private refreshs: VinegarRefresh[] = [];

  private syncs: VinegarSync[] = [];

  private destroys: AbstractModel[] = [];

  private hiddens: HideableModel[] = [];

  private procedures: AbstractProcedure[] = [];

  public readonly uuid: string;

  constructor(protected dataSource: D) {
    this.uuid = uuid();
    this.relations = new Map();
  }

  public persist(persist: VinegarPersist): void {
    this.persists.push(persist);
  }

  public refresh(refresh: VinegarRefresh): void {
    const { entity, model, relationable } = refresh;

    relationable && this.relation(entity, model);

    this.refreshs.push(refresh);
  }

  public sync(sync: VinegarSync): void {
    const { entity, model, relationable } = sync;

    relationable && this.relation(entity, model);

    this.syncs.push(sync);
  }

  public destroy(entity: AbstractEntity): void {
    const result = this.select(entity);

    if (result.isSuccess) {
      modelIsHideable(result.value)
        ? this.hiddens.push(result.value)
        : this.destroys.push(result.value);
    }
  }

  public procedure(procedure: AbstractProcedure): void {
    this.procedures.push(procedure);
  }

  public relation(entity: AbstractEntity, model: AbstractModel): void {
    this.relations.set(entity, model);
  }

  public link<E extends AbstractEntity>(entity: E, model: AbstractModel): E {
    this.relation(entity, model);

    return entity;
  }

  public select<M extends AbstractModel>(entity: AbstractEntity): Result<M> {
    const model = this.relations.get(entity);

    return model
      ? ResultFactory.success(model as M)
      : ResultFactory.failure('Not found');
  }

  public async flush(): Promise<PersistentUnitResult[]> {
    const results = [
      ...(await this.persistAll()),
      ...(await this.syncAll()),
      ...(await this.refreshAll()),
      ...(await this.hiddenAll()),
      ...(await this.destroyAll()),
      ...(await this.procedureAll())
    ];

    this.dispose();

    return results;
  }

  public dispose(): void {
    this.relations.clear();

    this.persists = [];
    this.refreshs = [];
    this.syncs = [];
    this.destroys = [];
    this.hiddens = [];
    this.procedures = [];
  }

  private persistAll(): Promise<PersistentUnitResult[]> {
    const results = this.persists.map(async (persist) => {
      const model = await fromPromise(persist.create(this));

      persist.relationable && this.relation(persist.entity, model);

      return this.dataSource.insert(model);
    });

    return Promise.all(results);
  }

  private syncAll(): Promise<PersistentUnitResult[]> {
    const results = this.syncs
      .filter(({ model }) => !this.destroys.includes(model))
      .reduce((syncs: SyncPromise[], sync) => {
        const dirty = sync.verify(this);

        dirty && syncs.push([sync.model, dirty]);

        return syncs;
      }, [])
      .map(([model, dirty]) => {
        return this.dataSource.update(model, dirty);
      });

    return Promise.all(results);
  }

  private refreshAll(): Promise<PersistentUnitResult[]> {
    const results = this.refreshs.map(async (refresh) => {
      const models = (await fromPromise(refresh.dispatch(this))).filter(
        (model) => !this.destroys.includes(model)
      );

      return this.dataSource.refresh(models);
    });

    return Promise.all(results);
  }

  private destroyAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.destroys.map((destroy) => this.dataSource.delete(destroy))
    );
  }

  private hiddenAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.hiddens.map((hidden) => this.dataSource.hidden(hidden))
    );
  }

  private procedureAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.procedures.map((procedure) => this.dataSource.procedure(procedure))
    );
  }
}
