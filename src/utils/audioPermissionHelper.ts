/**
 * Audio / Microphone Permission Helper
 * Ensures native Android APK and Web browsers prompt for and verify microphone permissions.
 */

export interface MicPermissionResult {
  granted: boolean;
  error?: string;
  source: 'android_native' | 'media_devices' | 'fallback';
}

/**
 * Request microphone permission using both Android Native bridge (if in APK)
 * and navigator.mediaDevices.getUserMedia (standard Web / WebView API).
 */
export async function requestMicrophonePermission(): Promise<MicPermissionResult> {
  // 1. If running inside Android APK with our native bridge
  try {
    const androidBridge = (window as any).AndroidDownloader;
    if (androidBridge && typeof androidBridge.requestMicrophonePermission === 'function') {
      androidBridge.requestMicrophonePermission();
    }
  } catch (err) {
    console.warn('Android native mic permission call error:', err);
  }

  // 2. Request standard browser / WebView media permission
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Crucial: Release tracks immediately so SpeechRecognition can bind freely
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });

      return { granted: true, source: 'media_devices' };
    } catch (err: any) {
      console.warn('getUserMedia audio permission error:', err);
      const isDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('denied');

      return {
        granted: false,
        source: 'media_devices',
        error: isDenied
          ? 'Microphone permission was denied. Please allow microphone in device App Settings or browser permissions.'
          : err.message || 'Microphone could not be accessed.',
      };
    }
  }

  // 3. Fallback for older browsers
  return { granted: true, source: 'fallback' };
}

/**
 * Checks current microphone permission state if supported
 */
export async function checkMicrophonePermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const androidBridge = (window as any).AndroidDownloader;
    if (androidBridge && typeof androidBridge.hasMicrophonePermission === 'function') {
      const hasPerm = androidBridge.hasMicrophonePermission();
      if (hasPerm) return 'granted';
    }
  } catch {
    // ignore
  }

  if (navigator.permissions && typeof navigator.permissions.query === 'function') {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as any });
      return status.state;
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}
