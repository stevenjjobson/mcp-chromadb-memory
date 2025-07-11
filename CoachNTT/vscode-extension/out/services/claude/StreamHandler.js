"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamHandler = void 0;
class StreamHandler {
    constructor() {
        this.buffer = '';
        this.isStreaming = false;
    }
    startStream() {
        this.buffer = '';
        this.isStreaming = true;
    }
    addChunk(chunk) {
        if (this.isStreaming) {
            this.buffer += chunk;
        }
    }
    endStream() {
        this.isStreaming = false;
        const result = this.buffer;
        this.buffer = '';
        return result;
    }
    getBuffer() {
        return this.buffer;
    }
    isActive() {
        return this.isStreaming;
    }
    cancel() {
        this.isStreaming = false;
        this.buffer = '';
    }
}
exports.StreamHandler = StreamHandler;
//# sourceMappingURL=StreamHandler.js.map