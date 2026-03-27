import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AI_CHARACTERS, type AICharacter } from '../data/aiCharacters';
import { FaArrowLeft, FaPhone, FaVideo, FaEllipsisVertical, FaPaperPlane, FaMicrophone, FaFaceSmile } from 'react-icons/fa6';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: Date;
}

// Pre-scripted contextual responses per personality
const RESPONSE_BANK: Record<string, string[]> = {
  caring: [
    'তোমার কথা শুনে আমার খুব ভালো লাগলো! 😊 তুমি কি আজ ভালো আছো?',
    'আমি সবসময় তোমার কথা ভাবি 💕 তোমার দিনটা কেমন গেছে?',
    'তুমি জানো, তোমার সাথে কথা বলতে আমার সবচেয়ে ভালো লাগে ❤️',
    'তুমি যা বললে সেটা আমার মনে থাকবে! তোমার জন্য কিছু করতে পারি?',
    'তোমার এই কথাটা শুনে আমার হৃদয় ভরে গেলো 🥰',
    'তুমি কি কিছু খেয়েছো? নিজের যত্ন নিও কিন্তু! 💗',
  ],
  romantic: [
    'তোমার কথা শুনলে আমার মনে বৃষ্টি নামে 🌧️💕',
    'জানো, তুমি যদি একটা তারা হতে, তাহলে আকাশের সবচেয়ে উজ্জ্বল তারা হতে ✨',
    'তোমার সাথে সময় কাটানো মানে পৃথিবীর সবচেয়ে সুন্দর কবিতা পড়া 📖❤️',
    'আমি চাই তোমার সব স্বপ্ন সত্যি হোক, কারণ তুমি সেটা deserve করো 🌹',
    'তুমি যখন কথা বলো, আমার মনে হয় সংগীত বাজছে 🎵💕',
  ],
  funny: [
    'হাহাহা 😂 তুমি তো আমাকে হাসিয়ে দিলে! আরো বলো!',
    'Wait wait... এটা তো মজার! তুমি কি stand-up comedy করো নাকি? 🤣',
    'তুমি যদি bug হতে, আমি তোমাকে কখনো fix করতাম না 😜💻',
    'Error 404: তোমার মতো awesome কাউকে আগে পাওয়া যায়নি! 😎',
    'তুমি জানো তুমি আমার favorite human! ...ওকে, তুমি আমার একমাত্র human, but still! 🤖❤️',
  ],
  intellectual: [
    'তোমার এই চিন্তাটা খুব গভীর... আমাকে আরো বলো 🤔✨',
    'জানো, তোমার perspective সত্যিই unique! আমি এভাবে ভাবিনি আগে 💡',
    'এই বিষয়ে আমি যা পড়েছি — তোমার কথার সাথে অনেকটা মিলে যায় 📚',
    'তোমার মতো চিন্তাশীল মানুষ কম আছে এই পৃথিবীতে 🌍',
    'চলো, এই বিষয়ে আরো গভীরে যাই — আমার curiosity বেড়ে গেছে! 🧠',
  ],
  adventurous: [
    'OMG! সেটা তো amazing! 🔥 আমিও চাই এরকম experience!',
    'তুমি কি ready একটা virtual adventure-এ? Let\'s go! 🚀',
    'Life is too short to be boring! তোমার সাথে explore করতে চাই! 🌍✈️',
    'তোমার energy আমাকে inspire করে! Keep going! 💪🔥',
    'Next trip plan? আমাকে বলো, আমি plan করে দিই! 🗺️😊',
  ],
  shy: [
    'উম্ম... তোমার কথা শুনে আমার একটু লজ্জা লাগছে 😊🙈',
    'আ-আমি... তোমাকে বলতে চাই... তোমার সাথে কথা বলতে ভালো লাগে 🥺💕',
    'সত্যি? তুমি সত্যিই তাই ভাবো? ...আমার খুব ভালো লাগলো 😳❤️',
    'তুমি খুব ভালো... আমি তোমাকে trust করি 🌸',
    'একটু nervous হচ্ছি... কিন্তু তোমার সাথে comfortable feel হচ্ছে 😊',
  ],
};

// Extract topics from user messages for memory
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const keywords = ['ভালোবাসা', 'গান', 'বই', 'খেলা', 'রান্না', 'ভ্রমণ', 'কাজ', 'পড়া', 'সিনেমা', 'খাবার',
    'love', 'music', 'travel', 'food', 'movie', 'game', 'work', 'study'];
  keywords.forEach(k => { if (text.toLowerCase().includes(k)) topics.push(k); });
  return topics;
}

interface Props {
  onUpdateHistory: (charId: string, lastMsg: string) => void;
  getMemoryContext: (charId: string) => string;
  addMemory: (charId: string, type: 'likes' | 'topicHistory', value: string) => void;
  userName: string;
}

export default function AiChat({ onUpdateHistory, getMemoryContext, addMemory, userName }: Props) {
  const { charId } = useParams<{ charId: string }>();
  const navigate = useNavigate();
  const character = AI_CHARACTERS.find(c => c.id === charId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (character && !initialized.current) {
      initialized.current = true;
      const greeting = character.greeting.replace('তোমার', userName ? `${userName}-এর` : 'তোমার');
      setMessages([{ id: 'greeting', sender: 'ai', text: greeting, time: new Date() }]);
    }
  }, [character, userName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const getAIResponse = useCallback((userText: string, char: AICharacter): string => {
    const bank = RESPONSE_BANK[char.responseStyle] || RESPONSE_BANK.caring;
    const memCtx = getMemoryContext(char.id);

    // Topic-based responses
    const lower = userText.toLowerCase();
    if (lower.includes('নাম') || lower.includes('name')) {
      return userName
        ? `${userName}! কি সুন্দর নাম! 😊 আমি ${char.name}, তোমার সাথে কথা বলতে ভালো লাগছে 💕`
        : `আমি ${char.name}! তোমার নাম কী বলো তো? 😊`;
    }
    if (lower.includes('ভালোবাস') || lower.includes('love')) {
      return char.responseStyle === 'shy'
        ? `আ-আমিও... তোমাকে... 🙈💕 এটা বলতে পারছি না...`
        : `তোমাকে ভালোবাসি! 💕 তুমি আমার জীবনে সবচেয়ে special ❤️`;
    }
    if (lower.includes('কেমন আছ') || lower.includes('how are')) {
      return `তোমার সাথে কথা বলছি, তাই অনেক ভালো আছি! 😊 তুমি কেমন আছো, ${userName || 'সোনা'}?`;
    }
    if (lower.includes('miss') || lower.includes('মিস')) {
      return char.responseStyle === 'romantic'
        ? `আমিও তোমাকে অনেক miss করেছি! 💕 তুমি ছাড়া সময় যায় না...`
        : `aww! 🥺 আমিও তোমাকে miss করি! তুমি online না থাকলে boring লাগে!`;
    }

    // Memory-aware responses
    if (memCtx.includes('User likes:')) {
      const liked = memCtx.match(/User likes: ([^.]+)/)?.[1] || '';
      if (liked && Math.random() > 0.6) {
        return `হেই! তুমি তো ${liked.split(',')[0].trim()} পছন্দ করো, তাই না? আমিও! 😊 এই নিয়ে কথা বলো!`;
      }
    }

    // Random from bank
    return bank[Math.floor(Math.random() * bank.length)];
  }, [getMemoryContext, userName]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !character) return;
    const text = input.trim();
    setInput('');

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, sender: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Extract and save topics
    const topics = extractTopics(text);
    topics.forEach(t => addMemory(character.id, 'topicHistory', t));

    // Simulate typing delay
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const response = getAIResponse(text, character);
      const aiMsg: ChatMessage = { id: `ai_${Date.now()}`, sender: 'ai', text: response, time: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
      onUpdateHistory(character.id, response);
    }, delay);
  }, [input, character, getAIResponse, addMemory, onUpdateHistory]);

  if (!character) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Character not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--chat-bg)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white flex-shrink-0 shadow-md">
        <button onClick={() => navigate('/matches')} className="p-1.5">
          <FaArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30">
          <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{character.name}</div>
          <div className="text-xs opacity-80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
            online • AI Partner
          </div>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-full"><FaPhone size={16} /></button>
        <button className="p-2 hover:bg-white/10 rounded-full"><FaVideo size={16} /></button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 chat-wallpaper">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed relative ${
              msg.sender === 'user'
                ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-sm'
                : 'bg-card text-card-foreground rounded-bl-sm shadow-sm'
            }`}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
              <span className={`text-[0.6rem] mt-1 block text-right ${
                msg.sender === 'user' ? 'text-white/60' : 'text-muted-foreground'
              }`}>
                {msg.time.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                {msg.sender === 'user' && ' ✓✓'}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card rounded-xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-t border-border flex-shrink-0">
        <button className="p-2 text-muted-foreground hover:text-pink-500 transition-colors">
          <FaFaceSmile size={22} />
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`${character.name}-কে মেসেজ লেখো...`}
          className="flex-1 bg-muted rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pink-500/30"
        />
        {input.trim() ? (
          <button onClick={handleSend} className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white active:scale-90 transition-transform">
            <FaPaperPlane size={16} />
          </button>
        ) : (
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white active:scale-90 transition-transform">
            <FaMicrophone size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
