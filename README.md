# collaboration-engine

collaboration engine based on OT

## features

- full typescript stack
- one document one websocket
- support local undo/redo

## ot type definition

```ts
export type OTType<S=unknown, P=unknown> = {
  name: string;
  create(data: any): S;
  applyAndInvert(snapshot: S, op: P, invert: boolean): [S,P | undefined];
  compose?(op: P, prevOp: P): P | undefined;
  transform(op: P, refOp: P, side: OTSide): P;
};
```