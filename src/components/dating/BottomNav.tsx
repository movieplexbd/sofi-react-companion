import { useNavigate, useLocation } from 'react-router-dom';
import { FaFire, FaComments, FaUser } from 'react-icons/fa6';

interface Props {
  matchCount: number;
}

export default function BottomNav({ matchCount }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    { path: '/discover', icon: FaFire, label: 'Discover' },
    { path: '/matches', icon: FaComments, label: 'Matches', badge: matchCount },
    { path: '/profile', icon: FaUser, label: 'Profile' },
  ];

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card py-2 flex-shrink-0">
      {tabs.map(tab => {
        const active = pathname === tab.path || (tab.path === '/discover' && pathname === '/');
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 relative transition-colors ${
              active ? 'text-pink-500' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={20} />
            <span className="text-[0.65rem] font-medium">{tab.label}</span>
            {tab.badge ? (
              <span className="absolute -top-0.5 right-2 w-4 h-4 bg-pink-500 text-white text-[0.55rem] rounded-full flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
