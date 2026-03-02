import http.server
import socketserver
import json
import os
import urllib.parse
from http import HTTPStatus

PORT = 8000
DIRECTORY = "."
DB_FILE = "inventory_db.json"

def load_db():
    if not os.path.exists(DB_FILE):
        return {"bahama": [], "clickitup": {}}
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                # Migrate old array to new structure
                return {"bahama": data, "clickitup": {}}
            if not isinstance(data, dict):
                return {"bahama": [], "clickitup": {}}
            if "bahama" not in data:
                data["bahama"] = []
            if "clickitup" not in data:
                data["clickitup"] = {}
            return data
    except Exception:
        return {"bahama": [], "clickitup": {}}

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # API Endpoint to fetch inventory
        if parsed_path.path == '/api/inventory':
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            db = load_db()
            self.wfile.write(json.dumps(db).encode('utf-8'))
            return
            
        # Serve static files normally
        super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Temporary logging endpoint to capture the Firebase error message
        if parsed_path.path == '/log':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                print(f"[BROWSER ERROR LOG]: {post_data.decode('utf-8')}")
            self.send_response(HTTPStatus.OK)
            self.end_headers()
            return
            
        # API Endpoint to upload BaHaMa inventory (Excel)
        if parsed_path.path == '/api/inventory/upload':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(HTTPStatus.BAD_REQUEST, "No content provided")
                return
                
            post_data = self.rfile.read(content_length)
            try:
                inventory_data = json.loads(post_data.decode('utf-8'))
                if not isinstance(inventory_data, list):
                    raise ValueError("Expected a JSON array")
                    
                db = load_db()
                db["bahama"] = inventory_data
                save_db(db)
                    
                self.send_response(HTTPStatus.OK)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": f"Saved {len(inventory_data)} BaHaMa items"}).encode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON data")
            except Exception as e:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f"Error saving data: {str(e)}")
            return

        # API Endpoint to incrementally update ClickitUP matrix
        if parsed_path.path == '/api/inventory/clickitup':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(HTTPStatus.BAD_REQUEST, "No content provided")
                return
            
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                size = str(payload.get('size'))
                field = str(payload.get('field'))
                delta = int(payload.get('delta', 0))

                db = load_db()
                if size not in db["clickitup"]:
                    db["clickitup"][size] = {"sektion": 0, "dorr_h": 0, "dorr_v": 0, "hane_h": 0, "hane_v": 0}
                
                if field in db["clickitup"][size]:
                    db["clickitup"][size][field] += delta
                    # Prevent negative stock optionally, though negative may be useful if over-allocated
                
                save_db(db)

                self.send_response(HTTPStatus.OK)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "newValue": db["clickitup"][size][field]}).encode('utf-8'))
            except Exception as e:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f"Error saving clickitup data: {str(e)}")
            return
            
        self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"API endpoints available:")
        print(f"  GET  /api/inventory")
        print(f"  POST /api/inventory/upload")
        httpd.serve_forever()
