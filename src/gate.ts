// possibly an over-abstraction, but:
// multiple listeners may block on a gate. only one will do the action, but
// everyone will wake when the action is done.
export class Gate {
  gate: Promise<void> | undefined;

  constructor(public action: () => Promise<void>) {
    // pass
  }

  async wait() {
    if (!this.gate) this.gate = new Promise(async resolve => {
      await this.action();
      delete this.gate;
      resolve();
    });
    await this.gate;
  }
}
