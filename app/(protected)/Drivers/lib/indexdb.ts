import { Driver } from "../types";

const DB_NAME = "driversDB";
const DB_VERSION = 2;
const DRIVERS_STORE = "drivers";
const COMPANIES_STORE = "companies";

interface IDBConfig {
  name: string;
  version: number;
  stores: { [key: string]: string };
}

const dbConfig: IDBConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: {
    [DRIVERS_STORE]: "id",
    [COMPANIES_STORE]: "id",
  },
};

class DriversIndexedDB {
  private db: IDBDatabase | null = null;

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;

      try {
        request = indexedDB.open(dbConfig.name, dbConfig.version);
      } catch (error) {
        console.error("Error opening database:", error);
        reject(error);
        return;
      }

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        if (error?.name === "VersionError") {
          // If we get a version error, try to delete the database and reconnect
          indexedDB.deleteDatabase(dbConfig.name).onsuccess = () => {
            // Retry connection after deletion
            const retryRequest = indexedDB.open(
              dbConfig.name,
              dbConfig.version
            );

            retryRequest.onerror = () => {
              console.error("Retry error:", retryRequest.error);
              reject(retryRequest.error);
            };

            retryRequest.onsuccess = () => {
              this.db = retryRequest.result;
              resolve(retryRequest.result);
            };

            retryRequest.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;

              // Create stores with proper configuration
              if (!db.objectStoreNames.contains(DRIVERS_STORE)) {
                db.createObjectStore(DRIVERS_STORE, {
                  keyPath: "id",
                  autoIncrement: false,
                });
              }

              if (!db.objectStoreNames.contains(COMPANIES_STORE)) {
                db.createObjectStore(COMPANIES_STORE, {
                  keyPath: "id",
                  autoIncrement: false,
                });
              }
            };
          };
        } else {
          console.error("IndexedDB error:", error);
          reject(error);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores with proper configuration
        if (!db.objectStoreNames.contains(DRIVERS_STORE)) {
          db.createObjectStore(DRIVERS_STORE, {
            keyPath: "id",
            autoIncrement: false,
          });
        }

        if (!db.objectStoreNames.contains(COMPANIES_STORE)) {
          db.createObjectStore(COMPANIES_STORE, {
            keyPath: "id",
            autoIncrement: false,
          });
        }
      };
    });
  }

  private async ensureStoreExists(storeName: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    if (!this.db.objectStoreNames.contains(storeName)) {
      // Close the current connection
      this.db.close();
      this.db = null;

      // Increment version and reconnect
      const currentVersion = dbConfig.version;
      dbConfig.version += 1;

      await this.connect();
    }
  }

  async getAllDrivers(): Promise<Driver[]> {
    await this.connect();
    await this.ensureStoreExists(DRIVERS_STORE);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const transaction = this.db.transaction(DRIVERS_STORE, "readonly");
        const store = transaction.objectStore(DRIVERS_STORE);
        const request = store.getAll();

        request.onerror = () => {
          console.error("Error getting drivers:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        console.error("Transaction error:", error);
        reject(error);
      }
    });
  }

  async getDriver(id: number): Promise<Driver | null> {
    await this.connect();
    await this.ensureStoreExists(DRIVERS_STORE);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const transaction = this.db.transaction(DRIVERS_STORE, "readonly");
        const store = transaction.objectStore(DRIVERS_STORE);
        const request = store.get(id);

        request.onerror = () => {
          console.error("Error getting driver:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result || null);
        };
      } catch (error) {
        console.error("Transaction error:", error);
        reject(error);
      }
    });
  }

  async setDrivers(drivers: Driver[]): Promise<void> {
    const db = await this.connect();
    const tx = db.transaction("drivers", "readwrite");
    const store = tx.objectStore("drivers");

    // Clear existing data
    await store.clear();

    // Add all drivers
    for (const driver of drivers) {
      await store.add(driver);
    }

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async setCompanies(
    companies: Array<{ id: number; name: string }>
  ): Promise<void> {
    await this.connect();
    await this.ensureStoreExists(COMPANIES_STORE);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const transaction = this.db.transaction(COMPANIES_STORE, "readwrite");
        const store = transaction.objectStore(COMPANIES_STORE);

        // Clear existing data
        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          // Add all companies
          let completed = 0;
          let hasError = false;

          if (companies.length === 0) {
            resolve();
            return;
          }

          companies.forEach((company) => {
            if (!company.id) {
              console.warn("Company without ID found:", company);
              completed++;
              if (completed === companies.length) {
                resolve();
              }
              return;
            }

            try {
              // Create a new object with the key as a property
              const companyData = {
                ...company,
                id: Number(company.id),
              };

              const request = store.put(companyData); // Don't pass explicit key since we're using keyPath

              request.onsuccess = () => {
                completed++;
                if (completed === companies.length && !hasError) {
                  resolve();
                }
              };

              request.onerror = (event) => {
                hasError = true;
                console.error(
                  "Error adding company:",
                  request.error,
                  companyData
                );
                event.preventDefault(); // Prevent transaction abort
                completed++;
                if (completed === companies.length) {
                  reject(request.error);
                }
              };
            } catch (e) {
              hasError = true;
              console.error("Error in put operation:", e, company);
              completed++;
              if (completed === companies.length) {
                reject(e);
              }
            }
          });
        };

        clearRequest.onerror = () => {
          console.error("Error clearing store:", clearRequest.error);
          reject(clearRequest.error);
        };
      } catch (error) {
        console.error("Error in setCompanies:", error);
        reject(error);
      }
    });
  }

  async getCompanies(): Promise<Array<{ id: number; name: string }>> {
    await this.connect();
    await this.ensureStoreExists(COMPANIES_STORE);

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const transaction = this.db.transaction(COMPANIES_STORE, "readonly");
        const store = transaction.objectStore(COMPANIES_STORE);
        const request = store.getAll();

        request.onerror = () => {
          console.error("Error getting companies:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        console.error("Transaction error:", error);
        reject(error);
      }
    });
  }

  async clearAll(): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const stores = [DRIVERS_STORE, COMPANIES_STORE];
        let completedStores = 0;

        stores.forEach((storeName) => {
          if (this.db!.objectStoreNames.contains(storeName)) {
            try {
              const transaction = this.db!.transaction(storeName, "readwrite");
              const store = transaction.objectStore(storeName);
              const request = store.clear();

              request.onsuccess = () => {
                completedStores++;
                if (completedStores === stores.length) {
                  resolve();
                }
              };

              request.onerror = () => {
                console.error(`Error clearing ${storeName}:`, request.error);
                reject(request.error);
              };
            } catch (e) {
              console.error(`Error in transaction for ${storeName}:`, e);
              completedStores++;
              if (completedStores === stores.length) {
                reject(e);
              }
            }
          } else {
            completedStores++;
            if (completedStores === stores.length) {
              resolve();
            }
          }
        });
      } catch (error) {
        console.error("Error in clearAll:", error);
        reject(error);
      }
    });
  }
}

// Export a singleton instance
export const driversDB = new DriversIndexedDB();
