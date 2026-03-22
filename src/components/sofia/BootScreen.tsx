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
    if (!visible) {
      setOpacity(0);
    }
  }, [visible]);

  if (!visible && opacity === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-4"
      style={{
        background: 'linear-gradient(135deg, hsl(280 30% 96%), hsl(340 30% 96%))',
        opacity,
        transition: 'opacity 0.4s',
      }}
    >
      <div className="text-6xl animate-bounce-logo">🤖</div>
      <div className="text-2xl font-bold text-primary">Sofia v4.0</div>
      <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-400 ease-out"
          style={{ width: `${progress}%`, background: 'var(--header-gradient)' }}
        />
      </div>
      <div className="flex flex-col gap-1.5 w-60">
        {steps.map(step => (
          <div
            key={step.id}
            className={`text-xs flex items-center gap-2 transition-colors duration-300 ${
              step.status === 'done' ? 'text-sofia-green' :
              step.status === 'active' ? 'text-primary font-semibold' :
              'text-muted-foreground'
            }`}
          >
            {step.status === 'done' ? '✅' : '⏳'} {step.text}
          </div>
        ))}
      </div>
    </div>
  );
}
