import { Optional, fromPromise } from '@rolster/commons';
import { AbstractEntityDataSource } from './datasource';
import { EntityLink, EntitySync, EntityRefresh } from './entity';
import { AbstractProcedure } from './procedure';
import { PersistentUnitResult } from './result';
import {
  AbstractModel,
  DirtyModel,
  AbstractEntity,
  ModelHideable,
  QueryEntityManager
} from './types';

type VinegarLink = EntityLink<AbstractEntity, AbstractModel>;

type VinegarRefresh = EntityRefresh<AbstractEntity, AbstractModel>;

type VinegarSync = EntitySync<AbstractEntity, AbstractModel>;

type SyncPromise = [AbstractModel, DirtyModel];

function isModelHidden(model: any): model is ModelHideable {
  return typeof model === 'object' && 'hidden' in model && 'hiddenAt' in model;
}

export abstract class AbstractEntityManager implements QueryEntityManager {
  abstract persist(options: VinegarLink): void;

  abstract refresh(options: VinegarRefresh): void;

  abstract sync(options: VinegarSync): void;

  abstract destroy(entity: AbstractEntity): void;

  abstract procedure(procedure: AbstractProcedure): void;

  abstract relation(entity: AbstractEntity, model: AbstractModel): void;

  abstract link<E extends AbstractEntity>(entity: E, model: AbstractModel): E;

  abstract select<T extends AbstractModel>(entity: AbstractEntity): Optional<T>;

  abstract flush(): Promise<PersistentUnitResult[]>;

  abstract dispose(): void;
}

export class EntityManager<
  D extends AbstractEntityDataSource = AbstractEntityDataSource
> implements AbstractEntityManager
{
  private relations: Map<AbstractEntity, AbstractModel>;

  private links: VinegarLink[] = [];

  private refreshs: VinegarRefresh[] = [];

  private syncs: VinegarSync[] = [];

  private destroys: AbstractModel[] = [];

  private hiddens: ModelHideable[] = [];

  private procedures: AbstractProcedure[] = [];

  constructor(protected dataSource: D) {
    this.relations = new Map();
  }

  public persist(link: VinegarLink): void {
    this.links.push(link);
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
    const optional = this.select(entity);

    if (optional.isPresent()) {
      const model = optional.get();

      isModelHidden(model)
        ? this.hiddens.push(model)
        : this.destroys.push(model);
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

  public select<M extends AbstractModel>(entity: AbstractEntity): Optional<M> {
    return Optional.build(
      this.relations.has(entity) ? (this.relations.get(entity) as M) : undefined
    );
  }

  public async flush(): Promise<PersistentUnitResult[]> {
    const results = [
      ...(await this.persistAll()),
      ...(await this.refreshAll()),
      ...(await this.syncAll()),
      ...(await this.hiddenAll()),
      ...(await this.destroyAll()),
      ...(await this.procedureAll())
    ];

    this.dispose();

    return results;
  }

  public dispose(): void {
    this.relations.clear();

    this.links = [];
    this.refreshs = [];
    this.syncs = [];
    this.destroys = [];
    this.hiddens = [];
    this.procedures = [];
  }

  private persistAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.links.map(async (link) => {
        const model = await fromPromise(link.create(this));

        link.relationable && this.relation(link.entity, model);

        return this.dataSource.insert(model);
      })
    );
  }

  private refreshAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.refreshs.map((refresh) => {
        refresh.setManager(this);

        return this.dataSource.refresh(refresh);
      })
    );
  }

  private syncAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.syncs
        .filter(({ model }) => !this.destroys.includes(model))
        .reduce((syncs: SyncPromise[], sync) => {
          const dirty = sync.verify(this);

          dirty && syncs.push([sync.model, dirty]);

          return syncs;
        }, [])
        .map(([model, dirty]) => {
          return this.dataSource.update(model, dirty);
        })
    );
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
