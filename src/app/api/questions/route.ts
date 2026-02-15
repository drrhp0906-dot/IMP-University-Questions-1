import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Calculate importance score
function calculateImportanceScore(
  repeatCount: number,
  years: string[],
  globalImportance: number
): number {
  const currentYear = new Date().getFullYear();
  
  // Recency score: years in past 5 years / 5 (max 1.0)
  const recentYears = years.filter(year => {
    const yearNum = parseInt(year);
    return !isNaN(yearNum) && (currentYear - yearNum) <= 5;
  });
  const recencyScore = Math.min(recentYears.length / 5, 1.0);
  
  // Repeat count score: normalized (max 1.0 at 10 repeats)
  const repeatScore = Math.min(repeatCount / 10, 1.0);
  
  // Global importance: 0-1 scale
  const globalScore = Math.min(Math.max(globalImportance, 0), 1);
  
  // Weighted calculation
  const importanceScore = (repeatScore * 0.4) + (recencyScore * 0.4) + (globalScore * 0.2);
  
  return Math.round(importanceScore * 100) / 100; // Round to 2 decimal places
}

// Parse years from JSON string
function parseYears(yearsStr: string): string[] {
  try {
    return JSON.parse(yearsStr);
  } catch {
    return [];
  }
}

// GET - Fetch questions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const subjectId = searchParams.get('subjectId');
    const systemId = searchParams.get('systemId');
    const marksSectionId = searchParams.get('marksSectionId');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const orderBy = searchParams.get('orderBy') || 'importanceScore';
    const orderDir = searchParams.get('orderDir') || 'desc';

    // If specific ID is requested
    if (id) {
      const question = await db.question.findUnique({
        where: { id },
        include: {
          subject: true,
          system: true,
          marksSection: true,
          files: {
            include: {
              folder: true,
            },
          },
          folders: {
            include: {
              _count: {
                select: { files: true },
              },
            },
          },
        },
      });

      if (!question) {
        return NextResponse.json(
          { success: false, error: 'Question not found' },
          { status: 404 }
        );
      }

      // Parse years for response
      const questionWithParsedYears = {
        ...question,
        years: parseYears(question.years),
      };

      return NextResponse.json({
        success: true,
        data: questionWithParsedYears,
      });
    }

    // Build filter
    const where: Record<string, unknown> = {};
    if (subjectId) where.subjectId = subjectId;
    if (systemId) where.systemId = systemId;
    if (marksSectionId) where.marksSectionId = marksSectionId;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Build order
    const order: Record<string, unknown>[] = [];
    if (orderBy && ['importanceScore', 'repeatCount', 'createdAt', 'title'].includes(orderBy)) {
      order.push({ [orderBy]: orderDir === 'asc' ? 'asc' : 'desc' });
    }
    order.push({ createdAt: 'desc' });

    const questions = await db.question.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        system: {
          select: {
            id: true,
            name: true,
          },
        },
        marksSection: {
          select: {
            id: true,
            marks: true,
            label: true,
          },
        },
        _count: {
          select: { files: true },
        },
      },
      orderBy: order as Record<string, unknown>[],
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    // Parse years for each question
    const questionsWithParsedYears = questions.map(q => ({
      ...q,
      years: parseYears(q.years),
    }));

    return NextResponse.json({
      success: true,
      data: questionsWithParsedYears,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

// POST - Create a new question
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      years = [],
      globalImportance = 0.5,
      notes,
      isBookmarked = false,
      subjectId,
      systemId,
      marksSectionId,
    } = body;

    // Validation
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Question title is required' },
        { status: 400 }
      );
    }

    if (!subjectId || !systemId || !marksSectionId) {
      return NextResponse.json(
        { success: false, error: 'Subject, System, and Marks Section are required' },
        { status: 400 }
      );
    }

    // Verify relations exist
    const [subject, system, marksSection] = await Promise.all([
      db.subject.findUnique({ where: { id: subjectId } }),
      db.system.findUnique({ where: { id: systemId } }),
      db.marksSection.findUnique({ where: { id: marksSectionId } }),
    ]);

    if (!subject) {
      return NextResponse.json(
        { success: false, error: 'Subject not found' },
        { status: 404 }
      );
    }
    if (!system) {
      return NextResponse.json(
        { success: false, error: 'System not found' },
        { status: 404 }
      );
    }
    if (!marksSection) {
      return NextResponse.json(
        { success: false, error: 'Marks section not found' },
        { status: 404 }
      );
    }

    // Calculate repeat count and importance score
    const repeatCount = years.length;
    const importanceScore = calculateImportanceScore(repeatCount, years, globalImportance);

    const question = await db.question.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        repeatCount,
        years: JSON.stringify(years),
        importanceScore,
        globalImportance,
        notes: notes?.trim() || null,
        isBookmarked,
        subjectId,
        systemId,
        marksSectionId,
      },
      include: {
        subject: true,
        system: true,
        marksSection: true,
      },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      data: {
        ...question,
        years: parseYears(question.years),
      },
      message: 'Question created successfully',
    });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

// PUT - Update a question
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      years,
      globalImportance,
      notes,
      isBookmarked,
      subjectId,
      systemId,
      marksSectionId,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Check if question exists
    const existingQuestion = await db.question.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    // Verify relations if being changed
    if (subjectId || systemId || marksSectionId) {
      const [subject, system, marksSection] = await Promise.all([
        subjectId ? db.subject.findUnique({ where: { id: subjectId } }) : null,
        systemId ? db.system.findUnique({ where: { id: systemId } }) : null,
        marksSectionId ? db.marksSection.findUnique({ where: { id: marksSectionId } }) : null,
      ]);

      if (subjectId && !subject) {
        return NextResponse.json(
          { success: false, error: 'Subject not found' },
          { status: 404 }
        );
      }
      if (systemId && !system) {
        return NextResponse.json(
          { success: false, error: 'System not found' },
          { status: 404 }
        );
      }
      if (marksSectionId && !marksSection) {
        return NextResponse.json(
          { success: false, error: 'Marks section not found' },
          { status: 404 }
        );
      }
    }

    // Calculate new values
    const updatedYears = years !== undefined ? years : parseYears(existingQuestion.years);
    const updatedGlobalImportance = globalImportance ?? existingQuestion.globalImportance;
    const repeatCount = updatedYears.length;
    const importanceScore = calculateImportanceScore(repeatCount, updatedYears, updatedGlobalImportance);

    const question = await db.question.update({
      where: { id },
      data: {
        title: title?.trim() ?? existingQuestion.title,
        description: description?.trim() ?? existingQuestion.description,
        repeatCount,
        years: JSON.stringify(updatedYears),
        importanceScore,
        globalImportance: updatedGlobalImportance,
        notes: notes?.trim() ?? existingQuestion.notes,
        isBookmarked: isBookmarked ?? existingQuestion.isBookmarked,
        subjectId: subjectId ?? existingQuestion.subjectId,
        systemId: systemId ?? existingQuestion.systemId,
        marksSectionId: marksSectionId ?? existingQuestion.marksSectionId,
      },
      include: {
        subject: true,
        system: true,
        marksSection: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...question,
        years: parseYears(question.years),
      },
      message: 'Question updated successfully',
    });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a question
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Check if question exists
    const existingQuestion = await db.question.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    // Delete question (cascade will handle related records)
    await db.question.delete({
      where: { id },
    });

    // Update statistics
    await updateStatistics();

    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete question' },
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
