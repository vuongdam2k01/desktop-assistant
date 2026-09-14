#!/usr/bin/env python3
import subprocess, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
SCREENSHOT_SCRIPT = ROOT / "spikes" / "SP-0-gui-harness" / "src" / "screenshot.ps1"
EVIDENCE_DIR = ROOT / "spikes" / "SP-13-byo-oauth-google" / "evidence"

URL = ("https://accounts.google.com/o/oauth2/v2/auth?"
       "response_type=code"
       "&client_id=479928792321-h44mk6ohi38piupipfnt96itkdifuf00.apps.googleusercontent.com"
       "&redirect_uri=http%3A%2F%2Flocalhost%3A8765"
       "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly"
       "&access_type=offline"
       "&prompt=consent")

def capture(out_name):
    out_path = EVIDENCE_DIR / out_name
    cmd = [
        "powershell", "-ExecutionPolicy", "Bypass", "-File", str(SCREENSHOT_SCRIPT),
        "-OutputPath", str(out_path),
        "-AllScreens"
    ]
    subprocess.run(cmd, check=True)
    print(f"Captured: {out_path}")

def main():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    print("Opening Chrome with URL...")
    subprocess.Popen([chrome_path, "--new-window", URL])
    time.sleep(4)
    capture("consent_step_initial.png")

if __name__ == "__main__":
    main()
