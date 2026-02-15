import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch systems (optionally filtered by subject)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const id = searchParams.get('id');

    // If specific ID is requested
    if (id) {
      const system = await db.system.findUnique({
        where: { id },
        include: {
          subject: true,
          marksSections: {
            orderBy: { marks: 'desc' },
            include: {
              _count: {
                select: { questions: true },
              },
            },
          },
          _count: {
            select: { questions: true, marksSections: true },
          },
        },
      });

      if (!system) {
        return NextResponse.json(
          { success: false, error: 'System not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: system,
      });
    }

    // Build filter
    const where = subjectId ? { subjectId } : {};

    const systems = await db.system.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            questions: true,
            marksSections: true,
          },
        },
        marksSections: {
          select: {
            id: true,
            marks: true,
            label: true,
            _count: {
              select: { questions: true },
            },
          },
          orderBy: { marks: 'desc' },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: systems,
    });
  } catch (error) {
    console.error('Error fetching systems:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch systems' },
      { status: 500 }
    );
  }
}

// POST - Create a new system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, order, subjectId } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'System name is required' },
        { status: 400 }
      );
    }

    if (!subjectId) {
      return NextResponse.json(
        { success: false, error: 'Subject ID is required' },
        { status: 400 }
      );
    }

    // Check if subject exists
    const subject = await db.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      return NextResponse.json(
        { success: false, error: 'Subject not found' },
        { status: 404 }
      );
    }

    // Check if system with same name exists in subject
    const existingSystem = await db.system.findFirst({
      where: {
        name: name.trim(),
        subjectId,
      },
    });

    if (existingSystem) {
      return NextResponse.json(
        { success: false, error: 'System with this name already exists in this subject' },
        { status: 400 }
      );
    }

    // Get max order for this subject
    const maxOrder = await db.system.aggregate({
      where: { subjectId },
      _max: { order: true },
    });

    const systemOrder = order ?? (maxOrder._max.order ?? -1) + 1;

    const system = await db.system.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        order: systemOrder,
        subjectId,
      },
      include: {
        subject: true,
      },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      data: system,
      message: 'System created successfully',
    });
  } catch (error) {
    console.error('Error creating system:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create system' },
      { status: 500 }
    );
  }
}

// PUT - Update a system
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, order, subjectId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'System ID is required' },
        { status: 400 }
      );
    }

    // Check if system exists
    const existingSystem = await db.system.findUnique({
      where: { id },
    });

    if (!existingSystem) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for conflicts
    const targetSubjectId = subjectId ?? existingSystem.subjectId;
    if (name && name !== existingSystem.name) {
      const nameConflict = await db.system.findFirst({
        where: {
          name: name.trim(),
          subjectId: targetSubjectId,
        },
      });
      if (nameConflict && nameConflict.id !== id) {
        return NextResponse.json(
          { success: false, error: 'System with this name already exists in this subject' },
          { status: 400 }
        );
      }
    }

    const system = await db.system.update({
      where: { id },
      data: {
        name: name?.trim() ?? existingSystem.name,
        description: description?.trim() ?? existingSystem.description,
        order: order ?? existingSystem.order,
        subjectId: targetSubjectId,
      },
      include: {
        subject: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: system,
      message: 'System updated successfully',
    });
  } catch (error) {
    console.error('Error updating system:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update system' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a system
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'System ID is required' },
        { status: 400 }
      );
    }

    // Check if system exists
    const existingSystem = await db.system.findUnique({
      where: { id },
    });

    if (!existingSystem) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      );
    }

    // Delete system (cascade will handle related records)
    await db.system.delete({
      where: { id },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      message: 'System deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting system:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete system' },
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
