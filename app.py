import sys
from pathlib import Path

# This securely runs the actual app script in the current namespace
# without using 'import *' which pollutes the namespace.
# Use __file__ to ensure the path is correct regardless of where the command is run from.
target_file = Path(__file__).resolve().parent / "chatbot_back" / "app.py"
exec(target_file.read_text(encoding="utf-8"))
