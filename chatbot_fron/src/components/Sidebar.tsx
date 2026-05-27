import { PlusCircle, Search, Sparkles, LogIn, MessageSquare, Pin, Trash2, Sun, Moon } from 'lucide-react'

interface Session {
  id: string;
  title: string;
  created_at: string;
  is_pinned: boolean;
}

interface SidebarProps {
  username: string | null;
  tokensBalance?: number;
  onLogout: () => void;
  onNewChat: () => void;
  sessions?: Session[];
  currentSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onTogglePin?: (id: string, currentPinStatus: boolean) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function Sidebar({ 
  username, 
  tokensBalance = 0,
  onLogout, 
  onNewChat, 
  sessions = [], 
  currentSessionId, 
  onSelectSession,
  onDeleteSession,
  onTogglePin,
  isOpen = true,
  onToggle,
  isDarkMode,
  onToggleDarkMode
}: SidebarProps) {
  return (
    <div className={`${isOpen ? 'w-[280px] p-5 opacity-100' : 'w-0 p-0 opacity-0'} hidden md:flex glass-panel border-r-0 border-r-[1px] border-r-white/10 dark:border-r-slate-800 flex-col justify-between z-20 transition-all duration-300 overflow-hidden shrink-0 whitespace-nowrap`}>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-8 text-slate-800 dark:text-slate-100 font-bold text-xl px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span>ICT Assistant</span>
        </div>

        <button 
          onClick={onNewChat}
          className="w-full bg-slate-100/50 hover:bg-slate-200/50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-all duration-300 mb-6 shadow-sm group"
        >
          <PlusCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
          <span className="text-sm">New Chat</span>
        </button>

        <div className="relative mb-6 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full bg-white/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 py-2 pl-9 pr-4 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 focus:border-amber-500/50 dark:focus:border-amber-500/50 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1 mb-4">
          {sessions.map(session => (
            <div key={session.id} className="group relative">
              <button
                onClick={() => onSelectSession && onSelectSession(session.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-all duration-200 ${
                  currentSessionId === session.id
                    ? 'bg-amber-100/50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium shadow-sm border border-amber-200/50 dark:border-amber-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
                } pr-16`}
              >
                {session.is_pinned ? (
                  <Pin className="w-4 h-4 shrink-0 text-amber-500 fill-amber-500/20" />
                ) : (
                  <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === session.id ? 'text-amber-500' : 'text-slate-400'}`} />
                )}
                <span className="truncate flex-1">{session.title}</span>
              </button>
              
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(session.id, session.is_pinned); }}
                  className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title={session.is_pinned ? "Unpin chat" : "Pin chat"}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteSession && onDeleteSession(session.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={onToggleDarkMode}
            className="flex-1 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl transition-colors flex items-center justify-center shadow-sm"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          
          <button 
            onClick={onLogout}
            className="flex-1 bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-500 dark:text-red-400 py-2.5 rounded-xl font-medium transition-colors text-sm flex items-center justify-center gap-2 border border-red-500/20 dark:border-red-500/30 shadow-sm"
            title="Sign Out"
          >
            <LogIn className="w-4 h-4 rotate-180" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>

        <div className="bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 bg-gradient-to-tr from-yellow-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold shadow-inner uppercase shrink-0">
            {username?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate leading-tight">{username}</div>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
              ⚡ {tokensBalance} Credits
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
