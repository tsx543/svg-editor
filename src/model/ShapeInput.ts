export interface ShapeInput {
  assertArity(min: number, max: number): void;
  number(index: number, name: string): number;
  text(index: number, name: string): string;
  optionalText(index: number, name: string): string | undefined;
}
