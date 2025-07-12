"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Image, Hash } from 'lucide-react';

interface Tag {
  name: string;
  color: string;
}

interface FormData {
  title: string;
  content: string;
  imageUrl: string;
  tags: Tag[];
}

interface InitialData {
  title?: string;
  content?: string;
  imageUrl?: string;
  tags?: Tag[];
}

interface QuestionFormProps {
  questionId?: string;
  initialData?: InitialData | null;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ questionId = '1', initialData = null }) => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    content: '',
    imageUrl: '',
    tags: []
  });
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Predefined tag colors for variety
  const tagColors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-yellow-100 text-yellow-800',
    'bg-red-100 text-red-800',
    'bg-indigo-100 text-indigo-800',
    'bg-pink-100 text-pink-800',
    'bg-orange-100 text-orange-800'
  ];

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        content: initialData.content || '',
        imageUrl: initialData.imageUrl || '',
        tags: initialData.tags || []
      });
    }
  }, [initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.some(tag => tag.name === newTag.trim())) {
      const colorIndex = formData.tags.length % tagColors.length;
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, { name: newTag.trim(), color: tagColors[colorIndex] }]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag.name !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      setIsLoading(false);
      return;
    }

    if (!formData.content.trim()) {
      setError('Content is required');
      setIsLoading(false);
      return;
    }

    try {
      // Prepare data for API
      const submitData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        imageUrl: formData.imageUrl.trim() || null,
        tags: formData.tags.map(tag => tag.name)
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In real implementation, you would call:
      // const response = await fetch(`/api/questions/${questionId}`, {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(submitData),
      // });

      setSuccess('Question updated successfully!');
      console.log('Form submitted:', submitData);
      
    } catch (err) {
      setError('Failed to update question. Please try again.');
      console.error('Submit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-bold text-gray-900 mb-2">
            Edit Question
          </h1>
          <p className="text-sm font-mono text-gray-600">
            Update your question details below
          </p>
        </div>

        <div className="space-y-6" onSubmit={handleSubmit}>
          {/* Title */}
          <div>
            <label className="block text-sm font-mono font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter question title..."
              className="w-full px-3 py-2 font-mono text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder-gray-400"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-mono font-medium text-gray-700 mb-2">
              Content *
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="Describe your question in detail..."
              rows={8}
              className="w-full px-3 py-2 font-mono text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder-gray-400 resize-none"
              required
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-mono font-medium text-gray-700 mb-2">
              <Image className="inline w-4 h-4 mr-1" />
              Image URL
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 font-mono text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder-gray-400"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-mono font-medium text-gray-700 mb-2">
              <Hash className="inline w-4 h-4 mr-1" />
              Tags
            </label>
            
            {/* Tag Input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 font-mono text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-900 text-white font-mono text-sm hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tags Display */}
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className={`inline-flex items-center px-3 py-1 text-xs font-mono font-medium ${tag.color} rounded-full`}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.name)}
                    className="ml-2 text-current hover:text-gray-600 focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200">
              <p className="text-sm font-mono text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200">
              <p className="text-sm font-mono text-green-800">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-900 text-white font-mono text-sm hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Updating...' : 'Update Question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionForm;