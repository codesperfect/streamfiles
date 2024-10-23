import time
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class WatchdogHandler(FileSystemEventHandler):
    def __init__(self, workspace_path, project_folder, skip_files):
        super().__init__()
        self.workspace_path = workspace_path
        self.project_folder = project_folder
        self.skip_files = skip_files
        self.ignore_file_list = self._load_gitignore_file()

    def on_modified(self, event):
        if event.is_directory:
            return

        # Check if the modified file is .gitignore, and reload ignore patterns if it is
        if event.src_path.endswith('.gitignore'):
            print(f".gitignore modified: {event.src_path}. Reloading ignore patterns.")
            self.ignore_file_list = self._load_gitignore_file()
            return

        if self._filter_files(event.src_path):
            return

        print(f"File modified: {event.src_path}")

    def on_created(self, event):
        if event.is_directory:
            return

        if self._filter_files(event.src_path):
            return

        print(f"File created: {event.src_path}")

    def on_deleted(self, event):
        if event.is_directory:
            return

        if self._filter_files(event.src_path):
            return

        print(f"File deleted: {event.src_path}")

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

    def print_most_recently_modified_file(self):
        """Print the most recently modified file in the project folder."""
        most_recent_file = None
        most_recent_time = None

        # Walk through the project folder and subdirectories to find the most recently modified file
        for root, dirs, files in os.walk(self.project_folder):
            for file in files:
                file_path = os.path.join(root, file)

                # Skip ignored files
                if self._filter_files(file_path):
                    continue

                # Get the modification time of the current file
                file_mod_time = os.path.getmtime(file_path)

                # Compare with the most recent file found so far
                if most_recent_time is None or file_mod_time > most_recent_time:
                    most_recent_time = file_mod_time
                    most_recent_file = file_path

        if most_recent_file:
            print(f"Most recently modified file: {most_recent_file}")

def find_project_folder(path):
    """Checks if there's a project folder in the given path and returns its name."""
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        if os.path.isdir(item_path):
            return item_path
    return None

if __name__ == "__main__":
    workspace_path = 'workspace'  # Path to the workspace folder
    skip_files = ['package-lock.json', 'yarn.lock']
    
    # Start by checking if a project folder exists inside the workspace
    project_folder = find_project_folder(workspace_path)

    if project_folder:
        print(f"Project folder found: {project_folder}. Watching the project folder.")
        event_handler = WatchdogHandler(workspace_path=workspace_path, project_folder=project_folder, skip_files=skip_files)
        
        # Print the most recently modified file
        event_handler.print_most_recently_modified_file()

        observer = Observer()
        observer.schedule(event_handler, project_folder, recursive=True)
    else:
        print(f"No project folder found. Watching the workspace folder for new project folder.")
        event_handler = WatchdogHandler(workspace_path=workspace_path, project_folder=workspace_path, skip_files=skip_files)
        
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
                    event_handler = WatchdogHandler(project_folder=project_folder, skip_files=skip_files)
                    
                    # Print the most recently modified file
                    event_handler.print_most_recently_modified_file()

                    observer.schedule(event_handler, project_folder, recursive=True)
                    observer.start()
                    break  # Stop checking for new project folder after one is found
    except KeyboardInterrupt:
        observer.stop()  # Stop the observer if the user presses Ctrl+C

    observer.join()
