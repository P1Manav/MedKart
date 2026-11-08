# scripts/generate_diagrams.py
"""
Generates high-resolution, publication-grade pictorial architecture diagrams
for the MedKart Pharmacy Technical Design Document (TDD).
Outputs 300 DPI PNGs into docs/diagrams/.
"""

import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ArrowStyle

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "diagrams")
os.makedirs(OUT_DIR, exist_ok=True)

# MedKart Professional Clinical Palette
TEAL_PRIMARY = "#0F766E"      # MedKart Deep Teal
TEAL_LIGHT = "#CCFBF1"        # Soft Teal Mint
TEAL_DARK = "#115E59"
SLATE_DARK = "#0F172A"       # Headers / Text
SLATE_BODY = "#334155"       # Subtitles / Descriptions
SLATE_LIGHT = "#F8FAFC"      # Card Backgrounds
SLATE_BORDER = "#CBD5E1"     # Card Outlines
AMBER_ACCENT = "#D97706"     # Caution / Review
AMBER_LIGHT = "#FEF3C7"
GREEN_ACCENT = "#059669"     # Success / Approved
GREEN_LIGHT = "#D1FAE5"
PURPLE_ACCENT = "#6366F1"    # Security / DB
PURPLE_LIGHT = "#EEF2FF"
RED_ACCENT = "#DC2626"       # Restricted / Trigger
RED_LIGHT = "#FEE2E2"

plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.sans-serif"] = ["Segoe UI", "Calibri", "DejaVu Sans", "Arial"]


def draw_card(ax, x, y, w, h, title, items=None, bg_color=SLATE_LIGHT, border_color=SLATE_BORDER, title_color=SLATE_DARK, badge=None, badge_color=TEAL_PRIMARY):
    """Draws a rounded modern card with title, optional badge, and bullet items."""
    box = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.015,rounding_size=0.025",
        facecolor=bg_color,
        edgecolor=border_color,
        linewidth=1.5,
        zorder=2
    )
    ax.add_patch(box)

    # Title
    ax.text(x + 0.02, y + h - 0.035, title, fontsize=11, fontweight="bold", color=title_color, va="top", zorder=3)

    # Badge if present
    if badge:
        bw = len(badge) * 0.013 + 0.04
        bx = x + w - bw - 0.02
        by = y + h - 0.045
        badge_box = FancyBboxPatch(
            (bx, by), bw, 0.03,
            boxstyle="round,pad=0.005,rounding_size=0.01",
            facecolor=badge_color,
            edgecolor="none",
            zorder=4
        )
        ax.add_patch(badge_box)
        ax.text(bx + bw / 2, by + 0.015, badge, fontsize=8, fontweight="bold", color="white", ha="center", va="center", zorder=5)

    # Bullet / Sub items
    if items:
        start_y = y + h - 0.065
        step = (h - 0.08) / max(len(items), 1)
        for i, item in enumerate(items):
            iy = start_y - i * step
            ax.text(x + 0.02, iy, f"• {item}", fontsize=9, color=SLATE_BODY, va="top", zorder=3)


def draw_arrow(ax, x1, y1, x2, y2, label=None, color=TEAL_PRIMARY, lw=2.0, style="->"):
    """Draws a crisp directional connection with optional text label."""
    ax.annotate(
        "",
        xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(
            arrowstyle=style,
            color=color,
            lw=lw,
            shrinkA=4, shrinkB=4,
            mutation_scale=15
        ),
        zorder=6
    )
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(
            mx, my + 0.015, label,
            fontsize=8.5, fontweight="bold", color=color,
            ha="center", va="center",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor=color, lw=0.8),
            zorder=7
        )


# ==============================================================================
# Diagram 1: System Architecture Overview
# ==============================================================================
def generate_architecture_diagram():
    fig, ax = plt.subplots(figsize=(13, 8.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # Title & Subtitle banner
    ax.text(0.5, 0.965, "MedKart Pharmacy — Monolithic System Architecture", fontsize=17, fontweight="bold", color=SLATE_DARK, ha="center")
    ax.text(0.5, 0.935, "Locked Three-Tier Architecture: Next.js Client, Verified Server Domain Monolith, and PostgreSQL Dual-Gated Database", fontsize=10, color=SLATE_BODY, ha="center")

    # Tier 1: Client Tier
    tier1_bg = FancyBboxPatch((0.04, 0.64), 0.92, 0.26, boxstyle="round,pad=0.015,rounding_size=0.02", facecolor="#F0FDFA", edgecolor=TEAL_PRIMARY, lw=1.5, zorder=1)
    ax.add_patch(tier1_bg)
    ax.text(0.06, 0.875, "CLIENT TIER — Universal Responsive Web Interface", fontsize=11, fontweight="bold", color=TEAL_DARK, zorder=2)

    draw_card(ax, 0.06, 0.66, 0.27, 0.19, "Customer PWA (Mobile 375px)", [
        "1-Minute Chronic Reorder Flow",
        "Direct UPI Deep-Link & Sandbox Modal",
        "Multi-Profile Family Caregiver UI",
        "Encrypted Prescription Capture",
    ], badge="Next.js 16", badge_color=TEAL_PRIMARY)

    draw_card(ax, 0.365, 0.66, 0.27, 0.19, "Pharmacist Review Workspace", [
        "Side-by-Side Dual-Pane (Desktop 1440px)",
        "Decrypted Prescription Viewer (Pan/Zoom)",
        "AI Transcript Draft Verification",
        "One-Click Schedule H/H1 Line Decision",
    ], badge="Tailwind CSS", badge_color=TEAL_PRIMARY)

    draw_card(ax, 0.67, 0.66, 0.27, 0.19, "Store & Ops Control Desks", [
        "Store Pick List & GST Invoicing",
        "Direct UPI Receipt Verification Gate",
        "Courier Handover & Tracking ID",
        "Live 46-Store SLA & Volume Metrics",
    ], badge="next-intl (EN/HI/BN)", badge_color=TEAL_PRIMARY)

    # Arrow Down to Server
    draw_arrow(ax, 0.5, 0.64, 0.5, 0.58, "HTTPS / HttpOnly Signed JWT Cookie (jose HS256)", color=TEAL_PRIMARY, lw=2.2)

    # Tier 2: Server Monolith
    tier2_bg = FancyBboxPatch((0.04, 0.29), 0.92, 0.28, boxstyle="round,pad=0.015,rounding_size=0.02", facecolor="#F8FAFC", edgecolor="#64748B", lw=1.5, zorder=1)
    ax.add_patch(tier2_bg)
    ax.text(0.06, 0.545, "SERVER TIER — Next.js Route Handlers & Pure Domain Services Monolith", fontsize=11, fontweight="bold", color=SLATE_DARK, zorder=2)

    draw_card(ax, 0.06, 0.31, 0.20, 0.21, "Auth & RBAC Guards", [
        "Deny-by-Default Role Middleware",
        "Store-Object Scoped Isolation",
        "Salted HMAC-SHA256 OTP (Twilio)",
        "tokenVersion Instant Multi-Logout",
    ], bg_color="white", border_color="#CBD5E1", badge="Security", badge_color=PURPLE_ACCENT)

    draw_card(ax, 0.28, 0.31, 0.22, 0.21, "Pure Domain Engines", [
        "Order State Machine (validateTransition)",
        "assertDispatchable Mandatory Gate",
        "Haversine Store Inventory Routing",
        "Refill Cycle & Run-Out Predictor",
    ], bg_color="white", border_color="#CBD5E1", badge="Domain", badge_color=TEAL_PRIMARY)

    draw_card(ax, 0.52, 0.31, 0.21, 0.21, "3-Tier Non-Gen AI", [
        "Tier 1: TrOCR (microsoft/trocr-base)",
        "Tier 2: Tesseract.js WASM In-Process",
        "Tier 3: Graceful Manual Queue Fallback",
        "Deterministic Regex & Fuzzy Match",
    ], bg_color="white", border_color="#CBD5E1", badge="Non-Gen AI", badge_color=AMBER_ACCENT)

    draw_card(ax, 0.75, 0.31, 0.19, 0.21, "Crypto & Auditing", [
        "AES-256-GCM Envelope Encryption",
        "Random 96-bit IV & 128-bit AuthTag",
        "Pure Byte-Level EXIF/GPS Stripper",
        "Immutable PrescriptionAccessLog",
    ], bg_color="white", border_color="#CBD5E1", badge="DPDP 2023", badge_color=GREEN_ACCENT)

    # Arrow Down to Database
    draw_arrow(ax, 0.5, 0.29, 0.5, 0.23, "Prisma ORM (ACID Connection Pool) & Database Triggers", color="#6366F1", lw=2.2)

    # Tier 3: PostgreSQL Database
    tier3_bg = FancyBboxPatch((0.04, 0.03), 0.92, 0.19, boxstyle="round,pad=0.015,rounding_size=0.02", facecolor=PURPLE_LIGHT, edgecolor=PURPLE_ACCENT, lw=1.5, zorder=1)
    ax.add_patch(tier3_bg)
    ax.text(0.06, 0.195, "DATABASE TIER — Supabase Managed PostgreSQL 15+ & Native Safety Triggers", fontsize=11, fontweight="bold", color=PURPLE_ACCENT, zorder=2)

    draw_card(ax, 0.06, 0.05, 0.27, 0.125, "Relational Schema (18 Tables)", [
        "Users, FamilyProfiles, Orders, OrderLines",
        "Products, Stores, StoreStock, ScheduleRules",
    ], bg_color="white", border_color=PURPLE_ACCENT)

    draw_card(ax, 0.365, 0.05, 0.27, 0.125, "PostgreSQL Trigger Defense", [
        "trg_assert_dispatchable_order",
        "Aborts raw SQL bypass without pharmacist",
    ], bg_color=RED_LIGHT, border_color=RED_ACCENT, title_color=RED_ACCENT, badge="Hard Gate", badge_color=RED_ACCENT)

    draw_card(ax, 0.67, 0.05, 0.27, 0.125, "Immutable Compliance Logs", [
        "OrderAudit (actor, role, from/to, reason)",
        "PrescriptionAccessLog (DPDP Act audit)",
    ], bg_color="white", border_color=PURPLE_ACCENT)

    out_file = os.path.join(OUT_DIR, "architecture_overview.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor="white")
    plt.close()
    print(f"Generated {out_file}")


# ==============================================================================
# Diagram 2: Entity Relationship Diagram
# ==============================================================================
def generate_er_diagram():
    fig, ax = plt.subplots(figsize=(14, 9), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.965, "MedKart Pharmacy — Relational Entity-Relationship Model", fontsize=17, fontweight="bold", color=SLATE_DARK, ha="center")
    ax.text(0.5, 0.935, "18 Normalized PostgreSQL Entities with Strict Foreign Key Integrity & Audit Logs", fontsize=10, color=SLATE_BODY, ha="center")

    # Layout Entities
    # Left column: Users, FamilyProfile, CustomerAddress
    draw_card(ax, 0.04, 0.67, 0.25, 0.23, "User", [
        "id: String (PK)",
        "phone: String (Unique)",
        "role: CUSTOMER | PHARMACIST | ...",
        "pharmacistRegNo: String?",
        "tokenVersion: Int",
    ], bg_color="#F0FDFA", border_color=TEAL_PRIMARY, badge="Core", badge_color=TEAL_PRIMARY)

    draw_card(ax, 0.04, 0.37, 0.25, 0.23, "FamilyProfile", [
        "id: String (PK)",
        "userId: String (FK -> User)",
        "name: String",
        "relationship: String",
        "chronicConditions: String[]",
    ], bg_color="white", border_color=SLATE_BORDER)

    draw_card(ax, 0.04, 0.08, 0.25, 0.23, "CustomerAddress", [
        "id: String (PK)",
        "userId: String (FK -> User)",
        "addressText: String",
        "pincode: String (700064, etc.)",
        "lat: Float, lng: Float",
    ], bg_color="white", border_color=SLATE_BORDER)

    # Center column: Order, OrderLine, OrderAudit
    draw_card(ax, 0.375, 0.58, 0.26, 0.32, "Order", [
        "id: String (PK)",
        "displayId: String (RX-502xx)",
        "customerId: String (FK -> User)",
        "storeId: String? (FK -> Store)",
        "status: OrderStatus (DRAFT..DELIVERED)",
        "prescriptionEncrypted: Bytes",
        "prescriptionIv, AuthTag: Bytes",
        "prescriptionValidUntil: DateTime",
        "paymentMethod: PaymentMethod",
    ], bg_color="#EEF2FF", border_color=PURPLE_ACCENT, badge="Central Aggregate", badge_color=PURPLE_ACCENT)

    draw_card(ax, 0.375, 0.27, 0.26, 0.26, "OrderLine", [
        "id: String (PK)",
        "orderId: String (FK -> Order)",
        "productId: String (FK -> Product)",
        "lineStatus: PENDING | APPROVED | ...",
        "pharmacistId, RegNo: String?",
        "h1PrescriberName, RegNo: String?",
        "h1PatientName, Date: String?",
    ], bg_color="white", border_color=SLATE_BORDER)

    draw_card(ax, 0.375, 0.05, 0.26, 0.17, "OrderAudit", [
        "id: String (PK)",
        "orderId: String (FK -> Order)",
        "actorId, actorRole: String",
        "fromStatus, toStatus: String",
        "reason, timestamp: DateTime",
    ], bg_color="#FEF3C7", border_color=AMBER_ACCENT, badge="Immutable", badge_color=AMBER_ACCENT)

    # Right column: Product, ScheduleRule, Store, StoreStock
    draw_card(ax, 0.71, 0.71, 0.25, 0.19, "Product", [
        "id: String (PK)",
        "name, strength, form: String",
        "schedule: OTC | H | H1 | X | NARCOTIC",
        "price: Float, packSize: String",
    ], bg_color="white", border_color=SLATE_BORDER)

    draw_card(ax, 0.71, 0.50, 0.25, 0.17, "ScheduleRule", [
        "schedule: ScheduleType (PK)",
        "canSellOnline: Boolean",
        "requiresPrescription: Boolean",
        "requiresPharmacistApproval: Boolean",
    ], bg_color="#FEE2E2", border_color=RED_ACCENT, badge="Statutory Gate", badge_color=RED_ACCENT)

    draw_card(ax, 0.71, 0.26, 0.25, 0.20, "Store", [
        "id: String (PK, e.g. store_saltlake)",
        "name: String (MedKart Salt Lake)",
        "lat: Float, lng: Float",
        "pincode: String (700064)",
    ], bg_color="white", border_color=SLATE_BORDER)

    draw_card(ax, 0.71, 0.05, 0.25, 0.17, "StoreStock", [
        "storeId: String (FK -> Store)",
        "productId: String (FK -> Product)",
        "quantity: Int (Physical count)",
        "Composite PK: (storeId, productId)",
    ], bg_color="white", border_color=SLATE_BORDER)

    # Relationship Arrows
    draw_arrow(ax, 0.29, 0.76, 0.375, 0.76, "places (1:N)", lw=1.5)
    draw_arrow(ax, 0.29, 0.50, 0.375, 0.65, "orders for (1:N)", lw=1.5)
    draw_arrow(ax, 0.505, 0.58, 0.505, 0.53, "contains (1:N)", lw=1.5)
    draw_arrow(ax, 0.505, 0.27, 0.505, 0.22, "audits (1:N)", lw=1.5)
    draw_arrow(ax, 0.71, 0.80, 0.635, 0.40, "references", lw=1.5)
    draw_arrow(ax, 0.71, 0.35, 0.635, 0.70, "fulfills (1:N)", lw=1.5)
    draw_arrow(ax, 0.835, 0.26, 0.835, 0.22, "maintains (1:N)", lw=1.5)

    out_file = os.path.join(OUT_DIR, "entity_relationship.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor="white")
    plt.close()
    print(f"Generated {out_file}")


# ==============================================================================
# Diagram 3: AI Transcription Pipeline & Perception Flow
# ==============================================================================
def generate_ai_pipeline_diagram():
    fig, ax = plt.subplots(figsize=(13.5, 7.8), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.96, "3-Tier Non-Generative AI Perception & Clinical Uncertainty Pipeline", fontsize=16, fontweight="bold", color=SLATE_DARK, ha="center")
    ax.text(0.5, 0.925, "Zero Hallucination Guarantee: Small Vision Perception Models + Deterministic Parsing + Mandatory Human Pharmacist Gate", fontsize=10, color=SLATE_BODY, ha="center")

    # Step 1: Ingestion & Privacy
    draw_card(ax, 0.04, 0.52, 0.20, 0.34, "1. Ingestion & DPDP", [
        "Patient Image Upload",
        "Magic-Byte Header Validation",
        "Client EXIF/GPS Stripping",
        "AES-256-GCM Envelope Encrypt",
        "Secure Storage (bytea, IV, tag)",
    ], bg_color="#F0FDFA", border_color=TEAL_PRIMARY, badge="Privacy", badge_color=TEAL_PRIMARY)

    draw_arrow(ax, 0.24, 0.69, 0.29, 0.69, "Clean Image", lw=2.0)

    # Step 2: 3-Tier OCR Engine
    draw_card(ax, 0.29, 0.46, 0.24, 0.40, "2. 3-Tier OCR Perception", [
        "Tier 1: Hugging Face Router",
        "  (microsoft/trocr-base-handwritten)",
        "Tier 2 Fallback: Tesseract.js",
        "  (In-Process WebAssembly)",
        "Tier 3 Fallback: Pharmacist Queue",
        "  (Zero-Crash Manual Transcription)",
        "Serverless 30s Timeout Guard",
    ], bg_color="#EEF2FF", border_color=PURPLE_ACCENT, badge="Perception", badge_color=PURPLE_ACCENT)

    draw_arrow(ax, 0.53, 0.69, 0.58, 0.69, "Raw Tokens", lw=2.0)

    # Step 3: Deterministic Parsing & Matching
    draw_card(ax, 0.58, 0.46, 0.21, 0.40, "3. Parsing & Matching", [
        "Regex Line Segmentation",
        "Dosage & Frequency Extraction",
        "  (e.g., 500mg, 1 tab OD, 30 days)",
        "Fuse.js Fuzzy Catalogue Match",
        "Deterministic Confidence Proxy:",
        "  C = 0.35 Salnum + 0.30 Sentropy",
        "  + Smed (No Hallucination)",
    ], bg_color="#FEF3C7", border_color=AMBER_ACCENT, badge="Deterministic", badge_color=AMBER_ACCENT)

    draw_arrow(ax, 0.79, 0.69, 0.83, 0.69, "Candidate", lw=2.0)

    # Step 4: Clinical Safety Verification
    draw_card(ax, 0.83, 0.46, 0.14, 0.40, "4. Safety Gating", [
        "Strength Check",
        "Schedule Rules",
        "Generic Links",
        "Amber Flags",
    ], bg_color="#FEE2E2", border_color=RED_ACCENT, badge="Safety", badge_color=RED_ACCENT)

    # Bottom Decision Branches
    draw_arrow(ax, 0.90, 0.46, 0.90, 0.35, lw=1.8)

    draw_card(ax, 0.04, 0.08, 0.42, 0.24, "Branch A: High Confidence & Exact Match (Green)", [
        "Prescription tokens match catalogue drug, strength (e.g. 5 mg), and form.",
        "Generates Pre-Filled Draft Line marked PENDING pharmacist verification.",
        "Calculates recommended generic bioequivalent savings (e.g., Rosuvastatin Generic saves ₹115).",
    ], bg_color=GREEN_LIGHT, border_color=GREEN_ACCENT, title_color=GREEN_ACCENT, badge="Draft Line", badge_color=GREEN_ACCENT)

    draw_card(ax, 0.52, 0.08, 0.44, 0.24, "Branch B: Uncertainty / Strength Mismatch / Blur (Amber)", [
        "Strength mismatch (e.g., prescription reads 10mg, catalogue is 5mg) strictly forces needsReview.",
        "Low word confidence (<0.40) flags order with MANUAL_ENTRY_NEEDED badge.",
        "Schedule X / Narcotics automatically tagged BLOCKED_NOT_SOLD_ONLINE.",
        "Pharmacist uses manual medicine search modal to add and verify correct medicine safely.",
    ], bg_color=AMBER_LIGHT, border_color=AMBER_ACCENT, title_color=AMBER_ACCENT, badge="Human Override", badge_color=AMBER_ACCENT)

    draw_arrow(ax, 0.85, 0.35, 0.74, 0.32, "Mismatch / Blur", color=AMBER_ACCENT, lw=1.8)
    draw_arrow(ax, 0.85, 0.35, 0.25, 0.32, "Exact Match", color=GREEN_ACCENT, lw=1.8)

    out_file = os.path.join(OUT_DIR, "ai_transcription_pipeline.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor="white")
    plt.close()
    print(f"Generated {out_file}")


# ==============================================================================
# Diagram 4: Regulated Order Lifecycle & Dual Gate State Machine
# ==============================================================================
def generate_order_lifecycle_diagram():
    fig, ax = plt.subplots(figsize=(14, 7.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.965, "Regulated Order Lifecycle & Dual-Layer Dispatch Security Gating", fontsize=16, fontweight="bold", color=SLATE_DARK, ha="center")
    ax.text(0.5, 0.93, "State Machine Transitions Gated by Application-Layer assertDispatchable and PostgreSQL Trigger Engine", fontsize=10, color=SLATE_BODY, ha="center")

    # State Nodes horizontally
    # 1. DRAFT / SUBMITTED
    draw_card(ax, 0.03, 0.58, 0.15, 0.27, "1. SUBMITTED", [
        "Cart selection or",
        "Prescription upload",
        "Customer phone OTP",
        "Payment authorized",
    ], bg_color="#F8FAFC", border_color=SLATE_BORDER, badge="Customer", badge_color=SLATE_DARK)

    draw_arrow(ax, 0.18, 0.71, 0.22, 0.71, lw=2.0)

    # 2. Pharmacist Review
    draw_card(ax, 0.22, 0.50, 0.18, 0.35, "2. Pharmacist Gate", [
        "Side-by-side verification",
        "Approve lines / Transcribe",
        "Schedule H1 register entry",
        "Compute validUntil date",
        "Auto-route order to store",
    ], bg_color="#F0FDFA", border_color=TEAL_PRIMARY, badge="Licensed RPh", badge_color=TEAL_PRIMARY)

    draw_arrow(ax, 0.40, 0.71, 0.44, 0.71, "Approve", color=GREEN_ACCENT, lw=2.0)

    # Rejection loop
    draw_arrow(ax, 0.31, 0.50, 0.31, 0.38, "Reject / Blur", color=AMBER_ACCENT, lw=1.8)
    draw_card(ax, 0.20, 0.12, 0.22, 0.22, "ON_HOLD / REJECTED", [
        "ON_HOLD: Blur / illegible",
        "  Customer receives reupload link",
        "REJECTED: Invalid Rx / Schedule X",
        "  Transitions to REFUND_DUE queue",
    ], bg_color=AMBER_LIGHT, border_color=AMBER_ACCENT, badge="Hold / Refund", badge_color=AMBER_ACCENT)

    # 3. APPROVED
    draw_card(ax, 0.44, 0.58, 0.14, 0.27, "3. APPROVED", [
        "Prescription verified",
        "Store ID assigned",
        "Inventory reserved",
        "Ready for packing",
    ], bg_color=GREEN_LIGHT, border_color=GREEN_ACCENT, badge="Approved", badge_color=GREEN_ACCENT)

    draw_arrow(ax, 0.58, 0.71, 0.62, 0.71, lw=2.0)

    # DUAL SECURITY GATE CALLOUT
    gate_box = FancyBboxPatch((0.59, 0.15), 0.18, 0.42, boxstyle="round,pad=0.015,rounding_size=0.02", facecolor=RED_LIGHT, edgecolor=RED_ACCENT, lw=1.8, zorder=2)
    ax.add_patch(gate_box)
    ax.text(0.68, 0.52, "DUAL SECURITY GATE", fontsize=10, fontweight="bold", color=RED_ACCENT, ha="center", zorder=3)
    ax.text(0.60, 0.47, "Gate 1: Application Layer\n• assertDispatchable(order)\n• Verified RPh Reg No\n• Valid Rx date (<6 mo)\n• H1 Register Complete\n• Payment Verified\n\nGate 2: Database Layer\n• trg_assert_dispatchable\n• PostgreSQL Trigger\n• Aborts raw SQL bypass", fontsize=8.5, color=SLATE_DARK, va="top", zorder=3)

    draw_arrow(ax, 0.58, 0.71, 0.77, 0.71, "Passes Both Gates", color=RED_ACCENT, lw=2.2)

    # 4. PACKED
    draw_card(ax, 0.77, 0.66, 0.19, 0.23, "4. PACKED", [
        "Store staff picks stock",
        "Records GST Invoice No.",
        "Direct UPI confirmed",
        "Tamper seal applied",
    ], bg_color="#EEF2FF", border_color=PURPLE_ACCENT, badge="Store Staff", badge_color=PURPLE_ACCENT)

    draw_arrow(ax, 0.865, 0.66, 0.865, 0.57, lw=2.0)

    # 5. HANDED_OVER
    draw_card(ax, 0.77, 0.38, 0.19, 0.19, "5. HANDED_OVER", [
        "Local Fleet / Courier partner",
        "Tracking ID logged",
        "SMS dispatch notification",
    ], bg_color="white", border_color=SLATE_BORDER, badge="Fleet", badge_color=TEAL_PRIMARY)

    draw_arrow(ax, 0.865, 0.38, 0.865, 0.29, lw=2.0)

    # 6. DELIVERED
    draw_card(ax, 0.77, 0.10, 0.19, 0.19, "6. DELIVERED", [
        "Delivered at customer door",
        "Final SMS confirmation",
        "Refill tracker initialized",
    ], bg_color=GREEN_LIGHT, border_color=GREEN_ACCENT, badge="Complete", badge_color=GREEN_ACCENT)

    out_file = os.path.join(OUT_DIR, "order_lifecycle_flow.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor="white")
    plt.close()
    print(f"Generated {out_file}")


# ==============================================================================
# Diagram 5: Multi-Store Inventory Routing & Stock Split Flow
# ==============================================================================
def generate_store_routing_diagram():
    fig, ax = plt.subplots(figsize=(13.5, 7.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    ax.text(0.5, 0.965, "Multi-Store Haversine Inventory Routing & Stock Split Engine", fontsize=16, fontweight="bold", color=SLATE_DARK, ha="center")
    ax.text(0.5, 0.93, "Evaluates Pincode Proximity and Live Shelf Stock across 46 Stores in Kolkata & Howrah", fontsize=10, color=SLATE_BODY, ha="center")

    # Step 1: Customer Coordinates
    draw_card(ax, 0.04, 0.48, 0.22, 0.38, "1. Location Mapping", [
        "Customer Delivery Address",
        "e.g. Block BD-12, Sector 1, Salt Lake",
        "Pincode centroid lookup (700064)",
        "Lat: 22.5875, Lng: 88.4190",
        "Cart & Prescription Lines:",
        "  • Amlodipine 5mg (Qty: 1)",
        "  • Metformin 500mg (Qty: 2)",
    ], bg_color="#F0FDFA", border_color=TEAL_PRIMARY, badge="Input", badge_color=TEAL_PRIMARY)

    draw_arrow(ax, 0.26, 0.67, 0.32, 0.67, lw=2.0)

    # Step 2: Haversine Distance Engine
    draw_card(ax, 0.32, 0.48, 0.25, 0.38, "2. Haversine Distance Sort", [
        "Filters 10 Active Network Stores",
        "Calculates Great-Circle Distance:",
        "  d = 2R arcsin(sqrt(hav(dlat) + ...))",
        "Sorted Store Candidate List:",
        "  1. MedKart Salt Lake (0.24 km)",
        "  2. MedKart New Town (6.1 km)",
        "  3. MedKart Shyambazar (6.8 km)",
        "  4. Central Warehouse (8.2 km)",
    ], bg_color="#EEF2FF", border_color=PURPLE_ACCENT, badge="Routing Engine", badge_color=PURPLE_ACCENT)

    draw_arrow(ax, 0.57, 0.67, 0.63, 0.67, lw=2.0)

    # Step 3: Stock Coverage Evaluation
    draw_card(ax, 0.63, 0.48, 0.33, 0.38, "3. Live Shelf Stock Evaluation", [
        "Query store_stock table per candidate store",
        "Store 1 (Salt Lake):",
        "  Amlodipine 5mg: 45 in stock (Required: 1) -> OK",
        "  Metformin 500mg: 60 in stock (Required: 2) -> OK",
        "Coverage: 100% (2 / 2 lines)",
        "Assigned Store: store_saltlake",
        "Store Name: MedKart Salt Lake (Sec 1)",
    ], bg_color="#FEF3C7", border_color=AMBER_ACCENT, badge="Coverage", badge_color=AMBER_ACCENT)

    # Branching to outcome
    draw_arrow(ax, 0.795, 0.48, 0.795, 0.38, lw=1.8)

    draw_card(ax, 0.04, 0.08, 0.43, 0.25, "Outcome A: 100% Stock at Nearest Store (Single Store Dispatch)", [
        "Assigned immediately to closest full-coverage store (e.g. Salt Lake Sec 1).",
        "Store staff dashboard receives pick list with exact aisle/shelf inventory.",
        "Guarantees fastest same-day delivery without splitting transit costs.",
    ], bg_color=GREEN_LIGHT, border_color=GREEN_ACCENT, title_color=GREEN_ACCENT, badge="Optimal", badge_color=GREEN_ACCENT)

    draw_card(ax, 0.53, 0.08, 0.43, 0.25, "Outcome B: Stock Deficit / Multi-Store Split (Fail-Safe Fallback)", [
        "If nearest store lacks an item (e.g. Behala out of Telmisartan 40mg):",
        "Evaluates next-nearest store with maximum covered lines.",
        "Missing lines flagged with nearest secondary store (e.g. Gariahat) or Central Warehouse.",
        "Store staff can claim and pack unassigned orders dynamically without lockout.",
    ], bg_color=AMBER_LIGHT, border_color=AMBER_ACCENT, title_color=AMBER_ACCENT, badge="Split / Fallback", badge_color=AMBER_ACCENT)

    draw_arrow(ax, 0.795, 0.38, 0.25, 0.34, "Full Coverage", color=GREEN_ACCENT, lw=1.8)
    draw_arrow(ax, 0.795, 0.38, 0.75, 0.34, "Partial Stock", color=AMBER_ACCENT, lw=1.8)

    out_file = os.path.join(OUT_DIR, "store_routing_flow.png")
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor="white")
    plt.close()
    print(f"Generated {out_file}")


def main():
    print("🎨 Generating MedKart Pictorial Architecture Diagrams...")
    generate_architecture_diagram()
    generate_er_diagram()
    generate_ai_pipeline_diagram()
    generate_order_lifecycle_diagram()
    generate_store_routing_diagram()
    print("✅ All 5 high-resolution pictorial diagrams successfully generated in docs/diagrams/!")


if __name__ == "__main__":
    main()
