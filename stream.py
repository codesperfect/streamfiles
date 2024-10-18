import asyncio
import websockets
import json
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

OUTPUT_FOLDER = 'output/'  # Folder path to stream files from
active_connections = set()

async def file_monitor(websocket):
    last_modified_times = {}
    while True:
        try:
            # Get a list of all files in the output directory
            files = [f for f in os.listdir(OUTPUT_FOLDER) if os.path.isfile(os.path.join(OUTPUT_FOLDER, f))]
            for file_name in files:
                file_path = os.path.join(OUTPUT_FOLDER, file_name)
                current_modified_time = os.path.getmtime(file_path)
                
                # Check if the file was modified or is new
                if file_name not in last_modified_times or current_modified_time > last_modified_times[file_name]:
                    last_modified_times[file_name] = current_modified_time
                    with open(file_path, 'r') as file:
                        content = file.read()
                        file.flush()  # Ensure all content is read

                    if content.strip():  # Only send non-empty content
                        await websocket.send(json.dumps({
                            "type": "code",
                            "filename": file_name,
                            "content": content,
                            "language": "python"  # Adjust the language dynamically if needed
                        }))
                    else:
                        logging.warning(f"File {file_name} has no content.")
        except FileNotFoundError:
            logging.error(f"File or directory {OUTPUT_FOLDER} not found.")
        except Exception as e:
            logging.error(f"Error monitoring files: {e}")
        await asyncio.sleep(1)  # Sleep before checking again

async def websocket_handler(websocket, path):
    logging.info(f"New connection from {websocket.remote_address}")
    active_connections.add(websocket)
    try:
        await file_monitor(websocket)  # Monitor the files and send them to the client
        await websocket.wait_closed()
    finally:
        active_connections.remove(websocket)
        logging.info(f"Connection closed for {websocket.remote_address}")

async def main():
    server = await websockets.serve(websocket_handler, "localhost", 8765)
    logging.info("WebSocket server started on ws://localhost:8765")
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server shutting down")
