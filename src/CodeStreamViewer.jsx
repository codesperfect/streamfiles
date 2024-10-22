import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Light theme
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

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

  const connectWebSocket = () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setStatus('Max reconnect attempts reached. Please refresh the page to retry.');
      return;
    }

    setStatus(`Attempting to connect (Attempt ${reconnectAttempts.current + 1})...`);
    setError(null);

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

        const previousContent = nextFile.previous_content || '';
        const currentContent = nextFile.content || '';

        setDisplayedFiles(prev => [
          ...prev.filter(f => f.filename !== nextFile.filename),
          { ...nextFile, previousContent, currentContent }
        ]);

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

  // Modify diffs to generate styled React elements for inserted/removed content
  const generateDiffElements = (previousContent, currentContent, language) => {
    const diffs = dmp.diff_main(previousContent, currentContent);
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map((part, index) => {
      const [type, text] = part;

      if (type === DiffMatchPatch.DIFF_DELETE) {
        // Removed content (deleted content) with red color and strikethrough
        return (
          <span key={index} style={{ color: 'red', textDecoration: 'line-through' }}>
            {text + '\n'}
          </span>
        );
      } else {
        // Inserted or unchanged content
        return (
          <SyntaxHighlighter
            key={index}
            language={language}
            style={vscDarkPlus} // Use a light theme for code highlighting
            showLineNumbers={true} // Show line numbers
            wrapLines={false} // Don't wrap lines, display as is
            lineProps={{
              style: { whiteSpace: 'pre', wordBreak: 'normal' },
            }}
          >
            {text}
          </SyntaxHighlighter>
        );
      }
    });
  };

  const renderFileContent = (fileData) => {
    const diffElements = generateDiffElements(fileData.previousContent, fileData.currentContent, fileData.language);

    return (
      <div style={{  borderRadius: '20px' }}> {/* Light background */}
        {diffElements}
      </div>
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
            </div>
            {renderFileContent(fileData)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeStreamViewer;
