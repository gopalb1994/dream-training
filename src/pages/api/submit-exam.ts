export const prerender = false;
import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Readable } from 'stream';

// --- HELPER TO FIX KEY FORMATTING ---
function getCleanKey(key: string | undefined) {
  if (!key) return undefined;
  // If the key was pasted with literal "\n" characters, replace them with real newlines
  return key.replace(/\\n/g, '\n');
}

function loadServiceAccount() {
  // Allow passing either the raw key/client email or the entire service account JSON (optionally base64-encoded)
  const rawServiceAccount = import.meta.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let privateKey = getCleanKey(import.meta.env.GOOGLE_PRIVATE_KEY);
  let clientEmail = import.meta.env.GOOGLE_CLIENT_EMAIL;

  if (rawServiceAccount) {
    try {
      const decoded = rawServiceAccount.includes('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      privateKey = getCleanKey(parsed.private_key) || privateKey;
      clientEmail = parsed.client_email || clientEmail;
    } catch (error) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT env value.', error);
      throw new Error('Server Configuration Error: Invalid Google Credentials');
    }
  }

  if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY') || !clientEmail) {
    console.error('CRITICAL ERROR: Google credentials missing or malformed.', {
      hasClientEmail: Boolean(clientEmail),
      keyPreview: privateKey ? privateKey.substring(0, 30) + '...' : 'undefined',
    });
    throw new Error('Server Configuration Error: Invalid Google Credentials');
  }

  return { clientEmail, privateKey };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { studentName, score, answers, date } = data;

    // 1. GENERATE PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText('DREAM HOME CARE LLC', { x: 50, y: height - 50, size: 20, font: fontBold });
    page.drawText('Competency Exam Certificate', { x: 50, y: height - 80, size: 16, font: font });
    page.drawText(`Name: ${studentName}`, { x: 50, y: height - 120, size: 14, font: font });
    page.drawText(`Date: ${date}`, { x: 50, y: height - 140, size: 14, font: font });
    page.drawText(`Score: ${score}% (PASS)`, { x: 50, y: height - 160, size: 14, font: fontBold, color: rgb(0, 0.5, 0) });
    
    // Write Answers
    page.drawText('Exam Answers:', { x: 50, y: height - 200, size: 12, font: fontBold });
    let yPos = height - 220;
    Object.entries(answers).forEach(([qIndex, answer]) => {
        if (yPos < 50) { page.addPage(); yPos = height - 50; }
        const qNum = parseInt(qIndex) + 1;
        const safeAnswer = String(answer).substring(0, 90).replace(/\n/g, ' ');
        page.drawText(`Q${qNum}: ${safeAnswer}`, { x: 50, y: yPos, size: 10, font: font });
        yPos -= 15;
    });

    const pdfBytes = await pdfDoc.save();

    // 2. AUTHENTICATE WITH GOOGLE
    const { clientEmail, privateKey } = loadServiceAccount();
    const folderId = import.meta.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      throw new Error("Server Configuration Error: Missing Google Drive folder id");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 3. UPLOAD
    const fileMetadata = {
      name: `${studentName} - Competency Exam.pdf`,
      parents: [folderId],
    };

    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(Buffer.from(pdfBytes)),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    return new Response(JSON.stringify({ success: true, fileId: file.data.id }), {
      status: 200,
    });

  } catch (error: any) {
    console.error('Upload Error Details:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown Server Error' }), {
      status: 500,
    });
  }
};

// End of src/pages/api/submit-exam.ts
