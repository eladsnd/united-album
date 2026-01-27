import { useState } from 'react';

/**
 * Reusable form state management for admin CRUD operations
 *
 * @param {object} initialFormData - Initial form values
 * @param {function} onSubmit - Submit handler (async)
 * @param {function} onSuccess - Success callback
 * @returns {object} Form state and handlers
 */
export function useAdminForm(initialFormData, onSubmit, onSuccess) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const openAddForm = () => {
    setEditingItem(null);
    setFormData(initialFormData);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (item, transformFn) => {
    setEditingItem(item);
    setFormData(transformFn ? transformFn(item) : item);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(initialFormData);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      await onSubmit(formData, editingItem);
      if (onSuccess) onSuccess();
      closeForm();
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  return {
    showForm,
    editingItem,
    formData,
    setFormData,
    formError,
    formLoading,
    openAddForm,
    openEditForm,
    closeForm,
    handleSubmit,
  };
}
