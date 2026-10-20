import type { SvgDocument } from "../../model/SvgDocument.js";
import type { LoadedDocument } from "./LoadedDocument.js";

export interface DocumentGateway {
  read(path: string): LoadedDocument;
  save(path: string, document: SvgDocument): void;
}
