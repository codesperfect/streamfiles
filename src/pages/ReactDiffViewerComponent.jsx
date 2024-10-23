import React, { useState, useEffect } from "react";
import ReactDiffViewer from 'react-diff-viewer';

const WebSocketURL = "ws://localhost:6789"; // Replace with your WebSocket server URL

const ReactDiffViewerComponent = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previousCode, setPreviousCode] = useState("");
  const [currentCode, setCurrentCode] = useState("");

  useEffect(() => {
    const ws = new WebSocket(WebSocketURL);

    ws.onmessage = (event) => {
      const fileData = JSON.parse(event.data);

      // Add the file to the list of live files if not already present
      setFiles((prevFiles) => {
        if (!prevFiles.some((file) => file.filepath === fileData.filepath)) {
          return [...prevFiles, fileData];
        }
        return prevFiles;
      });

      // If the current file is the one being updated, update its content and diff
      if (selectedFile && fileData.filepath === selectedFile.filepath) {
        setPreviousCode(fileData.previous_code || "");  // Get the previous version of the file
        setCurrentCode(fileData.current_code);  // Get the current version of the file
      }
    };

    return () => ws.close();
  }, [selectedFile]);

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setPreviousCode(file.previous_code || "");  // Set the previous version of the selected file
    setCurrentCode(file.current_code);  // Set the current version of the selected file
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h3>File Monitor</h3>
        <ul>
          {files.map((file) => (
            <li
              key={file.filepath}
              className={file.filepath === selectedFile?.filepath ? "active" : ""}
              onClick={() => handleFileClick(file)}
            >
              {file.filename}
            </li>
          ))}
        </ul>
      </div>
      <div className="content">
        {selectedFile ? (
          <>
            <h3>{selectedFile.filename}</h3>
            {/* ReactDiffViewer rendering the difference between previous and current code */}
            <ReactDiffViewer
              oldValue={previousCode}
              newValue={currentCode}
              splitView={true}  // You can change to false for unified view
              compareMethod="diffWords"  // Word-level comparison
            />
          </>
        ) : (
          <p>Select a file to view its content and diff.</p>
        )}
      </div>
    </div>
  );
};

export default ReactDiffViewerComponent;
