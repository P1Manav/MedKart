# scripts/package_submission.py
import os
import zipfile

def package_submission():
    out_dir = "submission"
    os.makedirs(out_dir, exist_ok=True)
    zip_path = os.path.join(out_dir, "isocode_pharmacy_submission.zip")

    files_to_add = [
        ("docs/Technical_Design_Document.docx", "Technical_Design_Document.docx"),
        ("docs/TECHNICAL_DESIGN_DOCUMENT.md", "Technical_Design_Document.md"),
        ("docs/deployment.md", "deployment.md"),
    ]

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, arcname in files_to_add:
            if os.path.exists(src):
                zf.write(src, arcname)
                print(f"Added {src} as {arcname} ({os.path.getsize(src)} bytes)")
            else:
                print(f"Warning: {src} not found!")

    print(f"Created submission ZIP at {zip_path} ({os.path.getsize(zip_path)} bytes)")

if __name__ == "__main__":
    package_submission()
