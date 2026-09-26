#!/usr/bin/env python3
import os
import shutil
from PIL import Image, ImageDraw

SOURCE_LOGO = r"C:\Users\Aladine20Dz\.gemini\antigravity-ide\brain\aa611fe4-98bc-4098-8b6e-9cb5b687b56c\.user_uploaded\media_1790425825883.jpg"
WORKSPACE = r"c:\Users\Aladine20Dz\AquaCore-Club-Manager"

if not os.path.exists(SOURCE_LOGO):
    raise FileNotFoundError(f"Source logo not found at {SOURCE_LOGO}")

print(f"Loading master logo from: {SOURCE_LOGO}")
master_img = Image.open(SOURCE_LOGO).convert("RGBA")
w, h = master_img.size
print(f"Master image loaded: {w}x{h} (RGBA)")

def create_circular_icon(img, size):
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.paste(resized, (0, 0), mask=mask)
    return output

def create_rounded_icon(img, size, radius_pct=0.18):
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    radius = int(size * radius_pct)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.paste(resized, (0, 0), mask=mask)
    return output

def save_png(img, rel_path, size=None):
    full_path = os.path.join(WORKSPACE, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    target = img
    if size is not None:
        target = img.resize(size, Image.Resampling.LANCZOS)
    target.save(full_path, "PNG", optimize=True)
    print(f"  [PNG] Saved {rel_path} ({target.size[0]}x{target.size[1]})")

# 1. Web & Application Master Logos
print("\n--- Generating Web & Brand Logos ---")
save_png(master_img, "public/images/aquacore-logo.png", (1024, 1024))
save_png(master_img, "public/images/icon.png", (512, 512))
save_png(master_img, "public/images/icon-256.png", (256, 256))
save_png(master_img, "public/images/apple-touch-icon.png", (180, 180))
save_png(master_img, "public/icon-512.png", (512, 512))
save_png(master_img, "public/icon-192.png", (192, 192))
save_png(master_img, "public/favicon.png", (64, 64))
save_png(master_img, "public/images/logo.png", (512, 512))
save_png(master_img, "public/images/rcs-logo.png", (512, 512))
save_png(master_img, "public/images/rcs-logo-official.png", (512, 512))
save_png(master_img, "public/images/rcs-logo-official-optimized.png", (512, 512))
save_png(master_img, "www/logo.png", (512, 512))

# 2. Windows Desktop Multi-size ICO & Browser favicon.ico
print("\n--- Generating Multi-resolution Windows ICOs ---")
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
desktop_ico_path = os.path.join(WORKSPACE, "public/images/icon.ico")
os.makedirs(os.path.dirname(desktop_ico_path), exist_ok=True)
master_img.save(desktop_ico_path, format="ICO", sizes=ico_sizes)
print(f"  [ICO] Saved public/images/icon.ico with sizes: {ico_sizes}")

fav_ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
app_fav_path = os.path.join(WORKSPACE, "src/app/favicon.ico")
os.makedirs(os.path.dirname(app_fav_path), exist_ok=True)
master_img.save(app_fav_path, format="ICO", sizes=fav_ico_sizes)
print(f"  [ICO] Saved src/app/favicon.ico with sizes: {fav_ico_sizes}")

pub_fav_path = os.path.join(WORKSPACE, "public/favicon.ico")
master_img.save(pub_fav_path, format="ICO", sizes=fav_ico_sizes)
print(f"  [ICO] Saved public/favicon.ico with sizes: {fav_ico_sizes}")

# 3. Android Splash Screens
print("\n--- Generating Android Splash Screens ---")
save_png(master_img, "android-resources/splash.png", (512, 512))
save_png(master_img, "android/app/src/main/res/drawable/splash.png", (512, 512))

# 4. Android Launcher Mipmap Icons
print("\n--- Generating Android Launcher & Round Icons ---")
density_sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

for density, size in density_sizes.items():
    rounded_icon = create_rounded_icon(master_img, size, radius_pct=0.18)
    circular_icon = create_circular_icon(master_img, size)
    
    # In android-resources
    p_square_res = f"android-resources/mipmap-{density}/ic_launcher.png"
    p_round_res = f"android-resources/mipmap-{density}/ic_launcher_round.png"
    save_png(rounded_icon, p_square_res)
    save_png(circular_icon, p_round_res)
    
    # In android/app/src/main/res
    p_square_app = f"android/app/src/main/res/mipmap-{density}/ic_launcher.png"
    p_round_app = f"android/app/src/main/res/mipmap-{density}/ic_launcher_round.png"
    save_png(rounded_icon, p_square_app)
    save_png(circular_icon, p_round_app)

print("\n✅ All brand logo assets successfully generated across web, mobile, and desktop!")
