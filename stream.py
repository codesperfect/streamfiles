import asyncio
import websockets
import json
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

FILE_PATH = 'snake.js'  # Replace with your file path
last_modified_time = 0
active_connections = set()

async def file_monitor():
    global last_modified_time
    while True:
        try:
            current_modified_time = os.path.getmtime(FILE_PATH)
            if current_modified_time > last_modified_time:
                last_modified_time = current_modified_time
                with open(FILE_PATH, 'r') as file:
                    content = file.read()
                await broadcast_file_content(content)
        except FileNotFoundError:
            logging.error(f"File {FILE_PATH} not found.")
        except Exception as e:
            logging.error(f"Error monitoring file: {e}")
        await asyncio.sleep(1)

async def broadcast_file_content(content):
    if active_connections:
        for websocket in active_connections.copy():
            try:
                await websocket.send(json.dumps({
                    "type": "code",
                    "content": content,
                    "language": "python"
                }))
            except websockets.exceptions.ConnectionClosed:
                active_connections.remove(websocket)
                logging.info(f"Removed closed connection")

async def websocket_handler(websocket, path):
    logging.info(f"New connection from {websocket.remote_address}")
    active_connections.add(websocket)
    try:
        with open(FILE_PATH, 'r') as file:
            content = file.read()
        await websocket.send(json.dumps({
            "type": "code",
            "content": content,
            "language": "python"
        }))
        await websocket.wait_closed()
    finally:
        active_connections.remove(websocket)
        logging.info(f"Connection closed for {websocket.remote_address}")

async def main():
    server = await websockets.serve(
        websocket_handler,
        "localhost",
        8765,
    )
    logging.info("WebSocket server started on ws://localhost:8765")
    await asyncio.gather(server.wait_closed(), file_monitor())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Server shutting down")
