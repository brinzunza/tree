import React, { useState, useRef, useEffect } from 'react';

function CanvasView({ tree, onAsk, onClear }) {
  const [nodes, setNodes] = useState({});
  const [dragging, setDragging] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const calculateLayout = () => {
      const newNodes = {};
      const positioned = new Set();

      const getSubtreeWidth = (nodeId) => {
        const node = tree.nodes[nodeId];
        if (!node) return 1;

        const children = Object.values(tree.nodes).filter(n => n.parent_id === nodeId);
        if (children.length === 0) return 1;

        return children.reduce((sum, child) => sum + getSubtreeWidth(child.id), 0);
      };

      const positionNode = (nodeId, x, y, offsetX = 0) => {
        if (positioned.has(nodeId)) return offsetX;

        const node = tree.nodes[nodeId];
        if (!node) return offsetX;

        if (nodes[nodeId] && positioned.has(nodeId)) {
          newNodes[nodeId] = nodes[nodeId];
        } else {
          newNodes[nodeId] = { x: x + offsetX, y };
        }

        positioned.add(nodeId);

        const children = Object.values(tree.nodes).filter(n => n.parent_id === nodeId);

        if (children.length > 0) {
          let currentX = 0;

          children.forEach((child) => {
            const childWidth = getSubtreeWidth(child.id);
            const childCenter = currentX + (childWidth * 350) / 2;
            positionNode(child.id, x + offsetX - (children.length * 350) / 2 + childCenter, y + 150);
            currentX += childWidth * 350;
          });
        }

        return offsetX;
      };

      const roots = Object.values(tree.nodes).filter(n => n.parent_id === null);
      let currentX = 400;
      roots.forEach((root) => {
        const width = getSubtreeWidth(root.id);
        positionNode(root.id, currentX, 50);
        currentX += width * 400;
      });

      return newNodes;
    };

    if (Object.keys(tree.nodes).length > 0) {
      setNodes(calculateLayout());
    }
  }, [tree]);

  const handleMouseDown = (e, nodeId) => {
    if (e.button === 0) {
      e.stopPropagation();
      setDragging(nodeId);
      setOffset({
        x: e.clientX - nodes[nodeId].x,
        y: e.clientY - nodes[nodeId].y
      });
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setNodes({
        ...nodes,
        [dragging]: {
          x: e.clientX - offset.x,
          y: e.clientY - offset.y
        }
      });
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleAsk = async (parentId) => {
    if (!inputText.trim() || loading) return;

    setLoading(true);
    const response = await fetch('http://localhost:5001/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: inputText,
        parent_id: parentId
      })
    });

    const data = await response.json();
    onAsk(data.tree);
    setInputText('');
    setSelectedNode(data.node_id);
    setLoading(false);
  };

  const handleNodeClick = (nodeId, e) => {
    e.stopPropagation();
    setSelectedNode(nodeId);
  };

  const renderConnections = () => {
    const lines = [];
    Object.values(tree.nodes).forEach(node => {
      if (node.parent_id !== null && nodes[node.id] && nodes[node.parent_id]) {
        const parent = nodes[node.parent_id];
        const child = nodes[node.id];

        lines.push(
          <line
            key={`line-${node.parent_id}-${node.id}`}
            x1={parent.x + 100}
            y1={parent.y + 70}
            x2={child.x + 100}
            y2={child.y}
            stroke="#333333"
            strokeWidth="1"
          />
        );
      }
    });
    return lines;
  };

  const selectedNodeData = selectedNode !== null ? tree.nodes[selectedNode] : null;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundColor: '#ffffff',
          backgroundImage: 'radial-gradient(circle, #cccccc 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
            {renderConnections()}
          </g>
        </svg>

        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {Object.values(tree.nodes).map(node => {
            if (!nodes[node.id]) return null;

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: nodes[node.id].x,
                  top: nodes[node.id].y,
                  width: '200px',
                  padding: '10px',
                  backgroundColor: selectedNode === node.id ? '#f0f0f0' : '#ffffff',
                  border: selectedNode === node.id ? '2px solid #000000' : '1px solid #333333',
                  cursor: dragging === node.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(node.id, e)}
              >
                <div style={{ color: '#000000', fontSize: '10px', fontWeight: '500' }}>
                  {node.question}
                </div>
              </div>
            );
          })}

          {Object.keys(tree.nodes).length === 0 && (
            <div
              style={{
                position: 'absolute',
                left: 100,
                top: 100,
                padding: '20px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #333333',
                color: '#666666',
                fontSize: '12px'
              }}
            >
              start a conversation to see the tree
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: '1px solid #cccccc'
        }}
      >
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #cccccc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', textTransform: 'lowercase', color: '#000000' }}>
            tree chat
          </h1>
          <button
            onClick={onClear}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: '1px solid #333333',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              textTransform: 'lowercase'
            }}
          >
            clear chat
          </button>
        </div>

        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {selectedNodeData ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#666666', fontSize: '11px', marginBottom: '8px', textTransform: 'lowercase' }}>
                question
              </div>
              <div style={{ color: '#000000', fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>
                {selectedNodeData.question}
              </div>

              <div style={{ color: '#666666', fontSize: '11px', marginBottom: '8px', textTransform: 'lowercase' }}>
                answer
              </div>
              <div style={{
                color: '#000000',
                fontSize: '12px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                marginBottom: '30px',
                padding: '15px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #cccccc'
              }}>
                {selectedNodeData.answer}
              </div>
            </div>

            <div style={{ marginTop: 'auto' }}>
              <div style={{ color: '#666666', fontSize: '11px', marginBottom: '10px', textTransform: 'lowercase' }}>
                follow up question
              </div>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="ask a follow up..."
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #333333',
                  color: '#000000',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  marginBottom: '10px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAsk(selectedNode);
                  }
                }}
              />
              <button
                onClick={() => handleAsk(selectedNode)}
                disabled={loading || !inputText.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  border: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  cursor: loading || !inputText.trim() ? 'not-allowed' : 'pointer',
                  textTransform: 'lowercase'
                }}
              >
                {loading ? 'thinking...' : 'ask'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            {Object.keys(tree.nodes).length === 0 ? (
              <>
                <div style={{ color: '#666666', fontSize: '11px', marginBottom: '20px', textTransform: 'lowercase' }}>
                  start conversation
                </div>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="ask a question..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #333333',
                    color: '#000000',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    marginBottom: '10px'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAsk(null);
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleAsk(null)}
                  disabled={loading || !inputText.trim()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    cursor: loading || !inputText.trim() ? 'not-allowed' : 'pointer',
                    textTransform: 'lowercase'
                  }}
                >
                  {loading ? 'thinking...' : 'start'}
                </button>
              </>
            ) : (
              <div style={{ color: '#666666', fontSize: '12px' }}>
                click a node to view details
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default CanvasView;
