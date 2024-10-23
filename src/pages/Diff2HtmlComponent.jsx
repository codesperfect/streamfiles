import React, { useState, useEffect, useRef } from "react";
import { FaFolderOpen, FaFolder } from "react-icons/fa";
import { parse, html } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";
import FileIcon from "../components/FileIcons"; // Importing the new FileIcon component

const WebSocketURL = "ws://localhost:6789"; // Replace with your WebSocket server URL

const Diff2HtmlComponent = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [latestStreamedFile, setLatestStreamedFile] = useState(null);
  const [diffHtml, setDiffHtml] = useState("");
  const [openFolders, setOpenFolders] = useState({});
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // Helper function to transform flat file paths into a nested tree structure
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
          }
          return updatedFiles;
        } else {
          return [...prevFiles, fileData];
        }
      });

      setLatestStreamedFile(fileData);
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

  const renderFileTree = (tree, folderPath = "") => {
    const folderEntries = Object.entries(tree.folders || {});
    const fileEntries = tree.files || [];

    return (
      <>
        {folderEntries.map(([folderName, folderContent]) => {
          const fullPath = `${folderPath}/${folderName}`;
          const isOpen = openFolders[fullPath] !== false;

          return (
            <li key={fullPath} className="mb-0.5">
              <div
                className="flex items-center cursor-pointer text-gray-700"
                onClick={() => handleFolderClick(fullPath)}
              >
                {isOpen ? <FaFolderOpen /> : <FaFolder />}
                <span className="ml-1">{folderName}</span>
              </div>
              {isOpen && (
                <ul className="ml-5">
                  {renderFileTree(folderContent, fullPath)}
                </ul>
              )}
            </li>
          );
        })}
        {fileEntries.map((file) => (
          <li
            key={file.filepath}
            className={`px-1 py-0.5 flex items-center cursor-pointer hover:bg-gray-200 ${
              selectedFile?.filepath === file.filepath
                ? "bg-gray-300 rounded px-2"
                : ""
            }`}
            onClick={() => handleFileClick(file)}
          >
            <FileIcon filename={file.filename} /> {/* Using FileIcon */}
            <span className="truncate flex-1 text-left">{file.filename}</span>
            {file.diff && (
              <span className="ml-auto sticky right-0">{getDiffCount(file.diff)}</span>
            )}
          </li>
        ))}
      </>
    );
  };

  const getDiffCount = (diff) => {
    const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
    const removedLines = (diff.match(/^\-[^-]/gm) || []).length;
    return (
      <span className="sticky right-0">
        <span className="text-green-500">+{addedLines}</span>
        <span className="text-red-500 ml-1">-{removedLines}</span>
      </span>
    );
  };

  const handleFileClick = (file) => {
    if (selectedFile && file.filepath === selectedFile.filepath) {
      setSelectedFile(null);
      if (latestStreamedFile) {
        renderDiff(latestStreamedFile);
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

  const renderDiff = (file) => {
    if (!file.diff || file.diff.trim() === "") {
      setDiffHtml(`<pre>${file.current_code}</pre>`);
    } else {
      const diffOutput = parse(file.diff);
      const prettyHtml = html(diffOutput, { outputFormat: "line-by-line" });
      setDiffHtml(prettyHtml);
    }
  };

  useEffect(() => {
    if (!selectedFile && latestStreamedFile) {
      renderDiff(latestStreamedFile);
    }
  }, [latestStreamedFile, selectedFile]);

  const fileTree = buildFileTree(files);

  return (
    <div className="container mx-auto flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r-2 border-gray-300 p-1 overflow-y-auto overflow-x-hidden h-full">
        <ul>{renderFileTree(fileTree)}</ul>
      </div>

      {/* Diff Viewer */}
      <div className="w-full p-1 overflow-auto">
        <h3 className="text-lg font-semibold mb-1">
          {selectedFile ? selectedFile.filename : latestStreamedFile?.filename || "Latest Streamed File"}
        </h3>
        <div
          className="bg-white border border-gray-300 p-2 rounded shadow overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      </div>
    </div>
  );
};

export default Diff2HtmlComponent;
