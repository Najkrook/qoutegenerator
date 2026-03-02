import os
import urllib.request
import subprocess

url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
filename = "cloudflared.exe"

if not os.path.exists(filename):
    print("Downloading cloudflared...")
    urllib.request.urlretrieve(url, filename)
    print("Download complete. Starting tunnel...")

# Run cloudflared to tunnel to localhost:8000
subprocess.run([filename, "tunnel", "--url", "http://localhost:8000"])
