
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface CertificateData {
  participantName: string;
  courseName: string;
  completionDate: string;
  score: number;
  certificateId: string;
  digitalSignature: string;
  courseType: string;
  expiresAt?: string;
}

export function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers: Buffer[] = [];
      
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Certificate border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
         .stroke('#2563eb');
      
      doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
         .stroke('#2563eb');

      // Title
      doc.fontSize(36)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text('CERTIFICATE OF COMPLETION', 0, 120, { align: 'center' });

      // Decorative line
      doc.moveTo(200, 180)
         .lineTo(doc.page.width - 200, 180)
         .stroke('#2563eb');

      // Main text
      doc.fontSize(18)
         .fillColor('#333')
         .font('Helvetica')
         .text('This is to certify that', 0, 220, { align: 'center' });

      // Participant name
      doc.fontSize(32)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text(data.participantName, 0, 260, { align: 'center' });

      // Course completion text
      doc.fontSize(18)
         .fillColor('#333')
         .font('Helvetica')
         .text('has successfully completed the training course', 0, 320, { align: 'center' });

      // Course name
      doc.fontSize(24)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text(data.courseName, 0, 360, { align: 'center' });

      // Score and completion details
      doc.fontSize(14)
         .fillColor('#666')
         .font('Helvetica')
         .text(`Score: ${data.score}%`, 0, 420, { align: 'center' })
         .text(`Completion Date: ${data.completionDate}`, 0, 440, { align: 'center' });

      if (data.courseType === 'recurring' && data.expiresAt) {
        doc.text(`Certificate Expires: ${data.expiresAt}`, 0, 460, { align: 'center' });
      }

      // Certificate ID and signature
      doc.fontSize(12)
         .fillColor('#999')
         .text(`Certificate ID: ${data.certificateId}`, 60, doc.page.height - 120)
         .text(`Digital Signature: ${data.digitalSignature}`, 60, doc.page.height - 100);

      // Date issued
      doc.text(`Issued on: ${new Date().toLocaleDateString()}`, doc.page.width - 200, doc.page.height - 120);

      // Company logo area (placeholder)
      doc.fontSize(16)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text('TrainTrack', doc.page.width - 150, 80);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
