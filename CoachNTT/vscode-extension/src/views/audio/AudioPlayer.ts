import * as vscode from 'vscode';

export interface AudioItem {
    id: string;
    url: string;
    title: string;
    duration?: number;
    metadata?: any;
}

export class AudioPlayer {
    private static currentPlayer: AudioPlayer | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private queue: AudioItem[] = [];
    private currentIndex: number = -1;
    private isPlaying: boolean = false;

    public static createOrShow(extensionUri: vscode.Uri, mode: 'panel' | 'embedded' = 'panel') {
        if (mode === 'panel') {
            const column = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;

            if (AudioPlayer.currentPlayer) {
                AudioPlayer.currentPlayer._panel.reveal(column);
                return AudioPlayer.currentPlayer;
            }

            const panel = vscode.window.createWebviewPanel(
                'coachntt.audioPlayer',
                'CoachNTT Audio Player',
                column || vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(extensionUri, 'media'),
                        vscode.Uri.joinPath(extensionUri, 'node_modules')
                    ]
                }
            );

            AudioPlayer.currentPlayer = new AudioPlayer(panel, extensionUri);
            return AudioPlayer.currentPlayer;
        }
        
        // For embedded mode, return existing instance or create new one
        if (!AudioPlayer.currentPlayer) {
            // Create a hidden panel for embedded mode
            const panel = vscode.window.createWebviewPanel(
                'coachntt.audioPlayer',
                'Audio Player',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(extensionUri, 'media')
                    ]
                }
            );
            panel.dispose(); // Immediately dispose the visual panel
            AudioPlayer.currentPlayer = new AudioPlayer(panel, extensionUri);
        }
        
        return AudioPlayer.currentPlayer;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'play':
                        this.handlePlay();
                        break;
                    case 'pause':
                        this.handlePause();
                        break;
                    case 'next':
                        this.playNext();
                        break;
                    case 'previous':
                        this.playPrevious();
                        break;
                    case 'seek':
                        this.handleSeek(message.position);
                        break;
                    case 'volume':
                        this.handleVolumeChange(message.volume);
                        break;
                    case 'speed':
                        this.handleSpeedChange(message.speed);
                        break;
                    case 'removeFromQueue':
                        this.removeFromQueue(message.index);
                        break;
                    case 'playbackEnded':
                        this.handlePlaybackEnded();
                        break;
                    case 'ready':
                        this.onPlayerReady();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        AudioPlayer.currentPlayer = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public addToQueue(item: AudioItem) {
        this.queue.push(item);
        this.updateQueue();
        
        // If nothing is playing, start playing the added item
        if (this.currentIndex === -1) {
            this.currentIndex = this.queue.length - 1;
            this.playCurrentItem();
        }
    }

    public addMultipleToQueue(items: AudioItem[]) {
        const wasEmpty = this.queue.length === 0;
        this.queue.push(...items);
        this.updateQueue();
        
        if (wasEmpty && items.length > 0) {
            this.currentIndex = 0;
            this.playCurrentItem();
        }
    }

    public clearQueue() {
        this.queue = [];
        this.currentIndex = -1;
        this.updateQueue();
        this.sendCommand('stop');
    }

    public playUrl(url: string, title: string = 'Audio') {
        const item: AudioItem = {
            id: Date.now().toString(),
            url,
            title
        };
        this.addToQueue(item);
    }

    private playCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
            const item = this.queue[this.currentIndex];
            this.sendCommand('loadAndPlay', { item, index: this.currentIndex });
            this.isPlaying = true;
        }
    }

    private playNext() {
        if (this.currentIndex < this.queue.length - 1) {
            this.currentIndex++;
            this.playCurrentItem();
        }
    }

    private playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.playCurrentItem();
        }
    }

    private handlePlay() {
        this.isPlaying = true;
        this.sendCommand('play');
    }

    private handlePause() {
        this.isPlaying = false;
        this.sendCommand('pause');
    }

    private handleSeek(position: number) {
        this.sendCommand('seek', { position });
    }

    private handleVolumeChange(volume: number) {
        this.sendCommand('setVolume', { volume });
    }

    private handleSpeedChange(speed: number) {
        this.sendCommand('setSpeed', { speed });
    }

    private removeFromQueue(index: number) {
        if (index >= 0 && index < this.queue.length) {
            this.queue.splice(index, 1);
            
            // Adjust current index if needed
            if (index < this.currentIndex) {
                this.currentIndex--;
            } else if (index === this.currentIndex) {
                // If we removed the current item, play the next one
                if (this.currentIndex >= this.queue.length && this.queue.length > 0) {
                    this.currentIndex = this.queue.length - 1;
                }
                if (this.queue.length > 0) {
                    this.playCurrentItem();
                } else {
                    this.currentIndex = -1;
                    this.sendCommand('stop');
                }
            }
            
            this.updateQueue();
        }
    }

    private handlePlaybackEnded() {
        // Auto-advance to next item
        if (this.currentIndex < this.queue.length - 1) {
            this.playNext();
        } else {
            this.isPlaying = false;
        }
    }

    private onPlayerReady() {
        this.updateQueue();
        if (this.currentIndex >= 0) {
            this.playCurrentItem();
        }
    }

    private updateQueue() {
        this.sendCommand('updateQueue', { 
            queue: this.queue, 
            currentIndex: this.currentIndex 
        });
    }

    private sendCommand(command: string, data?: any) {
        this._panel.webview.postMessage({ command, ...data });
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'CoachNTT Audio Player';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'audio-player.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'audio-player.css')
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https: http: data:; img-src ${webview.cspSource} https: http: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
                <link href="${styleUri}" rel="stylesheet">
                <link href="${codiconsUri}" rel="stylesheet">
                <title>Audio Player</title>
            </head>
            <body>
                <div id="audio-player-container">
                    <div id="now-playing">
                        <h3 id="track-title">No track loaded</h3>
                        <div id="waveform-container">
                            <canvas id="waveform"></canvas>
                            <div id="progress-bar">
                                <div id="progress-fill"></div>
                            </div>
                        </div>
                        <div id="time-display">
                            <span id="current-time">0:00</span>
                            <span id="duration">0:00</span>
                        </div>
                    </div>
                    
                    <div id="controls">
                        <button id="prev-button" class="control-button" title="Previous">
                            <i class="codicon codicon-debug-reverse-continue"></i>
                        </button>
                        <button id="play-pause-button" class="control-button primary" title="Play/Pause">
                            <i class="codicon codicon-play"></i>
                        </button>
                        <button id="next-button" class="control-button" title="Next">
                            <i class="codicon codicon-debug-continue"></i>
                        </button>
                        
                        <div class="control-separator"></div>
                        
                        <div class="volume-control">
                            <i class="codicon codicon-unmute"></i>
                            <input type="range" id="volume-slider" min="0" max="100" value="80">
                        </div>
                        
                        <div class="speed-control">
                            <select id="speed-select">
                                <option value="0.5">0.5x</option>
                                <option value="0.75">0.75x</option>
                                <option value="1" selected>1x</option>
                                <option value="1.25">1.25x</option>
                                <option value="1.5">1.5x</option>
                                <option value="2">2x</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="queue-container">
                        <h4>Queue <span id="queue-count">(0)</span></h4>
                        <div id="queue-list"></div>
                    </div>
                    
                    <audio id="audio-element" crossorigin="anonymous"></audio>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    // Public methods for external control
    public play() {
        this.handlePlay();
    }

    public pause() {
        this.handlePause();
    }

    public toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    public getState() {
        return {
            isPlaying: this.isPlaying,
            queue: this.queue,
            currentIndex: this.currentIndex,
            currentItem: this.currentIndex >= 0 ? this.queue[this.currentIndex] : null
        };
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}