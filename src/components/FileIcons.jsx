import React from "react";
import {
  FaFileAlt,
  FaFileCsv,
  FaFilePdf,
  FaJsSquare,
  FaPython,
  FaHtml5,
  FaCss3Alt,
  FaMarkdown,
  FaFileCode,
} from "react-icons/fa";

// This component returns appropriate icons based on the file extension
const FileIcon = ({ filename }) => {
  const extension = filename.split(".").pop().toLowerCase();

  switch (extension) {
    case "js":
      return <FaJsSquare className="text-yellow-500 mr-1" />;
    case "py":
      return <FaPython className="text-blue-500 mr-1" />;
    case "html":
      return <FaHtml5 className="text-orange-600 mr-1" />;
    case "pdf":
      return <FaFilePdf className="text-red-500 mr-1" />;
    case "csv":
      return <FaFileCsv className="text-teal-600 mr-1" />;
    case "css":
      return <FaCss3Alt className="text-blue-600 mr-1" />;
    case "md":
      return <FaMarkdown className="text-gray-600 mr-1" />;
    case "xml":
      return <FaFileCode className="text-purple-600 mr-1" />;
    default:
      return <FaFileAlt className="mr-1" />;
  }
};

export default FileIcon;
