#!/usr/bin/env python3
"""Sinh các ảnh screenshot cho 3 kịch bản thị giác S-15, S-16, S-17 của SP-4."""

import os
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
EVIDENCE_DIR = ROOT_DIR / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def get_font(size=15, bold=False):
    path = FONT_BOLD_PATH if bold else FONT_PATH
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def create_s15_zalo():
    """
    S-15: Zalo chat
    - Linh (PM) 13:52: 'e ơi làm cho c cái checklist UAT cho app Vinmart nhé, cần trc thứ 4 tuần sau để c gửi khách'
    - User: 'ok c'
    """
    img = Image.new("RGB", (720, 320), color="#E5EBF0")
    draw = ImageDraw.Draw(img)

    # Header bar
    draw.rectangle([0, 0, 720, 50], fill="#0068FF")
    draw.text((20, 15), "Linh (PM) - Zalo", fill="#FFFFFF", font=get_font(18, bold=True))

    # Sender bubble (Linh)
    f_meta = get_font(12)
    f_text = get_font(15)
    
    draw.text((30, 65), "Linh (PM)  13:52", fill="#666666", font=f_meta)
    bubble_x1, bubble_y1 = 30, 85
    bubble_x2, bubble_y2 = 680, 165
    draw.rounded_rectangle([bubble_x1, bubble_y1, bubble_x2, bubble_y2], radius=10, fill="#FFFFFF", outline="#D0D7DE")
    
    msg_l1 = "e ơi làm cho c cái checklist UAT cho app Vinmart nhé,"
    msg_l2 = "cần trc thứ 4 tuần sau để c gửi khách"
    draw.text((bubble_x1 + 15, bubble_y1 + 15), msg_l1, fill="#000000", font=f_text)
    draw.text((bubble_x1 + 15, bubble_y1 + 42), msg_l2, fill="#000000", font=f_text)

    # User bubble (Right aligned)
    u_bubble_x1, u_bubble_y1 = 580, 195
    u_bubble_x2, u_bubble_y2 = 680, 245
    draw.rounded_rectangle([u_bubble_x1, u_bubble_y1, u_bubble_x2, u_bubble_y2], radius=10, fill="#D1E4FD", outline="#A8C7FA")
    draw.text((u_bubble_x1 + 25, u_bubble_y1 + 15), "ok c", fill="#000000", font=f_text)
    draw.text((u_bubble_x1 - 45, u_bubble_y1 + 15), "13:53", fill="#888888", font=f_meta)

    out_file = EVIDENCE_DIR / "s15-zalo-checklist.png"
    img.save(out_file)
    print(f"✓ Created {out_file}")

def create_s16_slack():
    """
    S-16: Slack channel #hr-portal
    - Tuan Pham 11:03 AM:
      '@you three things before Friday: 1) fix the avatar upload crash 2) write tests for the payroll module 3) update the HR onboarding doc (the one on Drive). thanks!'
    - Reaction: 👍 1
    """
    img = Image.new("RGB", (780, 360), color="#FFFFFF")
    draw = ImageDraw.Draw(img)

    # Header bar
    draw.rectangle([0, 0, 780, 45], fill="#3F0E40")
    draw.text((20, 12), "# hr-portal  |  Company Workspace", fill="#FFFFFF", font=get_font(16, bold=True))

    # Slack message item
    # Avatar placeholder
    draw.ellipse([25, 65, 65, 105], fill="#4A154B")
    draw.text((38, 73), "TP", fill="#FFFFFF", font=get_font(14, bold=True))

    # Username and timestamp
    draw.text((80, 65), "Tuan Pham", fill="#1D1C1D", font=get_font(15, bold=True))
    draw.text((180, 67), "11:03 AM", fill="#616061", font=get_font(12))

    # Text content
    f_text = get_font(14)
    l1 = "@you three things before Friday:"
    l2 = "1) fix the avatar upload crash"
    l3 = "2) write tests for the payroll module"
    l4 = "3) update the HR onboarding doc (the one on Drive). thanks!"
    
    draw.text((80, 95), l1, fill="#1264A3", font=f_text)
    draw.text((80, 125), l2, fill="#1D1C1D", font=f_text)
    draw.text((80, 150), l3, fill="#1D1C1D", font=f_text)
    draw.text((80, 175), l4, fill="#1D1C1D", font=f_text)

    # Reaction badge
    draw.rounded_rectangle([80, 215, 135, 250], radius=6, fill="#F2F3F5", outline="#DDDFE2")
    draw.text((92, 222), "+1  1", fill="#1D1C1D", font=get_font(13, bold=True))

    out_file = EVIDENCE_DIR / "s16-slack-hr.png"
    img.save(out_file)
    print(f"✓ Created {out_file}")

def create_s17_zalo():
    """
    S-17: Zalo chat
    - Linh (PM): 'demo khách chốt thứ 4 tuần sau nhé, 10h'
    - User: 'dạ'
    """
    img = Image.new("RGB", (720, 280), color="#E5EBF0")
    draw = ImageDraw.Draw(img)

    # Header bar
    draw.rectangle([0, 0, 720, 50], fill="#0068FF")
    draw.text((20, 15), "Linh (PM) - Zalo", fill="#FFFFFF", font=get_font(18, bold=True))

    # Sender bubble
    f_meta = get_font(12)
    f_text = get_font(15)
    
    draw.text((30, 65), "Linh (PM)  09:15", fill="#666666", font=f_meta)
    bubble_x1, bubble_y1 = 30, 85
    bubble_x2, bubble_y2 = 540, 140
    draw.rounded_rectangle([bubble_x1, bubble_y1, bubble_x2, bubble_y2], radius=10, fill="#FFFFFF", outline="#D0D7DE")
    draw.text((bubble_x1 + 15, bubble_y1 + 16), "demo khách chốt thứ 4 tuần sau nhé, 10h", fill="#000000", font=f_text)

    # User bubble
    u_bubble_x1, u_bubble_y1 = 600, 160
    u_bubble_x2, u_bubble_y2 = 680, 210
    draw.rounded_rectangle([u_bubble_x1, u_bubble_y1, u_bubble_x2, u_bubble_y2], radius=10, fill="#D1E4FD", outline="#A8C7FA")
    draw.text((u_bubble_x1 + 25, u_bubble_y1 + 15), "dạ", fill="#000000", font=f_text)
    draw.text((u_bubble_x1 - 45, u_bubble_y1 + 15), "09:16", fill="#888888", font=f_meta)

    out_file = EVIDENCE_DIR / "s17-zalo-demo.png"
    img.save(out_file)
    print(f"✓ Created {out_file}")

if __name__ == "__main__":
    create_s15_zalo()
    create_s16_slack()
    create_s17_zalo()
    print("All vision fixtures generated successfully.")
