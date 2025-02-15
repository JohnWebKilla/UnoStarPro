// Create a new file for shared types
export interface Reaction {
  emoji: string;
  users: { id: string; name: string }[];
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  read: boolean;
  edited?: boolean;
  replyTo?: string;
  files?: {
    name: string;
    url: string;
    type: "image" | "document";
  }[];
  reactions?: Reaction[];
}

export interface ChatGroup {
  id: string;
  name: string;
  type: "office" | "drivers";
  isGroup: boolean;
  members: {
    id: string;
    name: string;
    role: "admin" | "member";
    type: "driver" | "user";
  }[];
  lastMessage?: Message;
  unreadCount: number;
  messages: Message[];
}
