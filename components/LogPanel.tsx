
import React, { useRef, useEffect } from 'react';
import type { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
}

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogStyle = (type: LogEntry['type']) => {
    switch(type) {
      case 'GOAL':
        return 'text-yellow-400 border-l-yellow-400';
      case 'SYSTEM':
        return 'text-purple-400 border-l-purple-400';
      case 'STATUS':
        return 'text-orange-400 border-l-orange-400 italic';
      case 'ACTION':
        return 'text-gray-400 italic border-l-gray-500';
      case 'COMMUNICATION':
      default:
        return 'text-white border-l-gray-300';
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-full">
      <h2 className="text-xl mb-2 text-gray-300 border-b border-gray-700 pb-2">Event Log</h2>
      <div ref={scrollRef} className="flex-grow overflow-y-auto pr-2 space-y-3 text-xs">
        {logs.map((log) => (
          <div key={log.id} className={`pl-3 border-l-2 ${getLogStyle(log.type)}`}>
            <span className={`font-bold ${log.robotColor || ''}`}>{log.robotName}:</span>
            <span className="ml-2">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;
