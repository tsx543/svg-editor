import type { DocumentGateway } from "../application/contracts/DocumentGateway.js";
import type { FileStore } from "../application/contracts/FileStore.js";
import type { LoadedDocument } from "../application/contracts/LoadedDocument.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { SvgCodec } from "./SvgCodec.js";

export class SvgDocumentGateway implements DocumentGateway {
  public constructor(
    private readonly fileStore: FileStore,
    private readonly codec: SvgCodec = new SvgCodec(),
  ) {}

  public read(path: string): LoadedDocument {
    return this.codec.decode(this.fileStore.read(path));
  }

  public save(path: string, document: SvgDocument): void {
    this.fileStore.writeAtomic(path, this.codec.encode(document));
  }
}
