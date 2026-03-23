import { useState, useCallback, useRef, useEffect } from 'react';
import { FaPaperPlane, FaMicrophone, FaMicrophoneSlash, FaFaceSmile } from 'react-icons/fa6';

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
    <div className="flex items-center gap-1.5 px-2 py-1.5 flex-shrink-0 bg-card border-t border-border/20">
      {/* Emoji placeholder */}
      <button className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors rounded-full">
        <FaFaceSmile size={20} />
      </button>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyPress}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 border-none rounded-2xl text-sm outline-none bg-background text-foreground font-bengali transition-all focus:ring-1 focus:ring-primary/20"
      />

      {/* Mic or Send */}
      {text.trim() ? (
        <button
          onClick={handleSend}
          disabled={disabled}
          className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-45 flex-shrink-0"
          style={{ background: 'var(--header-gradient)' }}
        >
          <FaPaperPlane size={16} />
        </button>
      ) : hasSpeech ? (
        <button
          onClick={toggleVoice}
          disabled={disabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0 ${
            isListening
              ? 'bg-destructive text-white animate-pulse'
              : 'text-primary-foreground'
          } disabled:opacity-45`}
          style={!isListening ? { background: 'var(--header-gradient)' } : undefined}
        >
          {isListening ? <FaMicrophoneSlash size={16} /> : <FaMicrophone size={16} />}
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={true}
          className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground opacity-45 flex-shrink-0"
          style={{ background: 'var(--header-gradient)' }}
        >
          <FaPaperPlane size={16} />
        </button>
      )}
    </div>
  );
}
