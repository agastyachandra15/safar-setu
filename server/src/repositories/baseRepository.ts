export abstract class BaseRepository<T extends { id: string }> {
  protected storage = new Map<string, T>()

  create(entity: T): void {
    this.storage.set(entity.id, entity)
  }

  getById(id: string): T | undefined {
    return this.storage.get(id)
  }

  getAll(): T[] {
    return [...this.storage.values()]
  }

  save(entity: T): void {
    this.storage.set(entity.id, entity)
  }

  update(id: string, entity: T): void {
    if (!this.storage.has(id)) throw new Error(`Entity with id ${id} not found`)
    this.storage.set(id, entity)
  }

  delete(id: string): void {
    this.storage.delete(id)
  }

  exists(id: string): boolean {
    return this.storage.has(id)
  }
}
