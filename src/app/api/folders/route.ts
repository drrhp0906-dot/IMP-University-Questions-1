import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch folders (optionally filtered by question)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const questionId = searchParams.get('questionId');

    // If specific ID is requested
    if (id) {
      const folder = await db.folder.findUnique({
        where: { id },
        include: {
          question: {
            select: {
              id: true,
              title: true,
            },
          },
          files: true,
          _count: {
            select: { files: true },
          },
        },
      });

      if (!folder) {
        return NextResponse.json(
          { success: false, error: 'Folder not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: folder,
      });
    }

    // Build filter
    const where = questionId ? { questionId } : {};

    const folders = await db.folder.findMany({
      where,
      include: {
        _count: {
          select: { files: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: folders,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

// POST - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, questionId } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
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

    // Check if folder with same name exists in question
    const existingFolder = await db.folder.findFirst({
      where: {
        name: name.trim(),
        questionId,
      },
    });

    if (existingFolder) {
      return NextResponse.json(
        { success: false, error: 'Folder with this name already exists' },
        { status: 400 }
      );
    }

    const folder = await db.folder.create({
      data: {
        name: name.trim(),
        questionId,
      },
    });

    return NextResponse.json({
      success: true,
      data: folder,
      message: 'Folder created successfully',
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

// PUT - Update a folder
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    // Check if folder exists
    const existingFolder = await db.folder.findUnique({
      where: { id },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for conflicts
    if (name && name !== existingFolder.name) {
      const nameConflict = await db.folder.findFirst({
        where: {
          name: name.trim(),
          questionId: existingFolder.questionId,
        },
      });
      if (nameConflict) {
        return NextResponse.json(
          { success: false, error: 'Folder with this name already exists' },
          { status: 400 }
        );
      }
    }

    const folder = await db.folder.update({
      where: { id },
      data: {
        name: name?.trim() ?? existingFolder.name,
      },
    });

    return NextResponse.json({
      success: true,
      data: folder,
      message: 'Folder updated successfully',
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a folder
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    // Check if folder exists
    const existingFolder = await db.folder.findUnique({
      where: { id },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Set folderId to null for all files in this folder
    await db.file.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    // Delete folder
    await db.folder.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
