import type { Readable } from 'stream'

export interface DriverModel {
  getReadURLPrefix(): string;
  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }): Promise<string>;
  listFiles(storageTopLevel: string, page: number): Promise<Array<string>>;
}
