/**
 * Shared audio types for CoachNTT
 * Used by both MCP server and VSCode extension
 */

export interface AudioSynthesisRequest {
  text: string;
  options?: {
    voice?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
    style?: number;
    stability?: number;
    similarityBoost?: number;
  };
}

export interface AudioSynthesisResponse {
  audioData: string; // Base64 encoded audio
  mimeType: string;
  duration: number;
  metadata: {
    voice: string;
    model: string;
    characterCount: number;
  };
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
}

export interface AudioQueueItem {
  id: string;
  text: string;
  title?: string;
  audioData?: string;
  status: 'pending' | 'synthesizing' | 'ready' | 'playing' | 'completed' | 'error';
  error?: string;
  metadata?: {
    source: 'memory' | 'code' | 'user' | 'system';
    memoryId?: string;
    timestamp: number;
  };
}

export interface Voice {
  id: string;
  name: string;
  description?: string;
  labels?: Record<string, string>;
  previewUrl?: string;
  category?: string;
  language?: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
  isActive: boolean;
}

export interface AudioSettings {
  defaultVoice?: string;
  defaultSpeed: number;
  defaultVolume: number;
  autoPlay: boolean;
  queueBehavior: 'append' | 'replace' | 'interrupt';
  enableNotifications: boolean;
  cacheAudio: boolean;
  maxCacheSize: number; // MB
}

export interface AudioError {
  code: 'SYNTHESIS_FAILED' | 'PLAYBACK_FAILED' | 'INVALID_AUDIO' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR';
  message: string;
  details?: any;
}