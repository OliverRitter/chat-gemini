"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/use-chat-store";
// 🚀 IMPORT THE CLEAN PORTAL PICKER LIBRARY
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";

interface ChatInputBarProps {
  activeChannelId: string;
}

export function ChatInputBar({ activeChannelId }: ChatInputBarProps) {
  const [typedMessage, setTypedMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const socket = useChatStore((state) => state.socket);

  // Close the popup picker automatically if a user clicks outside of it
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showEmojiPicker]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket) return;
    if (!typedMessage.trim() || !activeChannelId) return;

    socket.emit("send_message", {
      channelId: activeChannelId,
      content: typedMessage.trim(),
    });
    setTypedMessage("");
    setShowEmojiPicker(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // 🚀 CLEAN EMOJI CLICK HANDLER
  const handleSelectEmoji = (emojiData: EmojiClickData) => {
    const input = inputRef.current;
    if (!input) return;

    const selectionStart = input.selectionStart || 0;
    const selectionEnd = input.selectionEnd || 0;

    // Insert the picked emoji directly at the cursor selection point
    const newText =
      typedMessage.substring(0, selectionStart) +
      emojiData.emoji +
      typedMessage.substring(selectionEnd);

    setTypedMessage(newText);

    // Maintain focus and put the cursor right after the newly inserted character
    setTimeout(() => {
      input.focus();
      const newCursorPos = selectionStart + emojiData.emoji.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId || !socket) return;

    setIsUploading(true);
    setShowEmojiPicker(false);
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

      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <form
      onSubmit={handleSendMessage}
      className="p-4 border-t border-zinc-800 flex items-center gap-2 bg-zinc-950 w-full shrink-0 relative"
    >
      {/* 🚀 FLOATING PORTAL PICKER INTERFACE (Kept isolated and out of line) */}
      {showEmojiPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-20 left-4 z-50 shadow-2xl"
        >
          <EmojiPicker
            theme={Theme.DARK} // Enforces premium dark-mode styling matches
            onEmojiClick={handleSelectEmoji}
            searchPlaceholder="Search emojis..."
            width={320}
            height={400}
            skinTonesDisabled={true} // Simplifies UI panel layout footprints
          />
        </div>
      )}

      {/* TOGGLE PICKER BUTTON */}
      <button
        type="button"
        disabled={isUploading}
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        className={`bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-4 py-2 rounded-md text-sm font-medium border border-zinc-800 transition-colors select-none flex items-center justify-center min-w-[40px] h-[38px] ${showEmojiPicker ? "border-blue-500 bg-zinc-800" : ""}`}
      >
        😀
      </button>

      {/* MEDIA MEDIA FILE INPUT ATTACHMENT */}
      <label
        className={`cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-4 py-2 rounded-md text-sm font-medium border border-zinc-800 transition-colors select-none flex items-center justify-center min-w-[40px] h-[38px] ${isUploading ? "opacity-40 pointer-events-none" : ""}`}
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

      {/* CHAT CHAT TEXT FIELD */}
      <input
        ref={inputRef}
        type="text"
        placeholder={
          isUploading ? "Processing upload..." : "Type your message..."
        }
        value={typedMessage}
        disabled={isUploading}
        onChange={(e) => setTypedMessage(e.target.value)}
        className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
      />

      <Button
        type="submit"
        disabled={isUploading || !typedMessage.trim()}
        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 h-[38px] transition-colors"
      >
        Send
      </Button>
    </form>
  );
}
