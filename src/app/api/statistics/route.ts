import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch global statistics
export async function GET() {
  try {
    // Get or create statistics record
    let stats = await db.statistics.findFirst();

    if (!stats) {
      // Calculate statistics
      const [totalSubjects, totalSystems, totalQuestions, totalFiles] = await Promise.all([
        db.subject.count(),
        db.system.count(),
        db.question.count(),
        db.file.count(),
      ]);

      stats = await db.statistics.create({
        data: {
          totalSubjects,
          totalSystems,
          totalQuestions,
          totalFiles,
        },
      });
    } else {
      // Update statistics to ensure accuracy
      const [totalSubjects, totalSystems, totalQuestions, totalFiles] = await Promise.all([
        db.subject.count(),
        db.system.count(),
        db.question.count(),
        db.file.count(),
      ]);

      stats = await db.statistics.update({
        where: { id: stats.id },
        data: {
          totalSubjects,
          totalSystems,
          totalQuestions,
          totalFiles,
        },
      });
    }

    // Get additional stats
    const [
      bookmarkedQuestions,
      totalRepeatCount,
      questionsWithFiles,
      recentQuestions,
      subjectBreakdown,
    ] = await Promise.all([
      // Bookmarked questions count
      db.question.count({
        where: { isBookmarked: true },
      }),
      // Total repeat count across all questions
      db.question.aggregate({
        _sum: { repeatCount: true },
      }),
      // Questions with files count
      db.question.count({
        where: {
          files: {
            some: {},
          },
        },
      }),
      // Questions created in last 7 days
      db.question.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Subject breakdown
      db.subject.findMany({
        select: {
          id: true,
          name: true,
          color: true,
          _count: {
            select: {
              systems: true,
              questions: true,
            },
          },
        },
      }),
    ]);

    // Get marks distribution
    const marksDistribution = await db.question.groupBy({
      by: ['marksSectionId'],
      _count: {
        id: true,
      },
    });

    // Get marks section details for the distribution
    const marksSectionIds = marksDistribution.map((m) => m.marksSectionId);
    const marksSections = await db.marksSection.findMany({
      where: {
        id: { in: marksSectionIds },
      },
      select: {
        id: true,
        marks: true,
        label: true,
      },
    });

    const marksBreakdown = marksDistribution.map((m) => {
      const section = marksSections.find((s) => s.id === m.marksSectionId);
      return {
        marks: section?.marks || 0,
        label: section?.label || '',
        count: m._count.id,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        bookmarkedQuestions,
        totalRepeatCount: totalRepeatCount._sum.repeatCount || 0,
        questionsWithFiles,
        recentQuestions,
        subjectBreakdown,
        marksBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

// PUT - Refresh statistics manually
export async function PUT() {
  try {
    const [totalSubjects, totalSystems, totalQuestions, totalFiles] = await Promise.all([
      db.subject.count(),
      db.system.count(),
      db.question.count(),
      db.file.count(),
    ]);

    const existingStats = await db.statistics.findFirst();

    let stats;
    if (existingStats) {
      stats = await db.statistics.update({
        where: { id: existingStats.id },
        data: {
          totalSubjects,
          totalSystems,
          totalQuestions,
          totalFiles,
        },
      });
    } else {
      stats = await db.statistics.create({
        data: {
          totalSubjects,
          totalSystems,
          totalQuestions,
          totalFiles,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Statistics refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh statistics' },
      { status: 500 }
    );
  }
}
