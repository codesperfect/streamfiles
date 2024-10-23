import time
import os
import difflib
import json
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class WatchdogHandler(FileSystemEventHandler):
    def __init__(self, workspace_path, project_folder, skip_files, diffs_path):
        super().__init__()
        self.workspace_path = workspace_path
        self.project_folder = project_folder
        self.skip_files = skip_files
        self.diffs_path = diffs_path  # Separate diffs directory
        self.ignore_file_list = self._load_gitignore_file()
        os.makedirs(self.diffs_path, exist_ok=True)  # Ensure the diffs directory exists

    def on_modified(self, event):
        if event.is_directory:
            return

        # Check if the modified file is .gitignore, and reload ignore patterns if it is
        if event.src_path.endswith('.gitignore'):
            self.ignore_file_list = self._load_gitignore_file()
            return

        if self._filter_files(event.src_path):
            return

        # Capture the diff and generate meaningful JSON data
        self.generate_file_change_json(event.src_path)

    def on_created(self, event):
        if event.is_directory:
            return

        if self._filter_files(event.src_path):
            return

        self.generate_file_change_json(event.src_path)

    def generate_file_change_json(self, file_path):
        """Generate a JSON structure for the modified file, including previous code, current code, and the diff."""
        # Get the relative path and filename
        relative_path = os.path.relpath(file_path, self.project_folder)
        filename = os.path.basename(file_path)
        file_extension = os.path.splitext(filename)[1]  # Get the file extension

        # Define the diff file path where the previous version of this file will be stored in the separate diffs directory
        diff_file_path = os.path.join(self.diffs_path, f"{relative_path.replace('/', '_')}_prev")

        # Read current content of the file
        try:
            with open(file_path, 'r') as f:
                current_code = f.read()
        except Exception as e:
            print(f"Error reading current content of {file_path}: {e}")
            return

        # Read previous content from the diffs, if available
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

        # Print the JSON structure (or you can save it to a file)
        json_output = json.dumps(file_change_data, indent=4)
        print(json_output)  # Print the JSON structure

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
        # Get the relative path from the project folder to the file
        relative_file_path = os.path.relpath(file_path, self.project_folder)
        normalized_relative_path = os.path.normpath(relative_file_path)

        # Filter based on hardcoded skip list
        if os.path.basename(file_path) in self.skip_files:
            return True

        # Filter based on the .gitignore file content
        for ignored in self.ignore_file_list:
            ignored = ignored.strip()
            if ignored.endswith('/'):  # Folder to ignore
                ignored_folder = os.path.normpath(ignored.rstrip('/'))
                if normalized_relative_path.startswith(ignored_folder):
                    return True

            elif ignored.startswith('*.'):  # File extension to ignore
                ext = ignored.lstrip('*.')
                if normalized_relative_path.endswith(ext):
                    return True

            elif ignored == normalized_relative_path:  # Specific file to ignore
                return True

        return False

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

def print_most_recent_file_diff(recent_file, handler):
    """Generates and prints the diff for the most recently modified file using the WatchdogHandler's logic."""
    if recent_file:
        print(f"Most recently modified file: {recent_file}")
        handler.generate_file_change_json(recent_file)
    else:
        print("No recently modified file found.")

if __name__ == "__main__":
    workspace_path = 'workspace'  # Path to the workspace folder
    diffs_path = 'diffs'  # Path to the separate diffs directory
    skip_files = ['package-lock.json', 'yarn.lock']
    
    # Start by checking if a project folder exists inside the workspace
    project_folder = find_project_folder(workspace_path)

    if project_folder:
        print(f"Project folder found: {project_folder}. Watching the project folder.")
        
        # Initialize the WatchdogHandler
        event_handler = WatchdogHandler(workspace_path=workspace_path, project_folder=project_folder, skip_files=skip_files, diffs_path=diffs_path)
        
        # Find and print the most recently modified file and its diff at startup
        recent_file = get_most_recently_modified_file(project_folder)
        print_most_recent_file_diff(recent_file, event_handler)
        
        observer = Observer()
        observer.schedule(event_handler, project_folder, recursive=True)
    else:
        print(f"No project folder found. Watching the workspace folder for new project folder.")
        event_handler = WatchdogHandler(workspace_path=workspace_path, project_folder=workspace_path, skip_files=skip_files, diffs_path=diffs_path)
        
        observer = Observer()
        observer.schedule(event_handler, workspace_path, recursive=False)

    observer.start()

    try:
        while True:
            time.sleep(1)  # Keep the script running

            # If no project folder was initially found, keep checking for its creation
            if not project_folder:
                project_folder = find_project_folder(workspace_path)
                if project_folder:
                    print(f"Project folder detected: {project_folder}. Switching to watch the project folder.")
                    # Stop watching the workspace folder
                    observer.stop()
                    observer = Observer()  # Create a new observer
                    event_handler = WatchdogHandler(workspace_path=workspace_path, project_folder=project_folder, skip_files=skip_files, diffs_path=diffs_path)
                    
                    observer.schedule(event_handler, project_folder, recursive=True)
                    observer.start()
                    break  # Stop checking for new project folder after one is found
    except KeyboardInterrupt:
        observer.stop()  # Stop the observer if the user presses Ctrl+C

    observer.join()
