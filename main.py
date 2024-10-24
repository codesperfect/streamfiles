import time
import os
import difflib
import json
import asyncio
import websockets
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from concurrent.futures import ThreadPoolExecutor

connected_clients = set()  # Store connected WebSocket clients
most_recent_file_data = None  # Store the most recent file change data

class WatchdogHandler(FileSystemEventHandler):
    def __init__(self, workspace_path, project_folder, skip_files, diffs_path, loop):
        super().__init__()
        self.workspace_path = workspace_path
        self.project_folder = project_folder
        self.skip_files = skip_files
        self.diffs_path = diffs_path  # Separate diffs directory
        self.loop = loop  # Pass in the asyncio event loop
        self.executor = ThreadPoolExecutor()  # Thread pool for running blocking tasks
        self.ignore_file_list = self._load_gitignore_file()
        os.makedirs(self.diffs_path, exist_ok=True)  # Ensure the diffs directory exists

    def on_modified(self, event):
        if event.is_directory:
            return

        if event.src_path.endswith('.gitignore'):
            self.ignore_file_list = self._load_gitignore_file()
            return

        if self._filter_files(event.src_path):
            return

        # Log the file modification event
        print(f"File modified: {os.path.basename(event.src_path)}")

        # Submit the generate_file_change_json task to be run in the event loop
        asyncio.run_coroutine_threadsafe(self.generate_file_change_json(event.src_path), self.loop)

    def on_created(self, event):
        if event.is_directory:
            return

        if self._filter_files(event.src_path):
            return

        # Log the file creation event
        print(f"File created: {os.path.basename(event.src_path)}")

        # Submit the generate_file_change_json task to be run in the event loop
        asyncio.run_coroutine_threadsafe(self.generate_file_change_json(event.src_path), self.loop)

    async def generate_file_change_json(self, file_path):
        """Generate a JSON structure for the modified file, including previous code, current code, and the diff."""
        global most_recent_file_data

        relative_path = os.path.relpath(file_path, self.project_folder)
        filename = os.path.basename(file_path)
        file_extension = os.path.splitext(filename)[1]  # Get the file extension

        # Define the diff file path where the previous version of this file will be stored in the separate diffs directory
        diff_file_path = os.path.join(self.diffs_path, f"{relative_path.replace('/', '_')}_prev")

        try:
            with open(file_path, 'r') as f:
                current_code = f.read()
        except Exception as e:
            print(f"Error reading current content of {file_path}: {e}")
            return

        if os.path.exists(diff_file_path):
            with open(diff_file_path, 'r') as f:
                previous_code = f.read()
        else:
            previous_code = ""  # If no previous version exists, assume it's a new file

        # Generate the diff between previous and current code
        diff = difflib.unified_diff(
            previous_code.splitlines(),
            current_code.splitlines(),
            lineterm='',
            fromfile='previous_code',
            tofile='current_code'
        )
        diff_text = "\n".join(diff)

        # Save the current version as the "previous" version for the next modification
        with open(diff_file_path, 'w') as f:
            f.write(current_code)

        # Create a JSON structure
        file_change_data = {
            "filepath": relative_path,
            "filename": filename,
            "extension": file_extension,
            "previous_code": previous_code,
            "current_code": current_code,
            "diff": diff_text
        }
        print(file_change_data)

        # Update the global most recent file data for WebSocket clients
        most_recent_file_data = json.dumps(file_change_data, indent=4)

        # Send JSON data to all connected WebSocket clients
        await send_data_to_clients(most_recent_file_data)

    def _load_gitignore_file(self):
        """Load the .gitignore file if it exists and return a list of ignored patterns."""
        ignore_list = []
        
        # Get the current working directory and combine it with the project folder to ensure the absolute path
        current_directory = os.getcwd()
        gitignore_file = os.path.join(current_directory, self.project_folder, '.gitignore')
        
        if os.path.exists(gitignore_file):
            with open(gitignore_file, 'r') as f:
                for line in f:
                    stripped_line = line.strip()  # Strip whitespace
                    if stripped_line and not stripped_line.startswith("#"):  # Non-empty and not a comment
                        ignore_list.append(stripped_line)  # Add the line to the ignore list
        return ignore_list

    def _filter_files(self, file_path):
        """Filters out files based on the .gitignore file content and skip list."""
        relative_file_path = os.path.relpath(file_path, self.project_folder)
        normalized_relative_path = os.path.normpath(relative_file_path)

        if os.path.basename(file_path) in self.skip_files:
            return True

        for ignored in self.ignore_file_list:
            ignored = ignored.strip()
            if ignored.endswith('/'):
                ignored_folder = os.path.normpath(ignored.rstrip('/'))
                if normalized_relative_path.startswith(ignored_folder):
                    return True
            elif ignored.startswith('*.'):
                ext = ignored.lstrip('*.')
                if normalized_relative_path.endswith(ext):
                    return True
            elif ignored == normalized_relative_path:
                return True

        return False


async def send_data_to_clients(data):
    """Send data to all connected WebSocket clients."""
    if connected_clients:
        await asyncio.wait([client.send(data) for client in connected_clients])


async def websocket_handler(websocket, path):
    """Handle WebSocket connections."""
    global most_recent_file_data

    print(f"Client connected: {websocket.remote_address}")
    connected_clients.add(websocket)

    # Send the most recent file diff to the newly connected client
    if most_recent_file_data:
        await websocket.send(most_recent_file_data)

    try:
        async for message in websocket:
            pass  # Keep the connection alive
    except websockets.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    finally:
        connected_clients.remove(websocket)


async def start_websocket_server():
    """Start the WebSocket server."""
    server = await websockets.serve(websocket_handler, "localhost", 6789)
    await server.wait_closed()


def find_project_folder(path):
    """Checks if there's a project folder in the given path and returns its name."""
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        if os.path.isdir(item_path):
            return item_path
    return None

def get_most_recently_modified_file(folder_path):
    """Finds and returns the most recently modified file in the folder."""
    most_recent_file = None
    most_recent_mtime = 0

    for root, dirs, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                mtime = os.path.getmtime(file_path)
                if mtime > most_recent_mtime:
                    most_recent_mtime = mtime
                    most_recent_file = file_path

    return most_recent_file

async def print_most_recent_file_diff(recent_file, handler):
    """Generates and prints the diff for the most recently modified file using the WatchdogHandler's logic."""
    if recent_file:
        print(f"Most recently modified file: {recent_file}")
        await handler.generate_file_change_json(recent_file)
    else:
        print("No recently modified file found.")

async def main():
    workspace_path = 'workspace'
    diffs_path = 'diffs'
    skip_files = ['package-lock.json', 'yarn.lock']

    loop = asyncio.get_event_loop()

    while True:
        # Check if a project folder is available inside the workspace
        project_folder = find_project_folder(workspace_path)

        if project_folder:
            print(f"Project folder found: {project_folder}. Watching the project folder.")

            event_handler = WatchdogHandler(
                workspace_path=workspace_path,
                project_folder=project_folder,
                skip_files=skip_files,
                diffs_path=diffs_path,
                loop=loop
            )
            
            recent_file = get_most_recently_modified_file(project_folder)
            await print_most_recent_file_diff(recent_file, event_handler)

            observer = Observer()
            observer.schedule(event_handler, project_folder, recursive=True)
            observer.start()

            # Run WebSocket server concurrently
            server_task = asyncio.create_task(start_websocket_server())

            try:
                # Keep the observer running until the project folder is deleted
                while os.path.exists(project_folder):
                    await asyncio.sleep(1)
            except KeyboardInterrupt:
                break
            finally:
                observer.stop()
                observer.join()
                server_task.cancel()

            print("Project folder removed. Waiting for a new project to be available...")
        else:
            print("No project folder found. Waiting for a project to be available...")

        # Wait a few seconds before checking again for a new project
        await asyncio.sleep(5)

# Run the asyncio event loop
if __name__ == "__main__":
    asyncio.run(main())
