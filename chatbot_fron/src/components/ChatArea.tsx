import { useState, useEffect, useRef } from 'react'
import { Bot, Send, Sparkles, PanelLeftClose, PanelLeftOpen, BarChart3, Code2, FileText, Image as ImageIcon, BarChartBig, GraduationCap, Users } from 'lucide-react'
import { z } from 'zod'
import { toPng } from 'html-to-image'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const GRADIENTS = [
  { id: 'color0', from: '#6366f1', to: '#a855f7' }, // Indigo to Purple
  { id: 'color1', from: '#ec4899', to: '#f43f5e' }, // Pink to Rose
  { id: 'color2', from: '#14b8a6', to: '#3b82f6' }, // Teal to Blue
  { id: 'color3', from: '#f59e0b', to: '#ef4444' }, // Amber to Red
  { id: 'color4', from: '#8b5cf6', to: '#ec4899' }, // Violet to Pink
  { id: 'color5', from: '#10b981', to: '#14b8a6' }, // Emerald to Teal
]

interface Message {
  role: string;
  content: string;
}

interface ChatAreaProps {
  username: string | null;
  messages: Message[];
  isLoading: boolean;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: (msg: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const ChartSchema = z.object({
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie']),
  title: z.string().optional(),
  data: z.array(z.record(z.string(), z.unknown())),
  xAxisKey: z.string(),
  yAxisKey: z.string()
})

type ChartConfig = z.infer<typeof ChartSchema>

export default function ChatArea({
  username,
  messages,
  isLoading,
  inputMessage,
  setInputMessage,
  onSendMessage,
  isSidebarOpen = true,
  onToggleSidebar
}: ChatAreaProps) {
  const [isDevMode, setIsDevMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSendMessage(inputMessage)
    }
  }

  const handleDownloadCSV = (data: Record<string, unknown>[], title: string = 'data') => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
    ].join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPNG = async (chartId: string, title: string = 'chart') => {
    const element = document.getElementById(chartId);
    if (!element) return;
    try {
      const dataUrl = await toPng(element, { cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `${title}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  const renderChart = (chartConfig: ChartConfig, index: number) => {
    const { chartType, title, data, xAxisKey, yAxisKey } = chartConfig
    const chartId = `chart-content-${index}`;

    return (
      <div id={chartId} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 dark:border-slate-700/60 my-6 w-full h-[450px] shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col animate-slide-up-fade relative overflow-hidden group">
        {/* Subtle background glow effect */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl group-hover:bg-blue-400/20 transition-all duration-700"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl group-hover:bg-purple-400/20 transition-all duration-700"></div>
        
        {title && (
          <div className="flex items-center justify-between mb-6 relative z-10 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
                <BarChart3 size={20} />
              </div>
              <h3 className="text-slate-800 dark:text-slate-200 font-bold text-lg tracking-wide">{title}</h3>
            </div>
            
            {/* Export Toolbar */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onClick={() => handleDownloadCSV(data, title)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="Download CSV">
                <FileText size={18} />
              </button>
              <button onClick={() => handleDownloadPNG(chartId, title)} className="p-1.5 text-slate-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors border border-transparent hover:border-pink-100" title="Download PNG">
                <ImageIcon size={18} />
              </button>
            </div>
          </div>
        )}
        
        <div className="flex-1 w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {GRADIENTS.map((grad) => (
                    <linearGradient key={grad.id} id={grad.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={grad.from} stopOpacity={1} />
                      <stop offset="100%" stopColor={grad.to} stopOpacity={0.8} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={13} tickLine={false} axisLine={false} dy={10} fontWeight={500} />
                <YAxis stroke="#64748b" fontSize={13} tickLine={false} axisLine={false} fontWeight={500} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600, fontSize: '15px' }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}
                />
                <Bar dataKey={yAxisKey} radius={[8, 8, 0, 0]} animationDuration={1500} animationEasing="ease-out">
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#${GRADIENTS[index % GRADIENTS.length].id})`} />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={13} tickLine={false} axisLine={false} dy={10} fontWeight={500} />
                <YAxis stroke="#64748b" fontSize={13} tickLine={false} axisLine={false} fontWeight={500} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}
                />
                <Line type="monotone" dataKey={yAxisKey} stroke="url(#lineGradient)" strokeWidth={5} animationDuration={1500} dot={{ r: 6, fill: '#fff', strokeWidth: 3, stroke: '#ec4899' }} activeDot={{ r: 10, stroke: '#ec4899', strokeWidth: 3, fill: '#fff' }} />
              </LineChart>
            ) : (
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  {GRADIENTS.map((grad) => (
                    <linearGradient key={grad.id} id={grad.id} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={grad.from} stopOpacity={1} />
                      <stop offset="100%" stopColor={grad.to} stopOpacity={0.8} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={data} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={6} dataKey={yAxisKey} nameKey={xAxisKey} animationDuration={1500} cornerRadius={8} stroke="none">
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#${GRADIENTS[index % GRADIENTS.length].id})`} style={{ outline: 'none', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))' }} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                  itemStyle={{ color: '#1e293b', fontWeight: 600 }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 500, fontSize: '14px', color: '#475569' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const parseChartConfig = (value: string): ChartConfig | null => {
    try {
      const parsed = JSON.parse(value)
      const result = ChartSchema.safeParse(parsed)
      if (!result.success) {
        console.warn('Invalid chart config format:', result.error.format())
        return null
      }
      return result.data
    } catch {
      return null
    }
  }

  const renderMessageContent = (content: string, messageIndex: number) => {
    let displayContent = content;
    let sqlQuery = null;
    
    const hiddenSqlMatch = content.match(/```sql_hidden\n([\s\S]*?)\n```/);
    if (hiddenSqlMatch) {
      sqlQuery = hiddenSqlMatch[1].trim();
      displayContent = content.replace(hiddenSqlMatch[0], '').trim();
    }

    const renderSqlBlock = () => {
      if (!isDevMode || !sqlQuery) return null;
      return (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-inner animate-slide-up-fade">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Executed SQL Query</span>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language="sql"
            PreTag="div"
            customStyle={{ margin: 0, background: 'transparent', padding: 0, fontSize: '13px' }}
          >
            {sqlQuery}
          </SyntaxHighlighter>
        </div>
      );
    };

    const jsonMatch = displayContent.match(/```(?:json)?\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      const parsedJson = parseChartConfig(jsonMatch[1])
      if (parsedJson) {
        const parts = displayContent.split(jsonMatch[0])
        return (
          <div className="flex flex-col w-full">
            {parts[0] && <div className="markdown-body mb-2 leading-relaxed"><ReactMarkdown>{parts[0]}</ReactMarkdown></div>}
            {renderChart(parsedJson, messageIndex)}
            {parts[1] && <div className="markdown-body mt-2 leading-relaxed"><ReactMarkdown>{parts[1]}</ReactMarkdown></div>}
            {renderSqlBlock()}
          </div>
        )
      }
    }

    if (displayContent.trim().startsWith('{') && displayContent.trim().endsWith('}')) {
      const parsedJson = parseChartConfig(displayContent)
      if (parsedJson) {
        return (
          <div className="flex flex-col w-full">
            {renderChart(parsedJson, messageIndex)}
            {renderSqlBlock()}
          </div>
        )
      }
    }

    return (
      <div className="flex flex-col w-full">
        <div className="markdown-container leading-relaxed space-y-3">
          <ReactMarkdown
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || '')
                const codeString = String(children).replace(/\n$/, '')
                const isBlock = codeString.includes('\n')

                if (isBlock) {
                  return (
                    <div className="rounded-xl overflow-hidden my-4 border border-white/10 shadow-lg">
                      {match && (
                        <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono border-b border-white/5 uppercase tracking-wider">
                          {match[1]}
                        </div>
                      )}
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match?.[1] ?? 'sql'}
                        PreTag="div"
                        customStyle={{ margin: 0, background: '#0d1117', padding: '1rem', fontSize: '14px' }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  )
                }

                return (
                  <code className={`${className ?? ''} bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded-md font-mono text-sm`}>
                    {children}
                  </code>
                )
              },
              p({ children }) {
                return <p className="mb-2">{children}</p>
              },
              ul({ children }) {
                return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
              },
              ol({ children }) {
                return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
              },
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>
        {renderSqlBlock()}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col relative h-full w-full">
      <button
        onClick={onToggleSidebar}
        className="absolute top-4 left-4 z-50 p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 backdrop-blur-md rounded-xl text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 shadow-sm transition-all border border-slate-200 dark:border-slate-700 hidden md:block"
        title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
      </button>

      {/* Developer Mode Toggle */}
      <div className="absolute top-4 right-4 z-50 hidden md:block">
        <button
          onClick={() => setIsDevMode(!isDevMode)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${
            isDevMode 
              ? 'bg-slate-800 text-amber-400 border-slate-700' 
              : 'bg-white/50 hover:bg-white/80 backdrop-blur-md text-slate-500 hover:text-slate-700 border-slate-200'
          }`}
          title="Toggle Developer Mode"
        >
          <Code2 className="w-4 h-4" />
          {isDevMode ? 'Dev Mode ON' : 'Dev Mode OFF'}
        </button>
      </div>
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 w-full max-w-4xl mx-auto">
          <div className="w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-600/20 border border-amber-500/10 flex items-center justify-center shadow-lg backdrop-blur-md">
            <Sparkles className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-500 mb-4 tracking-tight text-center">
            Hi, {username?.replace(/@.*/, '').replace(/\.gmail\.com$/, '')}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg text-center max-w-lg mb-8">
            Ask me to draw a chart, write a query, or analyze your database.
          </p>
          <div className="flex flex-wrap gap-3 justify-center max-w-2xl animate-pop-in" style={{ animationDelay: '0.2s' }}>
            <button onClick={() => setInputMessage("ขอกราฟแท่งแสดงจำนวนนักศึกษาแต่ละสาขาหน่อย")} className="bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 hover:border-amber-500/50 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-full text-sm transition-all shadow-sm flex items-center gap-2"><BarChartBig className="w-4 h-4 text-amber-500" /> กราฟนักศึกษาแต่ละสาขา</button>
            <button onClick={() => setInputMessage("นักศึกษาที่ได้เกรดมากกว่า 3.0 มีกี่คน")} className="bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 hover:border-orange-500/50 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-full text-sm transition-all shadow-sm flex items-center gap-2"><GraduationCap className="w-4 h-4 text-orange-500" /> ค้นหานักศึกษาเกรดดี</button>
            <button onClick={() => setInputMessage("มีนักศึกษาทั้งหมดกี่คนในระบบ")} className="bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 hover:border-yellow-500/50 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-full text-sm transition-all shadow-sm flex items-center gap-2"><Users className="w-4 h-4 text-yellow-500" /> จำนวนนักศึกษาทั้งหมด</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col py-8 px-4 md:px-8 overflow-y-auto scroll-smooth z-10 pb-32">
          {messages.map((msg, index) => (
            <div key={index} className={`mb-8 flex w-full animate-pop-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md mr-4 shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[100%] md:max-w-[85%] p-4 rounded-3xl shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-sm'
                  : 'bg-white/80 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 backdrop-blur-md rounded-tl-sm border border-slate-200 dark:border-slate-700 w-full'
              }`}>
                {renderMessageContent(msg.content, index)}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="mb-8 flex justify-start w-full">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md mr-4 shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="max-w-[85%] p-4 rounded-2xl bg-white/80 dark:bg-slate-800/90 backdrop-blur-md text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <div className="flex gap-1.5 items-center px-2 py-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#f8fafc] dark:from-slate-900 via-[#f8fafc]/95 dark:via-slate-900/95 to-transparent pt-12 pb-8 px-4 md:px-8 z-20 flex justify-center">
        <div className="relative w-full max-w-4xl flex items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-amber-500/50 dark:focus-within:border-amber-500/50 rounded-2xl p-2 px-4 shadow-xl transition-all duration-300">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a bar chart of students..."
            className="flex-1 bg-transparent py-3 outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-[15px]"
          />
          <button
            onClick={() => onSendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className={`ml-2 p-2.5 rounded-xl flex items-center justify-center transition-all duration-300 ${
              inputMessage.trim() && !isLoading
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
