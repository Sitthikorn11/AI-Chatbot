import { useState, useEffect } from 'react'
import AuthScreen from './components/AuthScreen'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Jumpscare from './components/Jumpscare'
import './App.css'

interface Message {
  role: string;
  content: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback
}

function App() {
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'))

  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<{ id: string, title: string, created_at: string, is_pinned: boolean }[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [tokensBalance, setTokensBalance] = useState<number>(0)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  const fetchUserProfile = async () => {
    if (!username) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setTokensBalance(data.tokens_balance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  const fetchSessions = async () => {
    if (!username) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sessions`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        if (!currentSessionId && data.sessions && data.sessions.length > 0) {
          setCurrentSessionId(data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  useEffect(() => {
    if (username) {
      fetchUserProfile();
      fetchSessions();
    }
  }, [username]);

  useEffect(() => {
    if (!username || !currentSessionId) {
      if (!currentSessionId) setMessages([]);
      return;
    }
    
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/history?session_id=${currentSessionId}`, {
          credentials: "include"
        });
        
        const data = await response.json();
        
        if (response.ok) {
          if (data.history && Array.isArray(data.history)) {
            setMessages(data.history);
          }
        } else if (response.status === 401) {
          handleLogout();
        } else {
          setMessages([{ role: 'assistant', content: `**History Error:** ${data.detail || 'Unknown error'}` }]);
        }
      } catch (error) {
        setMessages([{ role: 'assistant', content: `**History Fetch Failed:** ${getErrorMessage(error, 'Network error')}` }]);
      }
    };
    
    fetchHistory();
  }, [username, currentSessionId]);

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('username')
    setUsername(null)
    setMessages([])
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!username) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: "include"
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleTogglePinSession = async (sessionId: string, currentPinStatus: boolean) => {
    if (!username) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}/pin`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: "include",
        body: JSON.stringify({ is_pinned: !currentPinStatus })
      });
      if (response.ok) {
        fetchSessions();
      }
    } catch (error) {
      console.error("Failed to pin session:", error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !username) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          session_id: currentSessionId
        }),
      })

      if (response.status === 401) {
        handleLogout()
        throw new Error('Session expired. Please login again.')
      }

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const data = await response.json()
      
      if (!currentSessionId && data.session_id) {
        setCurrentSessionId(data.session_id);
        fetchSessions();
      }

      fetchUserProfile(); // Refresh token balance

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ])
    } catch (error: unknown) {
      console.error('API Error:', error)
      const errorMessage = getErrorMessage(error, 'Could not connect to the server.')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Warning: ${errorMessage}` },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Jumpscare />
      {!username ? (
        <AuthScreen setUsername={setUsername} />
      ) : (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans overflow-hidden transition-colors duration-300">
          <Sidebar
            username={username}
            tokensBalance={tokensBalance}
            onLogout={handleLogout}
            onNewChat={handleNewChat}
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={setCurrentSessionId}
            onDeleteSession={handleDeleteSession}
            onTogglePin={handleTogglePinSession}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
          <ChatArea
            username={username}
            messages={messages}
            isLoading={isLoading}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={handleSendMessage}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>
      )}
    </>
  )
}

export default App
