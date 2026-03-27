import { useState, useCallback } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useUserPrefs } from './hooks/useUserPrefs';
import Onboarding from './pages/Onboarding';
import Discover from './pages/Discover';
import Matches from './pages/Matches';
import AiChat from './pages/AiChat';
import UserProfile from './pages/UserProfile';
import BottomNav from './components/dating/BottomNav';

const App = () => {
  const { profile, setProfile, matches, addMatch, removeMatch, memory, addMemory, setMood, getMemoryContext } = useUserPrefs();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<Record<string, { lastMsg: string; time: Date }>>({});

  const handleSkip = useCallback((id: string) => {
    setSkipped(prev => [...prev, id]);
  }, []);

  const handleUpdateHistory = useCallback((charId: string, lastMsg: string) => {
    setChatHistory(prev => ({ ...prev, [charId]: { lastMsg, time: new Date() } }));
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('সব ডেটা মুছে ফেলতে চাও?')) {
      localStorage.removeItem('sofia-dating-user');
      localStorage.removeItem('sofia-dating-matches');
      localStorage.removeItem('sofia-dating-memory');
      window.location.reload();
    }
  }, []);

  if (!profile.onboarded) {
    return (
      <>
        <Toaster position="bottom-center" />
        <Onboarding onComplete={setProfile} />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="bottom-center" />
      <div className="w-screen h-screen flex flex-col overflow-hidden bg-background font-bengali">
        <Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          <Route
            path="/discover"
            element={
              <Discover
                matches={matches}
                onLike={addMatch}
                skipped={skipped}
                onSkip={handleSkip}
              />
            }
          />
          <Route
            path="/matches"
            element={<Matches matches={matches} chatHistory={chatHistory} />}
          />
          <Route
            path="/chat/:charId"
            element={
              <AiChat
                onUpdateHistory={handleUpdateHistory}
                getMemoryContext={getMemoryContext}
                addMemory={addMemory}
                userName={profile.name}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <UserProfile
                profile={profile}
                onUpdate={setProfile}
                matchCount={matches.length}
                onReset={handleReset}
              />
            }
          />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
        <BottomNav matchCount={matches.length} />
      </div>
    </BrowserRouter>
  );
};

export default App;
