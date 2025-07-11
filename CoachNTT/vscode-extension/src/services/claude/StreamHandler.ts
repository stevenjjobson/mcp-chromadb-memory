export class StreamHandler {
    private buffer: string = '';
    private isStreaming: boolean = false;

    public startStream(): void {
        this.buffer = '';
        this.isStreaming = true;
    }

    public addChunk(chunk: string): void {
        if (this.isStreaming) {
            this.buffer += chunk;
        }
    }

    public endStream(): string {
        this.isStreaming = false;
        const result = this.buffer;
        this.buffer = '';
        return result;
    }

    public getBuffer(): string {
        return this.buffer;
    }

    public isActive(): boolean {
        return this.isStreaming;
    }

    public cancel(): void {
        this.isStreaming = false;
        this.buffer = '';
    }
}