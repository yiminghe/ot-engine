# collaboration-engine

collaboration engine based on OT

## features

- full typescript stack
- one document one websocket connection
- support local undo/redo
- support presence(collaborative cursors)

## ot type definition

```ts
export type OTType<S = any, P = any> = {
  name: string;
  create(data: any): S;
  applyAndInvert?(snapshot: S, op: P, invert: boolean): [S, P | undefined];
  apply?(snapshot: S, op: P): S;
  invert?(op: P): P;
  invertWithDoc?(op: P, snapshot: S): P;
  compose?(op: P, prevOp: P): P | undefined;
  transform(op: P, refOp: P, side: OTSide): P;
  transformPresence?(presence: any, refOp: P): any;
  serialize(s: S): any;
  deserialize(data: any): S;
};
```