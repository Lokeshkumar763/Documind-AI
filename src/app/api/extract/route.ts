
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 50;

export async function POST(request: Request) {
  try {
    // Receive the uploaded PDF
    const formData = await request.formData();
    const file = formData.get("file");

    // Validate the uploaded file
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a PDF file." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be 10 MB or less." },
        { status: 400 }
      );
    }

    // Read the PDF as binary data
    const buffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(buffer);

    // Check the PDF file signature
    const signature = new TextDecoder().decode(
      pdfData.subarray(0, 5)
    );

    if (signature !== "%PDF-") {
      return NextResponse.json(
        { error: "Invalid PDF file." },
        { status: 400 }
      );
    }

    // Load the PDF document
    const pdf = await getDocumentProxy(pdfData);

    // Limit the number of pages
    if (pdf.numPages > MAX_PAGES) {
      return NextResponse.json(
        { error: "PDF must contain 50 pages or fewer." },
        { status: 400 }
      );
    }

    // Extract text from all pages
    const result = await extractText(pdf, {
      mergePages: true,
    });

    const extractedText = result.text;

    if (
      typeof extractedText !== "string" ||
      extractedText.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No readable text found. This may be a scanned PDF.",
        },
        { status: 422 }
      );
    }

    // Return the extracted document information
    return NextResponse.json({
      success: true,
      fileName: file.name,
      totalPages: result.totalPages,
      characterCount: extractedText.length,
      text: extractedText,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);

    return NextResponse.json(
      { error: "Unable to process this PDF. Please try another file." },
      { status: 500 }
    );
  }
}
