import asyncio
import websockets
import json
import os
import logging
from pathlib import Path
from collections import deque
import difflib
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time

# Global limit for the number of files to send
LIMIT = 5
DEBOUNCE_DELAY = 1  # 1 second delay to debounce file changes

# List of allowed program file extensions (add more as necessary)
ALLOWED_EXTENSIONS = {'.py', '.js', '.ts', '.java', '.cpp', '.c', '.rb', '.go', '.sh','.md'}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

active_connections = set()
file_queue = deque(maxlen=LIMIT)  # Set maxlen to LIMIT so deque only holds latest LIMIT items
BASE_PATH = '/home/kavia/workspace'  # Set the base path
sent_files_tracker = {}  # To track recently sent files and debounce

# File change handler for watchdog
class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, ignore_patterns):
        self.ignore_patterns = ignore_patterns
        self.previous_contents = {}

    def on_modified(self, event):
        if event.is_directory or should_ignore(Path(event.src_path), self.ignore_patterns):
            return

        # Process the modified file
        file_path = event.src_path
        current_time = time.time()

        # Debounce logic: Only process the file if it hasn't been processed within the debounce delay
        if file_path in sent_files_tracker and (current_time - sent_files_tracker[file_path]) < DEBOUNCE_DELAY:
            return  # Skip if the file was modified too recently

        current_content = get_file_content(file_path)
        
        if current_content is None:
            return
        
        previous_content = self.previous_contents.get(file_path, "")
        file_type, language = get_file_info(file_path)

        diff = list(difflib.ndiff(previous_content.splitlines(), current_content.splitlines()))

        # Stream only if there are diffs (i.e., if diff is non-empty)
        if diff:
            file_data = {
                "type": file_type,
                "filename": file_path,
                "content": current_content,
                "previous_content": previous_content,
                "diff": diff,
                "language": language,
                "action": "update"
            }

            self.previous_contents[file_path] = current_content  # Update previous content to current

            # Add to the file queue (deque will handle max length automatically)
            file_queue.append(file_data)
            logging.info(f"File changed: {file_path}")

            # Track the time the file was sent to avoid duplicates
            sent_files_tracker[file_path] = current_time

def get_ignore_patterns(folder_path):
    ignore_patterns = []
    gitignore_path = Path(folder_path) / '.gitignore'
    if gitignore_path.exists():
        with open(gitignore_path, 'r') as gitignore:
            for line in gitignore:
                line = line.strip()
                if line and not line.startswith('#'):
                    if line.startswith('/'):
                        line = line[1:]
                    ignore_patterns.append(line)
        logging.info(f"Loaded {len(ignore_patterns)} patterns from .gitignore in {folder_path}")
    return ignore_patterns

def should_ignore(path, ignore_patterns):
    path_str = str(path)
    path_parts = Path(path_str).parts

    # Skip non-program files by checking the file extension
    if path.suffix not in ALLOWED_EXTENSIONS:
        return True

    if path.name == '.gitignore':
        return True

    # Add explicit checks for swap files
    if path_str.endswith('.swp') or path_str.endswith('~'):
        return True

    for pattern in ignore_patterns:
        if pattern.endswith('/'):
            if any(part == pattern[:-1] for part in path_parts):
                return True
        elif pattern.startswith('/'):
            if path_str.startswith(pattern[1:]):
                return True
        elif fnmatch.fnmatch(path_str, pattern) or fnmatch.fnmatch(path_str, f"*/{pattern}"):
            return True
        elif 'node_modules' in path_parts:
            return True
    return False

def get_file_info(file_path):
    _, ext = os.path.splitext(file_path)
    return 'text', ext.lstrip('.') or 'txt'

def get_file_content(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except UnicodeDecodeError:
        logging.warning(f"File {file_path} could not be read as UTF-8. Skipping.")
        return None

def get_recently_modified_files(limit=LIMIT):
    """Retrieve the most recently modified files within the BASE_PATH."""
    all_files = []

    for root, dirs, files in os.walk(BASE_PATH):
        for name in files:
            file_path = Path(root) / name
            if file_path.suffix not in ALLOWED_EXTENSIONS:  # Skip non-program files
                continue
            try:
                mtime = os.path.getmtime(file_path)
                all_files.append((file_path, mtime))
            except FileNotFoundError:
                continue

    # Sort files by modification time (latest first)
    all_files.sort(key=lambda x: x[1], reverse=True)

    recent_files = all_files[:limit]  # Limit to the most recent 'limit' files

    file_data_list = []
    for file_path, _ in recent_files:
        current_content = get_file_content(file_path)
        if current_content is None:
            continue
        
        file_type, language = get_file_info(file_path)
        file_data = {
            "type": file_type,
            "filename": str(file_path),
            "content": current_content,
            "previous_content": "",
            "diff": [],  # No diff on initial load
            "language": language,
            "action": "initial"
        }
        file_data_list.append(file_data)

    return file_data_list

async def send_updates(websocket):
    global file_queue
    try:
        # Send initially the most recently modified files
        recent_files = get_recently_modified_files()
        for file_data in recent_files:
            await websocket.send(json.dumps(file_data))

        # Continue sending file changes as they come in
        while True:
            if file_queue:
                file_data = file_queue.popleft()
                try:
                    await websocket.send(json.dumps(file_data))
                except websockets.exceptions.ConnectionClosed:
                    logging.info(f"Connection closed for {websocket.remote_address}")
                    break  # Exit the loop if the connection is closed
            await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
    except Exception as e:
        logging.error(f"Error in send_updates: {e}")
    finally:
        await websocket.close()

async def websocket_handler(websocket, path):
    logging.info(f"New connection from {websocket.remote_address}")
    active_connections.add(websocket)
    try:
        send_task = asyncio.create_task(send_updates(websocket))
        done, pending = await asyncio.wait([send_task], return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Connection closed for {websocket.remote_address}")
    finally:
        active_connections.remove(websocket)
        logging.info(f"Connection handler completed for {websocket.remote_address}")

async def main():
    # Start the watchdog observer
    ignore_patterns = get_ignore_patterns(BASE_PATH)
    event_handler = FileChangeHandler(ignore_patterns)
    observer = Observer()
    observer.schedule(event_handler, BASE_PATH, recursive=True)
    observer.start()

    try:
        # Start WebSocket server
        server = await websockets.serve(websocket_handler, "0.0.0.0", 8763)
        logging.info("WebSocket server started on ws://0.0.0.0:8763")
        await server.wait_closed()
    finally:
        observer.stop()
        observer.join()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server shutting down")