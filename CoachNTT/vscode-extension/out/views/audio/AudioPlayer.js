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
exports.AudioPlayer = void 0;
const vscode = __importStar(require("vscode"));
class AudioPlayer {
    static createOrShow(extensionUri, mode = 'panel') {
        if (mode === 'panel') {
            const column = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;
            if (AudioPlayer.currentPlayer) {
                AudioPlayer.currentPlayer._panel.reveal(column);
                return AudioPlayer.currentPlayer;
            }
            const panel = vscode.window.createWebviewPanel('coachntt.audioPlayer', 'CoachNTT Audio Player', column || vscode.ViewColumn.Two, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'node_modules')
                ]
            });
            AudioPlayer.currentPlayer = new AudioPlayer(panel, extensionUri);
            return AudioPlayer.currentPlayer;
        }
        // For embedded mode, return existing instance or create new one
        if (!AudioPlayer.currentPlayer) {
            // Create a hidden panel for embedded mode
            const panel = vscode.window.createWebviewPanel('coachntt.audioPlayer', 'Audio Player', vscode.ViewColumn.Two, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            });
            panel.dispose(); // Immediately dispose the visual panel
            AudioPlayer.currentPlayer = new AudioPlayer(panel, extensionUri);
        }
        return AudioPlayer.currentPlayer;
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this.queue = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(message => {
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
        }, null, this._disposables);
    }
    dispose() {
        AudioPlayer.currentPlayer = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    addToQueue(item) {
        this.queue.push(item);
        this.updateQueue();
        // If nothing is playing, start playing the added item
        if (this.currentIndex === -1) {
            this.currentIndex = this.queue.length - 1;
            this.playCurrentItem();
        }
    }
    addMultipleToQueue(items) {
        const wasEmpty = this.queue.length === 0;
        this.queue.push(...items);
        this.updateQueue();
        if (wasEmpty && items.length > 0) {
            this.currentIndex = 0;
            this.playCurrentItem();
        }
    }
    clearQueue() {
        this.queue = [];
        this.currentIndex = -1;
        this.updateQueue();
        this.sendCommand('stop');
    }
    playUrl(url, title = 'Audio') {
        const item = {
            id: Date.now().toString(),
            url,
            title
        };
        this.addToQueue(item);
    }
    playCurrentItem() {
        if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
            const item = this.queue[this.currentIndex];
            this.sendCommand('loadAndPlay', { item, index: this.currentIndex });
            this.isPlaying = true;
        }
    }
    playNext() {
        if (this.currentIndex < this.queue.length - 1) {
            this.currentIndex++;
            this.playCurrentItem();
        }
    }
    playPrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.playCurrentItem();
        }
    }
    handlePlay() {
        this.isPlaying = true;
        this.sendCommand('play');
    }
    handlePause() {
        this.isPlaying = false;
        this.sendCommand('pause');
    }
    handleSeek(position) {
        this.sendCommand('seek', { position });
    }
    handleVolumeChange(volume) {
        this.sendCommand('setVolume', { volume });
    }
    handleSpeedChange(speed) {
        this.sendCommand('setSpeed', { speed });
    }
    removeFromQueue(index) {
        if (index >= 0 && index < this.queue.length) {
            this.queue.splice(index, 1);
            // Adjust current index if needed
            if (index < this.currentIndex) {
                this.currentIndex--;
            }
            else if (index === this.currentIndex) {
                // If we removed the current item, play the next one
                if (this.currentIndex >= this.queue.length && this.queue.length > 0) {
                    this.currentIndex = this.queue.length - 1;
                }
                if (this.queue.length > 0) {
                    this.playCurrentItem();
                }
                else {
                    this.currentIndex = -1;
                    this.sendCommand('stop');
                }
            }
            this.updateQueue();
        }
    }
    handlePlaybackEnded() {
        // Auto-advance to next item
        if (this.currentIndex < this.queue.length - 1) {
            this.playNext();
        }
        else {
            this.isPlaying = false;
        }
    }
    onPlayerReady() {
        this.updateQueue();
        if (this.currentIndex >= 0) {
            this.playCurrentItem();
        }
    }
    updateQueue() {
        this.sendCommand('updateQueue', {
            queue: this.queue,
            currentIndex: this.currentIndex
        });
    }
    sendCommand(command, data) {
        this._panel.webview.postMessage({ command, ...data });
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.title = 'CoachNTT Audio Player';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'audio-player.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'audio-player.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
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
    play() {
        this.handlePlay();
    }
    pause() {
        this.handlePause();
    }
    toggle() {
        if (this.isPlaying) {
            this.pause();
        }
        else {
            this.play();
        }
    }
    getState() {
        return {
            isPlaying: this.isPlaying,
            queue: this.queue,
            currentIndex: this.currentIndex,
            currentItem: this.currentIndex >= 0 ? this.queue[this.currentIndex] : null
        };
    }
}
exports.AudioPlayer = AudioPlayer;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=AudioPlayer.js.map