import { NextResponse } from 'next/server';
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
  
  return Math.round(importanceScore * 100) / 100;
}

// Comprehensive medical questions database
const QUESTIONS_DATA = {
  Pathology: {
    'General Pathology': {
      '10 Markers': [
        { title: 'Inflammation - Definition and Types', description: 'Define inflammation. Discuss the cardinal signs of inflammation. Describe the differences between acute and chronic inflammation with examples.', years: ['2023', '2022', '2021', '2019', '2018', '2016'], globalImportance: 0.9 },
        { title: 'Necrosis - Types and Pathogenesis', description: 'Define necrosis. Describe the morphological patterns of necrosis with examples. Differentiate between necrosis and apoptosis.', years: ['2023', '2021', '2020', '2018'], globalImportance: 0.85 },
        { title: 'Granulomatous Inflammation', description: 'Define granuloma. Discuss the pathogenesis of granulomatous inflammation. List the causes of granulomatous inflammation with examples.', years: ['2022', '2021', '2019', '2017'], globalImportance: 0.85 },
        { title: 'Healing and Repair', description: 'Discuss the process of wound healing. Differentiate between healing by first intention and second intention. List the factors affecting wound healing.', years: ['2023', '2022', '2020', '2018', '2016'], globalImportance: 0.9 },
        { title: 'Neoplasia - Definition and Characteristics', description: 'Define neoplasia. Discuss the differences between benign and malignant tumors. Describe the characteristics of malignant tumors.', years: ['2023', '2022', '2021', '2020', '2019', '2017'], globalImportance: 0.95 },
        { title: 'Carcinogenesis', description: 'Discuss the molecular basis of carcinogenesis. Describe the role of oncogenes and tumor suppressor genes in cancer development.', years: ['2022', '2021', '2019', '2018'], globalImportance: 0.85 },
        { title: 'Metastasis', description: 'Define metastasis. Discuss the routes of spread of malignant tumors. Describe the mechanism of metastasis.', years: ['2023', '2021', '2020', '2018'], globalImportance: 0.8 },
        { title: 'Cell Injury', description: 'Discuss the causes and mechanisms of cell injury. Differentiate between reversible and irreversible cell injury.', years: ['2023', '2022', '2020', '2019', '2017'], globalImportance: 0.85 },
      ],
      '4 Markers': [
        { title: 'Oedema - Definition and Pathophysiology', description: 'Define oedema. Discuss the pathophysiology of oedema.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.8 },
        { title: 'Thrombosis - Virchows Triad', description: 'Describe Virchows triad in thrombosis.', years: ['2023', '2022', '2020', '2019'], globalImportance: 0.85 },
        { title: 'Embolism - Types', description: 'Define embolism. List the types of embolism.', years: ['2022', '2021', '2019'], globalImportance: 0.75 },
        { title: 'Infarction - Types', description: 'Define infarction. Differentiate between red and white infarcts.', years: ['2023', '2021', '2020'], globalImportance: 0.75 },
        { title: 'Amyloidosis', description: 'Define amyloidosis. List the types of amyloidosis.', years: ['2022', '2020', '2018'], globalImportance: 0.7 },
        { title: 'Calcification - Types', description: 'Define calcification. Differentiate between dystrophic and metastatic calcification.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Apoptosis', description: 'Define apoptosis. List the differences between apoptosis and necrosis.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Gangrene - Types', description: 'Define gangrene. Differentiate between dry and wet gangrene.', years: ['2022', '2021', '2019'], globalImportance: 0.7 },
      ],
      '2 Markers': [
        { title: 'Define Pyknosis', description: 'Define pyknosis. Give one example.', years: ['2023', '2022'], globalImportance: 0.6 },
        { title: 'Define Karyolysis', description: 'Define karyolysis.', years: ['2022', '2021'], globalImportance: 0.55 },
        { title: 'Define Anaplasia', description: 'Define anaplasia.', years: ['2023', '2021'], globalImportance: 0.65 },
        { title: 'Dysplasia Definition', description: 'Define dysplasia with example.', years: ['2022', '2021', '2020'], globalImportance: 0.7 },
        { title: 'Metaplasia Definition', description: 'Define metaplasia with example.', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
        { title: 'Hyperplasia Definition', description: 'Define hyperplasia with example.', years: ['2023', '2022'], globalImportance: 0.65 },
        { title: 'Caseation Necrosis', description: 'Define caseation necrosis with example.', years: ['2022', '2021', '2020'], globalImportance: 0.7 },
        { title: 'Fibrinoid Necrosis', description: 'Define fibrinoid necrosis with example.', years: ['2023', '2021'], globalImportance: 0.6 },
      ],
    },
    'Hematology': {
      '10 Markers': [
        { title: 'Anemia - Classification and Pathophysiology', description: 'Define anemia. Classify anemia based on etiology and morphology. Discuss the pathophysiology of anemia.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Iron Deficiency Anemia', description: 'Discuss the etiology, pathogenesis, and laboratory findings of iron deficiency anemia. Describe the stages of iron deficiency.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.9 },
        { title: 'Megaloblastic Anemia', description: 'Define megaloblastic anemia. Discuss the etiology, pathogenesis, and blood picture in megaloblastic anemia.', years: ['2022', '2021', '2020', '2019'], globalImportance: 0.85 },
        { title: 'Hemolytic Anemia', description: 'Define hemolytic anemia. Classify hemolytic anemias. Discuss the laboratory findings in hemolytic anemia.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
        { title: 'Thalassemia', description: 'Define thalassemia. Discuss the pathogenesis and classification of thalassemia. Describe the differences between thalassemia major and minor.', years: ['2023', '2022', '2021', '2019'], globalImportance: 0.9 },
        { title: 'Leukemia - Classification', description: 'Define leukemia. Classify leukemias. Discuss the differences between acute and chronic leukemia.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
      ],
      '4 Markers': [
        { title: 'Pernicious Anemia', description: 'Define pernicious anemia. Discuss its etiology and pathogenesis.', years: ['2023', '2022', '2020'], globalImportance: 0.75 },
        { title: 'Aplastic Anemia', description: 'Define aplastic anemia. List the causes of aplastic anemia.', years: ['2022', '2021', '2020'], globalImportance: 0.75 },
        { title: 'Hemophilia A vs B', description: 'Differentiate between Hemophilia A and Hemophilia B.', years: ['2023', '2022', '2021'], globalImportance: 0.8 },
        { title: 'Disseminated Intravascular Coagulation', description: 'Define DIC. List the causes and laboratory findings in DIC.', years: ['2022', '2021', '2020'], globalImportance: 0.8 },
        { title: 'Multiple Myeloma', description: 'Define multiple myeloma. List the clinical features.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Hodgkin Lymphoma', description: 'Define Hodgkin lymphoma. List the types of Hodgkin lymphoma.', years: ['2023', '2022'], globalImportance: 0.7 },
      ],
      '2 Markers': [
        { title: 'Reticulocyte Definition', description: 'Define reticulocyte.', years: ['2023', '2022'], globalImportance: 0.55 },
        { title: 'Target Cell', description: 'Define target cell. Give one condition where it is seen.', years: ['2022', '2021'], globalImportance: 0.6 },
        { title: 'Spherocyte', description: 'Define spherocyte. Give one condition where it is seen.', years: ['2023', '2021'], globalImportance: 0.6 },
        { title: 'Philadelphia Chromosome', description: 'Define Philadelphia chromosome.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Reed-Sternberg Cell', description: 'Define Reed-Sternberg cell.', years: ['2022', '2021'], globalImportance: 0.7 },
        { title: 'Pancytopenia', description: 'Define pancytopenia. List two causes.', years: ['2023', '2022', '2021'], globalImportance: 0.65 },
      ],
    },
    'Cardiovascular System': {
      '10 Markers': [
        { title: 'Atherosclerosis - Pathogenesis', description: 'Define atherosclerosis. Discuss the risk factors and pathogenesis of atherosclerosis. Describe the complications of atherosclerosis.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Myocardial Infarction', description: 'Discuss the etiology, pathogenesis, and morphological changes in myocardial infarction. Describe the complications of myocardial infarction.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Hypertension - Classification and Pathology', description: 'Define hypertension. Classify hypertension. Discuss the pathological changes in hypertension.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.9 },
        { title: 'Rheumatic Heart Disease', description: 'Discuss the etiology, pathogenesis, and morphological features of rheumatic heart disease. Describe Aschoff body.', years: ['2022', '2021', '2020', '2019', '2018'], globalImportance: 0.9 },
      ],
      '4 Markers': [
        { title: 'Aneurysm - Definition and Types', description: 'Define aneurysm. Classify aneurysms.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Cardiomyopathy Classification', description: 'Classify cardiomyopathies. Give examples.', years: ['2023', '2022'], globalImportance: 0.7 },
        { title: 'Pericarditis Types', description: 'Classify pericarditis. List the causes.', years: ['2023', '2022'], globalImportance: 0.65 },
      ],
      '2 Markers': [
        { title: 'Aschoff Body', description: 'Define Aschoff body.', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
        { title: 'Cor Pulmonale', description: 'Define cor pulmonale.', years: ['2022', '2021'], globalImportance: 0.65 },
        { title: 'Berry Aneurysm', description: 'Define berry aneurysm.', years: ['2023', '2022'], globalImportance: 0.6 },
      ],
    },
  },
  Pharmacology: {
    'General Pharmacology': {
      '10 Markers': [
        { title: 'Pharmacokinetics - ADME', description: 'Define pharmacokinetics. Discuss the processes of absorption, distribution, metabolism, and excretion of drugs.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Drug Interactions', description: 'Define drug interactions. Classify drug interactions. Discuss the mechanisms and clinical significance of drug interactions.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Adverse Drug Reactions', description: 'Define adverse drug reactions. Classify adverse drug reactions. Discuss the mechanisms and examples.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
      ],
      '4 Markers': [
        { title: 'Bioavailability', description: 'Define bioavailability. Discuss the factors affecting bioavailability.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.8 },
        { title: 'Half-Life', description: 'Define half-life of a drug. Discuss its clinical significance.', years: ['2022', '2021', '2020'], globalImportance: 0.75 },
        { title: 'First-Pass Metabolism', description: 'Define first-pass metabolism. Give examples of drugs undergoing first-pass metabolism.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Therapeutic Index', description: 'Define therapeutic index. Discuss its clinical significance.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
      ],
      '2 Markers': [
        { title: 'Define Pharmacokinetics', description: 'Define pharmacokinetics.', years: ['2023', '2022'], globalImportance: 0.55 },
        { title: 'Define Agonist', description: 'Define agonist with example.', years: ['2022', '2021'], globalImportance: 0.6 },
        { title: 'Tolerance Definition', description: 'Define tolerance.', years: ['2023', '2022'], globalImportance: 0.65 },
        { title: 'Tachyphylaxis Definition', description: 'Define tachyphylaxis with example.', years: ['2022', '2021'], globalImportance: 0.65 },
      ],
    },
    'Autonomic Nervous System': {
      '10 Markers': [
        { title: 'Cholinergic Drugs', description: 'Classify cholinergic drugs. Discuss the mechanism of action, pharmacological effects, and therapeutic uses of cholinergic drugs.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
        { title: 'Atropine', description: 'Discuss the mechanism of action, pharmacological effects, therapeutic uses, and adverse effects of atropine.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Sympathomimetic Drugs', description: 'Classify sympathomimetic drugs. Discuss the mechanism of action and therapeutic uses of sympathomimetic drugs.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
      ],
      '4 Markers': [
        { title: 'Organophosphorus Poisoning', description: 'Discuss the clinical features and management of organophosphorus poisoning.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Propranolol', description: 'Discuss the pharmacological effects and therapeutic uses of propranolol.', years: ['2023', '2022', '2021'], globalImportance: 0.8 },
        { title: 'Salbutamol', description: 'Discuss the mechanism of action and therapeutic uses of salbutamol.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
      ],
      '2 Markers': [
        { title: 'Define Cholinergic Crisis', description: 'Define cholinergic crisis.', years: ['2023', '2022'], globalImportance: 0.65 },
        { title: 'Atropine Poisoning', description: 'List the features of atropine poisoning.', years: ['2023', '2022'], globalImportance: 0.7 },
      ],
    },
    'Cardiovascular Pharmacology': {
      '10 Markers': [
        { title: 'Antihypertensive Drugs', description: 'Classify antihypertensive drugs. Discuss the mechanism of action and therapeutic uses of different classes of antihypertensive drugs.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Diuretics', description: 'Classify diuretics. Discuss the mechanism of action, therapeutic uses, and adverse effects of different classes of diuretics.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
        { title: 'Antiarrhythmic Drugs', description: 'Classify antiarrhythmic drugs (Vaughan Williams classification). Discuss the mechanism of action of each class.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Anticoagulants', description: 'Classify anticoagulants. Discuss the mechanism of action, therapeutic uses, and adverse effects of anticoagulants.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
      ],
      '4 Markers': [
        { title: 'ACE Inhibitors', description: 'Discuss the mechanism of action and adverse effects of ACE inhibitors.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Nitrates', description: 'Discuss the mechanism of action and therapeutic uses of nitrates in angina.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Statins', description: 'Discuss the mechanism of action and adverse effects of statins.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.8 },
      ],
      '2 Markers': [
        { title: 'Thiazide Diuretics', description: 'Give two examples of thiazide diuretics.', years: ['2023', '2022'], globalImportance: 0.6 },
        { title: 'Heparin vs Warfarin', description: 'Give two differences between heparin and warfarin.', years: ['2023', '2022'], globalImportance: 0.7 },
      ],
    },
  },
  Microbiology: {
    'General Microbiology': {
      '10 Markers': [
        { title: 'Sterilization and Disinfection', description: 'Define sterilization and disinfection. Discuss the physical and chemical methods of sterilization.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Normal Flora', description: 'Define normal flora. Discuss the beneficial and harmful effects of normal flora. List the normal flora of different body sites.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Bacterial Pathogenesis', description: 'Discuss the mechanisms of bacterial pathogenesis including virulence factors, toxins, and mechanisms of tissue damage.', years: ['2022', '2021', '2020', '2019'], globalImportance: 0.9 },
      ],
      '4 Markers': [
        { title: 'Gram Staining', description: 'Describe the procedure and principle of Gram staining.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Culture Media', description: 'Classify culture media. Give examples.', years: ['2023', '2022', '2021'], globalImportance: 0.8 },
        { title: 'Endotoxin vs Exotoxin', description: 'Differentiate between endotoxin and exotoxin.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
        { title: 'Autoclave', description: 'Define autoclave. Discuss the principle and uses of autoclave.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
      ],
      '2 Markers': [
        { title: 'Define Sterilization', description: 'Define sterilization.', years: ['2023', '2022'], globalImportance: 0.55 },
        { title: 'Nosocomial Infection', description: 'Define nosocomial infection.', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
        { title: 'Carrier State', description: 'Define carrier state.', years: ['2023', '2022'], globalImportance: 0.6 },
      ],
    },
    'Bacteriology': {
      '10 Markers': [
        { title: 'Staphylococcus aureus', description: 'Discuss the morphology, cultural characteristics, virulence factors, and clinical manifestations of Staphylococcus aureus infections.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Tuberculosis', description: 'Discuss the pathogenesis, laboratory diagnosis, and prevention of tuberculosis.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Enteric Fever', description: 'Discuss the pathogenesis, laboratory diagnosis, and treatment of enteric fever (typhoid).', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.9 },
        { title: 'Cholera', description: 'Discuss the pathogenesis, laboratory diagnosis, and treatment of cholera.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
      ],
      '4 Markers': [
        { title: 'Diphtheria', description: 'Discuss the pathogenesis and laboratory diagnosis of diphtheria.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Tetanus', description: 'Discuss the pathogenesis and prevention of tetanus.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.8 },
        { title: 'Leprosy', description: 'Discuss the classification and clinical features of leprosy.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Syphilis', description: 'Discuss the laboratory diagnosis of syphilis.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
      ],
      '2 Markers': [
        { title: 'MRSA', description: 'Define MRSA.', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
        { title: 'PPD Test', description: 'Define PPD test (Mantoux test).', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
        { title: 'Widal Test', description: 'Define Widal test.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
      ],
    },
    'Virology': {
      '10 Markers': [
        { title: 'HIV - Pathogenesis and Laboratory Diagnosis', description: 'Discuss the structure, pathogenesis, and laboratory diagnosis of HIV infection.', years: ['2023', '2022', '2021', '2020', '2019', '2018'], globalImportance: 0.95 },
        { title: 'Hepatitis B Virus', description: 'Discuss the structure, modes of transmission, pathogenesis, and laboratory diagnosis of Hepatitis B virus infection.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Rabies Virus', description: 'Discuss the pathogenesis, laboratory diagnosis, and prevention of rabies.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.85 },
      ],
      '4 Markers': [
        { title: 'Hepatitis A vs Hepatitis B', description: 'Differentiate between Hepatitis A and Hepatitis B infection.', years: ['2023', '2022', '2021'], globalImportance: 0.8 },
        { title: 'Dengue Virus', description: 'Discuss the pathogenesis and laboratory diagnosis of dengue.', years: ['2023', '2022', '2021'], globalImportance: 0.75 },
        { title: 'Chickenpox', description: 'Discuss the clinical features and laboratory diagnosis of chickenpox.', years: ['2023', '2022'], globalImportance: 0.65 },
      ],
      '2 Markers': [
        { title: 'CD4 Count', description: 'Define the significance of CD4 count in HIV.', years: ['2023', '2022'], globalImportance: 0.7 },
        { title: 'Negri Bodies', description: 'Define Negri bodies.', years: ['2022', '2021'], globalImportance: 0.65 },
        { title: 'Antigenic Drift', description: 'Define antigenic drift.', years: ['2023', '2022'], globalImportance: 0.6 },
      ],
    },
    'Immunology': {
      '10 Markers': [
        { title: 'Immunity - Innate and Adaptive', description: 'Define immunity. Discuss the differences between innate and adaptive immunity. Describe the components of innate immunity.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.9 },
        { title: 'Hypersensitivity Reactions', description: 'Classify hypersensitivity reactions (Gell and Coombs classification). Discuss the mechanism and examples of each type.', years: ['2023', '2022', '2021', '2020', '2019'], globalImportance: 0.95 },
        { title: 'Vaccines', description: 'Define vaccine. Classify vaccines. Discuss the advantages and disadvantages of live attenuated and killed vaccines.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.9 },
        { title: 'Immunoglobulins', description: 'Define immunoglobulins. Discuss the structure, properties, and functions of different classes of immunoglobulins.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.9 },
      ],
      '4 Markers': [
        { title: 'T Cells vs B Cells', description: 'Differentiate between T cells and B cells.', years: ['2023', '2022', '2021', '2020'], globalImportance: 0.8 },
        { title: 'Anaphylaxis', description: 'Discuss the pathogenesis and management of anaphylaxis.', years: ['2023', '2022', '2021'], globalImportance: 0.8 },
        { title: 'MHC', description: 'Define MHC. Discuss the types and functions of MHC.', years: ['2023', '2022', '2021'], globalImportance: 0.7 },
      ],
      '2 Markers': [
        { title: 'Define Antigen', description: 'Define antigen.', years: ['2023', '2022'], globalImportance: 0.5 },
        { title: 'Opsonization', description: 'Define opsonization.', years: ['2022', '2021'], globalImportance: 0.6 },
        { title: 'Natural Killer Cells', description: 'Define natural killer cells.', years: ['2023', '2022'], globalImportance: 0.6 },
      ],
    },
  },
};

// POST - Seed questions into database
export async function POST() {
  try {
    const results = {
      questionsAdded: 0,
      errors: [] as string[],
    };

    // Get all subjects
    const subjects = await db.subject.findMany({
      include: {
        systems: {
          include: {
            marksSections: true,
          },
        },
      },
    });

    for (const subject of subjects) {
      const subjectQuestions = QUESTIONS_DATA[subject.name as keyof typeof QUESTIONS_DATA];
      if (!subjectQuestions) continue;

      for (const system of subject.systems) {
        const systemQuestions = subjectQuestions[system.name as keyof typeof subjectQuestions];
        if (!systemQuestions) continue;

        for (const [marksLabel, questions] of Object.entries(systemQuestions)) {
          // Find the appropriate marks section
          let marksValue = 10;
          if (marksLabel === '10 Markers') marksValue = 10;
          else if (marksLabel === '4 Markers') marksValue = 4;
          else if (marksLabel === '2 Markers') marksValue = 2;

          const marksSection = system.marksSections.find(m => m.marks === marksValue);
          if (!marksSection) continue;

          for (const q of questions as Array<{ title: string; description: string; years: string[]; globalImportance: number }>) {
            try {
              // Check if question already exists
              const existing = await db.question.findFirst({
                where: {
                  title: q.title,
                  marksSectionId: marksSection.id,
                },
              });

              if (!existing) {
                const repeatCount = q.years.length;
                const importanceScore = calculateImportanceScore(repeatCount, q.years, q.globalImportance);

                await db.question.create({
                  data: {
                    title: q.title,
                    description: q.description,
                    repeatCount,
                    years: JSON.stringify(q.years),
                    importanceScore,
                    globalImportance: q.globalImportance,
                    subjectId: subject.id,
                    systemId: system.id,
                    marksSectionId: marksSection.id,
                  },
                });
                results.questionsAdded++;
              }
            } catch (error) {
              results.errors.push(`Question: ${q.title} - ${error}`);
            }
          }
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
      message: `Successfully added ${results.questionsAdded} questions`,
    });
  } catch (error) {
    console.error('Error seeding questions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed questions' },
      { status: 500 }
    );
  }
}

// GET - Get seed status
export async function GET() {
  try {
    const questionsCount = await db.question.count();
    
    return NextResponse.json({
      success: true,
      data: {
        hasQuestions: questionsCount > 0,
        questionsCount,
      },
    });
  } catch (error) {
    console.error('Error checking questions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check questions' },
      { status: 500 }
    );
  }
}
