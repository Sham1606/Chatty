import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

const EditMessagePopup = ({ message, onConfirm, onCancel }) => {
  const [editedText, setEditedText] = useState(message.text);
  
  const handleConfirm = () => {
    if (editedText.trim() === '') {
      toast.error("Message cannot be empty");
      return;
    }
    onConfirm(editedText);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">Edit Message</h3>
        <textarea
          className="w-full bg-gray-700 rounded p-3 mb-4 text-white"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows="4"
        />
        <div className="flex gap-3">
          <button
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded"
            onClick={handleConfirm}
          >
            Save Changes
          </button>
          <button
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditMessagePopup;