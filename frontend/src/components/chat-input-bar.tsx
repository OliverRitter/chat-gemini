"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/use-chat-store";
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

  // 🚀 ATOMIC REFS ADDED TO DEBOUNCE KEYSTROKE SOCKET EMISSIONS
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const socket = useChatStore((state) => state.socket);

  // 🚀 THE CENTRAL TYPING EMITTER FUNCTION
  const emitTypingNotification = (isCurrentlyTyping: boolean) => {
    if (!socket || !activeChannelId) return;

    // Guard Clause: Only hit the websocket link if the state boundary crosses!
    if (isTypingRef.current !== isCurrentlyTyping) {
      isTypingRef.current = isCurrentlyTyping;
      socket.emit("typing_update", {
        channelId: activeChannelId,
        isTyping: isCurrentlyTyping,
      });
    }
  };

  // 🚀 INTERCEPT TEXT VALUE CHANGES FOR ACTIVE DEBOUNCED MONITORING
  const handleTextChange = (textValue: string) => {
    setTypedMessage(textValue);

    if (textValue.trim().length > 0) {
      emitTypingNotification(true);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // Cooldown timer window: If they stop typing for 3 seconds, turn off the indicator
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingNotification(false);
      }, 3000);
    } else {
      // If the field becomes completely empty, clear indicators immediately
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTypingNotification(false);
    }
  };

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

  // 🚀 HOUSEKEEPING PROTECTION EFFECT:
  // Instantly turns off indicators if a user hops rooms or unmounts while mid-sentence
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (socket && activeChannelId && isTypingRef.current) {
        socket.emit("typing_update", {
          channelId: activeChannelId,
          isTyping: false,
        });
      }
      isTypingRef.current = false;
    };
  }, [activeChannelId, socket]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault(); // Guaranteed to run safely now!

    if (!socket) return;
    if (!typedMessage.trim() || !activeChannelId) return;

    socket.emit("send_message", {
      channelId: activeChannelId,
      content: typedMessage.trim(),
    });

    // RESET INDICATORS ON SUCCESSFUL MESSAGE TRANSMIT
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTypingNotification(false);

    setTypedMessage("");
    setShowEmojiPicker(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSelectEmoji = (emojiData: EmojiClickData) => {
    const input = inputRef.current;
    if (!input) return;

    const selectionStart = input.selectionStart || 0;
    const selectionEnd = input.selectionEnd || 0;

    const newText =
      typedMessage.substring(0, selectionStart) +
      emojiData.emoji +
      typedMessage.substring(selectionEnd);

    // 🚀 Update text and trigger standard typing timers for emojis too
    handleTextChange(newText);

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
      {showEmojiPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-20 left-4 z-50 shadow-2xl"
        >
          <EmojiPicker
            theme={Theme.DARK}
            onEmojiClick={handleSelectEmoji}
            searchPlaceholder="Search emojis..."
            width={320}
            height={400}
            skinTonesDisabled={true}
          />
        </div>
      )}

      <button
        type="button"
        disabled={isUploading}
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        className={`bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-4 py-2 rounded-md text-sm font-medium border border-zinc-800 transition-colors select-none flex items-center justify-center min-w-[40px] h-[38px] ${showEmojiPicker ? "border-blue-500 bg-zinc-800" : ""}`}
      >
        😀
      </button>

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

      <input
        ref={inputRef}
        type="text"
        placeholder={
          isUploading ? "Processing upload..." : "Type your message..."
        }
        value={typedMessage}
        disabled={isUploading}
        onChange={(e) => handleTextChange(e.target.value)} // 🚀 INTERCEPT KEYSTROKE CHANGES SAFELY
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
