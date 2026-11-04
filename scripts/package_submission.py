# scripts/package_submission.py
import os
import zipfile

def package_submission():
    out_dir = "submission"
    os.makedirs(out_dir, exist_ok=True)
    zip_path = os.path.join(out_dir, "isocode_pharmacy_submission.zip")

    # Brief specification: "One ZIP file with two files: your Technical Design Document (PDF or Word) and a deployment.md"
    files_to_add = [
        ("docs/Technical_Design_Document.docx", "Technical_Design_Document.docx"),
        ("docs/deployment.md", "deployment.md"),
    ]

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, arcname in files_to_add:
            if os.path.exists(src):
                zf.write(src, arcname)
                print(f"Added {src} as {arcname} ({os.path.getsize(src)} bytes)")
            else:
                print(f"Warning: {src} not found!")

    zip_size = os.path.getsize(zip_path)
    print(f"Created submission ZIP at {zip_path} ({zip_size} bytes)")
    assert zip_size <= 25 * 1024 * 1024, "Submission ZIP exceeds 25 MB limit!"
    print("Verification passed: ZIP contains exactly 2 files and is under 25 MB.")

if __name__ == "__main__":
    package_submission()
