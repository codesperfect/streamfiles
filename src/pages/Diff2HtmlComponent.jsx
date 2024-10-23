import React, { useState, useEffect, useRef } from "react";
import {
  FaFolderOpen,
  FaFileAlt,
  FaFileCode,
  FaFileCsv,
  FaFilePdf,
  FaJsSquare,
  FaPython,
  FaHtml5,
} from "react-icons/fa";
import { parse, html } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

const WebSocketURL = "ws://localhost:6789"; // Replace with your WebSocket server URL

const Diff2HtmlComponent = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");
  const ws = useRef(null); // Use a ref to persist WebSocket between renders
  const reconnectTimeout = useRef(null); // Use ref to keep track of reconnection timeout

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

  const connectWebSocket = () => {
    ws.current = new WebSocket(WebSocketURL);

    ws.current.onmessage = (event) => {
      const fileData = JSON.parse(event.data);

      setFiles((prevFiles) => {
        const fileIndex = prevFiles.findIndex(
          (file) => file.filepath === fileData.filepath
        );

        if (fileIndex !== -1) {
          const updatedFiles = [...prevFiles];
          updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], ...fileData };

          if (selectedFile && fileData.filepath === selectedFile.filepath) {
            setSelectedFile(fileData);
            renderDiff(fileData); // Live update of diff for the selected file
          }

          return updatedFiles;
        } else {
          return [...prevFiles, fileData];
        }
      });

      // Auto-select the latest file if no file is selected
      if (!selectedFile) {
        setSelectedFile(fileData);
        renderDiff(fileData); // Render the latest file's diff
      }
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

  const getFileIcon = (filename) => {
    const extension = filename.split(".").pop().toLowerCase();

    switch (extension) {
      case "js":
        return <FaJsSquare className="file-icon" style={{ color: "#F7DF1E" }} />;
      case "py":
        return <FaPython className="file-icon" style={{ color: "#3776AB" }} />;
      case "html":
        return <FaHtml5 className="file-icon" style={{ color: "#E34F26" }} />;
      case "pdf":
        return <FaFilePdf className="file-icon" style={{ color: "#FF0000" }} />;
      case "csv":
        return <FaFileCsv className="file-icon" style={{ color: "#008080" }} />;
      default:
        return <FaFileAlt className="file-icon" />;
    }
  };

  const renderFileTree = (tree, folderPath = "") => {
    const folderEntries = Object.entries(tree.folders || {});
    const fileEntries = tree.files || [];

    return (
      <>
        {folderEntries.map(([folderName, folderContent]) => {
          const fullPath = `${folderPath}/${folderName}`;

          return (
            <li key={fullPath} className="file-item">
              <div className="file-entry">
                <FaFolderOpen className="folder-icon" />
                <span>{folderName}</span>
              </div>
              <ul className="nested-files">
                {renderFileTree(folderContent, fullPath)}
              </ul>
            </li>
          );
        })}
        {fileEntries.map((file) => (
          <li
            key={file.filepath}
            className="file-item"
            onClick={() => handleFileClick(file)}
          >
            <div className="file-entry">
              {getFileIcon(file.filename)}
              <span>{file.filename}</span>
              {file.diff && (
                <span className="file-changes">{getDiffCount(file.diff)}</span>
              )}
            </div>
          </li>
        ))}
      </>
    );
  };

  const getDiffCount = (diff) => {
    const addedLines = (diff.match(/^\+[^+]/gm) || []).length; // Count only actual added lines (ignore diff markers)
    const removedLines = (diff.match(/^\-[^-]/gm) || []).length; // Count only actual removed lines (ignore diff markers)
  
    return (
      <span>
        <span style={{ color: "green", marginLeft: "10px" }}>
          +{addedLines}
        </span>
        <span style={{ color: "red", marginLeft: "5px" }}>
          -{removedLines}
        </span>
      </span>
    );
  };
  

  const handleFileClick = (file) => {
    setSelectedFile(file);
    renderDiff(file);
  };

  const renderDiff = (file) => {
    if (!file.diff || file.diff.trim() === "") {
      setDiffHtml(`<pre>${file.current_code}</pre>`);
    } else {
      const diffOutput = parse(file.diff);
      const prettyHtml = html(diffOutput, { outputFormat: "line-by-line" });
      setDiffHtml(prettyHtml);
    }
  };

  const fileTree = buildFileTree(files);

  return (
    <div className="container">
      <div className="sidebar">
        <ul className="file-structure">{renderFileTree(fileTree)}</ul>
      </div>
      <div className="content">
        {selectedFile ? (
          <>
            <h3>{selectedFile.filename}</h3>
            <div
              className="diff-viewer"
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          </>
        ) : (
          <p>Select a file to view its content and diff.</p>
        )}
      </div>
    </div>
  );
};

export default Diff2HtmlComponent;
