export class NumericValue {
  public static parseSvg(value: string, name: string): number {
    const normalized = value.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, "");
    return NumericValue.parse(normalized.endsWith("px") ? normalized.slice(0, -2) : normalized, name);
  }

  public static parse(value: string, name: string): number {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
      throw new Error(`invalid number: ${name}`);
    }
    return NumericValue.finite(Number(value), name);
  }

  public static finite(value: number, name: string): number {
    if (!Number.isFinite(value)) {
      throw new Error(`invalid number: ${name}`);
    }
    return Object.is(value, -0) ? 0 : value;
  }

  public static nonNegative(value: number, name: string): number {
    NumericValue.finite(value, name);
    if (value < 0) {
      throw new Error(`${name} must be non-negative`);
    }
    return value;
  }

  public static positive(value: number, name: string): number {
    NumericValue.finite(value, name);
    if (value <= 0) {
      throw new Error(`${name} must be positive`);
    }
    return value;
  }
}
