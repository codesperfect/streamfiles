import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiCopy } from 'react-icons/fi';

const CodeStreamViewer = () => {
  const [files, setFiles] = useState([]); // Array of { filename, content }
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const codeContainerRef = useRef(null); // Ref for the code container

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
          // Check if the file already exists in the list before adding to prevent duplicates
          setFiles((prevFiles) => {
            const fileIndex = prevFiles.findIndex((file) => file.filename === data.filename);
            if (fileIndex !== -1) {
              // Update the content of the existing file
              const updatedFiles = [...prevFiles];
              updatedFiles[fileIndex] = { filename: data.filename, content: data.content || '' };
              return updatedFiles;
            }
            return [...prevFiles, { filename: data.filename, content: data.content || '' }];
          });
          
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

  // Auto scroll when new files are added
  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [files]);

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    setStatus('Copied to clipboard!');
    setTimeout(() => setStatus('Connected'), 2000);
  };

  return (
    <div className="max-w-3xl w-full mx-auto p-4 rounded-lg ">
      <div className="mb-4 text-xs font-semibold text-blue-400">{status}</div>
      {error && <div className="mb-4 text-xs text-red-500">{error}</div>}

      {/* Wrapper for all code blocks with auto-scroll and max height */}
      <div
        ref={codeContainerRef} // Set ref for auto-scrolling
        className="overflow-auto" // Enable scrolling
        style={{ maxHeight: '90vh' }} // Limit height to 80% of viewport
      >
        {files.map((file, index) => (
          <div key={index} className="mb-6 bg-gray-900 text-gray-200 shadow-md rounded-lg "> {/* Add margin between blocks */}
            <div className="flex justify-between items-center p-2 bg-gray-800 rounded-t-lg space-x-2">
              <span className="text-sm text-gray-400 flex-grow">{file.filename}</span> {/* Display the filename */}
              <button
                onClick={() => handleCopy(file.content)}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-700 text-gray-400 hover:text-gray-200 rounded"
                title="Copy Code"
              >
                <FiCopy size={16} />
                <span className="text-xs">Copy</span>
              </button>
            </div>
            <SyntaxHighlighter
              language="javascript" // Adjust this based on the language if needed
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
                boxSizing: "border-box", // Ensure responsive width
              }}
              lineNumberStyle={{ color: '#565c64' }}
            >
              {file.content || 'No content available...'} {/* Display file content */}
            </SyntaxHighlighter>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeStreamViewer;
