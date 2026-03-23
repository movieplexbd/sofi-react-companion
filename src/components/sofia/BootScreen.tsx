import { useEffect, useState } from 'react';

export interface BootStep {
  id: number;
  text: string;
  status: 'pending' | 'active' | 'done';
}

interface BootScreenProps {
  steps: BootStep[];
  progress: number;
  visible: boolean;
}

export default function BootScreen({ steps, progress, visible }: BootScreenProps) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!visible) setOpacity(0);
  }, [visible]);

  if (!visible && opacity === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4"
      style={{
        background: 'hsl(var(--primary))',
        opacity,
        transition: 'opacity 0.4s',
      }}
    >
      <div className="text-6xl animate-bounce-logo">🤖</div>
      <div className="text-2xl font-bold text-primary-foreground">Sofia AI</div>
      <div className="text-sm text-primary-foreground/60">v4.0 · Ultra Intelligent</div>
      <div className="w-56 h-1 rounded-full overflow-hidden bg-white/20 mt-2">
        <div
          className="h-full rounded-full transition-[width] duration-400 ease-out bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-col gap-1.5 w-60 mt-2">
        {steps.map(step => (
          <div
            key={step.id}
            className={`text-xs flex items-center gap-2 transition-colors duration-300 ${
              step.status === 'done' ? 'text-green-300' :
              step.status === 'active' ? 'text-white font-semibold' :
              'text-white/40'
            }`}
          >
            {step.status === 'done' ? '✅' : '⏳'} {step.text}
          </div>
        ))}
      </div>
    </div>
  );
}
