import React from 'react';

function formatTimestamp(ts) {
  if (!ts) return 'Just now';
  try {
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleString();
    }
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    return 'Just now';
  } catch {
    return 'Just now';
  }
}

export default function MessageList({ messages }) {
  return (
    <div className="w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Echoes from The Void</h2>
      <div className="space-y-4 max-h-96 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-gray-500">The Void is silent... for now.</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="p-4 bg-gray-800 rounded-lg">
            <p>{msg.text}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatTimestamp(msg.timestamp)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
} 