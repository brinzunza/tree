# tree (a multidirectional chatbot interface)

a tree-based chatbot interface where conversations branch into multiple paths with context preservation.

## setup

### backend

```bash
pip install -r requirements.txt
.env file with  OPENAI_API_KEY=your_key_here
python3 backend.py
```

backend runs on `http://localhost:5000`

### frontend

```bash
cd frontend
npm install
npm start
```

frontend runs on `http://localhost:3000`

## usage

- ask a question to start a new conversation
- click any node in the tree to select it
- ask followup questions from any node to create branches
- the context chain shows the full conversation history up to the selected node
- click "start new conversation" to ask a question without context

## how it works

the system maintains a tree structure where:
- each node contains a question-answer pair
- nodes can have multiple children (branches)
- context is built by traversing from root to selected node
- chatgpt receives the full context chain for each new question
