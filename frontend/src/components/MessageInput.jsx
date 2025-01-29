import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { 
  Paperclip, 
  Send, 
  X, 
  Smile, 
  ImageIcon,  // Changed from Image
  Video, 
  FileText, 
  File, 
  Contact
} from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { sendMessage, selectedUser } = useChatStore();

  const fileTypes = {
    image: {
      icon: ImageIcon,
      accept: "image/*",
      label: "Photo",
      maxSize: 10 * 1024 * 1024, // 10MB
      error: "Image size should be less than 10MB"
    },
    video: {
      icon: Video,
      accept: "video/*",
      label: "Video",
      maxSize: 50 * 1024 * 1024, // 50MB
      error: "Video size should be less than 50MB"
    },
    document: {
      icon: FileText,
      accept: ".doc,.docx,.pdf,.txt",
      label: "Document",
      maxSize: 25 * 1024 * 1024, // 25MB
      error: "Document size should be less than 25MB"
    },
    zip: {
      icon: File,
      accept: ".zip,.rar,.7z",
      label: "Compressed",
      maxSize: 100 * 1024 * 1024, // 100MB
      error: "File size should be less than 100MB"
    },
    contact: {
      icon: Contact,
      accept: ".vcf",
      label: "Contact",
      maxSize: 1 * 1024 * 1024, // 1MB
      error: "Contact file size should be less than 1MB"
    }
  };

  const handleFileChange = async (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    const type = fileTypes[fileType];
    if (file.size > type.maxSize) {
      toast.error(type.error);
      return;
    }

    if (fileType === 'image') {
      handleImagePreview(file);
    } else {
      handleOtherFiles(file, fileType);
    }
    
    setShowFileOptions(false);
  };

  const handleImagePreview = (file) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Failed to process image");
      console.error("Image processing error:", error);
      setImagePreview(null);
    }
  };

  const handleOtherFiles = (file, fileType) => {
    toast.success(`${fileTypes[fileType].label} selected: ${file.name}`);
  };

  const onEmojiClick = (emojiObject) => {
    setText(prevText => prevText + emojiObject.emoji);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) {
      toast.error("Cannot send an empty message");
      return;
    }

    if (!selectedUser) {
      toast.error("Please select a user to send message");
      return;
    }

    setIsLoading(true);
    try {
      const messageData = {
        text: text.trim(),
        image: imagePreview,
      };

      const result = await sendMessage(messageData);
      
      if (result) {
        setText("");
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error("Message sent but failed to update UI. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
      if (!e.target.closest('.file-options-container')) {
        setShowFileOptions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {/* Changed from img to regular HTML img element */}
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 relative">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-md px-4 py-2"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading}
          />
          
          <div className="relative emoji-picker-container">
            <button
              type="button"
              className="btn btn-circle btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker(!showEmojiPicker);
              }}
            >
              <Smile size={20} />
            </button>
            
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  width={320}
                  height={400}
                  searchPlaceholder="Search emojis..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>

          <div className="relative file-options-container">
            <button
              type="button"
              className="btn btn-circle btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowFileOptions(!showFileOptions);
              }}
            >
              <Paperclip size={20} />
            </button>

            {showFileOptions && (
              <div className="absolute bottom-full right-0 mb-2 bg-base-200 rounded-lg shadow-lg py-2 min-w-[200px]">
                {Object.entries(fileTypes).map(([key, value]) => {
                  const IconComponent = value.icon;
                  return (
                    <div key={key} className="relative">
                      <input
                        type="file"
                        accept={value.accept}
                        className="hidden"
                        id={`file-${key}`}
                        onChange={(e) => handleFileChange(e, key)}
                      />
                      <label
                        htmlFor={`file-${key}`}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-base-300 cursor-pointer"
                      >
                        <IconComponent size={18} />
                        <span>{value.label}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className={`btn btn-circle btn-sm ${isLoading ? "loading" : ""}`}
          disabled={(!text.trim() && !imagePreview) || isLoading}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;