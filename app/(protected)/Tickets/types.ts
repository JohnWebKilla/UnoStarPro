export interface SystemIssue {
  id: string;
  timestamp: Date;
  company: string;
  driver: string;
  systemType: "android" | "ios" | "web";
  description: string;
  status: "open" | "in progress" | "resolved";
  files: {
    name: string;
    url: string;
  }[];
}

export interface Ticket {
  id: number;
  timestamp: Date;
  company: string;
  driver: string;
  services: string;
  dispatcher: string;
  dispatchNote: string;
  editor: string;
  editorNote: string;
  managerNote: string;
  duration: string;
  status: string;
  joinedAt?: Date;
  closedAt?: Date;
  notifiedAt?: Date;
  confirmedAt?: Date;
  beforePdf?: string;
  afterPdf?: string;
}
