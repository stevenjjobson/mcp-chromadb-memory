import * as vscode from 'vscode';
import { MCPClient } from './mcp-client';

export interface AudioPlaybackState {
    isPlaying: boolean;
    currentUrl?: string;
    currentText?: string;
    volume: number;
    speed: number;
}

export class AudioController {
    private mcpClient: MCPClient;
    private audioQueue: AudioQueueItem[] = [];
    private currentAudio: any = null; // HTMLAudioElement not available in Node.js context
    private playbackState: AudioPlaybackState = {
        isPlaying: false,
        volume: 0.8,
        speed: 1.0
    };
    private statusBarItem: vscode.StatusBarItem;
    private onStateChangeEmitter = new vscode.EventEmitter<AudioPlaybackState>();
    public readonly onStateChange = this.onStateChangeEmitter.event;

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        
        // Create status bar item for audio controls
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
        this.updateStatusBar();
    }

    /**
     * Synthesize and play audio from text
     */
    async synthesizeAndPlay(text: string, voiceId?: string): Promise<void> {
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
            const queueItem: AudioQueueItem = {
                id: Date.now().toString(),
                text: text,
                audioUrl: response.audio_url,
                voiceId: response.voice_id,
                duration: response.duration
            };

            this.addToQueue(queueItem);
            
            // Auto-play if enabled
            const config = vscode.workspace.getConfiguration('coachntt');
            if (config.get<boolean>('audio.autoPlay', false)) {
                await this.play();
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Audio synthesis failed: ${error}`);
            throw error;
        }
    }

    /**
     * Add audio to the playback queue
     */
    addToQueue(item: AudioQueueItem): void {
        const config = vscode.workspace.getConfiguration('coachntt');
        const queueBehavior = config.get<string>('audio.queueBehavior', 'append');

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
    async play(): Promise<void> {
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
    pause(): void {
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
    stop(): void {
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
    skip(): void {
        this.stop();
        if (this.audioQueue.length > 0) {
            this.audioQueue.shift();
            this.play();
        }
    }

    /**
     * Clear the audio queue
     */
    clearQueue(): void {
        this.audioQueue = [];
        this.updateStatusBar();
    }

    /**
     * Get the current queue
     */
    getQueue(): AudioQueueItem[] {
        return [...this.audioQueue];
    }

    /**
     * Get available voices
     */
    async getAvailableVoices(): Promise<any[]> {
        if (!this.mcpClient.isConnected()) {
            throw new Error('Not connected to MCP server');
        }

        try {
            const result = await this.mcpClient.getAvailableVoices();
            const voices = JSON.parse(result.content?.[0]?.text || '[]');
            return voices;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get voices: ${error}`);
            throw error;
        }
    }

    /**
     * Update the status bar item
     */
    private updateStatusBar(): void {
        const config = vscode.workspace.getConfiguration('coachntt');
        if (!config.get<boolean>('audio.showStatusBar', true)) {
            this.statusBarItem.hide();
            return;
        }

        if (this.audioQueue.length > 0) {
            this.statusBarItem.text = `$(play-circle) Audio Queue: ${this.audioQueue.length}`;
            this.statusBarItem.tooltip = 'Click to view audio queue';
            this.statusBarItem.command = 'coachntt.audio.showControls';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
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
    dispose(): void {
        this.stop();
        this.clearQueue();
        this.statusBarItem.dispose();
        this.onStateChangeEmitter.dispose();
    }
}

interface AudioQueueItem {
    id: string;
    text: string;
    audioUrl: string;
    voiceId?: string;
    duration?: number;
}