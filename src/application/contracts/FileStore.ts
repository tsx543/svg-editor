export interface FileStore {
  read(path: string): string;
  writeAtomic(path: string, content: string): void;
}
