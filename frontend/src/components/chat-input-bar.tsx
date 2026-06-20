"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/use-chat-store";

interface ChatInputBarProps {
  activeChannelId: string;
}

export function ChatInputBar({ activeChannelId }: ChatInputBarProps) {
  const [typedMessage, setTypedMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 🚀 1. Declared text input DOM reference variable
  const inputRef = useRef<HTMLInputElement | null>(null);

  const socket = useChatStore((state) => state.socket);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket) return;
    if (!typedMessage.trim() || !activeChannelId) return;

    socket.emit("send_message", {
      channelId: activeChannelId,
      content: typedMessage.trim(),
    });
    setTypedMessage("");

    // 🚀 2. Enforce instant input ref refocusing on submission
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId || !socket) return;

    setIsUploading(true);
    try {
      const signResponse = await fetch("/api/media/sign", { method: "POST" });
      const signData = await signResponse.json();
      if (signData.error) throw new Error(signData.error);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", signData.timestamp);
      formData.append("signature", signData.signature);
      formData.append("folder", "chat_attachments");

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`;

      const uploadResponse = await fetch(cloudinaryUrl, {
        method: "POST",
        body: formData,
      });
      const uploadedAsset = await uploadResponse.json();

      if (uploadedAsset.secure_url) {
        socket.emit("send_message", {
          channelId: activeChannelId,
          content: `🖼️ Attached Image: ${uploadedAsset.secure_url}`,
        });
      }
    } catch (err) {
      console.error("Media upload error:", err);
      alert("Media upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // 🚀 3. Enforce input refocusing after file upload pipelines complete
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <form
      onSubmit={handleSendMessage}
      className="p-4 border-t border-border flex items-center gap-2 bg-card w-full shrink-0"
    >
      <label
        className={`cursor-pointer bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-md text-sm font-medium border transition-colors select-none flex items-center justify-center min-w-[40px] h-[38px] ${isUploading ? "opacity-40 pointer-events-none" : ""}`}
      >
        {isUploading ? "⏳" : "📎"}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isUploading}
          onChange={handleFileUpload}
        />
      </label>
      <input
        ref={inputRef} // 🚀 4. Bound reference link to the input node element
        type="text"
        placeholder={
          isUploading ? "Processing upload..." : "Type your message..."
        }
        value={typedMessage}
        disabled={isUploading}
        onChange={(e) => setTypedMessage(e.target.value)}
        className="flex-1 min-w-0 bg-background border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none"
      />
      <Button type="submit" disabled={isUploading || !typedMessage.trim()}>
        Send
      </Button>
    </form>
  );
}

//;
