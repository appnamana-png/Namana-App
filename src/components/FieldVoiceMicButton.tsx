import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { parseSingleFieldSpokenValue } from '../utils/voiceFieldParser';
import { playVoiceListeningStart, playVoiceFillSuccess } from '../utils/audioNotification';

interface FieldVoiceMicButtonProps {
  fieldKey: string;
  fieldName?: string;
  onValueCaptured: (value: any, extraFields?: Record<string, any>) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  title?: string;
  appendMode?: boolean;
  currentValue?: string;
}

export const FieldVoiceMicButton: React.FC<FieldVoiceMicButtonProps> = ({
  fieldKey,
  fieldName,
  onValueCaptured,
  className = '',
  size = 'sm',
  title,
  appendMode = false,
  currentValue = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const stopListening = (shouldProcess: boolean = true) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        if (shouldProcess) {
          recognitionRef.current.stop();
        } else {
          recognitionRef.current.abort();
        }
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const handleStartListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      stopListening(true);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalCapturedText = '';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setInterimText('');
        playVoiceListeningStart();
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        const currentSpoken = (final || interim).trim();
        setInterimText(currentSpoken);

        if (final) {
          finalCapturedText = final;
        }

        // Snappy auto-stop on silence once speech is heard
        if (currentSpoken.length > 0) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          // Snappy delay: 900ms for short fields (age, phone, name), 1400ms for long text/history
          const delay = ['history', 'notes', 'diagnosis', 'address'].includes(fieldKey) ? 1400 : 900;
          silenceTimerRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              stopListening(true);
            }
          }, delay);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn(`Speech recognition error on ${fieldKey}:`, event?.error);
        if (event.error !== 'no-speech') {
          stopListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const textToProcess = (finalCapturedText || interimText).trim();
        setInterimText('');

        if (textToProcess) {
          const parsed = parseSingleFieldSpokenValue(fieldKey, textToProcess);
          let val = parsed.value !== undefined ? parsed.value : textToProcess;

          if (appendMode && currentValue && typeof val === 'string') {
            val = `${currentValue.trim()} ${val}`.trim();
          }

          onValueCaptured(val, parsed.extraFields);
          playVoiceFillSuccess();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  const displayName = fieldName || fieldKey;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        id={`voice-mic-btn-${fieldKey}`}
        onClick={handleStartListening}
        title={
          title ||
          (isListening
            ? `Listening to ${displayName}... Click to finish`
            : `Click to enter ${displayName} using voice`)
        }
        aria-label={`Voice input for ${displayName}`}
        className={`relative p-1 rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 select-none ${
          isListening
            ? 'text-emerald-600 bg-emerald-50 ring-4 ring-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 active:scale-95'
        } ${className}`}
      >
        {isListening ? (
          <div className="relative flex items-center justify-center">
            {/* Luminous green halo aura */}
            <span className="absolute -inset-1 rounded-full bg-emerald-400/30 pointer-events-none" />
            <Mic className={`${iconSizes[size]} text-emerald-600 stroke-[2.5] relative z-10`} />
          </div>
        ) : (
          <Mic className={`${iconSizes[size]}`} />
        )}
      </button>
    </div>
  );
};
