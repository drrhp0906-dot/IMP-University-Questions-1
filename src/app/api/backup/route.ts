import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const BACKUP_DIR = '/home/z/my-project/download';

// Parse years from JSON string
function parseYears(yearsStr: string): string[] {
  try {
    return JSON.parse(yearsStr);
  } catch {
    return [];
  }
}

// GET - Export all data as JSON
export async function GET() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `question-bank-backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Fetch all data
    const [subjects, systems, marksSections, questions, files, folders, statistics] = await Promise.all([
      db.subject.findMany(),
      db.system.findMany(),
      db.marksSection.findMany(),
      db.question.findMany(),
      db.file.findMany(),
      db.folder.findMany(),
      db.statistics.findFirst(),
    ]);

    // Transform questions to parse years
    const questionsWithParsedYears = questions.map((q) => ({
      ...q,
      years: parseYears(q.years),
    }));

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      statistics,
      counts: {
        subjects: subjects.length,
        systems: systems.length,
        marksSections: marksSections.length,
        questions: questions.length,
        files: files.length,
        folders: folders.length,
      },
      data: {
        subjects,
        systems,
        marksSections,
        questions: questionsWithParsedYears,
        files,
        folders,
      },
    };

    // Write backup file to server
    await writeFile(filepath, JSON.stringify(backupData, null, 2));

    // Return the full backup data for download
    return NextResponse.json({
      success: true,
      data: backupData,
      file: {
        filename,
        filepath,
      },
      message: 'Backup created successfully',
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}

// POST - Import data from JSON backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mode = 'merge' } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No backup data provided' },
        { status: 400 }
      );
    }

    // If mode is 'replace', clear existing data first
    if (mode === 'replace') {
      await db.file.deleteMany();
      await db.folder.deleteMany();
      await db.question.deleteMany();
      await db.marksSection.deleteMany();
      await db.system.deleteMany();
      await db.subject.deleteMany();
    }

    const results = {
      subjects: 0,
      systems: 0,
      marksSections: 0,
      questions: 0,
      files: 0,
      folders: 0,
      errors: [] as string[],
    };

    // Import subjects
    if (data.subjects && Array.isArray(data.subjects)) {
      for (const subject of data.subjects) {
        try {
          if (mode === 'merge') {
            const existing = await db.subject.findUnique({
              where: { id: subject.id },
            });
            if (existing) {
              await db.subject.update({
                where: { id: subject.id },
                data: {
                  name: subject.name,
                  description: subject.description,
                  color: subject.color,
                  icon: subject.icon,
                },
              });
            } else {
              await db.subject.create({
                data: {
                  id: subject.id,
                  name: subject.name,
                  description: subject.description,
                  color: subject.color,
                  icon: subject.icon,
                  createdAt: new Date(subject.createdAt),
                  updatedAt: new Date(subject.updatedAt),
                },
              });
            }
          } else {
            await db.subject.create({
              data: {
                id: subject.id,
                name: subject.name,
                description: subject.description,
                color: subject.color,
                icon: subject.icon,
                createdAt: new Date(subject.createdAt),
                updatedAt: new Date(subject.updatedAt),
              },
            });
          }
          results.subjects++;
        } catch (error) {
          results.errors.push(`Subject: ${subject.name} - ${error}`);
        }
      }
    }

    // Import systems
    if (data.systems && Array.isArray(data.systems)) {
      for (const system of data.systems) {
        try {
          if (mode === 'merge') {
            const existing = await db.system.findUnique({
              where: { id: system.id },
            });
            if (existing) {
              await db.system.update({
                where: { id: system.id },
                data: {
                  name: system.name,
                  description: system.description,
                  order: system.order,
                  subjectId: system.subjectId,
                },
              });
            } else {
              await db.system.create({
                data: {
                  id: system.id,
                  name: system.name,
                  description: system.description,
                  order: system.order,
                  subjectId: system.subjectId,
                  createdAt: new Date(system.createdAt),
                  updatedAt: new Date(system.updatedAt),
                },
              });
            }
          } else {
            await db.system.create({
              data: {
                id: system.id,
                name: system.name,
                description: system.description,
                order: system.order,
                subjectId: system.subjectId,
                createdAt: new Date(system.createdAt),
                updatedAt: new Date(system.updatedAt),
              },
            });
          }
          results.systems++;
        } catch (error) {
          results.errors.push(`System: ${system.name} - ${error}`);
        }
      }
    }

    // Import marks sections
    if (data.marksSections && Array.isArray(data.marksSections)) {
      for (const section of data.marksSections) {
        try {
          if (mode === 'merge') {
            const existing = await db.marksSection.findUnique({
              where: { id: section.id },
            });
            if (existing) {
              await db.marksSection.update({
                where: { id: section.id },
                data: {
                  marks: section.marks,
                  label: section.label,
                  systemId: section.systemId,
                },
              });
            } else {
              await db.marksSection.create({
                data: {
                  id: section.id,
                  marks: section.marks,
                  label: section.label,
                  systemId: section.systemId,
                  createdAt: new Date(section.createdAt),
                  updatedAt: new Date(section.updatedAt),
                },
              });
            }
          } else {
            await db.marksSection.create({
              data: {
                id: section.id,
                marks: section.marks,
                label: section.label,
                systemId: section.systemId,
                createdAt: new Date(section.createdAt),
                updatedAt: new Date(section.updatedAt),
              },
            });
          }
          results.marksSections++;
        } catch (error) {
          results.errors.push(`MarksSection: ${section.label} - ${error}`);
        }
      }
    }

    // Import questions
    if (data.questions && Array.isArray(data.questions)) {
      for (const question of data.questions) {
        try {
          const yearsStr = Array.isArray(question.years)
            ? JSON.stringify(question.years)
            : question.years;

          if (mode === 'merge') {
            const existing = await db.question.findUnique({
              where: { id: question.id },
            });
            if (existing) {
              await db.question.update({
                where: { id: question.id },
                data: {
                  title: question.title,
                  description: question.description,
                  repeatCount: question.repeatCount,
                  years: yearsStr,
                  importanceScore: question.importanceScore,
                  globalImportance: question.globalImportance,
                  notes: question.notes,
                  isBookmarked: question.isBookmarked,
                  subjectId: question.subjectId,
                  systemId: question.systemId,
                  marksSectionId: question.marksSectionId,
                },
              });
            } else {
              await db.question.create({
                data: {
                  id: question.id,
                  title: question.title,
                  description: question.description,
                  repeatCount: question.repeatCount,
                  years: yearsStr,
                  importanceScore: question.importanceScore,
                  globalImportance: question.globalImportance,
                  notes: question.notes,
                  isBookmarked: question.isBookmarked,
                  subjectId: question.subjectId,
                  systemId: question.systemId,
                  marksSectionId: question.marksSectionId,
                  createdAt: new Date(question.createdAt),
                  updatedAt: new Date(question.updatedAt),
                },
              });
            }
          } else {
            await db.question.create({
              data: {
                id: question.id,
                title: question.title,
                description: question.description,
                repeatCount: question.repeatCount,
                years: yearsStr,
                importanceScore: question.importanceScore,
                globalImportance: question.globalImportance,
                notes: question.notes,
                isBookmarked: question.isBookmarked,
                subjectId: question.subjectId,
                systemId: question.systemId,
                marksSectionId: question.marksSectionId,
                createdAt: new Date(question.createdAt),
                updatedAt: new Date(question.updatedAt),
              },
            });
          }
          results.questions++;
        } catch (error) {
          results.errors.push(`Question: ${question.title} - ${error}`);
        }
      }
    }

    // Import folders
    if (data.folders && Array.isArray(data.folders)) {
      for (const folder of data.folders) {
        try {
          if (mode === 'merge') {
            const existing = await db.folder.findUnique({
              where: { id: folder.id },
            });
            if (existing) {
              await db.folder.update({
                where: { id: folder.id },
                data: {
                  name: folder.name,
                  questionId: folder.questionId,
                },
              });
            } else {
              await db.folder.create({
                data: {
                  id: folder.id,
                  name: folder.name,
                  questionId: folder.questionId,
                  createdAt: new Date(folder.createdAt),
                  updatedAt: new Date(folder.updatedAt),
                },
              });
            }
          } else {
            await db.folder.create({
              data: {
                id: folder.id,
                name: folder.name,
                questionId: folder.questionId,
                createdAt: new Date(folder.createdAt),
                updatedAt: new Date(folder.updatedAt),
              },
            });
          }
          results.folders++;
        } catch (error) {
          results.errors.push(`Folder: ${folder.name} - ${error}`);
        }
      }
    }

    // Import files (metadata only - files themselves are not imported)
    if (data.files && Array.isArray(data.files)) {
      for (const file of data.files) {
        try {
          if (mode === 'merge') {
            const existing = await db.file.findUnique({
              where: { id: file.id },
            });
            if (existing) {
              await db.file.update({
                where: { id: file.id },
                data: {
                  name: file.name,
                  type: file.type,
                  url: file.url,
                  size: file.size,
                  description: file.description,
                  questionId: file.questionId,
                  folderId: file.folderId,
                },
              });
            } else {
              await db.file.create({
                data: {
                  id: file.id,
                  name: file.name,
                  type: file.type,
                  url: file.url,
                  size: file.size,
                  description: file.description,
                  questionId: file.questionId,
                  folderId: file.folderId,
                  createdAt: new Date(file.createdAt),
                  updatedAt: new Date(file.updatedAt),
                },
              });
            }
          } else {
            await db.file.create({
              data: {
                id: file.id,
                name: file.name,
                type: file.type,
                url: file.url,
                size: file.size,
                description: file.description,
                questionId: file.questionId,
                folderId: file.folderId,
                createdAt: new Date(file.createdAt),
                updatedAt: new Date(file.updatedAt),
              },
            });
          }
          results.files++;
        } catch (error) {
          results.errors.push(`File: ${file.name} - ${error}`);
        }
      }
    }

    // Update statistics
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
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Backup imported successfully',
    });
  } catch (error) {
    console.error('Error importing backup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to import backup' },
      { status: 500 }
    );
  }
}
