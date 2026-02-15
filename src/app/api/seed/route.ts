import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Medical systems data for each subject
const MEDICAL_SYSTEMS = {
  Pathology: [
    { name: 'General Pathology', description: 'Cell Injury, Inflammation, Healing, Neoplasia', order: 1 },
    { name: 'Hematology', description: 'Blood disorders and hematopoietic system', order: 2 },
    { name: 'Cardiovascular System', description: 'Heart and blood vessels pathology', order: 3 },
    { name: 'Respiratory System', description: 'Lungs and respiratory tract pathology', order: 4 },
    { name: 'Gastrointestinal System', description: 'GI tract pathology', order: 5 },
    { name: 'Hepatobiliary System', description: 'Liver, gallbladder and biliary tract', order: 6 },
    { name: 'Urinary System', description: 'Kidney and urinary tract pathology', order: 7 },
    { name: 'Reproductive System', description: 'Male and female reproductive pathology', order: 8 },
    { name: 'Endocrine System', description: 'Endocrine glands pathology', order: 9 },
    { name: 'Nervous System', description: 'CNS and PNS pathology', order: 10 },
    { name: 'Musculoskeletal System', description: 'Bones, joints and soft tissue pathology', order: 11 },
    { name: 'Skin & Soft Tissue', description: 'Dermatological pathology', order: 12 },
  ],
  Pharmacology: [
    { name: 'General Pharmacology', description: 'Pharmacokinetics, pharmacodynamics, drug interactions', order: 1 },
    { name: 'Autonomic Nervous System', description: 'Cholinergic and adrenergic drugs', order: 2 },
    { name: 'Cardiovascular Pharmacology', description: 'Drugs for cardiovascular diseases', order: 3 },
    { name: 'Respiratory Pharmacology', description: 'Drugs for respiratory conditions', order: 4 },
    { name: 'Gastrointestinal Pharmacology', description: 'Drugs for GI disorders', order: 5 },
    { name: 'Chemotherapy', description: 'Antimicrobial and anticancer drugs', order: 6 },
    { name: 'Endocrine Pharmacology', description: 'Hormones and related drugs', order: 7 },
    { name: 'CNS Drugs', description: 'Drugs acting on central nervous system', order: 8 },
    { name: 'Autacoids', description: 'Histamine, prostaglandins, leukotrienes', order: 9 },
    { name: 'Blood Drugs', description: 'Anticoagulants, antiplatelets, hematinics', order: 10 },
  ],
  Microbiology: [
    { name: 'General Microbiology', description: 'Basic microbiology principles', order: 1 },
    { name: 'Bacteriology', description: 'Bacterial infections and pathogens', order: 2 },
    { name: 'Virology', description: 'Viral infections and pathogens', order: 3 },
    { name: 'Mycology', description: 'Fungal infections', order: 4 },
    { name: 'Parasitology', description: 'Parasitic infections', order: 5 },
    { name: 'Immunology', description: 'Immune system and immunological disorders', order: 6 },
    { name: 'Clinical Microbiology', description: 'Clinical aspects of microbiology', order: 7 },
    { name: 'Hospital Infection Control', description: 'Nosocomial infections and control measures', order: 8 },
  ],
};

// Standard marks options
const MARKS_OPTIONS = [10, 8, 5, 4, 3, 2, 1];

// POST - Seed the database with initial data
export async function POST() {
  try {
    const results = {
      subjects: 0,
      systems: 0,
      marksSections: 0,
      errors: [] as string[],
    };

    // Create subjects
    const subjectData = [
      { name: 'Pathology', description: 'Study of disease processes', color: '#ef4444', icon: 'Microscope' },
      { name: 'Pharmacology', description: 'Study of drugs and their effects', color: '#22c55e', icon: 'Pill' },
      { name: 'Microbiology', description: 'Study of microorganisms', color: '#3b82f6', icon: 'Virus' },
    ];

    for (const subjectInfo of subjectData) {
      try {
        // Check if subject already exists
        const existingSubject = await db.subject.findUnique({
          where: { name: subjectInfo.name },
        });

        let subject;
        if (existingSubject) {
          subject = existingSubject;
        } else {
          subject = await db.subject.create({
            data: subjectInfo,
          });
          results.subjects++;
        }

        // Create systems for this subject
        const systemsData = MEDICAL_SYSTEMS[subjectInfo.name as keyof typeof MEDICAL_SYSTEMS] || [];
        for (const systemInfo of systemsData) {
          try {
            // Check if system already exists
            const existingSystem = await db.system.findFirst({
              where: {
                name: systemInfo.name,
                subjectId: subject.id,
              },
            });

            let system;
            if (existingSystem) {
              system = existingSystem;
            } else {
              system = await db.system.create({
                data: {
                  ...systemInfo,
                  subjectId: subject.id,
                },
              });
              results.systems++;
            }

            // Create marks sections for this system
            for (const marks of MARKS_OPTIONS) {
              try {
                const existingMarksSection = await db.marksSection.findFirst({
                  where: {
                    marks,
                    systemId: system.id,
                  },
                });

                if (!existingMarksSection) {
                  await db.marksSection.create({
                    data: {
                      marks,
                      label: `${marks} Markers`,
                      systemId: system.id,
                    },
                  });
                  results.marksSections++;
                }
              } catch (error) {
                results.errors.push(`Marks section ${marks} for ${systemInfo.name}: ${error}`);
              }
            }
          } catch (error) {
            results.errors.push(`System ${systemInfo.name}: ${error}`);
          }
        }
      } catch (error) {
        results.errors.push(`Subject ${subjectInfo.name}: ${error}`);
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

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Database seeded successfully',
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}

// GET - Check if database is seeded
export async function GET() {
  try {
    const subjectsCount = await db.subject.count();
    const systemsCount = await db.system.count();
    const marksSectionsCount = await db.marksSection.count();

    return NextResponse.json({
      success: true,
      data: {
        isSeeded: subjectsCount > 0,
        counts: {
          subjects: subjectsCount,
          systems: systemsCount,
          marksSections: marksSectionsCount,
        },
      },
    });
  } catch (error) {
    console.error('Error checking seed status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check seed status' },
      { status: 500 }
    );
  }
}
