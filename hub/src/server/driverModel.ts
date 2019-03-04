

import { Readable } from 'stream'

export type ListFilesResult = { entries: Array<string>, page?: string };
export type PerformWriteArgs = { 
  path: string,
  storageTopLevel: string,
  stream: Readable,
  contentLength: number,
  contentType: string };

export interface DriverModel {
  getReadURLPrefix(): string;
  performWrite(args: PerformWriteArgs): Promise<string>;
  listFiles(storageTopLevel: string, page?: string): Promise<ListFilesResult>;
  ensureInitialized(): Promise<void>;
  dispose(): Promise<void>;
  // constructor(config: any) : void
}

export interface DriverConstructor {
  new (config: any): DriverModel;
}

export interface DriverModelTestMethods extends DriverModel {
  /**
   * Deletes the bucket. This is only meant to be used for cleaning up 
   * after performing integration testing so as not to exceed any max 
   * bucket/container limits. A sanity check is performed to ensure 
   * that the bucket is empty before deletion. 
   */
  deleteEmptyBucket(): Promise<void>;
}

export interface DriverStatics {
  getConfigInformation(): { defaults: Object,
                            envVars: Object }
}

/* class decorator */
export function staticImplements<T>() {
  return (constructor: T) => {}
}
