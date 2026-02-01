import type { Evidence } from '../judges/interface.js';

/**
 * Interface for data source fetchers.
 * Each source fetches evidence for market resolution.
 */
export interface IDataSource {
  /**
   * Unique identifier for this source
   */
  readonly id: string;

  /**
   * Categories this source can provide data for
   * e.g., ["crypto", "price"], ["sports", "nfl"]
   */
  readonly categories: string[];

  /**
   * Fetch evidence relevant to the given query
   */
  fetch(query: DataSourceQuery): Promise<Evidence[]>;
}

export interface DataSourceQuery {
  /** Keywords to search for */
  keywords: string[];

  /** Time range for data */
  startTime?: Date;
  endTime?: Date;

  /** Optional category filter */
  category?: string;
}
