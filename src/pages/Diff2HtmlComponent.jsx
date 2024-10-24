import React, { useState, useEffect, useRef } from "react";
import { FaFolderOpen, FaFolder, FaSearch } from "react-icons/fa";
import { parse, html } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import FileIcon from "../components/FileIcons";

const WebSocketURL = "ws://localhost:6789";

// Streaming content components
const StreamingContent = ({ content, language, speed = 10 }) => {
  const [visibleLines, setVisibleLines] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!content) return;
    
    const lines = content.split('\n');
    setVisibleLines([]);
    setIsComplete(false);
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < lines.length) {
        setVisibleLines(prev => [...prev, lines[currentIndex]]);
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [content, speed]);

  if (!content) return null;

  return (
    <div className="relative">
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        showLineNumbers={true}
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          background: '#ffffff'
        }}
      >
        {visibleLines.join('\n')}
      </SyntaxHighlighter>
      {!isComplete && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
      )}
    </div>
  );
};

const DiffStreamingContent = ({ diffContent, speed = 10 }) => {
  const [visibleHtml, setVisibleHtml] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!diffContent) return;
    
    const diffLines = diffContent.split('\n');
    setVisibleHtml('');
    setIsComplete(false);
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < diffLines.length) {
        setVisibleHtml(prev => prev + diffLines[currentIndex] + '\n');
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [diffContent, speed]);

  if (!diffContent) return null;

  return (
    <div className="relative">
      <div className="diff-container" dangerouslySetInnerHTML={{ __html: visibleHtml }} />
      {!isComplete && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
      )}
    </div>
  );
};

const Diff2HtmlComponent = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [latestStreamedFile, setLatestStreamedFile] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");
  const [openFolders, setOpenFolders] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [streamedUpdates, setStreamedUpdates] = useState({});
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const buildFileTree = (fileList) => {
    const fileTree = {};
    fileList.forEach((file) => {
      const parts = file.filepath.split("/");
      let current = fileTree;

      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          if (!current.files) current.files = [];
          current.files.push(file);
        } else {
          if (!current.folders) current.folders = {};
          if (!current.folders[part]) current.folders[part] = {};
          current = current.folders[part];
        }
      });
    });
    return fileTree;
  };

  const getDiffCount = (diff) => {
    if (!diff) return null;
    const addedLines = (diff.match(/^\+/gm) || []).length;
    const removedLines = (diff.match(/^\-/gm) || []).length;
    
    if (addedLines === 0 && removedLines === 0) return null;
    
    return (
      <div className="flex items-center space-x-1 text-xs font-medium">
        {addedLines > 0 && (
          <span className="text-green-600">+{addedLines}</span>
        )}
        {removedLines > 0 && (
          <span className="text-red-600">-{removedLines}</span>
        )}
      </div>
    );
  };

  const connectWebSocket = () => {
    ws.current = new WebSocket(WebSocketURL);

    ws.current.onmessage = (event) => {
      const fileData = JSON.parse(event.data);
      
      setFiles((prevFiles) => {
        const fileIndex = prevFiles.findIndex(
          (file) => file.filepath === fileData.filepath
        );
        
        const updatedFiles = [...prevFiles];
        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], ...fileData };
        } else {
          updatedFiles.push(fileData);
        }

        setStreamedUpdates(prev => ({
          ...prev,
          [fileData.filepath]: fileData
        }));

        if (!selectedFile) {
          setLatestStreamedFile(fileData);
          renderDiff(fileData);
        }

        return updatedFiles;
      });
    };

    ws.current.onclose = () => {
      console.log("WebSocket closed. Attempting to reconnect...");
      reconnectTimeout.current = setTimeout(() => connectWebSocket(), 5000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.current.close();
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, []);

  const renderDiff = (file) => {
    if (!file) return;

    if (!file.diff || file.diff.trim() === "") {
      const language = file.extension.replace('.', '');
      setDiffHtml(
        <StreamingContent 
          content={file.current_code || ''} 
          language={language}
        />
      );
    } else {
      const diffOutput = parse(file.diff);
      const prettyHtml = html(diffOutput, {
        outputFormat: "line-by-line",
        matching: 'lines',
        drawFileList: false,
      });
      setDiffHtml(
        <DiffStreamingContent diffContent={prettyHtml} />
      );
    }
  };

  useEffect(() => {
    if (selectedFile) {
      renderDiff(selectedFile);
    } else if (latestStreamedFile) {
      renderDiff(latestStreamedFile);
    }
  }, [selectedFile, latestStreamedFile]);

  const handleFileClick = (file) => {
    if (selectedFile && file.filepath === selectedFile.filepath) {
      setSelectedFile(null);
      const latestVersion = streamedUpdates[file.filepath] || latestStreamedFile;
      if (latestVersion) {
        renderDiff(latestVersion);
      }
    } else {
      setSelectedFile(file);
      renderDiff(file);
    }
  };

  const handleFolderClick = (folderPath) => {
    setOpenFolders((prevOpenFolders) => ({
      ...prevOpenFolders,
      [folderPath]: !prevOpenFolders[folderPath],
    }));
  };

  useEffect(() => {
    if (selectedFile && streamedUpdates[selectedFile.filepath]) {
      setSelectedFile(prev => ({
        ...prev,
        ...streamedUpdates[selectedFile.filepath]
      }));
    }
  }, [streamedUpdates]);

  const renderFileTree = (tree, folderPath = "") => {
    const folderEntries = Object.entries(tree.folders || {});
    const fileEntries = tree.files || [];

    const filteredFileEntries = fileEntries.filter(file =>
      file.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <>
        {folderEntries.map(([folderName, folderContent]) => {
          const fullPath = `${folderPath}/${folderName}`;
          const isOpen = openFolders[fullPath] !== false;

          return (
            <li key={fullPath} className="mb-1">
              <div
                className="flex items-center cursor-pointer hover:bg-gray-100 rounded-md p-1.5 transition-colors"
                onClick={() => handleFolderClick(fullPath)}
              >
                <span className="text-gray-500 mr-2">
                  {isOpen ? <FaFolderOpen className="text-blue-500" /> : <FaFolder className="text-gray-400" />}
                </span>
                <span className="text-sm font-medium text-gray-700">{folderName}</span>
              </div>
              {isOpen && (
                <ul className="ml-4 border-l border-gray-200">
                  {renderFileTree(folderContent, fullPath)}
                </ul>
              )}
            </li>
          );
        })}
        {filteredFileEntries.map((file) => (
          <li
            key={file.filepath}
            className={`group relative flex items-center px-2 py-1.5 my-0.5 rounded-md cursor-pointer transition-all
              ${selectedFile?.filepath === file.filepath
                ? "bg-blue-100 text-blue-700"
                : "hover:bg-gray-100"
              }`}
            onClick={() => handleFileClick(file)}
          >
            <div className="flex items-center w-full">
              <FileIcon filename={file.filename} />
              <span className="text-sm truncate flex-1">{file.filename}</span>
              <div className="ml-2">
                {getDiffCount(file.diff)}
              </div>
              {selectedFile?.filepath === file.filepath && 
               streamedUpdates[file.filepath] && (
                <div className="ml-2 text-xs text-blue-500">•</div>
              )}
            </div>
          </li>
        ))}
      </>
    );
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-gray-100 border-0 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto px-3 py-4">
          <ul className="space-y-1">
            {renderFileTree(buildFileTree(files))}
          </ul>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              {selectedFile ? (
                <>
                  {selectedFile.filename}
                  <span className="ml-2 text-sm text-gray-500">(Selected)</span>
                  {streamedUpdates[selectedFile.filepath] && (
                    <span className="ml-2 text-xs text-blue-500">(Updates available)</span>
                  )}
                </>
              ) : latestStreamedFile ? (
                <>
                  {latestStreamedFile.filename}
                  <span className="ml-2 text-sm text-gray-500">(Latest Change)</span>
                </>
              ) : (
                "No files to display"
              )}
            </h1>
            {(selectedFile || latestStreamedFile) && (
              <span className="ml-4 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-sm rounded-full">
                {(selectedFile || latestStreamedFile).extension}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="rounded-lg shadow-sm border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              {diffHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diff2HtmlComponent;
