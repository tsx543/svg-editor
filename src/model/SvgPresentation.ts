import { NumericValue } from "./NumericValue.js";

export class SvgPresentation {
  public static normalize(name: string, value: string): string | undefined {
    if (name === "fill" || name === "stroke") {
      if (/url\s*\(/i.test(value)) throw new Error("SVG resource references are not supported");
      return value;
    }
    if (name === "stroke-width" || name === "font-size") {
      return String(NumericValue.nonNegative(NumericValue.parseSvg(value, name), name));
    }
    if (name === "text-anchor" && ["start", "middle", "end"].includes(value)) return value;
    return undefined;
  }
}
