import type { SvgDocument } from "../../model/SvgDocument.js";

export interface LoadedDocument {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}
