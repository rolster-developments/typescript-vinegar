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

type LinkOptions = EntityLink<AbstractEntity, AbstractModel>;
type RefreshOptions = EntityRefresh<AbstractEntity, AbstractModel>;
type SyncOptions = EntitySync<AbstractEntity, AbstractModel>;
type SyncPromise = [AbstractModel, DirtyModel];

function itIsModelHidden(model: any): model is ModelHideable {
  return typeof model === 'object' && 'hidden' in model && 'hiddenAt' in model;
}

export abstract class AbstractEntityManager implements QueryEntityManager {
  abstract persist(options: LinkOptions): void;

  abstract refresh(options: RefreshOptions): void;

  abstract sync(options: SyncOptions): void;

  abstract destroy(entity: AbstractEntity): void;

  abstract procedure(procedure: AbstractProcedure): void;

  abstract relation(entity: AbstractEntity, model: AbstractModel): void;

  abstract link<E extends AbstractEntity>(entity: E, model: AbstractModel): E;

  abstract select<T extends AbstractModel>(entity: AbstractEntity): Optional<T>;

  abstract flush(): Promise<PersistentUnitResult[]>;

  abstract dispose(): void;
}

export class EntityManager implements AbstractEntityManager {
  private relations: Map<string, AbstractModel>;

  private links: LinkOptions[] = [];

  private refreshs: RefreshOptions[] = [];

  private syncs: SyncOptions[] = [];

  private destroys: AbstractModel[] = [];

  private hiddens: ModelHideable[] = [];

  private procedures: AbstractProcedure[] = [];

  constructor(private _dataSource: AbstractEntityDataSource) {
    this.relations = new Map<string, AbstractModel>();
  }

  public persist(options: LinkOptions): void {
    this.links.push(options);
  }

  public refresh(options: RefreshOptions): void {
    options.relationable && this.relation(options.entity, options.model);

    this.refreshs.push(options);
  }

  public sync(options: SyncOptions): void {
    options.relationable && this.relation(options.entity, options.model);

    this.syncs.push(options);
  }

  public destroy(entity: AbstractEntity): void {
    this.select(entity).present((model) => {
      itIsModelHidden(model)
        ? this.hiddens.push(model)
        : this.destroys.push(model);
    });
  }

  public procedure(procedure: AbstractProcedure): void {
    this.procedures.push(procedure);
  }

  public relation(entity: AbstractEntity, model: AbstractModel): void {
    this.relations.set(entity.uuid, model);
  }

  public link<E extends AbstractEntity>(entity: E, model: AbstractModel): E {
    this.relation(entity, model);

    return entity;
  }

  public select<M extends AbstractModel>(entity: AbstractEntity): Optional<M> {
    return Optional.build(
      this.relations.has(entity.uuid)
        ? (this.relations.get(entity.uuid) as M)
        : undefined
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
      this.links.map((link) =>
        fromPromise(link.create(this)).then((model) => {
          link.relationable && this.relation(link.entity, model);

          return this._dataSource.insert(model);
        })
      )
    );
  }

  private refreshAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.refreshs.map((refresh) => this._dataSource.refresh(refresh))
    );
  }

  private syncAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.syncs
        .filter(({ model }) => !this.destroys.includes(model))
        .reduce((syncs: SyncPromise[], sync) => {
          const dirty = sync.verify();

          dirty && syncs.push([sync.model, dirty]);

          return syncs;
        }, [])
        .map(([model, dirty]) => {
          return this._dataSource.update(model, dirty);
        })
    );
  }

  private destroyAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.destroys.map((destroy) => this._dataSource.delete(destroy))
    );
  }

  private hiddenAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.hiddens.map((hidden) => this._dataSource.hidden(hidden))
    );
  }

  private procedureAll(): Promise<PersistentUnitResult[]> {
    return Promise.all(
      this.procedures.map((procedure) => this._dataSource.procedure(procedure))
    );
  }
}
