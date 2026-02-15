import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = '/home/z/my-project/download/question-files';

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Get file type from extension
function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    pdf: 'pdf',
    doc: 'docx',
    docx: 'docx',
    ppt: 'ppt',
    pptx: 'ppt',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'image',
  };
  return typeMap[ext] || 'other';
}

// GET - Fetch files (optionally filtered)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const questionId = searchParams.get('questionId');
    const folderId = searchParams.get('folderId');

    // If specific ID is requested
    if (id) {
      const file = await db.file.findUnique({
        where: { id },
        include: {
          question: {
            include: {
              subject: true,
              system: true,
            },
          },
          folder: true,
        },
      });

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: file,
      });
    }

    // Build filter
    const where: Record<string, unknown> = {};
    if (questionId) where.questionId = questionId;
    if (folderId !== null) {
      where.folderId = folderId === 'null' ? null : folderId;
    }

    const files = await db.file.findMany({
      where,
      include: {
        folder: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

// POST - Upload a new file
export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const questionId = formData.get('questionId') as string;
    const folderId = formData.get('folderId') as string | null;
    const description = formData.get('description') as string | null;
    const customName = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Check if question exists
    const question = await db.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    // Check folder if specified
    if (folderId) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        );
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const ext = originalName.split('.').pop() || 'bin';
    const uniqueFilename = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save to database
    const newFile = await db.file.create({
      data: {
        name: customName || originalName,
        type: getFileType(originalName),
        url: filePath,
        size: file.size,
        description: description?.trim() || null,
        questionId,
        folderId: folderId || null,
      },
      include: {
        folder: true,
      },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      data: newFile,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// PUT - Update file metadata
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, folderId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Check if file exists
    const existingFile = await db.file.findUnique({
      where: { id },
    });

    if (!existingFile) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Check folder if specified
    if (folderId !== undefined && folderId !== null) {
      const folder = await db.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        );
      }
    }

    const updatedFile = await db.file.update({
      where: { id },
      data: {
        name: name?.trim() ?? existingFile.name,
        description: description?.trim() ?? existingFile.description,
        folderId: folderId !== undefined ? folderId : existingFile.folderId,
      },
      include: {
        folder: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedFile,
      message: 'File updated successfully',
    });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update file' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Check if file exists
    const existingFile = await db.file.findUnique({
      where: { id },
    });

    if (!existingFile) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete file from disk
    try {
      if (existsSync(existingFile.url)) {
        await unlink(existingFile.url);
      }
    } catch (fsError) {
      console.error('Error deleting file from disk:', fsError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await db.file.delete({
      where: { id },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

// Helper function to update statistics
async function updateStatistics() {
  const [totalSubjects, totalSystems, totalQuestions, totalFiles] = await Promise.all([
    db.subject.count(),
    db.system.count(),
    db.question.count(),
    db.file.count(),
  ]);

  const existingStats = await db.statistics.findFirst();

  if (existingStats) {
    await db.statistics.update({
      where: { id: existingStats.id },
      data: {
        totalSubjects,
        totalSystems,
        totalQuestions,
        totalFiles,
      },
    });
  } else {
    await db.statistics.create({
      data: {
        totalSubjects,
        totalSystems,
        totalQuestions,
        totalFiles,
      },
    });
  }
}
