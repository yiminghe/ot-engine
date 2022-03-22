import { transformPresence } from 'ot-engine-common';
import { Doc } from './doc';
import { OpEvent } from './types';

export class LocalPresence {
  value: any | undefined;

  sending = false;

  constructor(private doc: Doc) {
    if (doc.otType.transformPresence) {
      doc.addEventListener('op', this.onOp);
    }
  }

  onOp = ({ ops }: OpEvent) => {
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
      presence: {
        version: doc.version,
        content: this.value,
        clientId: doc.clientId,
      },
    });
    this.sending = false;
  }
}
