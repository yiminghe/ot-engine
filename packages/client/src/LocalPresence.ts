import { transformPresence } from 'ot-engine-common';
import { Doc } from './doc';
import { OpEvent } from './types';

export class LocalPresence<S, P, Pr> {
  value: Pr | undefined;

  sending = false;

  constructor(private doc: Doc<S, P, Pr>) {
    if (doc.otType.transformPresence) {
      doc.addEventListener('op', this.onOp);
    }
  }

  onOp = ({ ops }: OpEvent<P>) => {
    if (this.value !== undefined) {
      this.value = transformPresence(this.value, ops, this.doc.otType);
    }
  };

  async submit(value: any) {
    const { doc } = this;
    this.value = value;
    if (this.sending) {
      return;
    }
    this.sending = true;
    await doc.waitNoPending();
    doc.send({
      type: 'presence',
      clientId: doc.clientId,
      presence: {
        version: doc.version,
        content: this.value,
      },
    });
    this.sending = false;
  }
}
