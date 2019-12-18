

import { Readable } from 'stream'

export interface ListFilesResult { 
  entries: string[];
  page?: string;
}

export interface ListFilesStatResult {
  entries: ListFileStatResult[];
  page?: string;
}

export interface ListFileStatResult extends Required<StatResult> {
  name: string;
  exists: true;
}

export interface PerformListFilesArgs {
  pathPrefix: string;
  page?: string;
}

export interface PerformWriteArgs { 
  path: string;
  storageTopLevel: string;
  stream: Readable;
  contentLength: number;
  contentType: string;
  ifMatch?: string;
  ifNoneMatch?: string;
}

export interface WriteResult {
  publicURL: string;
  etag: string;
}

export interface PerformDeleteArgs {
  path: string;
  storageTopLevel: string;
}

export interface PerformReadArgs {
  path: string;
  storageTopLevel: string;
}

export interface ReadResult extends StatResult {
  data: Readable;
  exists: true
}

export interface PerformStatArgs {
  path: string;
  storageTopLevel: string;
}

export interface StatResult {
  exists: boolean;
  lastModifiedDate: number;
  etag: string;
  contentLength: number;
  contentType: string;
}

export interface PerformRenameArgs {
  path: string;
  storageTopLevel: string;
  newPath: string;
}

export interface DriverModel {
  supportsETagMatching: boolean;

  getReadURLPrefix(): string;
  performWrite(args: PerformWriteArgs): Promise<WriteResult>;
  performDelete(args: PerformDeleteArgs): Promise<void>;
  performRename(args: PerformRenameArgs): Promise<void>;
  performStat(args: PerformStatArgs): Promise<StatResult>;
  performRead(args: PerformReadArgs): Promise<ReadResult>;
  listFiles(args: PerformListFilesArgs): Promise<ListFilesResult>;
  listFilesStat(args: PerformListFilesArgs): Promise<ListFilesStatResult>;
  ensureInitialized(): Promise<void>;
  dispose(): Promise<void>;
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
  getConfigInformation(): { defaults: any,
                            envVars: any }
}
