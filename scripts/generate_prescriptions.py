# scripts/generate_prescriptions.py
"""
Generates 10 synthetic prescription PNG images for the MedKart demo & seed data.
Uses Python standard library (zlib, struct) with pure bitmap font rendering so no external packages are needed.
Each image includes doctor letterhead, patient info, Rx medicines, signature, and synthetic footer.
"""

import os
import struct
import zlib
import math
import random

# A compact 5x7 bitmap font for ASCII 32..126
FONT_5X7 = {
    ' ': [0, 0, 0, 0, 0],
    '!': [0, 0, 0x5F, 0, 0],
    '"': [0, 0x07, 0, 0x07, 0],
    '#': [0x14, 0x7F, 0x14, 0x7F, 0x14],
    '$': [0x24, 0x2A, 0x7F, 0x2A, 0x12],
    '%': [0x23, 0x13, 0x08, 0x64, 0x62],
    '&': [0x36, 0x49, 0x55, 0x22, 0x50],
    "'": [0, 0x05, 0x03, 0, 0],
    '(': [0, 0x1C, 0x22, 0x41, 0],
    ')': [0, 0x41, 0x22, 0x1C, 0],
    '*': [0x08, 0x2A, 0x1C, 0x2A, 0x08],
    '+': [0x08, 0x08, 0x3E, 0x08, 0x08],
    ',': [0, 0x50, 0x30, 0, 0],
    '-': [0x08, 0x08, 0x08, 0x08, 0x08],
    '.': [0, 0x60, 0x60, 0, 0],
    '/': [0x20, 0x10, 0x08, 0x04, 0x02],
    '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
    '1': [0, 0x42, 0x7F, 0x40, 0],
    '2': [0x42, 0x61, 0x51, 0x49, 0x46],
    '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
    '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
    '5': [0x27, 0x45, 0x45, 0x45, 0x39],
    '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
    '7': [0x01, 0x71, 0x09, 0x05, 0x03],
    '8': [0x36, 0x49, 0x49, 0x49, 0x36],
    '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
    ':': [0, 0x36, 0x36, 0, 0],
    ';': [0, 0x56, 0x36, 0, 0],
    '<': [0, 0x08, 0x14, 0x22, 0x41],
    '=': [0x14, 0x14, 0x14, 0x14, 0x14],
    '>': [0x41, 0x22, 0x14, 0x08, 0],
    '?': [0x02, 0x01, 0x51, 0x09, 0x06],
    '@': [0x32, 0x49, 0x79, 0x41, 0x3E],
    'A': [0x7E, 0x11, 0x11, 0x11, 0x7E],
    'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
    'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
    'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
    'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
    'F': [0x7F, 0x09, 0x09, 0x01, 0x01],
    'G': [0x3E, 0x41, 0x41, 0x51, 0x32],
    'H': [0x7F, 0x08, 0x08, 0x08, 0x7F],
    'I': [0, 0x41, 0x7F, 0x41, 0],
    'J': [0x20, 0x40, 0x41, 0x3F, 0x01],
    'K': [0x7F, 0x08, 0x14, 0x22, 0x41],
    'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
    'M': [0x7F, 0x02, 0x04, 0x02, 0x7F],
    'N': [0x7F, 0x04, 0x08, 0x10, 0x7F],
    'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
    'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
    'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E],
    'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
    'S': [0x46, 0x49, 0x49, 0x49, 0x31],
    'T': [0x01, 0x01, 0x7F, 0x01, 0x01],
    'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
    'V': [0x1F, 0x20, 0x40, 0x20, 0x1F],
    'W': [0x7F, 0x20, 0x18, 0x20, 0x7F],
    'X': [0x63, 0x14, 0x08, 0x14, 0x63],
    'Y': [0x03, 0x04, 0x78, 0x04, 0x03],
    'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
    '[': [0, 0x7F, 0x41, 0x41, 0],
    '\\': [0x02, 0x04, 0x08, 0x10, 0x20],
    ']': [0, 0x41, 0x41, 0x7F, 0],
    '^': [0x04, 0x02, 0x01, 0x02, 0x04],
    '_': [0x40, 0x40, 0x40, 0x40, 0x40],
    '`': [0, 0x01, 0x02, 0x04, 0],
    'a': [0x20, 0x54, 0x54, 0x54, 0x78],
    'b': [0x7F, 0x48, 0x44, 0x44, 0x38],
    'c': [0x38, 0x44, 0x44, 0x44, 0x20],
    'd': [0x38, 0x44, 0x44, 0x48, 0x7F],
    'e': [0x38, 0x54, 0x54, 0x54, 0x18],
    'f': [0x08, 0x7E, 0x09, 0x01, 0x02],
    'g': [0x08, 0x14, 0x54, 0x54, 0x3C],
    'h': [0x7F, 0x08, 0x04, 0x04, 0x78],
    'i': [0, 0x44, 0x7D, 0x40, 0],
    'j': [0x20, 0x40, 0x44, 0x3D, 0],
    'k': [0x7F, 0x10, 0x28, 0x44, 0],
    'l': [0, 0x41, 0x7F, 0x40, 0],
    'm': [0x7C, 0x04, 0x18, 0x04, 0x78],
    'n': [0x7C, 0x08, 0x04, 0x04, 0x78],
    'o': [0x38, 0x44, 0x44, 0x44, 0x38],
    'p': [0x7C, 0x14, 0x14, 0x14, 0x08],
    'q': [0x08, 0x14, 0x14, 0x18, 0x7C],
    'r': [0x7C, 0x08, 0x04, 0x04, 0x08],
    's': [0x48, 0x54, 0x54, 0x54, 0x20],
    't': [0x04, 0x3F, 0x44, 0x40, 0x20],
    'u': [0x3C, 0x40, 0x40, 0x20, 0x7C],
    'v': [0x1C, 0x20, 0x40, 0x20, 0x1C],
    'w': [0x3C, 0x40, 0x30, 0x40, 0x3C],
    'x': [0x44, 0x28, 0x10, 0x28, 0x44],
    'y': [0x0C, 0x50, 0x50, 0x50, 0x3C],
    'z': [0x44, 0x64, 0x54, 0x4C, 0x44],
    '|': [0, 0, 0x7F, 0, 0],
    '~': [0x08, 0x04, 0x08, 0x10, 0x08],
}

class Canvas:
    def __init__(self, width, height, bg_color=(255, 255, 252)):
        self.width = width
        self.height = height
        self.bg_color = bg_color
        # 3 channels (RGB)
        self.pixels = bytearray(width * height * 3)
        for i in range(0, len(self.pixels), 3):
            self.pixels[i] = bg_color[0]
            self.pixels[i+1] = bg_color[1]
            self.pixels[i+2] = bg_color[2]

    def set_pixel(self, x, y, color):
        if 0 <= x < self.width and 0 <= y < self.height:
            idx = (y * self.width + x) * 3
            self.pixels[idx] = color[0]
            self.pixels[idx+1] = color[1]
            self.pixels[idx+2] = color[2]

    def draw_rect(self, x1, y1, x2, y2, color, fill=False):
        if fill:
            for y in range(max(0, y1), min(self.height, y2 + 1)):
                for x in range(max(0, x1), min(self.width, x2 + 1)):
                    self.set_pixel(x, y, color)
        else:
            for x in range(max(0, x1), min(self.width, x2 + 1)):
                self.set_pixel(x, y1, color)
                self.set_pixel(x, y2, color)
            for y in range(max(0, y1), min(self.height, y2 + 1)):
                self.set_pixel(x1, y, color)
                self.set_pixel(x2, y, color)

    def draw_text(self, text, x, y, color=(20, 24, 30), scale=2, slant=False):
        cur_x = x
        for char in text:
            glyph = FONT_5X7.get(char, FONT_5X7.get('?'))
            if glyph:
                for col_idx, col_bits in enumerate(glyph):
                    for row_idx in range(7):
                        if (col_bits >> row_idx) & 1:
                            offset_x = (7 - row_idx) // 3 if slant else 0
                            px = cur_x + col_idx * scale + offset_x
                            py = y + row_idx * scale
                            for dx in range(scale):
                                for dy in range(scale):
                                    self.set_pixel(px + dx, py + dy, color)
            cur_x += (5 + 1) * scale

    def add_noise(self, intensity=0.03):
        for i in range(0, len(self.pixels), 3):
            if random.random() < intensity:
                noise = random.randint(-40, 20)
                self.pixels[i] = max(0, min(255, self.pixels[i] + noise))
                self.pixels[i+1] = max(0, min(255, self.pixels[i+1] + noise))
                self.pixels[i+2] = max(0, min(255, self.pixels[i+2] + noise))

    def make_blurry(self, factor=4):
        # Downsample and upsample to simulate extreme blur / low resolution
        small_w = self.width // factor
        small_h = self.height // factor
        small_buf = bytearray(small_w * small_h * 3)
        for sy in range(small_h):
            for sx in range(small_w):
                src_x = sx * factor
                src_y = sy * factor
                idx = (src_y * self.width + src_x) * 3
                s_idx = (sy * small_w + sx) * 3
                small_buf[s_idx:s_idx+3] = self.pixels[idx:idx+3]
        for y in range(self.height):
            for x in range(self.width):
                sx = min(x // factor, small_w - 1)
                sy = min(y // factor, small_h - 1)
                s_idx = (sy * small_w + sx) * 3
                idx = (y * self.width + x) * 3
                self.pixels[idx:idx+3] = small_buf[s_idx:s_idx+3]

    def to_png_bytes(self):
        # Raw RGB to PNG uncompressed / zlib compressed
        raw_data = bytearray()
        stride = self.width * 3
        for y in range(self.height):
            raw_data.append(0)  # Filter type: None
            row_start = y * stride
            raw_data.extend(self.pixels[row_start:row_start + stride])

        compressed = zlib.compress(bytes(raw_data), level=6)

        def chunk(tag, data):
            crc = zlib.crc32(tag + data) & 0xFFFFFFFF
            return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

        ihdr = struct.pack('>IIBBBBB', self.width, self.height, 8, 2, 0, 0, 0)
        png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
        return png


def generate_prescription(
    filename,
    doctor_name="Dr. Subir Mukherjee, MBBS, MD (Med)",
    reg_no="WBMC-48192",
    clinic="SURAKSHA CLINIC & DIAGNOSTICS, SALT LAKE, KOLKATA",
    patient_name="Debasish Ghosh",
    patient_age="54 Y / Male",
    date_str="04-Nov-2026",
    medicines=[("Tab. Metformin 500 mg", "1 tab twice daily after meals x 30 days")],
    style="clean",  # "clean", "messy", "blurry", "stamped"
    h1_notice=None
):
    w, h = 900, 1200
    c = Canvas(w, h, bg_color=(254, 253, 248) if style != "messy" else (248, 246, 238))

    # Outer border & header rule
    c.draw_rect(30, 30, w - 30, h - 30, (180, 180, 170))
    c.draw_rect(35, 35, w - 35, h - 35, (220, 220, 215))

    # Doctor Header
    c.draw_text(clinic, 60, 60, (20, 70, 80), scale=2)
    c.draw_text(doctor_name, 60, 100, (15, 23, 42), scale=3)
    c.draw_text(f"Regd. Medical Practitioner No: {reg_no}", 60, 140, (70, 75, 80), scale=2)
    c.draw_text("Ph: +91 33 2358 1100  |  Email: care@surakshaclinic.in", 60, 170, (100, 105, 110), scale=2)

    # Dividing line
    c.draw_rect(60, 210, w - 60, 212, (20, 70, 80), fill=True)

    # Patient info box
    c.draw_rect(60, 230, w - 60, 310, (230, 230, 225), fill=True)
    c.draw_text(f"Patient Name: {patient_name}", 80, 245, (20, 25, 30), scale=2)
    c.draw_text(f"Age / Gender: {patient_age}", 550, 245, (50, 55, 60), scale=2)
    c.draw_text(f"Date: {date_str}", 80, 280, (20, 25, 30), scale=2)
    c.draw_text("Prescription Ref: SUR-2026-9921", 550, 280, (70, 75, 80), scale=2)

    # Rx symbol
    c.draw_text("Rx", 70, 340, (15, 118, 110), scale=5)

    slant = (style == "messy")
    y_cursor = 420
    for idx, (med, dose) in enumerate(medicines, 1):
        c.draw_text(f"{idx}. {med}", 110, y_cursor, (10, 15, 20), scale=3, slant=slant)
        c.draw_text(f"   Sig: {dose}", 110, y_cursor + 35, (60, 65, 70), scale=2, slant=slant)
        y_cursor += 90

    if h1_notice:
        c.draw_rect(60, y_cursor + 10, w - 60, y_cursor + 55, (254, 243, 199), fill=True)
        c.draw_text(f"[SCHEDULE H1 DRUG] {h1_notice}", 75, y_cursor + 22, (146, 64, 14), scale=2)
        y_cursor += 70

    # Doctor Signature & Stamp
    sig_y = h - 220
    c.draw_text("Dr. S. Mukherjee", w - 320, sig_y, (15, 23, 42), scale=2, slant=True)
    c.draw_text("-------------------------", w - 340, sig_y + 25, (100, 100, 100), scale=2)
    c.draw_text("Signature & Seal", w - 280, sig_y + 45, (80, 85, 90), scale=2)

    # Synthetic sample banner (SPEC REQUIREMENT)
    c.draw_rect(50, h - 80, w - 50, h - 45, (240, 240, 240), fill=True)
    c.draw_text("SYNTHETIC SAMPLE -- FOR SYSTEM TESTING & DEMO ONLY -- NOT A REAL PRESCRIPTION", 70, h - 70, (160, 40, 40), scale=2)

    if style == "messy":
        c.add_noise(0.04)
    elif style == "blurry":
        c.make_blurry(factor=7)
        c.add_noise(0.08)

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    png_bytes = c.to_png_bytes()
    with open(filename, "wb") as f:
        f.write(png_bytes)
    print(f"Generated synthetic prescription: {filename} ({len(png_bytes)} bytes)")


def main():
    dest_dir = "seed/prescriptions"
    os.makedirs(dest_dir, exist_ok=True)

    # 1. Clean Sample (RX-50211 - Debasish Ghosh for mother)
    generate_prescription(
        f"{dest_dir}/rx_50211_metformin_clean.png",
        patient_name="Debasish Ghosh (for Mother, Anjali Ghosh)",
        medicines=[("Tab. Metformin 500 mg", "1 tab twice daily after meals (Qty: 4 strips of 15)")],
        style="clean"
    )

    # 2. Sample (RX-50214 - Rina Sen)
    generate_prescription(
        f"{dest_dir}/rx_50214_telmisartan.png",
        patient_name="Rina Sen",
        medicines=[("Tab. Telmisartan 40 mg", "1 tab once daily in morning (Qty: 3 strips of 10)")],
        style="clean"
    )

    # 3. Sample (RX-50219 - Arif Mondal - On hold / re-upload requested)
    generate_prescription(
        f"{dest_dir}/rx_50219_levothyroxine.png",
        patient_name="Arif Mondal",
        medicines=[("Tab. Levothyroxine 50 mcg", "1 tab daily before breakfast (Qty: 1 bottle of 100)")],
        style="clean"
    )

    # 4. Messy handwriting
    generate_prescription(
        f"{dest_dir}/rx_sample_messy.png",
        patient_name="Pranab Roy",
        medicines=[
            ("Tab. Amlodipine 5 mg", "1 tab OD"),
            ("Tab. Atorvastatin 10 mg", "1 tab HS")
        ],
        style="messy"
    )

    # 5. Blurry / cropped (Must trigger manual entry path)
    generate_prescription(
        f"{dest_dir}/rx_sample_blurry_unreadable.png",
        patient_name="[Unreadable Text]",
        medicines=[("Blurry Rx Line #1", "Unclear dosage")],
        style="blurry"
    )

    # 6. Schedule X / Narcotic item (Must be blocked online)
    generate_prescription(
        f"{dest_dir}/rx_sample_blocked_schedule_x.png",
        patient_name="Amitabh Sen",
        medicines=[
            ("Tab. Paracetamol 650 mg", "1 tab SOS for fever"),
            ("Tab. Methylphenidate 10 mg", "1 tab morning (Schedule X - NOT SOLD ONLINE)")
        ],
        style="clean"
    )

    # 7. Schedule H1 item (Needs mandatory register entry)
    generate_prescription(
        f"{dest_dir}/rx_sample_schedule_h1.png",
        patient_name="Kalyan Banerjee",
        medicines=[("Tab. Meropenem 500 mg", "1 vial IV stat / Tab Cefixime 200 mg (Schedule H1)")],
        style="clean",
        h1_notice="Prescriber & Patient register entry required under Drugs and Cosmetics Rules."
    )

    # 8. Generic-eligible case
    generate_prescription(
        f"{dest_dir}/rx_sample_generic_eligible.png",
        patient_name="Sharmila Tagore",
        medicines=[("Tab. Rosuvastatin 10 mg (Crestor Brand)", "1 tab at bedtime x 30 days")],
        style="clean"
    )

    # 9. Monthly Refill Case
    generate_prescription(
        f"{dest_dir}/rx_sample_refill_chronic.png",
        patient_name="Bikash Bhattacharya",
        medicines=[
            ("Tab. Glimepiride 1 mg", "1 tab with breakfast"),
            ("Tab. Metformin 500 mg", "1 tab twice daily")
        ],
        style="clean"
    )

    # 10. Multi-item prescription
    generate_prescription(
        f"{dest_dir}/rx_sample_multi_items.png",
        patient_name="Sunil Ganguly",
        medicines=[
            ("Tab. Pantoprazole 40 mg", "1 tab empty stomach"),
            ("Tab. Telmisartan 40 mg", "1 tab morning"),
            ("Tab. Vitamin D3 60K", "1 sachet weekly x 4 weeks")
        ],
        style="clean"
    )


if __name__ == "__main__":
    main()

