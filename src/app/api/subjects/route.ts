import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all subjects with statistics
export async function GET() {
  try {
    const subjects = await db.subject.findMany({
      include: {
        _count: {
          select: {
            systems: true,
            questions: true,
          },
        },
        systems: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Get featured questions for each subject
    const subjectsWithFeatured = await Promise.all(
      subjects.map(async (subject) => {
        const featuredQuestions = await db.question.findMany({
          where: {
            subjectId: subject.id,
          },
          orderBy: [
            { importanceScore: 'desc' },
            { repeatCount: 'desc' },
          ],
          take: 5, // Top 5 for preview
          select: {
            id: true,
            title: true,
            importanceScore: true,
            repeatCount: true,
            years: true,
          },
        });

        return {
          ...subject,
          featuredQuestions,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: subjectsWithFeatured,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subjects' },
      { status: 500 }
    );
  }
}

// POST - Create a new subject
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Subject name is required' },
        { status: 400 }
      );
    }

    // Check if subject already exists
    const existingSubject = await db.subject.findUnique({
      where: { name: name.trim() },
    });

    if (existingSubject) {
      return NextResponse.json(
        { success: false, error: 'Subject with this name already exists' },
        { status: 400 }
      );
    }

    const subject = await db.subject.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#3b82f6',
        icon: icon || null,
      },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      data: subject,
      message: 'Subject created successfully',
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subject' },
      { status: 500 }
    );
  }
}

// PUT - Update a subject
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, color, icon } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Subject ID is required' },
        { status: 400 }
      );
    }

    // Check if subject exists
    const existingSubject = await db.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return NextResponse.json(
        { success: false, error: 'Subject not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for conflicts
    if (name && name !== existingSubject.name) {
      const nameConflict = await db.subject.findUnique({
        where: { name: name.trim() },
      });
      if (nameConflict) {
        return NextResponse.json(
          { success: false, error: 'Subject with this name already exists' },
          { status: 400 }
        );
      }
    }

    const subject = await db.subject.update({
      where: { id },
      data: {
        name: name?.trim() ?? existingSubject.name,
        description: description?.trim() ?? existingSubject.description,
        color: color ?? existingSubject.color,
        icon: icon ?? existingSubject.icon,
      },
    });

    return NextResponse.json({
      success: true,
      data: subject,
      message: 'Subject updated successfully',
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subject' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a subject
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Subject ID is required' },
        { status: 400 }
      );
    }

    // Check if subject exists
    const existingSubject = await db.subject.findUnique({
      where: { id },
    });

    if (!existingSubject) {
      return NextResponse.json(
        { success: false, error: 'Subject not found' },
        { status: 404 }
      );
    }

    // Delete subject (cascade will handle related records)
    await db.subject.delete({
      where: { id },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      message: 'Subject deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting subject:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete subject' },
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

  // Check if statistics record exists
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
