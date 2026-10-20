export class ExternalDependencyPolicy {
  readonly #xmlPackages: ReadonlySet<string>;

  public constructor(xmlPackages: readonly string[] = []) {
    this.#xmlPackages = new Set(xmlPackages);
  }

  public allows(layer: string, dependency: string): boolean {
    if (dependency.startsWith("node:")) {
      return layer === "cli" || layer === "infrastructure";
    }
    if (layer !== "svg") {
      return false;
    }
    for (const packageName of this.#xmlPackages) {
      if (dependency === packageName || dependency.startsWith(`${packageName}/`)) {
        return true;
      }
    }
    return false;
  }
}
