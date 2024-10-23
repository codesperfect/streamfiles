import React, { useState, useEffect } from "react";
import { Diff2Html } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import "./App.css"; // Add custom CSS for layout

const WebSocketURL = "ws://localhost:6789"; // Replace with your WebSocket server URL

const App = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");

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
        setFileContent(fileData.current_code);
        const diffOutput = Diff2Html.getPrettyHtml(fileData.diff, {
          inputFormat: "diff",
          showFiles: true,
          matching: "lines",
          outputFormat: "side-by-side",
        });
        setDiffHtml(diffOutput);
      }
    };

    return () => ws.close();
  }, [selectedFile]);

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setFileContent(file.current_code);
    const diffOutput = Diff2Html.getPrettyHtml(file.diff, {
      inputFormat: "diff",
      showFiles: true,
      matching: "lines",
      outputFormat: "side-by-side",
    });
    setDiffHtml(diffOutput);
  };

  return (
    <div className="container">
      <div className="sidebar">
        <h3>Live Files</h3>
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
            <div className="diff-viewer" dangerouslySetInnerHTML={{ __html: diffHtml }} />
          </>
        ) : (
          <p>Select a file to view its content and diff.</p>
        )}
      </div>
    </div>
  );
};

export default App;
