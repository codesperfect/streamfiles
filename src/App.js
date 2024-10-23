import React from "react";
import './App.css'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Diff2HtmlComponent from "./pages/Diff2HtmlComponent";
import ReactDiffViewerComponent from "./pages/ReactDiffViewerComponent";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/diff2html" element={<Diff2HtmlComponent />} />
        <Route path="/diffview" element={<ReactDiffViewerComponent/>} />
        {/* You can add more routes here for other components */}
        <Route path="*" element={<div>404 Page Not Found</div>} />
  
      </Routes>
    </Router>
  );
};

export default App;
