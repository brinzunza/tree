import React, { useState } from 'react';
import './App.css';
import CanvasView from './CanvasView';

function App() {
  const [tree, setTree] = useState({ nodes: {} });

  const handleAsk = (newTree) => {
    setTree(newTree);
  };

  const handleClear = async () => {
    await fetch('http://localhost:5001/api/clear', {
      method: 'POST'
    });
    setTree({ nodes: {} });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <CanvasView tree={tree} onAsk={handleAsk} onClear={handleClear} />
    </div>
  );
}

export default App;
