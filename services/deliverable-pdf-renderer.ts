import PDFDocument from "pdfkit";

type RenderedSection = {
  title: string;
  content: string;
};

type RenderDeliverablePdfParams = {
  title: string;
  engagementTitle: string;
  clientName?: string;
  generatedAt: string;
  templateName: string;
  sections: RenderedSection[];
  exportMetadata: string;
};

function paragraphLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0));
}

function writeSection(doc: PDFKit.PDFDocument, section: RenderedSection): void {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(14).text(section.title);
  doc.moveDown(0.2);

  const lines = paragraphLines(section.content);
  if (lines.length === 0) {
    doc.font("Helvetica").fontSize(11).fillColor("#334155").text("No items recorded");
  } else {
    doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
    for (const line of lines) {
      doc.text(line);
    }
  }
}

export async function renderDeliverablePdf(params: RenderDeliverablePdfParams): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 54,
    compress: false,
    info: {
      Title: params.title,
      Author: "FullSendOS",
      Subject: "Client-ready deliverable export",
      Keywords: "deliverable,export,pdf",
      Creator: "FullSendOS",
      Producer: "FullSendOS",
    },
  });

  const chunks: Buffer[] = [];

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor("#0f172a");
    doc.font("Helvetica-Bold").fontSize(22).text(params.title, { align: "left" });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11).fillColor("#334155").text(`Engagement: ${params.engagementTitle}`);
    doc.text(`Client: ${params.clientName || "Not available"}`);
    doc.text(`Template: ${params.templateName}`);
    doc.text(`Generated: ${new Date(params.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);

    doc.moveDown(0.8);
    doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();

    for (const section of params.sections) {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }
      writeSection(doc, section);
    }

    if (doc.y > doc.page.height - 120) {
      doc.addPage();
    }

    doc.moveDown(0.8);
    doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Export Metadata");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    for (const line of paragraphLines(params.exportMetadata)) {
      doc.text(line);
    }

    doc.end();
  });
}
