import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } from 'docx';

export async function downloadAsDocx(filename: string, content: string) {
  const lines = content.split('\n');
  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 150, after: 80 },
        })
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.replace(/^[-*]\s+/, '');
      // Handle bold subparts
      const parts = text.split(/(\*\*.*?\*\*)/g);
      const runs: TextRun[] = [];
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: 'Arial', size: 22 }));
        } else {
          runs.push(new TextRun({ text: part, font: 'Arial', size: 22 }));
        }
      }
      children.push(
        new Paragraph({
          children: runs,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    } else {
      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
      const runs: TextRun[] = [];
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: 'Arial', size: 22 }));
        } else {
          runs.push(new TextRun({ text: part, font: 'Arial', size: 22 }));
        }
      }
      children.push(
        new Paragraph({
          children: runs,
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 in
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printOrSavePdf(elementId: string, title: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            line-height: 1.5;
            color: #111827;
            padding: 30px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            font-size: 24px;
            text-align: center;
            text-transform: uppercase;
            border-bottom: 2px solid #111827;
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          h2 {
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #d1d5db;
            margin-top: 18px;
            margin-bottom: 8px;
            color: #1f2937;
          }
          h3 {
            font-size: 14px;
            margin-top: 12px;
            margin-bottom: 4px;
            color: #1f2937;
          }
          p, li {
            font-size: 13px;
            color: #374151;
            margin-bottom: 6px;
          }
          ul {
            padding-left: 20px;
            margin-top: 4px;
            margin-bottom: 8px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div id="print-root"></div>
      </body>
    </html>
  `);
  printWindow.document.close();

  // Safely assign title as DOM property to prevent script breakout
  printWindow.document.title = title;

  const container = printWindow.document.getElementById('print-root');
  if (container) {
    container.innerHTML = element.innerHTML;
  }

  // Trigger print after rendering
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
