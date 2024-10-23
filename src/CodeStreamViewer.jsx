import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

const CodeStreamViewer = () => {
  const [fileQueue, setFileQueue] = useState([]);
  const [displayedFiles, setDisplayedFiles] = useState([]);
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

    const wsUrl = 'ws://localhost:8763';
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
    if (fileQueue.length > 0) {
      const nextFile = fileQueue[0];
      const previousContent = nextFile.previous_content || '';
      const currentContent = nextFile.content || '';

      setDisplayedFiles((prev) => [
        ...prev.filter((f) => f.filename !== nextFile.filename),
        { ...nextFile, previousContent, currentContent }
      ]);

      setFileQueue((prevQueue) => prevQueue.slice(1));
    }
  }, [fileQueue]);

  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [displayedFiles]);

  const generateDiffElements = (previousContent, currentContent, language) => {
    const diffs = dmp.diff_main(previousContent, currentContent);
    dmp.diff_cleanupSemantic(diffs);
  
    if (diffs.length === 0) {
      // No diffs found, return the entire current content as unchanged
      return (
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          wrapLines={false}
          showLineNumbers={true}
          lineProps={{
            style: { whiteSpace: 'pre', wordBreak: 'normal' },
          }}
        >
          {currentContent}
        </SyntaxHighlighter>
      );
    }
  
    // Combine continuous changes into one block
    const combinedDiffs = [];
    let currentBlock = { type: diffs[0][0], text: diffs[0][1] };
  
    for (let i = 1; i < diffs.length; i++) {
      if (diffs[i][0] === currentBlock.type && !diffs[i][1].includes('\n')) {
        currentBlock.text += diffs[i][1];
      } else {
        combinedDiffs.push(currentBlock);
        currentBlock = { type: diffs[i][0], text: diffs[i][1] };
      }
    }
    combinedDiffs.push(currentBlock);
  
    return combinedDiffs.map((part, index) => {
      const { type, text } = part;
  
      if (type === DiffMatchPatch.DIFF_DELETE) {
        return (
          <div
            key={index}
            className="p-1 my-1 bg-red-100 rounded-lg"
            style={{
              backgroundColor: 'rgba(255, 0, 0, 0.15)',  // Light red background
              textDecoration: 'line-through',
            }}
          >
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              wrapLines={false}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                backgroundColor: "transparent", // Transparent background to highlight only the diff
              }}
              lineProps={{
                style: { whiteSpace: 'pre', wordBreak: 'normal' },
              }}
            >
              {text}
            </SyntaxHighlighter>
          </div>
        );
      } else if (type === DiffMatchPatch.DIFF_INSERT) {
        return (
          <div
            key={index}
            className="p-1 my-1 bg-green-100 rounded-lg"
            style={{
              backgroundColor: 'rgba(0, 255, 0, 0.15)',  // Light green background
            }}
          >
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              wrapLines={false}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                backgroundColor: "transparent",
              }}
              lineProps={{
                style: { whiteSpace: 'pre', wordBreak: 'normal' },
              }}
            >
              {text}
            </SyntaxHighlighter>
          </div>
        );
      } else {
        return (
          <SyntaxHighlighter
            key={index}
            language={language}
            style={vscDarkPlus}
            wrapLines={false}
            showLineNumbers={true}
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
      <div className="rounded-lg overflow-hidden">
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
