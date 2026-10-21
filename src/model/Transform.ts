import { NumericValue } from "./NumericValue.js";

export class Transform {
  readonly #factor: number;
  readonly #tx: number;
  readonly #ty: number;

  public constructor(factor = 1, tx = 0, ty = 0) {
    this.#factor = NumericValue.positive(factor, "transform scale");
    this.#tx = NumericValue.finite(tx, "transform x");
    this.#ty = NumericValue.finite(ty, "transform y");
  }

  public get factor(): number { return this.#factor; }
  public get tx(): number { return this.#tx; }
  public get ty(): number { return this.#ty; }
  public get isIdentity(): boolean { return this.factor === 1 && this.tx === 0 && this.ty === 0; }

  public compose(local: Transform): Transform {
    return new Transform(this.factor * local.factor, this.factor * local.tx + this.tx, this.factor * local.ty + this.ty);
  }

  public inverse(): Transform {
    return new Transform(1 / this.factor, -this.tx / this.factor, -this.ty / this.factor);
  }

  public relativeTo(parent: Transform): Transform {
    // Solve parent.compose(local) = this directly: a standalone inverse may overflow
    // even when the required local transform is finite (for example equal parents).
    return new Transform(this.factor / parent.factor,
      (this.tx - parent.tx) / parent.factor, (this.ty - parent.ty) / parent.factor);
  }

  public point(x: number, y: number): readonly [number, number] {
    return [NumericValue.finite(this.factor * x + this.tx, "world x"), NumericValue.finite(this.factor * y + this.ty, "world y")];
  }

  public toSvg(): string {
    return `translate(${this.tx},${this.ty}) scale(${this.factor})`;
  }

  public static parse(source: string): Transform {
    let result = new Transform();
    let end = 0;
    let count = 0;
    const pattern = /([A-Za-z]+)[\x20\t\r\n]*\(([^)]*)\)/g;
    for (const match of source.matchAll(pattern)) {
      const separator = source.slice(end, match.index);
      const validSeparator = count === 0
        ? /^[\x20\t\r\n]*$/.test(separator)
        : /^(?:[\x20\t\r\n]+|[\x20\t\r\n]*,[\x20\t\r\n]*)$/.test(separator);
      if (!validSeparator) throw new Error("unsupported transform");
      const body = match[2]!.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, "");
      if (!body || /,[\x20\t\r\n]*,|^,|,$/.test(body)) throw new Error("invalid transform parameters");
      const values = body.split(/[\x20\t\r\n,]+/).map((value) => NumericValue.parse(value, "transform"));
      const name = match[1]!;
      let next: Transform;
      if (name === "translate" && values.length >= 1 && values.length <= 2) {
        next = new Transform(1, values[0]!, values[1] ?? 0);
      } else if (name === "scale" && values.length >= 1 && values.length <= 2 && (values.length === 1 || values[0] === values[1])) {
        next = new Transform(values[0]!);
      } else {
        throw new Error("unsupported transform");
      }
      result = result.compose(next);
      end = match.index + match[0].length;
      count += 1;
    }
    if (count === 0 || !/^[\x20\t\r\n]*$/.test(source.slice(end))) throw new Error("unsupported transform");
    return result;
  }
}
