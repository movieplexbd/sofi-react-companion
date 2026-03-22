import { useState, useCallback, useRef, useEffect } from 'react';
import { FaPaperPlane, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa6';

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
}

export default function InputArea({ onSend, disabled, placeholder }: InputAreaProps) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }, [text, disabled, onSend]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Voice input via Web Speech API
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(prev => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const hasSpeech = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-t border-border/30 flex-shrink-0 bg-card"
      style={{ boxShadow: '0 -3px 14px rgba(0,0,0,0.05)' }}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyPress}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 border-none rounded-3xl text-sm outline-none bg-background text-foreground font-bengali transition-all duration-200 focus:bg-card focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),0_0_0_3px_hsl(var(--primary)/0.18)]"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.07)' }}
      />
      {hasSpeech && (
        <button
          onClick={toggleVoice}
          disabled={disabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isListening ? 'bg-sofia-red text-white animate-pulse' : 'bg-primary/10 text-primary hover:bg-primary/20'
          } disabled:opacity-45`}
        >
          {isListening ? <FaMicrophoneSlash size={16} /> : <FaMicrophone size={16} />}
        </button>
      )}
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="w-11 h-11 rounded-full flex items-center justify-center text-primary-foreground transition-all hover:scale-105 hover:-translate-y-0.5 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none flex-shrink-0"
        style={{ background: 'var(--header-gradient)', boxShadow: '0 3px 10px hsl(var(--primary) / 0.4)' }}
      >
        <FaPaperPlane size={16} />
      </button>
    </div>
  );
}
