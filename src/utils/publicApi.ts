import { Patient, TreatmentModalities, FollowUpVisit } from '../types';
import { COMMON_DIAGNOSES, BLOOD_GROUPS } from '../constants';
import { defaultTreatmentModalities } from './storage';

interface PublicApiUser {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  phone: string;
  address?: {
    address?: string;
    city?: string;
    postalCode?: string;
    state?: string;
  };
  bloodGroup?: string;
  height?: number;
  weight?: number;
}

const CLINICAL_SCENARIOS = [
  {
    diagnosis: "Cervical Spondylosis with Radiculopathy",
    history: "Patient presents with progressive neck stiffness, bilateral trapezius spasm, and radiating paresthesia to C6 dermatome (thumb & index finger). Symptoms aggravated by prolonged computer desk work.",
    modalities: ['cervicalTraction', 'ift', 'moist', 'postural', 'exercise'] as (keyof TreatmentModalities)[],
    fee: 600,
    visitType: "Clinic" as const,
    referredBy: "Dr. K. S. Murthy (Neurologist, Mysuru)",
    followUpCount: 3,
  },
  {
    diagnosis: "Adhesive Capsulitis (Frozen Shoulder - Freezing Stage)",
    history: "Severe right shoulder pain with restricted glenohumeral active & passive ranges: Abduction 75°, External Rotation 20°. Sleep disturbance when lying on affected side.",
    modalities: ['ust', 'moist', 'exercise', 'manual'] as (keyof TreatmentModalities)[],
    fee: 550,
    visitType: "Clinic" as const,
    referredBy: "Dr. A. Ramesh (Orthopedic Surgeon, Apollo BGS)",
    followUpCount: 4,
  },
  {
    diagnosis: "Lumbar Disc Herniation (L4-L5) with Sciatica",
    history: "Acute lower back ache radiating down posterior right thigh and lateral calf. Positive straight leg raise test at 45°. Difficulty sitting for >20 minutes.",
    modalities: ['pelvicTraction', 'ift', 'moist', 'exercise', 'tens'] as (keyof TreatmentModalities)[],
    fee: 650,
    visitType: "Clinic" as const,
    referredBy: "Dr. S. N. Manjunath (Spine Care Clinic)",
    followUpCount: 5,
  },
  {
    diagnosis: "Bilateral Knee Osteoarthritis (Kellgren-Lawrence Grade 2)",
    history: "Crepitus, morning stiffness < 30 mins, joint line tenderness. Trouble descending stairs and squatting. BMI elevated.",
    modalities: ['ust', 'ift', 'exercise', 'postural'] as (keyof TreatmentModalities)[],
    fee: 500,
    visitType: "Clinic" as const,
    referredBy: "Self-referred (Alanahalli Resident)",
    followUpCount: 3,
  },
  {
    diagnosis: "Post-Stroke Right Hemiparesis (Gait & Functional Rehab)",
    history: "6 months post ischemic CVA. Recovering upper extremity synergies and circumduction gait pattern. Goals: independent transfers and safe community ambulation.",
    modalities: ['nmes', 'gait', 'exercise', 'postural', 'manual'] as (keyof TreatmentModalities)[],
    fee: 800,
    visitType: "Home Visit" as const,
    referredBy: "Dr. P. Venkatesh (Rehabilitation Medicine)",
    followUpCount: 6,
  },
  {
    diagnosis: "Plantar Fasciitis (Left Heel)",
    history: "Sharp focal pain at medial calcaneal tubercle on first morning steps and post rest. Tight Achilles tendon complex.",
    modalities: ['ust', 'coldPack', 'exercise', 'manual'] as (keyof TreatmentModalities)[],
    fee: 450,
    visitType: "Clinic" as const,
    referredBy: "Dr. Girish Babu (Sports Physician)",
    followUpCount: 2,
  },
  {
    diagnosis: "Lateral Epicondylitis (Tennis Elbow) - Dominant Arm",
    history: "Point tenderness at lateral humeral epicondyle, positive Cozen's and Mill's test. Pain gripping racquet and door handles.",
    modalities: ['ust', 'coldPack', 'exercise', 'manual'] as (keyof TreatmentModalities)[],
    fee: 500,
    visitType: "Clinic" as const,
    referredBy: "Self-referred (Recreational Tennis Player)",
    followUpCount: 2,
  },
  {
    diagnosis: "Bell's Palsy (Left Facial Nerve Neuropraxia)",
    history: "Sudden onset incomplete eyelid closure, flattening of nasolabial fold, mouth angle drooping. Onset 4 days ago.",
    modalities: ['nmes', 'moist', 'exercise', 'manual'] as (keyof TreatmentModalities)[],
    fee: 600,
    visitType: "Clinic" as const,
    referredBy: "Dr. Kavitha Rao (ENT Consultant)",
    followUpCount: 4,
  },
];

export async function fetchDynamicPatientsFromPublicApi(limit: number = 10): Promise<{
  patients: Patient[];
  source: string;
  totalFetched: number;
}> {
  let rawUsers: PublicApiUser[] = [];
  let sourceName = 'DummyJSON Public API';

  try {
    const res = await fetch(`https://dummyjson.com/users?limit=${limit}&select=firstName,lastName,age,gender,phone,address,bloodGroup,height,weight`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) {
        rawUsers = data.users;
      }
    }
  } catch (err) {
    console.warn('DummyJSON fetch failed, attempting backup public API', err);
  }

  // Backup fetch from jsonplaceholder if dummyjson fails
  if (rawUsers.length === 0) {
    try {
      sourceName = 'JSONPlaceholder Public API';
      const res = await fetch('https://jsonplaceholder.typicode.com/users');
      if (res.ok) {
        const data = await res.json();
        rawUsers = data.map((u: any, idx: number) => ({
          id: u.id,
          firstName: u.name.split(' ')[0] || 'Patient',
          lastName: u.name.split(' ').slice(1).join(' ') || `#${idx + 1}`,
          age: 30 + (idx * 4) % 45,
          gender: idx % 2 === 0 ? 'Male' : 'Female',
          phone: u.phone || '9845012345',
          address: {
            address: u.address?.street || '#12 Cross Road',
            city: u.address?.city || 'Mysuru',
            postalCode: '570028',
            state: 'Karnataka',
          },
          bloodGroup: BLOOD_GROUPS[idx % BLOOD_GROUPS.length],
          height: 165 + (idx % 15),
          weight: 60 + (idx % 25),
        }));
      }
    } catch (err) {
      console.warn('JSONPlaceholder fetch failed, utilizing enriched local fallback', err);
    }
  }

  // If both networks blocked, generate realistic dynamic users
  if (rawUsers.length === 0) {
    sourceName = 'Curated Clinical Dataset';
    rawUsers = [
      { id: 1, firstName: "Ananya", lastName: "Shastry", age: 46, gender: "Female", phone: "9886214578", bloodGroup: "B+", height: 158, weight: 64 },
      { id: 2, firstName: "Karthik", lastName: "Hegde", age: 38, gender: "Male", phone: "9945032114", bloodGroup: "O+", height: 174, weight: 76 },
      { id: 3, firstName: "Manjula", lastName: "Prasad", age: 62, gender: "Female", phone: "9448123908", bloodGroup: "A+", height: 152, weight: 68 },
      { id: 4, firstName: "Suresh", lastName: "Gowda", age: 54, gender: "Male", phone: "9731294851", bloodGroup: "AB+", height: 168, weight: 81 },
      { id: 5, firstName: "Raghavendra", lastName: "Rao", age: 68, gender: "Male", phone: "9880124796", bloodGroup: "O-", height: 170, weight: 65 },
      { id: 6, firstName: "Deepika", lastName: "Nair", age: 29, gender: "Female", phone: "9611482035", bloodGroup: "B-", height: 163, weight: 58 },
      { id: 7, firstName: "Venkatesh", lastName: "Murthy", age: 43, gender: "Male", phone: "9900234187", bloodGroup: "A-", height: 176, weight: 79 },
      { id: 8, firstName: "Sunitha", lastName: "Babu", age: 51, gender: "Female", phone: "9480112456", bloodGroup: "O+", height: 156, weight: 63 },
    ];
  }

  // Transform into authentic Namana Physiotherapy Clinic cases
  const now = new Date();
  const currentYear = now.getFullYear();
  const patients: Patient[] = rawUsers.map((user, idx) => {
    const scenario = CLINICAL_SCENARIOS[idx % CLINICAL_SCENARIOS.length];
    const serial = 101 + idx;
    const serialPad = String(serial).padStart(3, '0');

    // Create realistic dates spread across recent months for financial/monthly charts
    const daysAgo = 10 + (idx * 12);
    const regDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const regDateStr = regDate.toISOString().slice(0, 10);

    // Build treatment modalities object
    const treatment = defaultTreatmentModalities();
    for (const key of scenario.modalities) {
      (treatment as any)[key] = true;
    }

    // Convert height to feet and inches format (e.g. 5'7")
    const heightCm = user.height || 165;
    const totalInches = Math.round(heightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    const heightStr = `${feet}'${inches}"`;
    const weightStr = String(user.weight || (user.gender === 'Female' ? 62 : 72));

    // Generate follow-ups
    const followUps: FollowUpVisit[] = [];
    const followUpCount = scenario.followUpCount;
    for (let f = 1; f <= followUpCount; f++) {
      const fDate = new Date(regDate.getTime() + f * 4 * 24 * 60 * 60 * 1000);
      if (fDate <= now) {
        const followUpTreat = defaultTreatmentModalities();
        // Use subset of modalities for followups
        scenario.modalities.slice(0, 3).forEach((k) => {
          (followUpTreat as any)[k] = true;
        });

        const vasScore = Math.max(8 - f * 2, 2);
        followUps.push({
          id: `fu_${serial}_${f}_${Date.now()}`,
          date: fDate.toISOString().slice(0, 10),
          notes: `Session ${f}: VAS Pain Score ${vasScore}/10. Reported functional improvement in daily activities. Range of motion reassessed. Home exercise program reinforced.`,
          painScale: vasScore,
          treatment: followUpTreat,
          fee: scenario.fee,
          receiptNo: `NPC/${currentYear}/R${serial}-${f}`,
          visitType: scenario.visitType,
          paymentMethod: f % 2 === 0 ? 'UPI' : 'Cash',
        });
      }
    }

    const city = user.address?.city || 'Mysuru';
    const street = user.address?.address || '# 45, 2nd Stage, Vijayanagar';
    const addressStr = `${street}, ${city} - 570028`;

    return {
      id: `patient_${user.id}_${Date.now()}`,
      serial,
      regNo: `NPC/${currentYear}/${serialPad}`,
      date: regDateStr,
      name: `${user.firstName} ${user.lastName}`,
      age: user.age || 42,
      sex: user.gender === 'female' || user.gender === 'Female' ? 'Female' : 'Male',
      height: heightStr,
      weight: weightStr,
      bloodGroup: user.bloodGroup || BLOOD_GROUPS[idx % BLOOD_GROUPS.length],
      referredBy: scenario.referredBy,
      address: addressStr,
      contact: user.phone || `98805${String(idx * 1111).padStart(5, '0')}`,
      diagnosis: scenario.diagnosis,
      history: scenario.history,
      comorbid: {
        diabetes: idx % 3 === 0,
        bp: idx % 2 === 0,
        thyroid: idx % 4 === 0 && user.gender === 'Female',
        other: false,
        otherText: '',
      },
      treatment,
      treatmentFee: scenario.fee,
      visitType: scenario.visitType,
      followUps,
      receiptNo: `NPC/${currentYear}/R${serial}`,
      createdAt: regDate.getTime(),
      updatedAt: now.getTime(),
      deleted: false,
    };
  });

  return {
    patients,
    source: sourceName,
    totalFetched: patients.length,
  };
}

export const fetchDynamicClinicalCases = fetchDynamicPatientsFromPublicApi;
