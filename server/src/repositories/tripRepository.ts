import type { Trip } from '../types.js'
import { BaseRepository } from './baseRepository.js'

export class TripRepository extends BaseRepository<Trip> {
  // Inherits all CRUD from BaseRepository
  // Future: add Trip-specific queries like getAllActive(), getByStatus(), etc.
}
