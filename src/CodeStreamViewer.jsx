import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy } from 'react-icons/fi';

const CodeStreamViewer = () => {
  const [code, setCode] = useState('');
  const [displayedCode, setDisplayedCode] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const typingSpeed = 0; // milliseconds per character

  const connectWebSocket = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setStatus('Max reconnect attempts reached. Please refresh the page to retry.');
      return;
    }

    setStatus(`Attempting to connect (Attempt ${reconnectAttempts.current + 1})...`);
    setError(null);

    const wsUrl = 'ws://localhost:8765';
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setStatus('Connected');
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'code') {
          setCode(data.content);
        }
      } catch (err) {
        setError(`Error parsing message: ${err.message}`);
      }
    };

    ws.current.onclose = (event) => {
      setStatus('Disconnected. Attempting to reconnect...');
      setError(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      reconnectAttempts.current += 1;
      const delay = Math.min(30000, Math.pow(2, reconnectAttempts.current) * 1000);
      setTimeout(connectWebSocket, delay);
    };

    ws.current.onerror = (err) => {
      setStatus('Error: Unable to connect to WebSocket server');
      setError(`WebSocket error: ${err.message || 'Unknown error'}`);
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    let timeout;
    let currentIndex = 0;

    const typeNextCharacter = () => {
      if (currentIndex < code.length) {
        setDisplayedCode(code.slice(0, currentIndex + 1));
        currentIndex++;
        timeout = setTimeout(typeNextCharacter, typingSpeed);
      }
    };

    if (code) {
      typeNextCharacter();
    }

    return () => clearTimeout(timeout);
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setStatus('Copied to clipboard!');
    setTimeout(() => setStatus('Connected'), 2000);
  };

  return (
    <div className="max-w-3xl w-full mx-auto p-4 bg-gray-900 text-gray-200 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-2 p-2 bg-gray-800 rounded-t-lg">
        <span className="text-sm text-gray-400">snake.js</span>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-gray-200"
          title="Copy Code"
        >
          <FiCopy size={16} />
        </button>
      </div>
      <div className="mb-4 text-xs font-semibold text-blue-400">{status}</div>
      {error && <div className="mb-4 text-xs text-red-500">{error}</div>}
      <div>
        <SyntaxHighlighter
          language="javascript"
          style={vscDarkPlus}
          className="text-sm rounded-b-lg bg-gray-800"
          showLineNumbers={true}
          wrapLines={true}
          customStyle={{ padding: '20px', borderRadius: '0 0 8px 8px', margin: '20px' }}
          lineNumberStyle={{ color: '#565c64' }}
        >
          {displayedCode || 'Waiting for code...'}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeStreamViewer;
