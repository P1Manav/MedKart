# scripts/compile_docx.py
"""
Compiles docs/Technical_Design_Document.md into a professional, native Microsoft Word (.docx) document
using python-docx. Formats tables with real Word XML cell shading, borders, and margins, parses inline
bold/code/links, renders clean architecture diagram callouts, and eliminates raw markdown syntax.
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

# Brand Palette (MedKart Professional Clinical Palette)
COLOR_TEAL_PRIMARY = RGBColor(15, 118, 110)    # #0F766E
COLOR_TEAL_DARK = RGBColor(13, 101, 96)        # #0D6560
COLOR_SLATE_DARK = RGBColor(30, 41, 59)        # #1E293B
COLOR_SLATE_MUTED = RGBColor(71, 85, 105)      # #475569
COLOR_CODE = RGBColor(15, 118, 110)            # #0F766E
COLOR_WHITE = RGBColor(255, 255, 255)

HEX_TEAL_PRIMARY = "0F766E"
HEX_TEAL_LIGHT = "F0FDFA"
HEX_ROW_ALT = "F8FAFC"
HEX_BORDER = "CBD5E1"
HEX_CALLOUT_BG = "F1F5F9"

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:bottom w:val="single" w:sz="8" w:space="0" w:color="{HEX_TEAL_PRIMARY}"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def clean_math(text):
    """Converts KaTeX math expressions into clean text representation."""
    text = re.sub(r'\\text\{([^}]+)\}', r'\1', text)
    text = re.sub(r'\\lfloor\s*', r'floor(', text)
    text = re.sub(r'\s*\\rfloor', r')', text)
    text = re.sub(r'\\le', r'<=', text)
    text = re.sub(r'\\times', r'x', text)
    text = text.replace('\\_', '_')
    text = text.replace('$', '')
    return text

def parse_and_add_runs(paragraph, text, default_color=COLOR_SLATE_DARK, base_size_pt=10.5):
    """
    Parses inline markdown tokens (**bold**, *italic*, `code`, [text](url))
    and adds typed runs to the paragraph.
    """
    # Tokenizer pattern for markdown elements
    # Matches: [label](url), `code`, ***bold-italic***, **bold**, *italic*
    token_pattern = re.compile(
        r'(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|\$([^$]+)\$)'
    )

    pos = 0
    for match in token_pattern.finditer(text):
        start, end = match.span()
        if start > pos:
            normal_text = text[pos:start]
            r = paragraph.add_run(normal_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(base_size_pt)
            r.font.color.rgb = default_color

        matched_str = match.group(0)
        if matched_str.startswith('[') and '](' in matched_str:
            # Markdown link
            label = match.group(2)
            url = match.group(3)
            r = paragraph.add_run(label)
            r.font.name = 'Calibri'
            r.font.size = Pt(base_size_pt)
            r.font.color.rgb = COLOR_TEAL_PRIMARY
            r.font.underline = True
            r.bold = True
        elif matched_str.startswith('`') and matched_str.endswith('`'):
            # Code span
            code_text = match.group(4)
            r = paragraph.add_run(code_text)
            r.font.name = 'Consolas'
            r.font.size = Pt(base_size_pt * 0.92)
            r.font.color.rgb = COLOR_CODE
            r.bold = True
        elif matched_str.startswith('***') and matched_str.endswith('***'):
            # Bold + Italic
            bi_text = match.group(5)
            r = paragraph.add_run(bi_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(base_size_pt)
            r.font.color.rgb = default_color
            r.bold = True
            r.italic = True
        elif matched_str.startswith('**') and matched_str.endswith('**'):
            # Bold
            b_text = match.group(6)
            r = paragraph.add_run(b_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(base_size_pt)
            r.font.color.rgb = default_color
            r.bold = True
        elif matched_str.startswith('*') and matched_str.endswith('*'):
            # Italic
            i_text = match.group(7)
            r = paragraph.add_run(i_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(base_size_pt)
            r.font.color.rgb = default_color
            r.italic = True
        elif matched_str.startswith('$') and matched_str.endswith('$'):
            # Math
            m_text = clean_math(match.group(8))
            r = paragraph.add_run(m_text)
            r.font.name = 'Consolas'
            r.font.size = Pt(base_size_pt * 0.95)
            r.font.color.rgb = COLOR_TEAL_DARK
            r.italic = True

        pos = end

    if pos < len(text):
        remaining = text[pos:]
        r = paragraph.add_run(remaining)
        r.font.name = 'Calibri'
        r.font.size = Pt(base_size_pt)
        r.font.color.rgb = default_color

def create_table_from_markdown(doc, md_table_lines):
    """
    Constructs a styled Word table from raw Markdown table lines.
    """
    rows_data = []
    for line in md_table_lines:
        line = line.strip()
        if not line or not line.startswith('|'):
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if any('---' in c for c in cells):
            continue  # Separator line
        rows_data.append(cells)

    if not rows_data:
        return

    num_rows = len(rows_data)
    num_cols = max(len(r) for r in rows_data)

    table = doc.add_table(rows=num_rows, cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table)

    for row_idx, row_cells in enumerate(rows_data):
        is_header = (row_idx == 0)
        table_row = table.rows[row_idx]

        # Prevent row split across pages
        trPr = table_row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

        if is_header:
            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        for col_idx in range(num_cols):
            cell = table_row.cells[col_idx]
            cell_text = row_cells[col_idx] if col_idx < len(row_cells) else ""
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

            if is_header:
                set_cell_background(cell, HEX_TEAL_PRIMARY)
                set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                # Header text is bold white
                r = p.add_run(cell_text.replace('**', ''))
                r.font.name = 'Calibri'
                r.font.size = Pt(10)
                r.bold = True
                r.font.color.rgb = COLOR_WHITE
            else:
                bg = HEX_ROW_ALT if (row_idx % 2 == 1) else "FFFFFF"
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=100, bottom=100, left=160, right=160)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                parse_and_add_runs(p, cell_text, default_color=COLOR_SLATE_DARK, base_size_pt=9.5)

    # Add subtle spacing after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(6)

def add_callout_box(doc, title, content_lines, hex_bg=HEX_CALLOUT_BG, border_color=HEX_TEAL_PRIMARY):
    """Adds a callout panel with left border accent and light background."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.rows[0].cells[0]
    set_cell_background(cell, hex_bg)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=180)

    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    r_title = p.add_run(f"◈ {title}")
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(10.5)
    r_title.bold = True
    r_title.font.color.rgb = COLOR_TEAL_DARK

    for cl in content_lines:
        p_c = cell.add_paragraph()
        p_c.paragraph_format.space_before = Pt(2)
        p_c.paragraph_format.space_after = Pt(2)
        parse_and_add_runs(p_c, cl, default_color=COLOR_SLATE_DARK, base_size_pt=9.5)

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(6)

def add_pictorial_image(doc, img_rel_path, caption=None, base_dir=None):
    """Embeds a high-resolution pictorial diagram into the Word document with centered alignment and caption."""
    if base_dir:
        full_path = os.path.normpath(os.path.join(base_dir, img_rel_path))
    else:
        full_path = img_rel_path

    if not os.path.exists(full_path):
        print(f"Warning: Image file not found: {full_path}")
        return False

    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(12)
    p_img.paragraph_format.space_after = Pt(4)
    run_img = p_img.add_run()
    # 6.5 inches printable width for 8.5" page with 0.9" margins
    run_img.add_picture(full_path, width=Inches(6.5))

    if caption:
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(14)
        r_cap = p_cap.add_run(caption)
        r_cap.font.name = 'Calibri'
        r_cap.font.size = Pt(9.5)
        r_cap.font.color.rgb = COLOR_SLATE_MUTED
        r_cap.italic = True

    return True

def build_docx(markdown_path, output_docx_path):
    with open(markdown_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    doc = docx.Document()

    # Configure Margins (0.9 inch)
    for section in doc.sections:
        section.top_margin = Inches(0.9)
        section.bottom_margin = Inches(0.9)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)

    lines = md_text.split('\n')
    i = 0
    total_lines = len(lines)

    is_first_header = True

    while i < total_lines:
        line = lines[i].strip()

        # Blank line
        if not line:
            i += 1
            continue

        # Horizontal rule
        if line in ('---', '***', '___'):
            i += 1
            continue

        # Document Title Header
        if line.startswith('# Technical Design Document'):
            p_title = doc.add_paragraph()
            p_title.paragraph_format.space_before = Pt(0)
            p_title.paragraph_format.space_after = Pt(2)
            r = p_title.add_run("Technical Design Document (TDD)")
            r.font.name = 'Calibri'
            r.font.size = Pt(24)
            r.bold = True
            r.font.color.rgb = COLOR_TEAL_PRIMARY

            # Check next line for subtitle
            if i + 1 < total_lines and lines[i + 1].strip().startswith('# MedKart'):
                i += 1
                sub_text = lines[i].strip().lstrip('#').strip()
                p_sub = doc.add_paragraph()
                p_sub.paragraph_format.space_before = Pt(0)
                p_sub.paragraph_format.space_after = Pt(14)
                r_sub = p_sub.add_run(sub_text)
                r_sub.font.name = 'Calibri'
                r_sub.font.size = Pt(13)
                r_sub.italic = True
                r_sub.font.color.rgb = COLOR_SLATE_MUTED

            i += 1
            continue

        # Section Headings
        if line.startswith('## '):
            h_text = line[3:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(15)
            r.bold = True
            r.font.color.rgb = COLOR_TEAL_PRIMARY
            i += 1
            continue

        if line.startswith('### '):
            h_text = line[4:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(12.5)
            r.bold = True
            r.font.color.rgb = COLOR_TEAL_DARK
            i += 1
            continue

        if line.startswith('#### '):
            h_text = line[5:].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(h_text)
            r.font.name = 'Calibri'
            r.font.size = Pt(11)
            r.bold = True
            r.font.color.rgb = COLOR_SLATE_DARK
            i += 1
            continue

        # Markdown Images: ![Caption](path)
        img_match = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)', line)
        if img_match:
            cap = img_match.group(1).strip()
            img_path = img_match.group(2).strip()
            # If next line is an italic caption like *Figure ...*, use it as caption
            if i + 1 < total_lines and lines[i + 1].strip().startswith('*Figure') and lines[i + 1].strip().endswith('*'):
                i += 1
                cap = lines[i].strip().strip('*')
            docs_dir = os.path.dirname(markdown_path)
            add_pictorial_image(doc, img_path, caption=cap, base_dir=docs_dir)
            i += 1
            continue

        # Mermaid Diagram Blocks -> Map to High-Resolution Pictorial Diagram
        if line.startswith('```mermaid'):
            diagram_lines = []
            i += 1
            while i < total_lines and not lines[i].strip().startswith('```'):
                diagram_lines.append(lines[i].strip())
                i += 1
            i += 1  # Skip closing ```

            all_dl = ' '.join(diagram_lines)
            docs_dir = os.path.dirname(markdown_path)
            if 'subgraph Client' in all_dl or 'Server Monolith' in all_dl:
                add_pictorial_image(doc, "diagrams/architecture_overview.png", "Figure 2.1: MedKart Monolithic Three-Tier Architecture", base_dir=docs_dir)
            elif 'erDiagram' in all_dl:
                add_pictorial_image(doc, "diagrams/entity_relationship.png", "Figure 3.1: MedKart Relational Entity-Relationship Model", base_dir=docs_dir)
            elif 'RESIZE' in all_dl or 'trocr' in all_dl.lower() or 'fuzzy' in all_dl.lower():
                add_pictorial_image(doc, "diagrams/ai_transcription_pipeline.png", "Figure 5.1: 3-Tier Non-Generative AI Perception Pipeline", base_dir=docs_dir)
            elif 'SUBMITTED' in all_dl or 'assertDispatchable' in all_dl:
                add_pictorial_image(doc, "diagrams/order_lifecycle_flow.png", "Figure 4.1: Regulated Order Lifecycle & Dual-Layer Dispatch Security Gating", base_dir=docs_dir)
            elif 'Haversine' in all_dl or 'store_stock' in all_dl:
                add_pictorial_image(doc, "diagrams/store_routing_flow.png", "Figure 6.1: Multi-Store Haversine Inventory Routing & Stock Split Engine", base_dir=docs_dir)
            else:
                add_pictorial_image(doc, "diagrams/architecture_overview.png", "System Architecture Flow", base_dir=docs_dir)
            continue

        # Code Blocks
        if line.startswith('```'):
            code_lines = []
            lang = line[3:].strip()
            i += 1
            while i < total_lines and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # Skip closing ```

            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            c = tbl.rows[0].cells[0]
            set_cell_background(c, "F1F5F9")
            set_cell_margins(c, top=100, bottom=100, left=180, right=180)
            p = c.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r_code = p.add_run('\n'.join(code_lines))
            r_code.font.name = 'Consolas'
            r_code.font.size = Pt(9)
            r_code.font.color.rgb = COLOR_SLATE_DARK

            p_after = doc.add_paragraph()
            p_after.paragraph_format.space_before = Pt(0)
            p_after.paragraph_format.space_after = Pt(4)
            continue

        # Markdown Tables
        if line.startswith('|'):
            table_lines = [line]
            i += 1
            while i < total_lines and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            create_table_from_markdown(doc, table_lines)
            continue

        # Bullet Lists
        if line.startswith('- ') or line.startswith('* '):
            bullet_text = line[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1.5)
            p.paragraph_format.space_after = Pt(2.5)
            parse_and_add_runs(p, bullet_text, default_color=COLOR_SLATE_DARK, base_size_pt=10.5)
            i += 1
            continue

        # Numbered Lists
        if re.match(r'^\d+\.\s+', line):
            m = re.match(r'^(\d+\.)\s+(.*)', line)
            num_label = m.group(1)
            num_text = m.group(2)
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            r_num = p.add_run(f"{num_label}  ")
            r_num.font.name = 'Calibri'
            r_num.font.size = Pt(10.5)
            r_num.bold = True
            r_num.font.color.rgb = COLOR_TEAL_PRIMARY
            parse_and_add_runs(p, num_text, default_color=COLOR_SLATE_DARK, base_size_pt=10.5)
            i += 1
            continue

        # Standard Paragraphs & Metadata Header block
        if line.startswith('**Repository URL:**') or line.startswith('**Live Deployed Application:**') or line.startswith('**Author:**'):
            # Collect metadata block
            meta_lines = [line]
            i += 1
            while i < total_lines and (lines[i].strip().startswith('**') or lines[i].strip().startswith('**Date:') or lines[i].strip().startswith('**Status:')):
                meta_lines.append(lines[i].strip())
                i += 1

            add_callout_box(doc, "Project Metadata & Verification Links", meta_lines, hex_bg="F8FAFC", border_color="0F766E")
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        parse_and_add_runs(p, line, default_color=COLOR_SLATE_DARK, base_size_pt=10.5)
        i += 1

    os.makedirs(os.path.dirname(output_docx_path), exist_ok=True)
    doc.save(output_docx_path)
    print(f"✅ Successfully compiled {output_docx_path} ({os.path.getsize(output_docx_path)} bytes)")

if __name__ == '__main__':
    # Ensure diagrams are generated and up-to-date
    try:
        from generate_diagrams import main as gen_diagrams
        gen_diagrams()
    except Exception as e:
        print(f"Diagram generation note: {e}")

    src = os.path.join(os.path.dirname(__file__), '..', 'docs', 'Technical_Design_Document.md')
    dst = os.path.join(os.path.dirname(__file__), '..', 'docs', 'Technical_Design_Document.docx')
    build_docx(src, dst)

