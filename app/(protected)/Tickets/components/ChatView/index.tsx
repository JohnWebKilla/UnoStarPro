"use client";

import * as React from "react";
import { useState } from "react";
import { Message, ChatGroup } from "../types";
import { ChatViewUI } from "./ChatViewUI";

interface ChatViewProps {
  selectedGroup: ChatGroup;
  onBack: () => void;
  onSendMessage: (message: Message) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onUpdateGroup: (groupId: string, updates: any) => void;
  onAddMember: (groupId: string, memberId: string) => void;
  onRemoveMember: (groupId: string, memberId: string) => void;
  userRole: string;
}

export default function ChatView(props: ChatViewProps): JSX.Element {
  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const newMsg: Message = {
        id: `msg${Date.now()}`,
        content: "",
        sender: "You",
        timestamp: new Date(),
        read: true,
        files: [
          {
            name: file.name,
            url: URL.createObjectURL(file),
            type: isImage ? "image" : "document",
          },
        ],
      };
      props.onSendMessage(newMsg);
    });
  };

  return (
    <ChatViewUI
      {...props}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      replyingTo={replyingTo}
      setReplyingTo={setReplyingTo}
      handleFileUpload={handleFileUpload}
    />
  );
}
