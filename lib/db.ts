/**
 * Mock database implementation
 * In a real application, this would connect to your actual database
 */

interface DriverLicense {
  id: number;
  driver_id: number;
  license_file_url: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MedicalCard {
  id: number;
  driver_id: number;
  file_link: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MvrFile {
  id: number;
  driver_id: number;
  mvr_file_url: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

// Mock data
const driverLicenses: DriverLicense[] = [];
const medicalCards: MedicalCard[] = [];
const mvrFiles: MvrFile[] = [];

// Mock database query functions
export const db = {
  driver_licenses: {
    id: "id",
    driver_id: "driver_id",
  },
  medical_cards: {
    id: "id",
    driver_id: "driver_id",
  },
  mvr_files: {
    id: "id",
    driver_id: "driver_id",
  },

  eq: (field: string, value: any) => ({ field, value, operator: "eq" }),

  query: {
    driver_licenses: {
      findMany: ({ where }: { where: Function }) => {
        const condition = where(db.driver_licenses, db.eq);
        return driverLicenses.filter(
          (license) =>
            license[condition.field as keyof DriverLicense] === condition.value
        );
      },
    },
    medical_cards: {
      findMany: ({ where }: { where: Function }) => {
        const condition = where(db.medical_cards, db.eq);
        return medicalCards.filter(
          (card) =>
            card[condition.field as keyof MedicalCard] === condition.value
        );
      },
    },
    mvr_files: {
      findMany: ({ where }: { where: Function }) => {
        const condition = where(db.mvr_files, db.eq);
        return mvrFiles.filter(
          (file) => file[condition.field as keyof MvrFile] === condition.value
        );
      },
    },
  },

  insert: (table: any) => ({
    values: (data: any) => ({
      returning: () => {
        const now = new Date().toISOString();
        const id = Math.floor(Math.random() * 10000);
        const newRecord = {
          ...data,
          id,
          created_at: now,
          updated_at: now,
        };

        if (table === db.driver_licenses) {
          driverLicenses.push(newRecord as DriverLicense);
        } else if (table === db.medical_cards) {
          medicalCards.push(newRecord as MedicalCard);
        } else if (table === db.mvr_files) {
          mvrFiles.push(newRecord as MvrFile);
        }

        return [newRecord];
      },
    }),
  }),

  delete: (table: any) => ({
    where: (condition: any) => {
      if (table === db.driver_licenses) {
        const index = driverLicenses.findIndex(
          (l) => l[condition.field as keyof DriverLicense] === condition.value
        );
        if (index !== -1) {
          driverLicenses.splice(index, 1);
        }
      } else if (table === db.medical_cards) {
        const index = medicalCards.findIndex(
          (c) => c[condition.field as keyof MedicalCard] === condition.value
        );
        if (index !== -1) {
          medicalCards.splice(index, 1);
        }
      } else if (table === db.mvr_files) {
        const index = mvrFiles.findIndex(
          (f) => f[condition.field as keyof MvrFile] === condition.value
        );
        if (index !== -1) {
          mvrFiles.splice(index, 1);
        }
      }
      return { success: true };
    },
  }),
};
