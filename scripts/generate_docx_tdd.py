# scripts/generate_docx_tdd.py
"""
Generates a valid, beautifully formatted Microsoft Word (.docx) Technical Design Document
using Python's standard library (zipfile, xml.etree.ElementTree) with zero external dependencies.
"""

import os
import zipfile
import xml.etree.ElementTree as ET

def create_docx(markdown_path, output_docx_path):
    with open(markdown_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    lines = md_text.split('\n')

    # XML namespaces for DOCX
    w_ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    ET.register_namespace('w', w_ns)

    # Document root
    doc = ET.Element(f"{{{w_ns}}}document")
    body = ET.SubElement(doc, f"{{{w_ns}}}body")

    def add_p(text, style='Normal', bold=False, size=24, color=None):
        p = ET.SubElement(body, f"{{{w_ns}}}p")
        pPr = ET.SubElement(p, f"{{{w_ns}}}pPr")
        if style != 'Normal':
            pStyle = ET.SubElement(pPr, f"{{{w_ns}}}pStyle")
            pStyle.set(f"{{{w_ns}}}val", style)

        # Spacing
        spacing = ET.SubElement(pPr, f"{{{w_ns}}}spacing")
        spacing.set(f"{{{w_ns}}}before", "120")
        spacing.set(f"{{{w_ns}}}after", "120")

        r = ET.SubElement(p, f"{{{w_ns}}}r")
        rPr = ET.SubElement(r, f"{{{w_ns}}}rPr")
        if bold:
            ET.SubElement(rPr, f"{{{w_ns}}}b")
        if size:
            sz = ET.SubElement(rPr, f"{{{w_ns}}}sz")
            sz.set(f"{{{w_ns}}}val", str(size))
        if color:
            c = ET.SubElement(rPr, f"{{{w_ns}}}color")
            c.set(f"{{{w_ns}}}val", color)

        t = ET.SubElement(r, f"{{{w_ns}}}t")
        t.text = text
        return p

    in_code_block = False

    for line in lines:
        line_s = line.strip()
        if not line_s:
            continue

        if line_s.startswith('```'):
            in_code_block = not in_code_block
            continue

        if in_code_block:
            add_p(line, style='Normal', size=20, color='334155')
            continue

        if line_s.startswith('# '):
            add_p(line_s[2:], style='Heading1', bold=True, size=36, color='0F766E')
        elif line_s.startswith('## '):
            add_p(line_s[3:], style='Heading2', bold=True, size=28, color='0D6560')
        elif line_s.startswith('### '):
            add_p(line_s[4:], style='Heading3', bold=True, size=24, color='1E293B')
        elif line_s.startswith('- ') or line_s.startswith('* '):
            add_p('•  ' + line_s[2:], style='Normal', size=22, color='334155')
        elif line_s.startswith('|'):
            # Table row represented as clean text
            cols = [c.strip() for c in line_s.split('|')[1:-1]]
            if any('---' in c for c in cols):
                continue
            add_p(' | '.join(cols), style='Normal', size=20, color='475569')
        else:
            add_p(line_s, style='Normal', size=22, color='1E293B')

    # Minimal DOCX OpenXML package structure
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    doc_xml_str = ET.tostring(doc, encoding='utf-8', xml_declaration=True).decode('utf-8')

    os.makedirs(os.path.dirname(output_docx_path), exist_ok=True)
    with zipfile.ZipFile(output_docx_path, 'w', zipfile.ZIP_DEFLATED) as docx:
        docx.writestr('[Content_Types].xml', content_types_xml)
        docx.writestr('_rels/.rels', rels_xml)
        docx.writestr('word/document.xml', doc_xml_str)

    print(f"Generated DOCX TDD: {output_docx_path} ({os.path.getsize(output_docx_path)} bytes)")

if __name__ == '__main__':
    md_file = 'docs/TECHNICAL_DESIGN_DOCUMENT.md'
    out_docx = 'docs/Technical_Design_Document.docx'
    create_docx(md_file, out_docx)
