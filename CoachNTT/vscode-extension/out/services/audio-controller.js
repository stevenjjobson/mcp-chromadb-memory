"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioController = void 0;
const vscode = __importStar(require("vscode"));
class AudioController {
    constructor(mcpClient) {
        this.audioQueue = [];
        this.currentAudio = null; // HTMLAudioElement not available in Node.js context
        this.playbackState = {
            isPlaying: false,
            volume: 0.8,
            speed: 1.0
        };
        this.onStateChangeEmitter = new vscode.EventEmitter();
        this.onStateChange = this.onStateChangeEmitter.event;
        this.mcpClient = mcpClient;
        // Create status bar item for audio controls
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.updateStatusBar();
    }
    /**
     * Synthesize and play audio from text
     */
    async synthesizeAndPlay(text, voiceId) {
        if (!this.mcpClient.isConnected()) {
            throw new Error('Not connected to MCP server');
        }
        try {
            // Synthesize audio
            const result = await this.mcpClient.synthesizeAudio(text, voiceId);
            const response = JSON.parse(result.content?.[0]?.text || '{}');
            if (!response.audio_url) {
                throw new Error('No audio URL returned from synthesis');
            }
            // Add to queue
            const queueItem = {
                id: Date.now().toString(),
                text: text,
                audioUrl: response.audio_url,
                voiceId: response.voice_id,
                duration: response.duration
            };
            this.addToQueue(queueItem);
            // Auto-play if enabled
            const config = vscode.workspace.getConfiguration('coachntt');
            if (config.get('audio.autoPlay', false)) {
                await this.play();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Audio synthesis failed: ${error}`);
            throw error;
        }
    }
    /**
     * Add audio to the playback queue
     */
    addToQueue(item) {
        const config = vscode.workspace.getConfiguration('coachntt');
        const queueBehavior = config.get('audio.queueBehavior', 'append');
        switch (queueBehavior) {
            case 'replace':
                this.audioQueue = [item];
                if (this.playbackState.isPlaying) {
                    this.stop();
                    this.play();
                }
                break;
            case 'interrupt':
                this.audioQueue.unshift(item);
                if (this.playbackState.isPlaying) {
                    this.stop();
                    this.play();
                }
                break;
            case 'append':
            default:
                this.audioQueue.push(item);
                break;
        }
        this.updateStatusBar();
    }
    /**
     * Play the next item in the queue
     */
    async play() {
        if (this.audioQueue.length === 0) {
            vscode.window.showInformationMessage('Audio queue is empty');
            return;
        }
        const item = this.audioQueue[0];
        // For now, just open the audio URL in the browser
        // TODO: Implement proper audio playback within VSCode
        vscode.env.openExternal(vscode.Uri.parse(item.audioUrl));
        // Remove from queue
        this.audioQueue.shift();
        this.updateStatusBar();
    }
    /**
     * Pause audio playback
     */
    pause() {
        if (this.currentAudio && this.playbackState.isPlaying) {
            // TODO: Implement actual pause functionality
            this.playbackState.isPlaying = false;
            this.updateStatusBar();
            this.onStateChangeEmitter.fire(this.playbackState);
        }
    }
    /**
     * Stop audio playback
     */
    stop() {
        if (this.currentAudio) {
            // TODO: Implement actual stop functionality
            this.currentAudio = null;
            this.playbackState.isPlaying = false;
            this.playbackState.currentUrl = undefined;
            this.playbackState.currentText = undefined;
            this.updateStatusBar();
            this.onStateChangeEmitter.fire(this.playbackState);
        }
    }
    /**
     * Skip to next audio in queue
     */
    skip() {
        this.stop();
        if (this.audioQueue.length > 0) {
            this.audioQueue.shift();
            this.play();
        }
    }
    /**
     * Clear the audio queue
     */
    clearQueue() {
        this.audioQueue = [];
        this.updateStatusBar();
    }
    /**
     * Get the current queue
     */
    getQueue() {
        return [...this.audioQueue];
    }
    /**
     * Get available voices
     */
    async getAvailableVoices() {
        if (!this.mcpClient.isConnected()) {
            throw new Error('Not connected to MCP server');
        }
        try {
            const result = await this.mcpClient.getAvailableVoices();
            const voices = JSON.parse(result.content?.[0]?.text || '[]');
            return voices;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get voices: ${error}`);
            throw error;
        }
    }
    /**
     * Update the status bar item
     */
    updateStatusBar() {
        const config = vscode.workspace.getConfiguration('coachntt');
        if (!config.get('audio.showStatusBar', true)) {
            this.statusBarItem.hide();
            return;
        }
        if (this.audioQueue.length > 0) {
            this.statusBarItem.text = `$(play-circle) Audio Queue: ${this.audioQueue.length}`;
            this.statusBarItem.tooltip = 'Click to view audio queue';
            this.statusBarItem.command = 'coachntt.audio.showControls';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        }
        else {
            this.statusBarItem.text = '$(play-circle) Audio';
            this.statusBarItem.tooltip = 'No audio in queue';
            this.statusBarItem.command = 'coachntt.audio.showControls';
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.show();
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.stop();
        this.clearQueue();
        this.statusBarItem.dispose();
        this.onStateChangeEmitter.dispose();
    }
}
exports.AudioController = AudioController;
//# sourceMappingURL=audio-controller.js.map