import React from "react";
import {
  FaFileAlt,
  FaFileCsv,
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileArchive,
  FaFileImage,
  FaFileVideo,
  FaFileAudio,
  FaJsSquare,
  FaHtml5,
  FaCss3Alt,
  FaMarkdown,
  FaFileCode,
  FaJava,
  FaPhp,
  FaRust,
  FaDatabase,
  FaDocker,
  FaYarn,
  FaNpm,
  FaGitAlt,
  FaSwift,
  FaTerminal,
  FaCog,
} from "react-icons/fa";
import {
  SiTypescript,
  SiRuby,
  SiCplusplus,
  SiCsharp,
  SiKotlin,
  SiGo,
  SiDart,
  SiLua,
  SiScala,
  SiElixir,
  SiGraphql,
  SiSass,
  SiLess,
  SiStylus,
  SiVuedotjs,
  SiAngular,
  SiReact,
  SiSvelte,
  SiPostgresql,
  SiMysql,
  SiMongodb,
  SiRedis,
  SiFigma,
  SiSketch,
} from "react-icons/si";
import { VscJson, VscRazor } from "react-icons/vsc";
import { BiLogoPython } from "react-icons/bi";

const FileIcon = ({ filename, className = "mr-1" }) => {
  // Extract extension and handle files without extensions
  const parts = filename.split(".");
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : "";
  const name = parts.join(".").toLowerCase();

  // Special cases for files without extensions or specific names
  if (!extension) {
    switch (name) {
      case "dockerfile":
        return <FaDocker className={`text-blue-600 ${className}`} />;
      case "license":
        return <FaFileAlt className={`text-gray-600 ${className}`} />;
      case "readme":
        return <FaMarkdown className={`text-gray-600 ${className}`} />;
      default:
        return <FaFileAlt className={`text-gray-400 ${className}`} />;
    }
  }

  // Map file extensions to icons and colors
  const iconMap = {
    // Programming Languages
    "js": () => <FaJsSquare className={`text-yellow-500 ${className}`} />,
    "jsx": () => <SiReact className={`text-blue-400 ${className}`} />,
    "ts": () => <SiTypescript className={`text-blue-600 ${className}`} />,
    "tsx": () => <SiTypescript className={`text-blue-500 ${className}`} />,
    "py": () => <BiLogoPython className={`text-blue-500 ${className}`} />,
    "java": () => <FaJava className={`text-red-600 ${className}`} />,
    "class": () => <FaJava className={`text-red-600 ${className}`} />,
    "jar": () => <FaJava className={`text-red-600 ${className}`} />,
    "php": () => <FaPhp className={`text-purple-600 ${className}`} />,
    "rb": () => <SiRuby className={`text-red-700 ${className}`} />,
    "rs": () => <FaRust className={`text-orange-700 ${className}`} />,
    "cpp": () => <SiCplusplus className={`text-blue-700 ${className}`} />,
    "c": () => <SiCplusplus className={`text-blue-800 ${className}`} />,
    "cs": () => <SiCsharp className={`text-green-600 ${className}`} />,
    "kt": () => <SiKotlin className={`text-orange-500 ${className}`} />,
    "go": () => <SiGo className={`text-blue-500 ${className}`} />,
    "dart": () => <SiDart className={`text-blue-400 ${className}`} />,
    "lua": () => <SiLua className={`text-navy-600 ${className}`} />,
    "scala": () => <SiScala className={`text-red-600 ${className}`} />,
    "ex": () => <SiElixir className={`text-purple-500 ${className}`} />,
    "swift": () => <FaSwift className={`text-orange-500 ${className}`} />,

    // Web Technologies
    "html": () => <FaHtml5 className={`text-orange-600 ${className}`} />,
    "htm": () => <FaHtml5 className={`text-orange-600 ${className}`} />,
    "css": () => <FaCss3Alt className={`text-blue-600 ${className}`} />,
    "scss": () => <SiSass className={`text-pink-600 ${className}`} />,
    "sass": () => <SiSass className={`text-pink-600 ${className}`} />,
    "less": () => <SiLess className={`text-blue-400 ${className}`} />,
    "styl": () => <SiStylus className={`text-green-500 ${className}`} />,
    "vue": () => <SiVuedotjs className={`text-green-500 ${className}`} />,
    "svelte": () => <SiSvelte className={`text-red-500 ${className}`} />,
    "ng": () => <SiAngular className={`text-red-600 ${className}`} />,

    // Data & Config Files
    "json": () => <VscJson className={`text-yellow-700 ${className}`} />,
    "yaml": () => <FaFileCode className={`text-red-400 ${className}`} />,
    "yml": () => <FaFileCode className={`text-red-400 ${className}`} />,
    "xml": () => <FaFileCode className={`text-orange-400 ${className}`} />,
    "csv": () => <FaFileCsv className={`text-green-600 ${className}`} />,
    "graphql": () => <SiGraphql className={`text-pink-600 ${className}`} />,
    "sql": () => <FaDatabase className={`text-blue-400 ${className}`} />,
    "db": () => <FaDatabase className={`text-blue-400 ${className}`} />,

    // Documentation & Text
    "md": () => <FaMarkdown className={`text-gray-600 ${className}`} />,
    "mdx": () => <FaMarkdown className={`text-gray-600 ${className}`} />,
    "txt": () => <FaFileAlt className={`text-gray-500 ${className}`} />,
    "pdf": () => <FaFilePdf className={`text-red-600 ${className}`} />,

    // Microsoft Office
    "doc": () => <FaFileWord className={`text-blue-700 ${className}`} />,
    "docx": () => <FaFileWord className={`text-blue-700 ${className}`} />,
    "xls": () => <FaFileExcel className={`text-green-700 ${className}`} />,
    "xlsx": () => <FaFileExcel className={`text-green-700 ${className}`} />,
    "ppt": () => <FaFilePowerpoint className={`text-red-700 ${className}`} />,
    "pptx": () => <FaFilePowerpoint className={`text-red-700 ${className}`} />,

    // Media Files
    "jpg": () => <FaFileImage className={`text-blue-400 ${className}`} />,
    "jpeg": () => <FaFileImage className={`text-blue-400 ${className}`} />,
    "png": () => <FaFileImage className={`text-blue-400 ${className}`} />,
    "gif": () => <FaFileImage className={`text-blue-400 ${className}`} />,
    "svg": () => <FaFileImage className={`text-blue-400 ${className}`} />,
    "mp4": () => <FaFileVideo className={`text-purple-400 ${className}`} />,
    "mov": () => <FaFileVideo className={`text-purple-400 ${className}`} />,
    "avi": () => <FaFileVideo className={`text-purple-400 ${className}`} />,
    "mp3": () => <FaFileAudio className={`text-green-400 ${className}`} />,
    "wav": () => <FaFileAudio className={`text-green-400 ${className}`} />,

    // Archive Files
    "zip": () => <FaFileArchive className={`text-yellow-600 ${className}`} />,
    "rar": () => <FaFileArchive className={`text-yellow-600 ${className}`} />,
    "7z": () => <FaFileArchive className={`text-yellow-600 ${className}`} />,
    "tar": () => <FaFileArchive className={`text-yellow-600 ${className}`} />,
    "gz": () => <FaFileArchive className={`text-yellow-600 ${className}`} />,

    // Development Tools & Config
    "gitignore": () => <FaGitAlt className={`text-orange-600 ${className}`} />,
    "npmrc": () => <FaNpm className={`text-red-600 ${className}`} />,
    "yarnrc": () => <FaYarn className={`text-blue-400 ${className}`} />,
    "env": () => <FaCog className={`text-gray-500 ${className}`} />,
    "sh": () => <FaTerminal className={`text-gray-600 ${className}`} />,
    "bash": () => <FaTerminal className={`text-gray-600 ${className}`} />,
    "zsh": () => <FaTerminal className={`text-gray-600 ${className}`} />,
    "fish": () => <FaTerminal className={`text-gray-600 ${className}`} />,
    "ps1": () => <FaTerminal className={`text-blue-600 ${className}`} />,

    // Design Files
    "fig": () => <SiFigma className={`text-purple-500 ${className}`} />,
    "sketch": () => <SiSketch className={`text-yellow-500 ${className}`} />,

    // Database Files
    "sqlite": () => <FaDatabase className={`text-blue-500 ${className}`} />,
    "sqlite3": () => <FaDatabase className={`text-blue-500 ${className}`} />,
    "postgres": () => <SiPostgresql className={`text-blue-600 ${className}`} />,
    "mysql": () => <SiMysql className={`text-blue-700 ${className}`} />,
    "mongodb": () => <SiMongodb className={`text-green-500 ${className}`} />,
    "redis": () => <SiRedis className={`text-red-500 ${className}`} />,
  };

  // Return the mapped icon or default icon
  return iconMap[extension]?.() || <FaFileAlt className={`text-gray-400 ${className}`} />;
};

export default FileIcon;