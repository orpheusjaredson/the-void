import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function MessageInput({ onSent }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || message.length > 500) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: message.trim(),
        timestamp: serverTimestamp(),
      });
      setMessage('');
      if (onSent) onSent();
      alert('Your message has been sent to The Void.');
    } catch (e) {
      alert('Failed to send message. Please try again.');
      console.error('Error adding message:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8 w-full max-w-md">
      <textarea
        className="w-full p-4 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 text-white resize-none"
        rows={4}
        maxLength={500}
        placeholder="Speak into The Void..."
        value={message}
        onChange={e => setMessage(e.target.value)}
        aria-label="Type your message to send to The Void"
        disabled={loading}
      />
      <button
        className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
        onClick={handleSend}
        disabled={loading || !message.trim() || message.length > 500}
      >
        Send to The Void
      </button>
      <div className="text-right text-xs text-gray-400 mt-1">{message.length}/500</div>
    </div>
  );
} 