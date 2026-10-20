export class SvgElement {
  readonly #name: string;
  readonly #attributes: ReadonlyMap<string, string>;
  readonly #children: SvgElement[] = [];
  readonly #text: string[] = [];

  public constructor(name: string, attributes: ReadonlyMap<string, string>) {
    this.#name = name;
    this.#attributes = new Map(attributes);
  }

  public get name(): string { return this.#name; }
  public get attributes(): ReadonlyMap<string, string> { return this.#attributes; }
  public get children(): readonly SvgElement[] { return this.#children; }
  public get text(): string { return this.#text.join(""); }

  public appendChild(child: SvgElement): void {
    this.#children.push(child);
  }

  public appendText(text: string): void {
    this.#text.push(text);
  }
}
