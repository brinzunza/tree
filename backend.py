import os
import json
from flask import Flask, request, jsonify
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

    if parent_id is not None:
        context = tree.get_context_chain(parent_id)
    else:
        context = []

    messages = context + [{'role': 'user', 'content': question}]

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
