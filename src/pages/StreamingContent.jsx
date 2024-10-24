import React, { useState, useEffect, useRef } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Import languages
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell';

// Register all languages
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('powershell', powershell);

// File extension to language mapping
const fileExtensionToLanguage = {
  // JavaScript & TypeScript
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'typescript',
  'mjs': 'javascript',
  'cjs': 'javascript',

  // Python
  'py': 'python',
  'pyc': 'python',
  'pyw': 'python',
  'ipynb': 'python',

  // Java
  'java': 'java',
  'class': 'java',
  'jar': 'java',

  // C-family
  'c': 'cpp',
  'cpp': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'cs': 'csharp',

  // Web
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'css',
  'sass': 'css',
  'less': 'css',

  // Ruby
  'rb': 'ruby',
  'erb': 'ruby',
  'gemspec': 'ruby',

  // PHP
  'php': 'php',
  'phtml': 'php',

  // Swift
  'swift': 'swift',

  // Rust
  'rs': 'rust',
  'rlib': 'rust',

  // Go
  'go': 'go',

  // Database
  'sql': 'sql',

  // Config & Data
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'markup',
  'md': 'markdown',
  'markdown': 'markdown',

  // Shell
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  'ps1': 'powershell',
  'psm1': 'powershell',
  'psd1': 'powershell',
};

const getLanguageFromFileName = (fileName) => {
  if (!fileName) return 'javascript'; // default fallback
  
  // Extract extension from filename
  const extension = fileName.split('.').pop().toLowerCase();
  
  // Return mapped language or default to javascript
  return fileExtensionToLanguage[extension] || 'javascript';
};

const StreamingContent = ({
  content,
  fileName, // New prop for filename
  speed = 10,
  maxHeight = '600px',
  showLineNumbers = true,
  fontSize = '12px',
  lineHeight = '1.4',
  theme = oneLight,
  className = ''
}) => {
  const [visibleLines, setVisibleLines] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      const scrollContainer = containerRef.current.querySelector('pre');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (!content) return;

    const lines = content.split('\n').filter(line => line !== undefined);
    setVisibleLines([]);
    setIsComplete(false);
    setVisibleLines([lines[0]]);

    let currentIndex = 1;
    let timeoutId;

    const addNextLine = () => {
      if (currentIndex < lines.length) {
        setVisibleLines(prev => [...prev, lines[currentIndex]]);
        currentIndex++;
        timeoutId = setTimeout(addNextLine, speed);
        setTimeout(scrollToBottom, 0);
      } else {
        setIsComplete(true);
      }
    };

    timeoutId = setTimeout(addNextLine, speed);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [content, speed]);

  useEffect(() => {
    scrollToBottom();
  }, [visibleLines]);

  if (!content) return null;

  const language = getLanguageFromFileName(fileName);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {fileName && (
        <div className="text-xs text-gray-500 mb-2 px-2">
          {fileName}
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={theme}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          background: '#ffffff',
          fontSize,
          lineHeight,
          padding: '0.75rem',
          maxHeight,
          overflow: 'auto'
        }}
        codeTagProps={{
          style: {
            fontSize,
            lineHeight
          }
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

export default StreamingContent;