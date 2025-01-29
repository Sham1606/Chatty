import React from 'react';
import { FaUserSlash, FaTrashAlt, FaTimes } from 'react-icons/fa';

const DeleteMessagePopup = ({ onDelete, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      {/* <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-1 rounded-lg shadow-2xl w-full max-w-sm"> */}
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">
            <div className="flex items-center justify-center bg-red-100 rounded-full w-16 h-16 mx-auto mb-4">
              <FaTrashAlt className="text-red-500 w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800">Delete Message</h3>
            <p className="text-sm text-gray-600 mt-2">
              This action cannot be undone. Please choose carefully.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <button
              className="flex items-center justify-center w-full px-4 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform transform hover:scale-105"
              onClick={() => onDelete('me')}
            >
              <FaUserSlash className="mr-2 w-5 h-5" />
              Delete for Me
            </button>
            <button
              className="flex items-center justify-center w-full px-4 py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-300 transition-transform transform hover:scale-105"
              onClick={() => onDelete('everyone')}
            >
              <FaTrashAlt className="mr-2 w-5 h-5" />
              Delete for Everyone
            </button>
            <button
              className="flex items-center justify-center w-full px-4 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-300 transition-transform transform hover:scale-105"
              onClick={onCancel}
            >
              <FaTimes className="mr-2 w-5 h-5" />
              Cancel
            </button>
          </div>
        {/* </div> */}
      </div>
    </div>
  );
};

export default DeleteMessagePopup;
