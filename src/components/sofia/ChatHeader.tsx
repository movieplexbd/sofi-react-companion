import { useState } from 'react';
import { FaBroom, FaChartBar, FaCircleInfo, FaMagnifyingGlass, FaMoon, FaSun, FaFileExport, FaChartPie } from 'react-icons/fa6';
import type { Lang } from '../../constants/i18n';

interface ChatHeaderProps {
  botName: string;
  version: string;
  qaCount: number;
  intentCount: number;
  onClearChat: () => void;
  onShowStats: () => void;
  onShowInfo: () => void;
  onToggleSearch: () => void;
  onToggleDark: () => void;
  onExport: () => void;
  onToggleAnalytics: () => void;
  isDark: boolean;
  lang: Lang;
  onToggleLang: () => void;
  matchBadge?: string | null;
}

export default function ChatHeader({
  botName, version, qaCount, intentCount,
  onClearChat, onShowStats, onShowInfo,
  onToggleSearch, onToggleDark, onExport,
  onToggleAnalytics, isDark, lang, onToggleLang,
  matchBadge,
}: ChatHeaderProps) {
  return (
    <header
      className="flex items-center gap-3 px-4 py-3 text-primary-foreground flex-shrink-0"
      style={{ background: 'var(--header-gradient)', boxShadow: '0 3px 14px rgba(0,0,0,0.18)' }}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full flex-shrink-0 border-2 border-white/40"
        style={{
          backgroundImage: `url('https://i.ibb.co/pBt8bS5c/1748861266024.jpg')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          boxShadow: '0 0 10px rgba(255,255,255,0.25)',
        }}
      />

      {/* Info */}
      <div className="flex-1 leading-tight min-w-0">
        <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
          {botName} v{version} 🔥
          {matchBadge && (
            <span className="text-[0.6em] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
              {matchBadge}
            </span>
          )}
        </div>
        <div className="text-xs opacity-90 flex items-center gap-1.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pdot flex-shrink-0" />
          7-Engine AI · {qaCount} QA · {intentCount} Intents
        </div>
      </div>

      {/* Icons */}
      <div className="flex items-center gap-2.5">
        <button onClick={onToggleLang} className="text-xs font-bold opacity-85 hover:opacity-100 transition-all active:scale-95" title="Toggle Language">
          {lang === 'bn' ? 'EN' : 'BN'}
        </button>
        <button onClick={onToggleDark} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Dark Mode">
          {isDark ? <FaSun size={14} /> : <FaMoon size={14} />}
        </button>
        <button onClick={onToggleSearch} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Search">
          <FaMagnifyingGlass size={14} />
        </button>
        <button onClick={onToggleAnalytics} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Analytics">
          <FaChartPie size={14} />
        </button>
        <button onClick={onExport} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Export">
          <FaFileExport size={14} />
        </button>
        <button onClick={onClearChat} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Clear">
          <FaBroom size={14} />
        </button>
        <button onClick={onShowStats} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Stats">
          <FaChartBar size={14} />
        </button>
        <button onClick={onShowInfo} className="opacity-85 hover:opacity-100 transition-all hover:scale-110 active:scale-95" title="Info">
          <FaCircleInfo size={14} />
        </button>
      </div>
    </header>
  );
}
