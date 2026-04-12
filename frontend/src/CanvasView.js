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
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [leftPanelWidth, setLeftPanelWidth] = useState(40);
  const [isResizing, setIsResizing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [systemMessages, setSystemMessages] = useState([]);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedNode, streamingAnswer, systemMessages, pendingQuestion]);

  useEffect(() => {
    const calculateLayout = () => {
      const newNodes = {};
      const positioned = new Set();

      // Get current canvas width dynamically
      const canvasWidth = window.innerWidth * (leftPanelWidth / 100);
      const centerX = canvasWidth / 2;

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
      const totalRootWidth = roots.reduce((sum, root) => sum + getSubtreeWidth(root.id), 0);
      let currentX = centerX - (totalRootWidth * 200);

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
  }, [tree, leftPanelWidth]);

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
    setIsResizing(false);
  };

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isResizing) {
        const containerWidth = window.innerWidth;
        const newLeftWidth = (e.clientX / containerWidth) * 100;
        // Allow wider range but with some constraints
        if (newLeftWidth >= 5 && newLeftWidth <= 95) {
          setLeftPanelWidth(newLeftWidth);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      // Use requestAnimationFrame for smoother updates
      const handleMove = (e) => {
        requestAnimationFrame(() => handleGlobalMouseMove(e));
      };

      document.addEventListener('mousemove', handleMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isResizing]);

  const addSystemMessage = (message, type = 'info') => {
    setSystemMessages(prev => [...prev, {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    }]);
  };

  const handleSaveContext = (name) => {
    try {
      const contexts = JSON.parse(localStorage.getItem('treeContexts') || '{}');
      contexts[name] = {
        tree: tree,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('treeContexts', JSON.stringify(contexts));
      addSystemMessage(`Context saved as "${name}"`, 'success');
    } catch (error) {
      console.error('Error saving context:', error);
      addSystemMessage('Failed to save context', 'error');
    }
  };

  const handleLoadContext = (name) => {
    try {
      const contexts = JSON.parse(localStorage.getItem('treeContexts') || '{}');
      if (contexts[name]) {
        onAsk(contexts[name].tree);
        setSelectedNode(null);
        addSystemMessage(`Context "${name}" loaded`, 'success');
      } else {
        addSystemMessage(`Context "${name}" not found. Use /list to see available contexts.`, 'error');
      }
    } catch (error) {
      console.error('Error loading context:', error);
      addSystemMessage('Failed to load context', 'error');
    }
  };

  const handleDeleteContext = (name) => {
    try {
      const contexts = JSON.parse(localStorage.getItem('treeContexts') || '{}');

      if (contexts[name]) {
        delete contexts[name];
        localStorage.setItem('treeContexts', JSON.stringify(contexts));
        addSystemMessage(`Context "${name}" deleted successfully`, 'success');
      } else {
        addSystemMessage(`Context "${name}" not found. Use /list to see available contexts.`, 'error');
      }
    } catch (error) {
      console.error('Error deleting context:', error);
      addSystemMessage('Failed to delete context', 'error');
    }
  };

  const handleListContexts = () => {
    try {
      const contexts = JSON.parse(localStorage.getItem('treeContexts') || '{}');
      const contextNames = Object.keys(contexts);

      if (contextNames.length === 0) {
        addSystemMessage('No saved contexts. Use /save [name] to save a context.', 'info');
      } else {
        const contextList = contextNames.map(name => {
          const date = new Date(contexts[name].savedAt).toLocaleString();
          const nodeCount = Object.keys(contexts[name].tree.nodes || {}).length;
          return `• ${name} - ${nodeCount} nodes (saved: ${date})`;
        }).join('\n');
        addSystemMessage(`Saved contexts:\n\n${contextList}\n\nUse /load [name] to load a context\nUse /delete [name] to delete a context`, 'info');
      }
    } catch (error) {
      console.error('Error listing contexts:', error);
      addSystemMessage('Failed to list contexts', 'error');
    }
  };

  const handleAsk = async (parentId) => {
    if (!inputText.trim() || loading) return;

    const currentQuestion = inputText.trim();
    setInputText('');

    // Handle commands
    if (currentQuestion.startsWith('/')) {
      const [command, ...args] = currentQuestion.split(' ');

      switch (command.toLowerCase()) {
        case '/save':
          handleSaveContext(args.join(' ') || 'default');
          return;
        case '/load':
          handleLoadContext(args.join(' ') || 'default');
          return;
        case '/delete':
          if (args.length === 0) {
            addSystemMessage('Please specify a context name to delete. Usage: /delete [name]', 'error');
          } else {
            handleDeleteContext(args.join(' '));
          }
          return;
        case '/list':
          handleListContexts();
          return;
        case '/help':
          addSystemMessage('Available commands:\n\n• /save [name] - Save current context\n• /load [name] - Load saved context\n• /delete [name] - Delete saved context\n• /list - List all saved contexts\n• /help - Show this help', 'info');
          return;
        default:
          addSystemMessage(`Unknown command: ${command}\nType /help for available commands`, 'error');
          return;
      }
    }

    setLoading(true);
    setStreamingAnswer('');
    setPendingQuestion(currentQuestion);
    setSystemMessages([]); // Clear system messages when asking a new question

    try {
      const response = await fetch('http://localhost:5001/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          question: currentQuestion,
          parent_id: parentId,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const contentType = response.headers.get('content-type');

      // Check if response is streaming (SSE) or regular JSON
      if (contentType && (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson'))) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedNodeId = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              let data;

              // Try parsing as SSE format (data: {...})
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr === '[DONE]') continue;
                data = JSON.parse(jsonStr);
              } else {
                // Try parsing as plain JSON (NDJSON format)
                data = JSON.parse(line);
              }

              if (data.type === 'token' || data.delta) {
                const content = data.content || data.delta || '';
                setStreamingAnswer(prev => prev + content);
              } else if (data.type === 'done' || data.tree) {
                if (data.tree) {
                  onAsk(data.tree);
                  receivedNodeId = data.node_id;
                  setSelectedNode(data.node_id);
                }
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e, 'Line:', line);
            }
          }
        }
      } else {
        // Fallback to regular JSON response
        const data = await response.json();
        onAsk(data.tree);
        setSelectedNode(data.node_id);
      }
      setStreamingAnswer(''); // Clear streaming answer
    } catch (error) {
      console.error('Error asking question:', error);
      addSystemMessage('Failed to get response. Please try again.', 'error');
    } finally {
      setLoading(false);
      setPendingQuestion(null);
    }
  };

  const handleNodeClick = (nodeId, e) => {
    e.stopPropagation();
    setSelectedNode(nodeId);
  };

  const getConversationPath = (nodeId) => {
    const path = [];
    let currentId = nodeId;

    while (currentId !== null) {
      const node = tree.nodes[currentId];
      if (node) {
        path.unshift(node);
        currentId = node.parent_id;
      } else {
        break;
      }
    }

    return path;
  };

  const renderConnections = () => {
    const paths = [];
    Object.values(tree.nodes).forEach(node => {
      if (node.parent_id !== null && nodes[node.id] && nodes[node.parent_id]) {
        const parent = nodes[node.parent_id];
        const child = nodes[node.id];

        const nodeWidth = 200;
        const padding = 10;
        const border = 1;

        // Get actual parent node height
        const parentElement = nodeRefs.current[node.parent_id];
        const parentHeight = parentElement ? parentElement.offsetHeight : 40;

        const x1 = parent.x + nodeWidth / 2;
        const y1 = parent.y + parentHeight;
        const x2 = child.x + nodeWidth / 2;
        const y2 = child.y;

        const midY = (y1 + y2) / 2;

        const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

        paths.push(
          <path
            key={`line-${node.parent_id}-${node.id}`}
            d={pathD}
            stroke="#333333"
            strokeWidth="2"
            fill="none"
          />
        );
      }
    });
    return paths;
  };

  const selectedNodeData = selectedNode !== null ? tree.nodes[selectedNode] : null;

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      <div
        ref={canvasRef}
        style={{
          width: `${leftPanelWidth}%`,
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
                ref={(el) => { if (el) nodeRefs.current[node.id] = el; }}
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
        onMouseDown={handleResizeMouseDown}
        style={{
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? '#000000' : '#cccccc',
          transition: isResizing ? 'none' : 'background-color 0.2s',
          position: 'relative',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = '#666666';
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = '#cccccc';
          }
        }}
      />

      <div
        style={{
          width: `${100 - leftPanelWidth}%`,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedNodeData ? (
          <>
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
              {getConversationPath(selectedNode).map((node, index, array) => {
                return (
                  <div key={node.id} style={{ marginBottom: '24px' }}>
                    {/* Question */}
                    <div style={{
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'flex-end'
                    }}>
                      <div style={{
                        maxWidth: '85%',
                        padding: '12px 16px',
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        borderRadius: '12px 12px 2px 12px',
                        wordWrap: 'break-word'
                      }}>
                        {node.question}
                      </div>
                    </div>

                    {/* Answer */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-start'
                    }}>
                      <div style={{
                        maxWidth: '85%',
                        padding: '12px 16px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        borderRadius: '12px 12px 12px 2px',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {node.answer}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pending Question & Streaming Answer */}
              {pendingQuestion && (
                <div style={{ marginBottom: '24px' }}>
                  {/* Pending Question */}
                  <div style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '12px 16px',
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      borderRadius: '12px 12px 2px 12px',
                      wordWrap: 'break-word'
                    }}>
                      {pendingQuestion}
                    </div>
                  </div>

                  {/* Streaming or Loading Answer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      borderRadius: '12px 12px 12px 2px',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      border: '1px solid #e0e0e0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {streamingAnswer || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>thinking...</span>}
                      {streamingAnswer && <span style={{ opacity: 0.6, marginLeft: '2px' }}>▊</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* System Messages */}
              {systemMessages.map((msg) => (
                <div key={msg.id} style={{
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    maxWidth: '90%',
                    padding: '10px 14px',
                    backgroundColor: msg.type === 'error' ? '#fff5f5' : msg.type === 'success' ? '#f0fff4' : '#f0f9ff',
                    color: msg.type === 'error' ? '#c53030' : msg.type === 'success' ? '#2f855a' : '#2c5282',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    border: `1px solid ${msg.type === 'error' ? '#fed7d7' : msg.type === 'success' ? '#c6f6d5' : '#bee3f8'}`,
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    {msg.message}
                  </div>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>

            <div style={{
              padding: '20px',
              borderTop: '1px solid #cccccc',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ color: '#666666', fontSize: '11px', marginBottom: '10px', textTransform: 'lowercase' }}>
                follow up question
              </div>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="ask a follow up... (type /help for commands)"
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
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {Object.keys(tree.nodes).length === 0 ? (
              <>
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#fafafa' }}>
                  {/* Pending Question & Streaming Answer for first query */}
                  {pendingQuestion && (
                    <div style={{ marginBottom: '24px' }}>
                      {/* Pending Question */}
                      <div style={{
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{
                          maxWidth: '85%',
                          padding: '12px 16px',
                          backgroundColor: '#000000',
                          color: '#ffffff',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          borderRadius: '12px 12px 2px 12px',
                          wordWrap: 'break-word'
                        }}>
                          {pendingQuestion}
                        </div>
                      </div>

                      {/* Streaming or Loading Answer */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-start'
                      }}>
                        <div style={{
                          maxWidth: '85%',
                          padding: '12px 16px',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          borderRadius: '12px 12px 12px 2px',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          border: '1px solid #e0e0e0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          {streamingAnswer || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>thinking...</span>}
                          {streamingAnswer && <span style={{ opacity: 0.6, marginLeft: '2px' }}>▊</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* System Messages */}
                  {systemMessages.map((msg) => (
                    <div key={msg.id} style={{
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        maxWidth: '90%',
                        padding: '10px 14px',
                        backgroundColor: msg.type === 'error' ? '#fff5f5' : msg.type === 'success' ? '#f0fff4' : '#f0f9ff',
                        color: msg.type === 'error' ? '#c53030' : msg.type === 'success' ? '#2f855a' : '#2c5282',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        borderRadius: '8px',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        border: `1px solid ${msg.type === 'error' ? '#fed7d7' : msg.type === 'success' ? '#c6f6d5' : '#bee3f8'}`,
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        {msg.message}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div style={{
                  padding: '20px',
                  borderTop: '1px solid #cccccc',
                  backgroundColor: '#ffffff'
                }}>
                  <div style={{ color: '#666666', fontSize: '11px', marginBottom: '10px', textTransform: 'lowercase' }}>
                    start conversation
                  </div>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="ask a question... (type /help for commands)"
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
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', color: '#666666', fontSize: '12px' }}>
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
