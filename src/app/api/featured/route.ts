import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Parse years from JSON string
function parseYears(yearsStr: string): string[] {
  try {
    return JSON.parse(yearsStr);
  } catch {
    return [];
  }
}

// GET - Fetch featured questions (top 30 by importance score)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const systemId = searchParams.get('systemId');
    const limit = parseInt(searchParams.get('limit') || '30');

    // Build filter
    const where: Record<string, unknown> = {};
    if (subjectId) where.subjectId = subjectId;
    if (systemId) where.systemId = systemId;

    // Get featured questions sorted by importance score
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
      orderBy: [
        { importanceScore: 'desc' },
        { repeatCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Parse years for each question
    const questionsWithParsedYears = questions.map((q) => ({
      ...q,
      years: parseYears(q.years),
    }));

    return NextResponse.json({
      success: true,
      data: questionsWithParsedYears,
    });
  } catch (error) {
    console.error('Error fetching featured questions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch featured questions' },
      { status: 500 }
    );
  }
}
