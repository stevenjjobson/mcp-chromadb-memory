import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ElevenLabsService } from './elevenlabs-service.js';
import { FallbackTTSService } from './fallback-tts-service.js';
import { WindowsAudioEngine } from './engines/windows-audio-engine.js';
import { MacOSAudioEngine } from './engines/macos-audio-engine.js';
import { LinuxAudioEngine } from './engines/linux-audio-engine.js';
import { AudioEngine, TTSEngine, AudioQueueItem, SpeakOptions, AudioState, PlaybackOptions } from './types.js';
import { Memory } from '../../types.js';
import { logger } from '../../logging.js';

export class AudioManager extends EventEmitter {
  private ttsEngine!: TTSEngine;
  private playbackEngine!: AudioEngine;
  private queue: AudioQueueItem[] = [];
  private currentlyPlaying: AudioQueueItem | null = null;
  private isPlaying: boolean = false;
  private volume: number = 1.0;
  private speed: number = 1.0;

  constructor() {
    super();
    this.initializeEngines().catch(error => {
      logger.error('Failed to initialize audio engines:', error);
      this.emit('error', { type: 'initialization_failure', error });
    });
  }

  private async initializeEngines(): Promise<void> {
    // Initialize TTS
    if (this.hasElevenLabsKey()) {
      try {
        this.ttsEngine = new ElevenLabsService(this.getElevenLabsConfig());
        logger.info('Initialized ElevenLabs TTS service');
      } catch (error) {
        logger.warn('Failed to initialize ElevenLabs, falling back to system TTS:', error);
        this.ttsEngine = new FallbackTTSService();
      }
    } else {
      this.ttsEngine = new FallbackTTSService();
      logger.info('Using fallback TTS service');
    }
    
    // Initialize platform-specific playback
    try {
      switch (process.platform) {
        case 'win32':
          this.playbackEngine = new WindowsAudioEngine();
          break;
        case 'darwin':
          this.playbackEngine = new MacOSAudioEngine();
          break;
        case 'linux':
          this.playbackEngine = new LinuxAudioEngine();
          break;
        default:
          throw new Error(`Unsupported platform: ${process.platform}`);
      }
      
      await this.playbackEngine.initialize();
      this.setupPlaybackListeners();
      logger.info(`Initialized ${process.platform} audio engine`);
    } catch (error) {
      logger.error('Failed to initialize playback engine:', error);
      throw error;
    }
  }

  private setupPlaybackListeners(): void {
    this.playbackEngine.on('playbackComplete', () => {
      this.handlePlaybackComplete();
    });

    this.playbackEngine.on('playbackError', (error) => {
      this.emit('error', { type: 'playback_error', error });
    });

    this.playbackEngine.on('positionChanged', (position) => {
      this.emit('positionChanged', position);
    });
  }

  private hasElevenLabsKey(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  private getElevenLabsConfig() {
    return {
      apiKey: process.env.ELEVENLABS_API_KEY!,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1',
      stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
      similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.5'),
      style: parseFloat(process.env.ELEVENLABS_STYLE || '0'),
      useSpeakerBoost: process.env.ELEVENLABS_SPEAKER_BOOST === 'true'
    };
  }

  async speakMemory(memory: Memory, options?: SpeakOptions): Promise<void> {
    try {
      const audioBuffer = await this.ttsEngine.synthesize(memory.content, {
        voice: options?.voice,
        speed: options?.speed || this.speed
      });
      
      const queueItem: AudioQueueItem = {
        id: uuidv4(),
        buffer: audioBuffer,
        metadata: {
          type: 'memory',
          memoryId: memory.id,
          text: memory.content,
          title: `Memory: ${memory.content.substring(0, 50)}...`
        },
        priority: options?.priority || 'normal'
      };
      
      if (options?.immediate) {
        await this.playImmediate(queueItem);
      } else {
        this.enqueue(queueItem);
      }
    } catch (error) {
      logger.error('Failed to speak memory:', error);
      this.emit('error', { type: 'tts_failure', error });
    }
  }

  async speakText(text: string, options?: SpeakOptions): Promise<void> {
    try {
      const audioBuffer = await this.ttsEngine.synthesize(text, {
        voice: options?.voice,
        speed: options?.speed || this.speed
      });
      
      const queueItem: AudioQueueItem = {
        id: uuidv4(),
        buffer: audioBuffer,
        metadata: {
          type: 'text',
          text,
          title: options?.title || `Text: ${text.substring(0, 50)}...`
        },
        priority: options?.priority || 'normal'
      };
      
      if (options?.immediate) {
        await this.playImmediate(queueItem);
      } else {
        this.enqueue(queueItem);
      }
    } catch (error) {
      logger.error('Failed to speak text:', error);
      this.emit('error', { type: 'tts_failure', error });
    }
  }

  async speakCodeExplanation(code: string, explanation: string, options?: SpeakOptions): Promise<void> {
    const combined = `Here's the code explanation: ${explanation}`;
    await this.speakText(combined, {
      ...options,
      title: 'Code Explanation'
    });
  }

  private enqueue(item: AudioQueueItem): void {
    // Insert based on priority
    if (item.priority === 'high') {
      // Insert after currently playing item
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }
    
    this.emit('queueUpdated', this.getQueueState());
    
    // Start playing if not already playing
    if (!this.isPlaying && !this.currentlyPlaying) {
      this.playNext();
    }
  }

  private async playImmediate(item: AudioQueueItem): Promise<void> {
    // Stop current playback
    if (this.isPlaying) {
      await this.stop();
    }
    
    // Play immediately
    this.currentlyPlaying = item;
    await this.playItem(item);
  }

  private async playItem(item: AudioQueueItem): Promise<void> {
    try {
      this.isPlaying = true;
      this.emit('playbackStarted', item);
      
      await this.playbackEngine.play(item.buffer, {
        volume: this.volume,
        rate: this.speed
      });
    } catch (error) {
      logger.error('Playback error:', error);
      this.isPlaying = false;
      this.currentlyPlaying = null;
      this.emit('error', { type: 'playback_error', error });
      
      // Try next item in queue
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    const nextItem = this.queue.shift();
    if (nextItem) {
      this.currentlyPlaying = nextItem;
      await this.playItem(nextItem);
    } else {
      this.currentlyPlaying = null;
      this.isPlaying = false;
      this.emit('queueEmpty');
    }
  }

  private handlePlaybackComplete(): void {
    this.isPlaying = false;
    this.emit('playbackComplete', this.currentlyPlaying);
    this.currentlyPlaying = null;
    this.playNext();
  }

  async play(): Promise<void> {
    if (!this.isPlaying && this.queue.length > 0) {
      this.playNext();
    }
  }

  async pause(): Promise<void> {
    if (this.isPlaying) {
      await this.playbackEngine.pause();
      this.isPlaying = false;
      this.emit('playbackPaused');
    }
  }

  async resume(): Promise<void> {
    if (!this.isPlaying && this.currentlyPlaying) {
      await this.playbackEngine.resume();
      this.isPlaying = true;
      this.emit('playbackResumed');
    }
  }

  async stop(): Promise<void> {
    if (this.isPlaying || this.currentlyPlaying) {
      await this.playbackEngine.stop();
      this.isPlaying = false;
      this.currentlyPlaying = null;
      this.emit('playbackStopped');
    }
  }

  async skip(): Promise<void> {
    if (this.isPlaying) {
      await this.stop();
      this.playNext();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.isPlaying) {
      this.playbackEngine.setVolume(this.volume);
    }
    this.emit('volumeChanged', this.volume);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(2, speed));
    this.emit('speedChanged', this.speed);
  }

  clearQueue(): void {
    this.queue = [];
    this.emit('queueUpdated', this.getQueueState());
  }

  removeFromQueue(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
    this.emit('queueUpdated', this.getQueueState());
  }

  getState(): AudioState {
    return {
      isPlaying: this.isPlaying,
      currentItem: this.currentlyPlaying,
      queue: this.queue,
      volume: this.volume,
      speed: this.speed,
      position: 0, // TODO: Get from playback engine
      duration: this.currentlyPlaying?.buffer.duration || 0
    };
  }

  private getQueueState() {
    return this.queue.map(item => ({
      id: item.id,
      title: item.metadata.title,
      priority: item.priority
    }));
  }

  async getAvailableVoices() {
    return this.ttsEngine.getVoices();
  }

  async getAudioDevices() {
    return this.playbackEngine.getDevices();
  }

  async setAudioDevice(deviceId: string) {
    await this.playbackEngine.setDevice(deviceId);
  }
}