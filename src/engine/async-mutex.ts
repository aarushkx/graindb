export class AsyncMutex {
    private locked = false;
    private waiters: Array<() => void> = [];

    async acquire(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return () => this.release();
        }
        await new Promise<void>((resolve) => {
            this.waiters.push(resolve);
        });
        return () => this.release();
    }

    private release(): void {
        const next = this.waiters.shift();
        if (next) {
            next();
            return;
        }
        this.locked = false;
    }
}
