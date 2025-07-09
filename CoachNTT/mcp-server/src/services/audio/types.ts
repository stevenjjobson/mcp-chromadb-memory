export interface AudioBuffer {
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

export interface Voice {
  id: string;
  name: string;
  labels?: Record<string, string>;
  preview_url?: string;
  category?: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface PlaybackOptions {
  volume?: number;
  rate?: number;
  loop?: boolean;
}

export interface SpeakOptions {
  voice?: string;
  speed?: number;
  priority?: 'low' | 'normal' | 'high';
  immediate?: boolean;
  title?: string;
  announcement?: string;
  queue?: boolean;
}

export interface AudioQueueItem {
  id: string;
  buffer: AudioBuffer;
  metadata: {
    type: 'memory' | 'text' | 'code_explanation';
    memoryId?: string;
    text: string;
    title?: string;
    code?: string;
    explanation?: string;
  };
  priority: 'low' | 'normal' | 'high';
}

export interface AudioState {
  isPlaying: boolean;
  currentItem: AudioQueueItem | null;
  queue: AudioQueueItem[];
  volume: number;
  speed: number;
  position: number;
  duration: number;
}

export interface AudioError {
  type: 'initialization_failure' | 'tts_failure' | 'playback_error';
  error: Error;
}

export interface TTSEngine {
  synthesize(text: string, options?: TTSOptions): Promise<AudioBuffer>;
  getVoices(): Promise<Voice[]>;
}

export interface AudioEngine {
  initialize(): Promise<void>;
  play(buffer: AudioBuffer, options?: PlaybackOptions): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): void;
  getDevices(): Promise<AudioDevice[]>;
  setDevice(deviceId: string): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}