import { AudioSynthesisRequest, AudioSynthesisResponse, Voice, AudioError } from '../../../shared/types';
import { logger } from './logger';

interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  defaultModelId?: string;
}

export class AudioSynthesisService {
  private config: ElevenLabsConfig;
  private voiceCache: Map<string, Voice> = new Map();
  private lastVoiceUpdate: number = 0;
  private readonly VOICE_CACHE_TTL = 3600000; // 1 hour

  constructor() {
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE || '21m00Tcm4TlvDq8ikWAM',
      defaultModelId: process.env.ELEVENLABS_MODEL || 'eleven_monolingual_v1'
    };

    if (!this.config.apiKey) {
      logger.warn('ElevenLabs API key not configured. Audio synthesis will not be available.');
    }
  }

  async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResponse> {
    if (!this.config.apiKey) {
      throw this.createError('SYNTHESIS_FAILED', 'ElevenLabs API key not configured');
    }

    const voiceId = request.options?.voice || this.config.defaultVoiceId;
    
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.config.apiKey
        },
        body: JSON.stringify({
          text: request.text,
          model_id: this.config.defaultModelId,
          voice_settings: {
            stability: request.options?.stability || 0.5,
            similarity_boost: request.options?.similarityBoost || 0.5,
            style: request.options?.style || 0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw this.createError('SYNTHESIS_FAILED', `ElevenLabs API error: ${response.status} - ${error}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioData = Buffer.from(audioBuffer).toString('base64');
      
      // Get voice info for metadata
      const voice = await this.getVoice(voiceId);

      return {
        audioData,
        mimeType: 'audio/mpeg',
        duration: this.estimateDuration(request.text), // Rough estimate
        metadata: {
          voice: voice?.name || voiceId,
          model: this.config.defaultModelId!,
          characterCount: request.text.length
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      logger.error('Audio synthesis error:', error);
      throw this.createError('SYNTHESIS_FAILED', 'Failed to synthesize audio', error);
    }
  }

  async getVoices(): Promise<Voice[]> {
    if (!this.config.apiKey) {
      return [];
    }

    // Check cache
    if (Date.now() - this.lastVoiceUpdate < this.VOICE_CACHE_TTL && this.voiceCache.size > 0) {
      return Array.from(this.voiceCache.values());
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      const voices: Voice[] = data.voices.map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        description: v.description,
        labels: v.labels,
        previewUrl: v.preview_url,
        category: v.category
      }));

      // Update cache
      this.voiceCache.clear();
      voices.forEach(voice => this.voiceCache.set(voice.id, voice));
      this.lastVoiceUpdate = Date.now();

      return voices;
    } catch (error) {
      logger.error('Failed to fetch voices:', error);
      return Array.from(this.voiceCache.values()); // Return cached voices on error
    }
  }

  async getVoice(voiceId: string): Promise<Voice | undefined> {
    if (this.voiceCache.has(voiceId)) {
      return this.voiceCache.get(voiceId);
    }

    // Refresh cache and try again
    await this.getVoices();
    return this.voiceCache.get(voiceId);
  }

  async checkQuota(): Promise<{ charactersUsed: number; charactersLimit: number }> {
    if (!this.config.apiKey) {
      return { charactersUsed: 0, charactersLimit: 0 };
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': this.config.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        charactersUsed: data.subscription.character_count,
        charactersLimit: data.subscription.character_limit
      };
    } catch (error) {
      logger.error('Failed to check quota:', error);
      return { charactersUsed: 0, charactersLimit: 0 };
    }
  }

  private estimateDuration(text: string): number {
    // Rough estimate: ~150 words per minute, ~5 characters per word
    const words = text.length / 5;
    const minutes = words / 150;
    return minutes * 60; // Return seconds
  }

  private createError(code: AudioError['code'], message: string, details?: any): AudioError {
    return {
      code,
      message,
      details
    };
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }
}