import os
import json
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class TreeNode:
    def __init__(self, id, question, answer, parent_id=None):
        self.id = id
        self.question = question
        self.answer = answer
        self.parent_id = parent_id
        self.children = []

class ConversationTree:
    def __init__(self):
        self.nodes = {}
        self.node_counter = 0

    def add_node(self, question, answer, parent_id=None):
        node_id = self.node_counter
        self.node_counter += 1
        node = TreeNode(node_id, question, answer, parent_id)
        self.nodes[node_id] = node

        if parent_id is not None:
            self.nodes[parent_id].children.append(node_id)

        return node_id

    def get_context_chain(self, node_id):
        chain = []
        current_id = node_id

        while current_id is not None:
            node = self.nodes[current_id]
            chain.append({
                'role': 'user',
                'content': node.question
            })
            chain.append({
                'role': 'assistant',
                'content': node.answer
            })
            current_id = node.parent_id

        chain.reverse()
        return chain

    def to_dict(self):
        return {
            'nodes': {
                str(k): {
                    'id': v.id,
                    'question': v.question,
                    'answer': v.answer,
                    'parent_id': v.parent_id,
                    'children': v.children
                }
                for k, v in self.nodes.items()
            }
        }

tree = ConversationTree()

@app.route('/api/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question')
    parent_id = data.get('parent_id')
    use_streaming = data.get('stream', False)

    if parent_id is not None:
        context = tree.get_context_chain(parent_id)
    else:
        context = []

    messages = context + [{'role': 'user', 'content': question}]

    if use_streaming:
        def generate():
            full_answer = ''
            stream = client.chat.completions.create(
                model='gpt-4',
                messages=messages,
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_answer += content
                    # Send as NDJSON format for simplicity
                    yield json.dumps({
                        'type': 'token',
                        'content': content
                    }) + '\n'

            # After streaming is complete, add to tree and send final update
            node_id = tree.add_node(question, full_answer, parent_id)
            yield json.dumps({
                'type': 'done',
                'node_id': node_id,
                'tree': tree.to_dict()
            }) + '\n'

        return Response(
            stream_with_context(generate()),
            mimetype='application/x-ndjson',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
    else:
        # Non-streaming response (original behavior)
        response = client.chat.completions.create(
            model='gpt-4',
            messages=messages
        )

        answer = response.choices[0].message.content
        node_id = tree.add_node(question, answer, parent_id)

        return jsonify({
            'node_id': node_id,
            'answer': answer,
            'tree': tree.to_dict()
        })

@app.route('/api/tree', methods=['GET'])
def get_tree():
    return jsonify(tree.to_dict())

@app.route('/api/clear', methods=['POST'])
def clear_tree():
    global tree
    tree = ConversationTree()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')
