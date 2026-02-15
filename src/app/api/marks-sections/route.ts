import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch marks sections (optionally filtered by system)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get('systemId');
    const id = searchParams.get('id');

    // If specific ID is requested
    if (id) {
      const marksSection = await db.marksSection.findUnique({
        where: { id },
        include: {
          system: {
            include: {
              subject: true,
            },
          },
          questions: {
            include: {
              files: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
              _count: {
                select: { files: true },
              },
            },
            orderBy: [
              { importanceScore: 'desc' },
              { repeatCount: 'desc' },
            ],
          },
          _count: {
            select: { questions: true },
          },
        },
      });

      if (!marksSection) {
        return NextResponse.json(
          { success: false, error: 'Marks section not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: marksSection,
      });
    }

    // Build filter
    const where = systemId ? { systemId } : {};

    const marksSections = await db.marksSection.findMany({
      where,
      include: {
        system: {
          select: {
            id: true,
            name: true,
            subject: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { marks: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: marksSections,
    });
  } catch (error) {
    console.error('Error fetching marks sections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch marks sections' },
      { status: 500 }
    );
  }
}

// POST - Create a new marks section
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marks, label, systemId } = body;

    if (!marks || typeof marks !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Marks value is required' },
        { status: 400 }
      );
    }

    if (!systemId) {
      return NextResponse.json(
        { success: false, error: 'System ID is required' },
        { status: 400 }
      );
    }

    // Check if system exists
    const system = await db.system.findUnique({
      where: { id: systemId },
    });

    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      );
    }

    // Check if marks section with same marks exists in system
    const existingSection = await db.marksSection.findFirst({
      where: {
        marks,
        systemId,
      },
    });

    if (existingSection) {
      return NextResponse.json(
        { success: false, error: `Marks section with ${marks} marks already exists in this system` },
        { status: 400 }
      );
    }

    // Generate label if not provided
    const sectionLabel = label || `${marks} Markers`;

    const marksSection = await db.marksSection.create({
      data: {
        marks,
        label: sectionLabel,
        systemId,
      },
      include: {
        system: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: marksSection,
      message: 'Marks section created successfully',
    });
  } catch (error) {
    console.error('Error creating marks section:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create marks section' },
      { status: 500 }
    );
  }
}

// PUT - Update a marks section
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, marks, label, systemId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Marks section ID is required' },
        { status: 400 }
      );
    }

    // Check if marks section exists
    const existingSection = await db.marksSection.findUnique({
      where: { id },
    });

    if (!existingSection) {
      return NextResponse.json(
        { success: false, error: 'Marks section not found' },
        { status: 404 }
      );
    }

    // If marks is being changed, check for conflicts
    const targetSystemId = systemId ?? existingSection.systemId;
    if (marks && marks !== existingSection.marks) {
      const marksConflict = await db.marksSection.findFirst({
        where: {
          marks,
          systemId: targetSystemId,
        },
      });
      if (marksConflict && marksConflict.id !== id) {
        return NextResponse.json(
          { success: false, error: `Marks section with ${marks} marks already exists in this system` },
          { status: 400 }
        );
      }
    }

    const marksSection = await db.marksSection.update({
      where: { id },
      data: {
        marks: marks ?? existingSection.marks,
        label: label ?? existingSection.label,
        systemId: targetSystemId,
      },
      include: {
        system: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: marksSection,
      message: 'Marks section updated successfully',
    });
  } catch (error) {
    console.error('Error updating marks section:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update marks section' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a marks section
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Marks section ID is required' },
        { status: 400 }
      );
    }

    // Check if marks section exists
    const existingSection = await db.marksSection.findUnique({
      where: { id },
    });

    if (!existingSection) {
      return NextResponse.json(
        { success: false, error: 'Marks section not found' },
        { status: 404 }
      );
    }

    // Delete marks section (cascade will handle related records)
    await db.marksSection.delete({
      where: { id },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      message: 'Marks section deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting marks section:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete marks section' },
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
