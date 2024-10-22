import asyncio
import websockets
import json
import os
import logging
from pathlib import Path
import fnmatch
from collections import deque

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

active_connections = set()
file_queue = deque()
BASE_PATH = 'code_gen/'  # Set the base path

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

    if path.name == 'main.py':
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

async def file_monitor():
    global file_queue
    
    # Check if base path exists
    if not os.path.exists(BASE_PATH):
        logging.error(f"Base path {BASE_PATH} does not exist")
        return

    # Get all subdirectories in the base path
    subdirs = [BASE_PATH]
    for item in os.listdir(BASE_PATH):
        full_path = os.path.join(BASE_PATH, item)
        if os.path.isdir(full_path):
            subdirs.append(full_path)

    # Monitor files in each subdirectory
    last_modified_times = {}
    while True:
        try:
            current_files = set()
            
            for dir_path in subdirs:
                # Get ignore patterns for this directory
                ignore_patterns = get_ignore_patterns(dir_path)
                
                for root, dirs, files in os.walk(dir_path):
                    for name in files:
                        path = Path(root) / name
                        if not should_ignore(path, ignore_patterns):
                            current_files.add(str(path))
                            current_modified_time = os.path.getmtime(path)
                            
                            if str(path) not in last_modified_times or current_modified_time > last_modified_times[str(path)]:
                                last_modified_times[str(path)] = current_modified_time
                                file_type, language = get_file_info(str(path))
                                
                                try:
                                    with open(path, 'r', encoding='utf-8') as file:
                                        content = file.read()
                                except UnicodeDecodeError:
                                    logging.warning(f"File {path} could not be read as UTF-8. Skipping.")
                                    continue

                                if content:  # Only queue non-empty content
                                    file_data = {
                                        "type": file_type,
                                        "filename": str(path),
                                        "content": content,
                                        "language": language,
                                        "action": "update"
                                    }
                                    # Remove old version if exists
                                    file_queue = deque(filter(lambda x: x['filename'] != str(path), file_queue))
                                    file_queue.append(file_data)
                                else:
                                    logging.warning(f"File {path} has no content.")
            
            # Remove files that no longer exist
            for path in list(last_modified_times.keys()):
                if path not in current_files:
                    del last_modified_times[path]

        except Exception as e:
            logging.error(f"Error monitoring files: {e}")
        await asyncio.sleep(1)  # Sleep before checking again

async def send_updates(websocket):
    global file_queue
    try:
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
        monitor_task = asyncio.create_task(file_monitor())
        send_task = asyncio.create_task(send_updates(websocket))
        done, pending = await asyncio.wait(
            [monitor_task, send_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Connection closed for {websocket.remote_address}")
    finally:
        active_connections.remove(websocket)
        logging.info(f"Connection handler completed for {websocket.remote_address}")

async def main():
    server = await websockets.serve(websocket_handler, "0.0.0.0", 8764)
    logging.info("WebSocket server started on ws://0.0.0.0:8764")
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server shutting down")
