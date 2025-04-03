import { openDB, IDBPDatabase } from "idb";
import { User } from "../types";

interface Company {
  id: number;
  name: string;
}

class UsersDB {
  private db: IDBPDatabase | null = null;
  private dbName = "usersDB";
  private version = 1;

  async connect() {
    if (this.db) return;

    this.db = await openDB(this.dbName, this.version, {
      upgrade(db) {
        // Create users store
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "id" });
        }
        // Create companies store
        if (!db.objectStoreNames.contains("companies")) {
          db.createObjectStore("companies", { keyPath: "id" });
        }
      },
    });
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.db) await this.connect();
    return this.db!.getAll("users");
  }

  async getUser(id: string): Promise<User | undefined> {
    if (!this.db) await this.connect();
    return this.db!.get("users", id);
  }

  async setUsers(users: User[]) {
    if (!this.db) await this.connect();
    const tx = this.db!.transaction("users", "readwrite");
    await Promise.all([...users.map((user) => tx.store.put(user)), tx.done]);
  }

  async addUser(user: User) {
    if (!this.db) await this.connect();
    await this.db!.put("users", user);
  }

  async updateUser(user: User) {
    if (!this.db) await this.connect();
    await this.db!.put("users", user);
  }

  async deleteUser(id: string) {
    if (!this.db) await this.connect();
    await this.db!.delete("users", id);
  }

  async getCompanies(): Promise<Company[]> {
    if (!this.db) await this.connect();
    return this.db!.getAll("companies");
  }

  async setCompanies(companies: Company[]) {
    if (!this.db) await this.connect();
    const tx = this.db!.transaction("companies", "readwrite");
    await Promise.all([
      ...companies.map((company) => tx.store.put(company)),
      tx.done,
    ]);
  }

  async clearAll() {
    if (!this.db) await this.connect();
    const tx = this.db!.transaction(["users", "companies"], "readwrite");
    await Promise.all([
      tx.objectStore("users").clear(),
      tx.objectStore("companies").clear(),
      tx.done,
    ]);
  }
}

export const usersDB = new UsersDB();
