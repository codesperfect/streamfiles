import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy } from 'react-icons/fi';

const CodeStreamViewer = () => {
  const [fileQueue, setFileQueue] = useState([]);
  const [displayedFiles, setDisplayedFiles] = useState([]);
  const [currentStreaming, setCurrentStreaming] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const codeContainerRef = useRef(null);
 

  const convertWatchUrl = (url, port) => {
    console.log("url", url);
    if (!url) return '';
    
    // Take only the first IP match if there are multiple
    const match = url.match(/(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
        // Use match[1] to get just the IP address from the match
        return `ws://${match[1]}:${port}`;
    }
    return '';
}

  const connectWebSocket = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setStatus('Max reconnect attempts reached. Please refresh the page to retry.');
      return;
    }

    setStatus(`Attempting to connect (Attempt ${reconnectAttempts.current + 1})...`);
    setError(null);

    // const wsUrl = convertWatchUrl(currentIframeUrl , 8764);
    const wsUrl = 'ws://localhost:8764';
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      setStatus('Connected');
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setFileQueue(prevQueue => [...prevQueue, data]);
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
    const streamNextFile = async () => {
      if (fileQueue.length > 0 && !currentStreaming) {
        const nextFile = fileQueue[0];
        setCurrentStreaming(nextFile.filename);
        
        const lines = nextFile.content.split('\n');
        let displayedContent = '';

        for (let i = 0; i < lines.length; i++) {
          displayedContent += (i > 0 ? '\n' : '') + lines[i];
          setDisplayedFiles(prev => [
            ...prev.filter(f => f.filename !== nextFile.filename),
            { ...nextFile, displayedContent }
          ]);
          await new Promise(resolve => setTimeout(resolve, 1));
        }

        setFileQueue(prev => prev.slice(1));
        setCurrentStreaming(null);
      }
    };

    streamNextFile();
  }, [fileQueue, currentStreaming]);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [displayedFiles]);

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    setStatus('Copied to clipboard!');
    setTimeout(() => setStatus('Connected'), 2000);
  };

  const renderFileContent = (fileData) => {
    return (
      <SyntaxHighlighter
        language={fileData.language}
        style={vscDarkPlus}
        className="text-sm rounded-b-lg bg-gray-800"
        showLineNumbers={true}
        wrapLines={true}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.875rem",
          lineHeight: "1.5",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
        lineNumberStyle={{ color: '#565c64' }}
      >
        {fileData.displayedContent || 'No content available...'}
      </SyntaxHighlighter>
    );
  };

  return (
    <div className="max-w-3xl w-full mx-auto p-4 rounded-lg">
      <div className="mb-4 text-xs font-semibold text-blue-400">{status}</div>
      {error && <div className="mb-4 text-xs text-red-500">{error}</div>}

      <div
        ref={codeContainerRef}
        className="overflow-auto"
        style={{ maxHeight: '90vh' }}
      >
        {displayedFiles.map(fileData => (
          <div key={fileData.filename} className="mb-6 bg-gray-900 text-gray-200 shadow-md rounded-lg">
            <div className="flex justify-between items-center p-2 bg-gray-800 rounded-t-lg space-x-2">
              <span className="text-sm text-gray-400 flex-grow">{fileData.filename}</span>
              <button
                onClick={() => handleCopy(fileData.content)}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-700 text-gray-400 hover:text-gray-200 rounded"
                title="Copy Code"
              >
                <FiCopy size={16} />
                <span className="text-xs">Copy</span>
              </button>
            </div>
            {renderFileContent(fileData)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeStreamViewer;