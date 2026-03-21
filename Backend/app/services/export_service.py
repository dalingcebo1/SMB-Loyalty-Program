"""Export service for generating CSV and PDF reports."""

import csv
import io
from datetime import datetime
from typing import Any

from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def generate_csv(
    rows: list[dict],
    columns: list[tuple[str, str]],
    filename: str,
) -> StreamingResponse:
    """Generate a CSV StreamingResponse with UTF-8 BOM for Excel compatibility.

    Args:
        rows: List of dicts, each representing a row.
        columns: List of (key, header_label) tuples defining column order and headers.
        filename: The download filename.
    """
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Excel

    writer = csv.writer(output, delimiter=",")
    writer.writerow([header for _, header in columns])

    for row in rows:
        writer.writerow([
            str(row.get(key) if row.get(key) is not None else "")
            for key, _ in columns
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def generate_pdf_report(
    title: str,
    subtitle: str,
    columns: list[tuple[str, str]],
    rows: list[dict],
    totals: dict[str, Any] | None,
    filename: str,
    business_name: str = "",
) -> StreamingResponse:
    """Generate a PDF table report.

    Args:
        title: Report title.
        subtitle: Subtitle (e.g. date range).
        columns: List of (key, header_label) tuples.
        rows: List of dicts for table data.
        totals: Optional totals dict displayed as a summary row.
        filename: The download filename.
        business_name: Optional business name shown in header.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15 * mm, rightMargin=15 * mm)
    styles = getSampleStyleSheet()
    elements: list[Any] = []

    if business_name:
        elements.append(Paragraph(business_name, styles["Title"]))
        elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph(title, styles["Heading1"]))
    elements.append(Paragraph(subtitle, styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))

    # Build table data
    header_labels = [header for _, header in columns]
    table_data = [header_labels]

    for row in rows:
        table_data.append([
            str(row.get(key) if row.get(key) is not None else "")
            for key, _ in columns
        ])

    if totals:
        totals_row = [str(totals.get(key, "")) for key, _ in columns]
        table_data.append(totals_row)

    table = Table(table_data, repeatRows=1)

    style_commands: list[Any] = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]

    if totals:
        last_row = len(table_data) - 1
        style_commands.append(("BACKGROUND", (0, last_row), (-1, last_row), colors.HexColor("#d5e8d4")))
        style_commands.append(("FONTNAME", (0, last_row), (-1, last_row), "Helvetica-Bold"))

    table.setStyle(TableStyle(style_commands))
    elements.append(table)

    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
