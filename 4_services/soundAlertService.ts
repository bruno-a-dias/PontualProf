import { Vibration } from 'react-native';
import { Audio } from 'expo-av';

/**
 * Serviço responsável por emitir o alerta sonoro e vibração tátil
 * quando a janela de ponto eletrônico (15 min antes até 15 min após) é aberta.
 */
class SoundAlertService {
  private isMuted: boolean = false;
  private lastTriggeredKey: string = '';

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public async triggerPontoAlert(alertKey?: string, force: boolean = false): Promise<void> {
    if (this.isMuted && !force) return;
    if (alertKey && this.lastTriggeredKey === alertKey && !force) return;

    if (alertKey) {
      this.lastTriggeredKey = alertKey;
    }

    // Vibração padrão mobile
    Vibration.vibrate([0, 300, 150, 400]);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      // Em produção mobile, carrega o asset local ou data URI WAV gerado em memória
      const { sound } = await Audio.Sound.createAsync(
        { uri: createBeepWavDataUri() },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch {
      // Fallback silencioso se o dispositivo não possuir hardware de áudio ativo
    }
  }
}

/**
 * Gera um pequeno arquivo WAV (440Hz/880Hz chime) em Base64 Data URI
 * para que o alerta sonoro funcione 100% offline sem depender de arquivos externos.
 */
function createBeepWavDataUri(): string {
  const sampleRate = 8000;
  const durationSeconds = 0.35;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Uint8Array(44 + numSamples);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
  };
  const write32 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
    buffer[offset + 2] = (val >> 16) & 0xff;
    buffer[offset + 3] = (val >> 24) & 0xff;
  };
  const write16 = (offset: number, val: number) => {
    buffer[offset] = val & 0xff;
    buffer[offset + 1] = (val >> 8) & 0xff;
  };

  writeStr(0, 'RIFF');
  write32(4, 36 + numSamples);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  write32(16, 16);
  write16(20, 1);
  write16(22, 1);
  write32(24, sampleRate);
  write32(28, sampleRate);
  write16(32, 1);
  write16(34, 8);
  writeStr(36, 'data');
  write32(40, numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = i < numSamples / 2 ? 660 : 880;
    const sample = Math.sin(2 * Math.PI * freq * t);
    buffer[44 + i] = Math.floor((sample * 0.5 + 0.5) * 255);
  }

  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
  return `data:audio/wav;base64,${base64}`;
}

export const soundAlertService = new SoundAlertService();
