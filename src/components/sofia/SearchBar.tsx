import { useState } from 'react';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';

interface SearchBarProps {
  visible: boolean;
  onSearch: (query: string) => void;
  onClose: () => void;
  placeholder: string;
}

export default function SearchBar({ visible, onSearch, onClose, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState('');

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card flex-shrink-0 animate-fade-up">
      <FaMagnifyingGlass size={14} className="text-muted-foreground flex-shrink-0" />
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onSearch(e.target.value); }}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground font-bengali"
        autoFocus
      />
      <button onClick={() => { setQuery(''); onSearch(''); onClose(); }} className="text-muted-foreground hover:text-foreground transition-colors">
        <FaXmark size={14} />
      </button>
    </div>
  );
}
