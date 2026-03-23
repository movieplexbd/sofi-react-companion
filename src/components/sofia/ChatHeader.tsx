import { useState, useRef, useEffect } from 'react';
import {
  FaBroom, FaChartBar, FaCircleInfo, FaMagnifyingGlass,
  FaMoon, FaSun, FaFileExport, FaChartPie, FaEllipsisVertical,
  FaArrowLeft, FaLanguage
} from 'react-icons/fa6';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const menuItems = [
    { icon: <FaMagnifyingGlass size={14} />, label: lang === 'bn' ? 'অনুসন্ধান' : 'Search', action: onToggleSearch },
    { icon: isDark ? <FaSun size={14} /> : <FaMoon size={14} />, label: isDark ? (lang === 'bn' ? 'লাইট মোড' : 'Light Mode') : (lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'), action: onToggleDark },
    { icon: <FaLanguage size={14} />, label: lang === 'bn' ? 'English' : 'বাংলা', action: onToggleLang },
    { icon: <FaChartPie size={14} />, label: lang === 'bn' ? 'বিশ্লেষণ' : 'Analytics', action: onToggleAnalytics },
    { icon: <FaChartBar size={14} />, label: lang === 'bn' ? 'পরিসংখ্যান' : 'Stats', action: onShowStats },
    { icon: <FaCircleInfo size={14} />, label: lang === 'bn' ? 'তথ্য' : 'Info', action: onShowInfo },
    { icon: <FaFileExport size={14} />, label: lang === 'bn' ? 'এক্সপোর্ট' : 'Export', action: onExport },
    { icon: <FaBroom size={14} />, label: lang === 'bn' ? 'চ্যাট মুছুন' : 'Clear Chat', action: onClearChat },
  ];

  return (
    <header
      className="flex items-center gap-3 px-3 py-2 text-primary-foreground flex-shrink-0"
      style={{ background: 'var(--header-gradient)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-white/30"
        style={{
          backgroundImage: `url('https://i.ibb.co/pBt8bS5c/1748861266024.jpg')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      />

      {/* Info */}
      <div className="flex-1 leading-tight min-w-0">
        <div className="font-semibold text-[0.95rem] flex items-center gap-1.5">
          {botName}
          {matchBadge && (
            <span className="text-[0.6em] px-1.5 py-0.5 rounded-full font-medium bg-white/20">
              {matchBadge}
            </span>
          )}
        </div>
        <div className="text-[0.72rem] opacity-80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pdot flex-shrink-0" />
          online · {qaCount} QA · v{version}
        </div>
      </div>

      {/* Right icons */}
      <div className="flex items-center gap-1 relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <FaEllipsisVertical size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-card text-card-foreground rounded-lg shadow-xl border border-border overflow-hidden z-50 animate-fade-up">
            {menuItems.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.action(); setMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="text-primary">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
